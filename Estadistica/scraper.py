import json
from datetime import date, datetime, time, timedelta, timezone
from email.utils import format_datetime

import requests
from sqlalchemy import delete

from config import (
    LOCAL_TIMEZONE,
    SHIFT_END_HOUR,
    SHIFT_START_HOUR,
    get_history_start_date,
    get_runtime_setting,
)
from database import ensure_schema, get_database_url, get_engine, get_storage_label, get_table

API_BASE_URL = "https://api-prod.nucleocheck.com"
ORIGIN_URL = "https://prod.nucleocheck.com"

LOCATIONS = {
    "palermo": {
        "name": "Santa Cebada - Palermo",
        "company_id": 827,
        "email_secret": "NUCLEO_EMAIL_PALERMO",
        "password_secret": "NUCLEO_PASSWORD_PALERMO",
    },
    "recoleta": {
        "name": "Santa Cebada - Recoleta",
        "company_id": 1041,
        "email_secret": "NUCLEO_EMAIL_RECOLETA",
        "password_secret": "NUCLEO_PASSWORD_RECOLETA",
    },
}

LOCATION_ALIASES = {
    "1": "palermo",
    "palermo": "palermo",
    "santa cebada - palermo": "palermo",
    "santa cebada palermo": "palermo",
    "2": "recoleta",
    "recoleta": "recoleta",
    "santa cebada - recoleta": "recoleta",
    "santa cebada recoleta": "recoleta",
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) "
    "Gecko/20100101 Firefox/129.0"
)


def get_db_path(_location_key=None):
    return get_database_url()


def get_secret_value(secret_name):
    return get_runtime_setting(secret_name)


def get_location_config(location_key):
    if location_key not in LOCATIONS:
        raise ValueError(f"Local invalido: {location_key}")

    location = dict(LOCATIONS[location_key])
    location["key"] = location_key
    location["db_path"] = get_db_path(location_key)
    location["email"] = get_secret_value(location["email_secret"])
    location["password"] = get_secret_value(location["password_secret"])
    return location


def ensure_location_credentials(location):
    if location.get("email") and location.get("password"):
        return location

    missing = []
    if not location.get("email"):
        missing.append(location["email_secret"])
    if not location.get("password"):
        missing.append(location["password_secret"])

    raise RuntimeError(
        "Faltan credenciales para "
        f"{location['name']}. Configura estos secretos: {', '.join(missing)}."
    )


def get_all_locations():
    return [get_location_config(location_key) for location_key in LOCATIONS]


def resolve_location_choice(choice):
    normalized_choice = str(choice or "").strip().lower()
    location_key = LOCATION_ALIASES.get(normalized_choice)
    if not location_key:
        raise ValueError(f"Local invalido: {choice}")
    return get_location_config(location_key)


def prompt_location_cli():
    print("Seleccion de local:")
    print("1. Santa Cebada - Palermo")
    print("2. Santa Cebada - Recoleta")

    while True:
        choice = input("Elegi el local: ").strip()
        if not choice:
            return get_location_config("palermo")
        try:
            return resolve_location_choice(choice)
        except ValueError as exc:
            print(exc)


def init_db(db_path):
    # keep the same interface used by the app
    ensure_schema()


def build_base_headers():
    return {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": ORIGIN_URL,
        "Referer": ORIGIN_URL,
    }


def ensure_local_datetime(value):
    if value is None:
        return datetime.now(LOCAL_TIMEZONE)
    if value.tzinfo is None:
        return value.replace(tzinfo=LOCAL_TIMEZONE)
    return value.astimezone(LOCAL_TIMEZONE)


def format_api_datetime(local_dt):
    utc_dt = local_dt.astimezone(timezone.utc)
    return format_datetime(utc_dt, usegmt=True)


def build_shift_range_for_date(target_date):
    start_local = datetime.combine(
        target_date,
        time(hour=SHIFT_START_HOUR),
        tzinfo=LOCAL_TIMEZONE,
    )
    end_local = datetime.combine(
        target_date + timedelta(days=1),
        time(hour=SHIFT_END_HOUR),
        tzinfo=LOCAL_TIMEZONE,
    )
    return start_local, end_local


def build_specific_day_range(target_date):
    return build_shift_range_for_date(target_date)


def build_today_shift_range(now=None):
    local_now = ensure_local_datetime(now)
    business_date = local_now.date()

    if local_now.time() < time(hour=SHIFT_START_HOUR):
        business_date = business_date - timedelta(days=1)

    start_local, end_local = build_shift_range_for_date(business_date)
    return start_local, min(local_now, end_local)


def build_week_range(reference_date=None):
    base_date = reference_date or datetime.now(LOCAL_TIMEZONE).date()
    if isinstance(base_date, datetime):
        base_date = ensure_local_datetime(base_date).date()
    week_start = base_date - timedelta(days=base_date.weekday())
    week_end = week_start + timedelta(days=7)

    start_local = datetime.combine(
        week_start,
        time(hour=SHIFT_START_HOUR),
        tzinfo=LOCAL_TIMEZONE,
    )
    end_local = datetime.combine(
        week_end,
        time(hour=SHIFT_END_HOUR),
        tzinfo=LOCAL_TIMEZONE,
    )
    return start_local, end_local


def build_month_range(year, month):
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    start_local = datetime.combine(
        start_date,
        time(hour=SHIFT_START_HOUR),
        tzinfo=LOCAL_TIMEZONE,
    )
    end_local = datetime.combine(
        end_date,
        time(hour=SHIFT_END_HOUR),
        tzinfo=LOCAL_TIMEZONE,
    )
    return start_local, end_local


def build_historical_range(start_date=None, now=None):
    history_start = start_date or get_history_start_date()
    start_local = datetime.combine(
        history_start,
        time(hour=SHIFT_START_HOUR),
        tzinfo=LOCAL_TIMEZONE,
    )
    current_end = ensure_local_datetime(now)
    return start_local, current_end


def login_user(session, company_id, email, password):
    url = f"{API_BASE_URL}/Account/LoginUser"
    payload = {
        "CompanyId": company_id,
        "EmailUser": email,
        "IsUserCheck": True,
        "Password": password,
    }

    headers = build_base_headers()
    headers["Authorization"] = "Bearer"

    response = session.post(url, headers=headers, json=payload, timeout=30)
    response.raise_for_status()

    data = response.json()
    token = data.get("Token")
    if not token:
        raise RuntimeError(f"Login sin token. Respuesta: {data}")

    return token, data


def validate_token(session, token):
    url = f"{API_BASE_URL}/Account/ValidateToken"
    headers = build_base_headers()
    headers["Authorization"] = f"Bearer {token}"
    headers["jwt-Token"] = token

    response = session.post(url, headers=headers, timeout=30)
    response.raise_for_status()

    data = response.json()
    new_token = data.get("NewToken")
    if not new_token:
        raise RuntimeError(f"ValidateToken sin NewToken. Respuesta: {data}")

    return new_token, data


def build_auth_headers(token):
    headers = build_base_headers()
    headers["Authorization"] = f"Bearer {token}"
    headers["jwt-Token"] = token
    headers.pop("Content-Type", None)
    return headers


def get_order_history(session, token, start_local, end_local):
    url = f"{API_BASE_URL}/OrderHistory/GetOrderHistory"
    params = {
        "DateFrom": format_api_datetime(start_local),
        "DateTo": format_api_datetime(end_local),
        "HourFrom": 0,
        "MinuteFrom": 0,
        "HourTo": 23,
        "MinuteTo": 59,
        "IsUseTimeRange": "false",
        "CustomerId": "undefined",
        "IsOnlyVIPCustomer": "false",
        "ActivationState": 1,
        "OrderType": "undefined",
        "IsShowOnlyUnpaidSales": "false",
        "TotalFrom": "",
        "TotalTo": "",
        "OrderNumber": "",
        "OpenUserId": "undefined",
        "FinisherUserId": "undefined",
        "SaleChannelId": "undefined",
        "BranchId": "undefined",
        "DayOfWeek": "undefined",
    }

    response = session.get(url, headers=build_auth_headers(token), params=params, timeout=60)
    response.raise_for_status()
    return response.url, response.json()


def get_sales_payment_methods(session, token, start_local, end_local):
    url = f"{API_BASE_URL}/Stats/GetSalesPaymentMethods/"
    params = {
        "StartDate": format_api_datetime(start_local),
        "EndDate": format_api_datetime(end_local),
        "UseTimeRange": "false",
    }

    response = session.get(url, headers=build_auth_headers(token), params=params, timeout=60)
    response.raise_for_status()
    return response.url, response.json()


def get_sales_by_product_stats(session, token, start_local, end_local, date_grouping=0):
    url = f"{API_BASE_URL}/Stats/GetSalesByProductStats/"
    params = {
        "StartDate": format_api_datetime(start_local),
        "EndDate": format_api_datetime(end_local),
        "UseTimeRange": "false",
        "DateGrouping": date_grouping,
        "OnlyProductsSendUnitAlax": "false",
        "IsBreakDownPromotions": "false",
    }

    response = session.get(url, headers=build_auth_headers(token), params=params, timeout=60)
    response.raise_for_status()
    return response.url, response.json()


def get_expenses(session, token, start_local, end_local):
    url = f"{API_BASE_URL}/Expense/Find"
    params = {
        "DateFrom": format_api_datetime(start_local),
        "DateTo": format_api_datetime(end_local),
        "IsUseTimeRange": "false",
        "ExpenseTypeId": 0,
        "ActivationState": "true",
    }

    response = session.get(url, headers=build_auth_headers(token), params=params, timeout=60)
    response.raise_for_status()
    return response.url, response.json()


def derive_orders_from_payment_items(payment_data):
    items = payment_data.get("Items", []) if isinstance(payment_data, dict) else []
    unique_orders = {}

    for item in items:
        order_id = item.get("OrderId")
        if order_id is None:
            continue

        order_key = str(order_id)
        if order_key not in unique_orders:
            unique_orders[order_key] = {
                "Number": order_key,
                "Date": item.get("Date"),
                "CustomerName": item.get("Customer", ""),
                "SubTotal": "",
                "ShippingPrice": 0,
                "DiscountTotal": 0,
                "Total": float(item.get("Total") or 0),
                "TotalPaid": float(item.get("Total") or 0),
                "Balance": 0,
                "ActivationStateName": "Facturado",
            }

    return list(unique_orders.values())


def split_business_ranges(start_local, end_local):
    ranges = []
    current_date = (start_local.date() - timedelta(days=1)) if start_local.time() < time(hour=SHIFT_START_HOUR) else start_local.date()

    while True:
        shift_start, shift_end = build_shift_range_for_date(current_date)
        if shift_start >= end_local:
            break

        intersection_start = max(start_local, shift_start)
        intersection_end = min(end_local, shift_end)
        if intersection_start < intersection_end:
            ranges.append((intersection_start, intersection_end))

        current_date += timedelta(days=1)
        if current_date > end_local.date() + timedelta(days=1):
            break

    return ranges or [(start_local, end_local)]


def merge_payment_payloads(payment_payloads):
    merged_payload = {"Items": [], "Total": 0.0}
    for payload in payment_payloads:
        if not isinstance(payload, dict):
            continue
        merged_payload["Items"].extend(payload.get("Items", []))
        merged_payload["Total"] += float(payload.get("Total", 0) or 0)
        for key, value in payload.items():
            if key not in {"Items", "Total"} and key not in merged_payload:
                merged_payload[key] = value
    return merged_payload


def merge_product_payloads(product_payloads):
    merged_items = {}
    base_payload = {}

    for payload in product_payloads:
        if not isinstance(payload, dict):
            continue

        if not base_payload:
            base_payload = {key: value for key, value in payload.items() if key != "Items"}

        for item in payload.get("Items", []):
            key = (str(item.get("Code", "")), str(item.get("Name", "")))
            current = merged_items.setdefault(
                key,
                {
                    "Code": key[0],
                    "Name": key[1],
                    "Quantity": 0.0,
                    "Total": 0.0,
                    "AlaxUnits": 0.0,
                },
            )
            current["Quantity"] += float(item.get("Quantity", 0) or 0)
            current["Total"] += float(item.get("Total", 0) or 0)
            current["AlaxUnits"] += float(item.get("AlaxUnits", 0) or 0)

    base_payload["Items"] = list(merged_items.values())
    return base_payload


def merge_fetch_bundles(bundles, start_local, end_local, location, db_path):
    if not bundles:
        return {
            "location": location,
            "db_path": db_path,
            "start_local": start_local,
            "end_local": end_local,
            "login": {},
            "validation": {},
            "orders": [],
            "payments": {"Items": [], "Total": 0.0},
            "products": {"Items": []},
            "expenses": [],
        }

    last_bundle = bundles[-1]
    merged_orders = []
    merged_expenses = []
    for bundle in bundles:
        if isinstance(bundle.get("orders"), list):
            merged_orders.extend(bundle["orders"])
        if isinstance(bundle.get("expenses"), list):
            merged_expenses.extend(bundle["expenses"])

    return {
        "location": location,
        "db_path": db_path,
        "start_local": start_local,
        "end_local": end_local,
        "login": last_bundle.get("login", {}),
        "validation": last_bundle.get("validation", {}),
        "login_endpoint": last_bundle.get("login_endpoint", "Account/LoginUser"),
        "validation_endpoint": last_bundle.get("validation_endpoint", "Account/ValidateToken"),
        "order_endpoint": last_bundle.get("order_endpoint", "OrderHistory/GetOrderHistory"),
        "payment_endpoint": last_bundle.get("payment_endpoint", "Stats/GetSalesPaymentMethods"),
        "product_endpoint": last_bundle.get("product_endpoint", "Stats/GetSalesByProductStats"),
        "expense_endpoint": last_bundle.get("expense_endpoint", "Expense/Find"),
        "orders": merged_orders,
        "payments": merge_payment_payloads([bundle.get("payments") for bundle in bundles]),
        "products": merge_product_payloads([bundle.get("products") for bundle in bundles]),
        "expenses": merged_expenses,
    }


def delete_snapshot_rows(conn, table_name, location_key, start_local=None, end_local=None):
    conditions = [get_table(table_name).c.location_key == location_key]
    if start_local is not None:
        conditions.append(get_table(table_name).c.period_start == start_local.isoformat())
    elif end_local is not None:
        conditions.append(get_table(table_name).c.period_end == end_local.isoformat())
    conn.execute(delete(get_table(table_name)).where(*conditions))


def replace_pedidos(conn, location, start_local, end_local, order_history, payment_data, fetched_at):
    delete_snapshot_rows(conn, "pedidos", location["key"], start_local, end_local)
    source_items = order_history if isinstance(order_history, list) and order_history else None
    if source_items is None:
        source_items = derive_orders_from_payment_items(payment_data)

    rows = [
        {
            "location_key": location["key"],
            "location_name": location["name"],
            "company_id": location["company_id"],
            "period_start": start_local.isoformat(),
            "period_end": end_local.isoformat(),
            "fecha_scraping": fetched_at,
            "numero": str(item.get("Number", "")),
            "fecha": str(item.get("Date", "")),
            "cliente": str(item.get("CustomerName", "")),
            "subtotal": str(item.get("SubTotal", "")),
            "envio": str(item.get("ShippingPrice", "")),
            "descuento": str(item.get("DiscountTotal", "")),
            "total": str(item.get("Total", "")),
            "total_pagado": str(item.get("TotalPaid", "")),
            "saldo": str(item.get("Balance", "")),
            "estado": str(item.get("ActivationStateName", "")),
        }
        for item in source_items
    ]
    if rows:
        conn.execute(get_table("pedidos").insert(), rows)


def replace_productos(conn, location, start_local, end_local, product_stats, fetched_at):
    delete_snapshot_rows(conn, "productos", location["key"], start_local, end_local)
    items = product_stats.get("Items", []) if isinstance(product_stats, dict) else []
    rows = [
        {
            "location_key": location["key"],
            "location_name": location["name"],
            "company_id": location["company_id"],
            "period_start": start_local.isoformat(),
            "period_end": end_local.isoformat(),
            "fecha_scraping": fetched_at,
            "codigo": str(item.get("Code", "")),
            "nombre": str(item.get("Name", "")),
            "cantidad": str(item.get("Quantity", "")),
            "total": str(item.get("Total", "")),
            "unidades_alax": str(item.get("AlaxUnits", "")),
        }
        for item in items
    ]
    if rows:
        conn.execute(get_table("productos").insert(), rows)


def replace_formas_pago(conn, location, start_local, end_local, payment_data, fetched_at):
    delete_snapshot_rows(conn, "formas_pago", location["key"], start_local, end_local)
    items = payment_data.get("Items", []) if isinstance(payment_data, dict) else []
    rows = [
        {
            "location_key": location["key"],
            "location_name": location["name"],
            "company_id": location["company_id"],
            "period_start": start_local.isoformat(),
            "period_end": end_local.isoformat(),
            "fecha_scraping": fetched_at,
            "nro_pedido": str(item.get("OrderId", "")),
            "fecha": str(item.get("Date", "")),
            "cliente": str(item.get("Customer", "")),
            "total_pedido": str(item.get("Total", "")),
            "forma_pago": str(item.get("PaymentMethod", "")),
            "monto": str(item.get("Amount", "")),
        }
        for item in items
    ]
    if rows:
        conn.execute(get_table("formas_pago").insert(), rows)


def replace_gastos(conn, location, start_local, end_local, expenses, fetched_at):
    delete_snapshot_rows(conn, "gastos", location["key"], start_local, end_local)
    items = expenses if isinstance(expenses, list) else []
    rows = [
        {
            "location_key": location["key"],
            "location_name": location["name"],
            "company_id": location["company_id"],
            "period_start": start_local.isoformat(),
            "period_end": end_local.isoformat(),
            "fecha_scraping": fetched_at,
            "fecha": str(item.get("Date", "")),
            "tipo_gasto": str(item.get("ExpenseTypeName", "")),
            "total": str(item.get("Amount", "")),
            "descripcion": str(item.get("Description", "")),
            "caja": str(item.get("CashDrawerName", "")),
            "estado": "Activo" if item.get("IsActive", True) else "Inactivo",
        }
        for item in items
    ]
    if rows:
        conn.execute(get_table("gastos").insert(), rows)


def sync_bundle_to_db(db_path, location, start_local, end_local, order_history, payment_data, product_stats, expenses):
    fetched_at = datetime.now().isoformat(timespec="seconds")
    with get_engine().begin() as conn:
        replace_pedidos(conn, location, start_local, end_local, order_history, payment_data, fetched_at)
        replace_productos(conn, location, start_local, end_local, product_stats, fetched_at)
        replace_formas_pago(conn, location, start_local, end_local, payment_data, fetched_at)
        replace_gastos(conn, location, start_local, end_local, expenses, fetched_at)


def insert_scrape_run(db_path, location, start_local, end_local, order_history, payment_data, product_stats, expenses):
    orders_count = len(order_history) if isinstance(order_history, list) else 0
    payments_count = len(payment_data.get("Items", [])) if isinstance(payment_data, dict) else 0
    products_count = len(product_stats.get("Items", [])) if isinstance(product_stats, dict) else 0
    expenses_count = len(expenses) if isinstance(expenses, list) else 0
    total_amount = float(payment_data.get("Total", 0) or 0) if isinstance(payment_data, dict) else 0.0

    with get_engine().begin() as conn:
        conn.execute(
            get_table("scrape_runs").insert(),
            {
                "location_key": location["key"],
                "location_name": location["name"],
                "company_id": location["company_id"],
                "period_start": start_local.isoformat(),
                "period_end": end_local.isoformat(),
                "fetched_at": datetime.now().isoformat(timespec="seconds"),
                "orders_count": orders_count,
                "payments_count": payments_count,
                "products_count": products_count,
                "expenses_count": expenses_count,
                "total_amount": total_amount,
            },
        )


def fetch_live_statistics_bundle(start_local, end_local, location, product_date_grouping=0):
    location = ensure_location_credentials(location)

    with requests.Session() as session:
        initial_token, login_data = login_user(session, location["company_id"], location["email"], location["password"])
        validated_token, validate_data = validate_token(session, initial_token)
        order_endpoint, order_history = get_order_history(session, validated_token, start_local, end_local)
        payment_endpoint, payment_data = get_sales_payment_methods(session, validated_token, start_local, end_local)
        product_endpoint, product_stats = get_sales_by_product_stats(session, validated_token, start_local, end_local, date_grouping=product_date_grouping)
        expense_endpoint, expenses = get_expenses(session, validated_token, start_local, end_local)

    return {
        "location": location,
        "db_path": location["db_path"],
        "start_local": start_local,
        "end_local": end_local,
        "login": login_data,
        "validation": validate_data,
        "login_endpoint": "Account/LoginUser",
        "validation_endpoint": "Account/ValidateToken",
        "order_endpoint": order_endpoint,
        "payment_endpoint": payment_endpoint,
        "product_endpoint": product_endpoint,
        "expense_endpoint": expense_endpoint,
        "orders": order_history,
        "payments": payment_data,
        "products": product_stats,
        "expenses": expenses,
    }


def fetch_statistics_bundle(start_local, end_local, location, db_path=None):
    db_path = db_path or location["db_path"]
    init_db(db_path)

    split_ranges = split_business_ranges(start_local, end_local)
    if len(split_ranges) > 1 or split_ranges[0] != (start_local, end_local):
        bundles = [fetch_statistics_bundle(shift_start, shift_end, location, db_path=db_path) for shift_start, shift_end in split_ranges]
        return merge_fetch_bundles(bundles, start_local, end_local, location, db_path)

    bundle = fetch_live_statistics_bundle(start_local, end_local, location)
    login_data = bundle["login"]
    validate_data = bundle["validation"]
    order_history = bundle["orders"]
    payment_data = bundle["payments"]
    product_stats = bundle["products"]
    expenses = bundle["expenses"]

    # keep the audit trail in api_data
    with get_engine().begin() as conn:
        conn.execute(
            get_table("api_data").insert(),
            {
                "location_key": location["key"],
                "location_name": location["name"],
                "company_id": location["company_id"],
                "endpoint": bundle["login_endpoint"],
                "period_start": start_local.isoformat(),
                "period_end": end_local.isoformat(),
                "requested_at": datetime.now().isoformat(timespec="seconds"),
                "data": json.dumps(login_data),
            },
        )
        conn.execute(
            get_table("api_data").insert(),
            {
                "location_key": location["key"],
                "location_name": location["name"],
                "company_id": location["company_id"],
                "endpoint": bundle["validation_endpoint"],
                "period_start": start_local.isoformat(),
                "period_end": end_local.isoformat(),
                "requested_at": datetime.now().isoformat(timespec="seconds"),
                "data": json.dumps(validate_data),
            },
        )
        conn.execute(
            get_table("api_data").insert(),
            {
                "location_key": location["key"],
                "location_name": location["name"],
                "company_id": location["company_id"],
                "endpoint": bundle["order_endpoint"],
                "period_start": start_local.isoformat(),
                "period_end": end_local.isoformat(),
                "requested_at": datetime.now().isoformat(timespec="seconds"),
                "data": json.dumps(order_history),
            },
        )
        conn.execute(
            get_table("api_data").insert(),
            {
                "location_key": location["key"],
                "location_name": location["name"],
                "company_id": location["company_id"],
                "endpoint": bundle["payment_endpoint"],
                "period_start": start_local.isoformat(),
                "period_end": end_local.isoformat(),
                "requested_at": datetime.now().isoformat(timespec="seconds"),
                "data": json.dumps(payment_data),
            },
        )
        conn.execute(
            get_table("api_data").insert(),
            {
                "location_key": location["key"],
                "location_name": location["name"],
                "company_id": location["company_id"],
                "endpoint": bundle["product_endpoint"],
                "period_start": start_local.isoformat(),
                "period_end": end_local.isoformat(),
                "requested_at": datetime.now().isoformat(timespec="seconds"),
                "data": json.dumps(product_stats),
            },
        )
        conn.execute(
            get_table("api_data").insert(),
            {
                "location_key": location["key"],
                "location_name": location["name"],
                "company_id": location["company_id"],
                "endpoint": bundle["expense_endpoint"],
                "period_start": start_local.isoformat(),
                "period_end": end_local.isoformat(),
                "requested_at": datetime.now().isoformat(timespec="seconds"),
                "data": json.dumps(expenses),
            },
        )

    sync_bundle_to_db(db_path, location, start_local, end_local, order_history, payment_data, product_stats, expenses)
    insert_scrape_run(db_path, location, start_local, end_local, order_history, payment_data, product_stats, expenses)

    return {
        "location": location,
        "db_path": db_path,
        "start_local": start_local,
        "end_local": end_local,
        "login": login_data,
        "validation": validate_data,
        "orders": order_history,
        "payments": payment_data,
        "products": product_stats,
        "expenses": expenses,
    }


def fetch_statistics_for_all_locations(start_local, end_local, location_keys=None):
    db_path = get_db_path()
    init_db(db_path)

    selected_keys = location_keys or list(LOCATIONS.keys())
    bundles = []
    for location_key in selected_keys:
        location = get_location_config(location_key)
        bundle = fetch_statistics_bundle(start_local, end_local, location, db_path=db_path)
        bundles.append(bundle)

    return bundles


def summarize_unique_orders(payment_data):
    orders = derive_orders_from_payment_items(payment_data)
    total = sum(float(item.get("Total") or 0) for item in orders)
    return len(orders), total


def main():
    start_local, end_local = build_today_shift_range()
    bundles = fetch_statistics_for_all_locations(start_local, end_local)

    print(f"Base compartida: {get_storage_label()}")
    print(
        "Turno local: "
        f"{start_local.strftime('%d/%m/%Y %H:%M')} -> "
        f"{end_local.strftime('%d/%m/%Y %H:%M')}"
    )

    for bundle in bundles:
        order_count, total_amount = summarize_unique_orders(bundle["payments"])
        print(f"\nLocal: {bundle['location']['name']}")
        print(f"Pedidos unicos: {order_count}")
        print(f"Facturado total: {total_amount:.2f}")

    print("\nCaptura finalizada")


if __name__ == "__main__":
    main()

from datetime import datetime

import pandas as pd

from config import (
    LOCAL_TIMEZONE,
    RUBRO_ORDER,
    UTC_TIMEZONE,
    compute_business_date,
    infer_rubro,
    map_payment_category,
    normalize_text,
    parse_numeric_value,
)
from database import ensure_schema, read_table
HEATMAP_HOURS = list(range(8, 24)) + [0, 1, 2]
HEATMAP_HOUR_LABELS = [f"{hour:02d}:00" for hour in HEATMAP_HOURS]
DAY_NAME_MAP = {
    0: "Lunes",
    1: "Martes",
    2: "Miercoles",
    3: "Jueves",
    4: "Viernes",
    5: "Sabado",
    6: "Domingo",
}
DAY_NAME_ORDER = [DAY_NAME_MAP[index] for index in range(7)]
ANONYMOUS_CUSTOMERS = {
    "",
    "consumidor final",
    "cons final",
    "cf",
    "publico general",
    "anonimo",
    "sin nombre",
}

def parse_numeric_series(series):
    if series.empty:
        return pd.Series(dtype="float64")
    return series.apply(parse_numeric_value).astype("float64")


def parse_datetime_series(series, assume_timezone=LOCAL_TIMEZONE):
    timestamps = pd.to_datetime(series, errors="coerce")
    if getattr(timestamps.dt, "tz", None) is None:
        localized = timestamps.dt.tz_localize(assume_timezone, nonexistent="NaT", ambiguous="NaT")
        if assume_timezone == LOCAL_TIMEZONE:
            return localized
        return localized.dt.tz_convert(LOCAL_TIMEZONE)
    return timestamps.dt.tz_convert(LOCAL_TIMEZONE)

def build_period_columns(df, datetime_column):
    work_df = df.copy()
    if datetime_column not in work_df.columns:
        return work_df

    timestamps = work_df[datetime_column]
    work_df["calendar_date"] = timestamps.dt.date
    work_df["business_date"] = timestamps.apply(compute_business_date)
    work_df["hour"] = timestamps.dt.hour
    work_df["weekday_index"] = timestamps.dt.weekday
    work_df["weekday_name"] = work_df["weekday_index"].map(DAY_NAME_MAP)
    naive_timestamps = timestamps.dt.tz_localize(None)
    work_df["week_start"] = naive_timestamps.dt.to_period("W-MON").dt.start_time.dt.date
    work_df["month_start"] = naive_timestamps.dt.to_period("M").dt.start_time.dt.date
    work_df["month_label"] = naive_timestamps.dt.strftime("%Y-%m")
    return work_df


def clean_customer_name(value):
    raw_value = str(value or "").strip()
    normalized = normalize_text(raw_value)
    if normalized in ANONYMOUS_CUSTOMERS:
        return "Consumidor final"
    if not raw_value:
        return "Consumidor final"
    return " ".join(part.capitalize() for part in raw_value.split())


def ensure_columns(df, columns):
    work_df = df.copy()
    for column_name in columns:
        if column_name not in work_df.columns:
            work_df[column_name] = None
    return work_df


def clean_pedidos(df):
    expected_columns = [
        "id",
        "location_key",
        "location_name",
        "company_id",
        "period_start",
        "period_end",
        "fecha_scraping",
        "numero",
        "fecha",
        "cliente",
        "subtotal",
        "envio",
        "descuento",
        "total",
        "total_pagado",
        "saldo",
        "estado",
    ]
    work_df = ensure_columns(df, expected_columns)
    work_df["order_datetime"] = parse_datetime_series(work_df["fecha"], assume_timezone=UTC_TIMEZONE)
    work_df["scraped_at"] = parse_datetime_series(work_df["fecha_scraping"], assume_timezone=LOCAL_TIMEZONE)
    work_df["period_start_dt"] = parse_datetime_series(work_df["period_start"])
    work_df["period_end_dt"] = parse_datetime_series(work_df["period_end"])
    work_df["period_business_date"] = work_df["period_start_dt"].apply(compute_business_date)
    work_df["numero"] = work_df["numero"].astype(str).str.strip()
    work_df["cliente_clean"] = work_df["cliente"].apply(clean_customer_name)
    work_df["subtotal_num"] = parse_numeric_series(work_df["subtotal"])
    work_df["envio_num"] = parse_numeric_series(work_df["envio"])
    work_df["descuento_num"] = parse_numeric_series(work_df["descuento"])
    work_df["total_num"] = parse_numeric_series(work_df["total"])
    work_df["total_pagado_num"] = parse_numeric_series(work_df["total_pagado"])
    work_df["saldo_num"] = parse_numeric_series(work_df["saldo"])
    work_df["estado_clean"] = work_df["estado"].fillna("").astype(str).str.strip()
    work_df["order_key"] = (
        work_df["location_key"].fillna("").astype(str)
        + "|"
        + work_df["numero"].where(work_df["numero"] != "", work_df["id"].astype(str))
    )
    work_df["pending_balance_flag"] = work_df["saldo_num"] > 0
    work_df["payment_gap_num"] = work_df["total_pagado_num"] - work_df["total_num"]
    work_df = build_period_columns(work_df, "order_datetime")
    return work_df


def clean_productos(df):
    expected_columns = [
        "id",
        "location_key",
        "location_name",
        "company_id",
        "period_start",
        "period_end",
        "fecha_scraping",
        "codigo",
        "nombre",
        "cantidad",
        "total",
        "unidades_alax",
    ]
    work_df = ensure_columns(df, expected_columns)
    work_df["scraped_at"] = parse_datetime_series(work_df["fecha_scraping"], assume_timezone=LOCAL_TIMEZONE)
    work_df["period_start_dt"] = parse_datetime_series(work_df["period_start"])
    work_df["period_end_dt"] = parse_datetime_series(work_df["period_end"])
    work_df["period_business_date"] = work_df["period_start_dt"].apply(compute_business_date)
    work_df["codigo_clean"] = work_df["codigo"].fillna("").astype(str).str.strip()
    work_df["nombre_clean"] = work_df["nombre"].fillna("").astype(str).str.strip()
    work_df["cantidad_num"] = parse_numeric_series(work_df["cantidad"])
    work_df["total_num"] = parse_numeric_series(work_df["total"])
    work_df["unidades_alax_num"] = parse_numeric_series(work_df["unidades_alax"])
    work_df["rubro"] = work_df["nombre_clean"].apply(infer_rubro)
    work_df["revenue_per_unit"] = work_df["total_num"] / work_df["cantidad_num"].replace(0, pd.NA)
    return work_df


def clean_pagos(df):
    expected_columns = [
        "id",
        "location_key",
        "location_name",
        "company_id",
        "period_start",
        "period_end",
        "fecha_scraping",
        "nro_pedido",
        "fecha",
        "cliente",
        "total_pedido",
        "forma_pago",
        "monto",
    ]
    work_df = ensure_columns(df, expected_columns)
    work_df["payment_datetime"] = parse_datetime_series(work_df["fecha"], assume_timezone=UTC_TIMEZONE)
    work_df["scraped_at"] = parse_datetime_series(work_df["fecha_scraping"], assume_timezone=LOCAL_TIMEZONE)
    work_df["period_start_dt"] = parse_datetime_series(work_df["period_start"])
    work_df["period_end_dt"] = parse_datetime_series(work_df["period_end"])
    work_df["period_business_date"] = work_df["period_start_dt"].apply(compute_business_date)
    work_df["nro_pedido_clean"] = work_df["nro_pedido"].fillna("").astype(str).str.strip()
    work_df["cliente_clean"] = work_df["cliente"].apply(clean_customer_name)
    work_df["forma_pago_clean"] = work_df["forma_pago"].fillna("").astype(str).str.strip()
    work_df["payment_category"] = work_df["forma_pago_clean"].apply(map_payment_category)
    work_df["total_pedido_num"] = parse_numeric_series(work_df["total_pedido"])
    work_df["monto_num"] = parse_numeric_series(work_df["monto"])
    work_df["payment_order_key"] = (
        work_df["location_key"].fillna("").astype(str)
        + "|"
        + work_df["nro_pedido_clean"].where(
            work_df["nro_pedido_clean"] != "",
            work_df["id"].astype(str),
        )
    )
    work_df = build_period_columns(work_df, "payment_datetime")
    return work_df


def clean_gastos(df):
    expected_columns = [
        "id",
        "location_key",
        "location_name",
        "company_id",
        "period_start",
        "period_end",
        "fecha_scraping",
        "fecha",
        "tipo_gasto",
        "total",
        "descripcion",
        "caja",
        "estado",
    ]
    work_df = ensure_columns(df, expected_columns)
    work_df["expense_datetime"] = parse_datetime_series(work_df["fecha"], assume_timezone=UTC_TIMEZONE)
    work_df["scraped_at"] = parse_datetime_series(work_df["fecha_scraping"], assume_timezone=LOCAL_TIMEZONE)
    work_df["period_start_dt"] = parse_datetime_series(work_df["period_start"])
    work_df["period_end_dt"] = parse_datetime_series(work_df["period_end"])
    work_df["period_business_date"] = work_df["period_start_dt"].apply(compute_business_date)
    work_df["tipo_gasto_clean"] = work_df["tipo_gasto"].fillna("").astype(str).str.strip()
    work_df["descripcion_clean"] = work_df["descripcion"].fillna("").astype(str).str.strip()
    work_df["caja_clean"] = work_df["caja"].fillna("").astype(str).str.strip()
    work_df["estado_clean"] = work_df["estado"].fillna("").astype(str).str.strip()
    work_df["total_num"] = parse_numeric_series(work_df["total"])
    work_df["active_flag"] = ~work_df["estado_clean"].str.lower().eq("inactivo")
    work_df = build_period_columns(work_df, "expense_datetime")
    return work_df


def clean_scrape_runs(df):
    expected_columns = [
        "id",
        "location_key",
        "location_name",
        "company_id",
        "period_start",
        "period_end",
        "fetched_at",
        "orders_count",
        "payments_count",
        "products_count",
        "expenses_count",
        "total_amount",
    ]
    work_df = ensure_columns(df, expected_columns)
    work_df["fetched_at_dt"] = parse_datetime_series(work_df["fetched_at"], assume_timezone=LOCAL_TIMEZONE)
    work_df["period_start_dt"] = parse_datetime_series(work_df["period_start"])
    work_df["period_end_dt"] = parse_datetime_series(work_df["period_end"])
    work_df["period_business_date"] = work_df["period_start_dt"].apply(compute_business_date)
    work_df["total_amount_num"] = parse_numeric_series(work_df["total_amount"])
    return work_df


def retain_latest_snapshot_rows(df, snapshot_date_column="period_business_date", snapshot_time_column="scraped_at"):
    if df.empty:
        return df.copy()

    required_columns = {"location_key", "period_start_dt", "period_end_dt"}
    if not required_columns.issubset(df.columns):
        return df.copy()

    work_df = df.copy()
    if snapshot_date_column not in work_df.columns:
        work_df[snapshot_date_column] = work_df["period_start_dt"].apply(compute_business_date)
    if snapshot_time_column not in work_df.columns:
        work_df[snapshot_time_column] = pd.NaT

    snapshot_signature_columns = [
        "location_key",
        snapshot_date_column,
        "period_start_dt",
        "period_end_dt",
        snapshot_time_column,
    ]
    snapshots = (
        work_df[snapshot_signature_columns]
        .dropna(subset=["location_key", snapshot_date_column, "period_start_dt"])
        .drop_duplicates()
        .sort_values(
            ["location_key", snapshot_date_column, "period_end_dt", snapshot_time_column, "period_start_dt"],
            ascending=True,
        )
        .drop_duplicates(subset=["location_key", snapshot_date_column], keep="last")
    )
    if snapshots.empty:
        return work_df.copy()

    return work_df.merge(snapshots, on=snapshot_signature_columns, how="inner").copy()


def load_clean_data_bundle():
    ensure_schema()
    pedidos_raw = read_table("pedidos")
    productos_raw = read_table("productos")
    pagos_raw = read_table("formas_pago")
    gastos_raw = read_table("gastos")
    runs_raw = read_table("scrape_runs")
    api_data_raw = read_table("api_data")
    pedidos_clean = retain_latest_snapshot_rows(clean_pedidos(pedidos_raw))
    productos_clean = retain_latest_snapshot_rows(clean_productos(productos_raw))
    pagos_clean = retain_latest_snapshot_rows(clean_pagos(pagos_raw))
    gastos_clean = retain_latest_snapshot_rows(clean_gastos(gastos_raw))
    return {
        "df_pedidos_clean": pedidos_clean,
        "df_productos_clean": productos_clean,
        "df_pagos_clean": pagos_clean,
        "df_gastos_clean": gastos_clean,
        "df_scrape_runs_clean": clean_scrape_runs(runs_raw),
        "df_api_data_raw": api_data_raw,
    }


def get_available_date_range(bundle):
    business_dates = []
    for key in ["df_pedidos_clean", "df_gastos_clean", "df_pagos_clean"]:
        df = bundle.get(key, pd.DataFrame())
        if not df.empty and "business_date" in df.columns:
            business_dates.append(df["business_date"].dropna())
    if not business_dates:
        today = datetime.now(LOCAL_TIMEZONE).date()
        return today, today
    merged = pd.concat(business_dates, ignore_index=True)
    return merged.min(), merged.max()


def filter_dataframe(df, location_selection="ambas", start_date=None, end_date=None, date_column="business_date"):
    if df.empty:
        return df.copy()

    work_df = df.copy()
    if location_selection != "ambas" and "location_key" in work_df.columns:
        work_df = work_df[work_df["location_key"] == location_selection]
    if start_date is not None and date_column in work_df.columns:
        comparison_series = work_df[date_column]
        if pd.api.types.is_datetime64_any_dtype(comparison_series):
            comparison_series = comparison_series.dt.date
        work_df = work_df[comparison_series >= start_date]
    if end_date is not None and date_column in work_df.columns:
        comparison_series = work_df[date_column]
        if pd.api.types.is_datetime64_any_dtype(comparison_series):
            comparison_series = comparison_series.dt.date
        work_df = work_df[comparison_series <= end_date]
    return work_df.copy()


def filter_clean_bundle(bundle, location_selection="ambas", start_date=None, end_date=None):
    return {
        "df_pedidos_clean": filter_dataframe(bundle["df_pedidos_clean"], location_selection, start_date, end_date),
        "df_productos_clean": filter_dataframe(
            bundle["df_productos_clean"],
            location_selection,
            start_date,
            end_date,
            date_column="period_business_date",
        ),
        "df_pagos_clean": filter_dataframe(bundle["df_pagos_clean"], location_selection, start_date, end_date),
        "df_gastos_clean": filter_dataframe(bundle["df_gastos_clean"], location_selection, start_date, end_date),
        "df_scrape_runs_clean": filter_dataframe(
            bundle["df_scrape_runs_clean"],
            location_selection,
            start_date,
            end_date,
            date_column="period_start_dt",
        ),
        "df_api_data_raw": bundle["df_api_data_raw"],
    }


def safe_divide(numerator, denominator):
    if not denominator:
        return 0.0
    return float(numerator or 0) / float(denominator or 0)


def build_overview_metrics(bundle):
    pedidos_df = bundle["df_pedidos_clean"]
    gastos_df = bundle["df_gastos_clean"]
    pagos_df = bundle["df_pagos_clean"]

    sales_total = float(pedidos_df["total_num"].sum()) if not pedidos_df.empty else 0.0
    cost_total = float(gastos_df["total_num"].sum()) if not gastos_df.empty else 0.0
    gain_total = sales_total - cost_total
    order_count = int(len(pedidos_df))
    ticket_average = safe_divide(sales_total, order_count)
    pending_balance = float(pedidos_df["saldo_num"].sum()) if not pedidos_df.empty else 0.0
    payment_total = float(pagos_df["monto_num"].sum()) if not pagos_df.empty else 0.0
    payment_gap = payment_total - sales_total
    margin_pct = safe_divide(gain_total, sales_total)

    return {
        "sales_total": sales_total,
        "cost_total": cost_total,
        "gain_total": gain_total,
        "order_count": order_count,
        "ticket_average": ticket_average,
        "pending_balance": pending_balance,
        "payment_total": payment_total,
        "payment_gap": payment_gap,
        "margin_pct": margin_pct,
    }


def _aggregate_period(df, date_column, value_column, freq):
    if df.empty:
        return pd.DataFrame(columns=["period_start", "period_label", value_column])

    work_df = df.copy()
    work_df = work_df.dropna(subset=[date_column])
    if work_df.empty:
        return pd.DataFrame(columns=["period_start", "period_label", value_column])

    period_series = pd.to_datetime(work_df[date_column])
    if freq == "D":
        work_df["period_start"] = period_series
        work_df["period_label"] = period_series.dt.strftime("%d/%m")
    elif freq == "W":
        work_df["period_start"] = period_series - pd.to_timedelta(period_series.dt.weekday, unit="D")
        work_df["period_label"] = work_df["period_start"].dt.strftime("Semana %d/%m")
    else:
        work_df["period_start"] = period_series.values.astype("datetime64[M]")
        work_df["period_label"] = pd.to_datetime(work_df["period_start"]).dt.strftime("%m/%Y")

    grouped = (
        work_df.groupby(["period_start", "period_label"], as_index=False)
        .agg(**{value_column: (value_column, "sum")})
        .sort_values("period_start")
    )
    return grouped


def build_sales_timeseries(pedidos_df, freq="D"):
    if pedidos_df.empty:
        return pd.DataFrame(columns=["period_start", "period_label", "sales_total", "orders_count", "ticket_average"])

    work_df = pedidos_df.dropna(subset=["business_date"]).copy()
    if work_df.empty:
        return pd.DataFrame(columns=["period_start", "period_label", "sales_total", "orders_count", "ticket_average"])

    aggregated_sales = _aggregate_period(
        work_df.assign(sales_total=work_df["total_num"]),
        "business_date",
        "sales_total",
        freq,
    )
    aggregated_orders = _aggregate_period(
        work_df.assign(orders_count=1.0),
        "business_date",
        "orders_count",
        freq,
    )
    merged = aggregated_sales.merge(aggregated_orders, on=["period_start", "period_label"], how="left")
    merged["ticket_average"] = merged["sales_total"] / merged["orders_count"].replace(0, pd.NA)
    return merged


def build_finance_timeseries(pedidos_df, gastos_df, freq="D"):
    sales_df = build_sales_timeseries(pedidos_df, freq=freq)
    if gastos_df.empty:
        finance_df = sales_df.copy()
        if finance_df.empty:
            return pd.DataFrame(columns=["period_start", "period_label", "sales_total", "cost_total", "gain_total"])
        finance_df["cost_total"] = 0.0
        finance_df["gain_total"] = finance_df["sales_total"]
        return finance_df

    expense_periods = _aggregate_period(
        gastos_df.assign(cost_total=gastos_df["total_num"]),
        "business_date",
        "cost_total",
        freq,
    )
    finance_df = sales_df.merge(expense_periods, on=["period_start", "period_label"], how="outer").fillna(
        {"sales_total": 0.0, "orders_count": 0.0, "ticket_average": 0.0, "cost_total": 0.0}
    )
    finance_df["gain_total"] = finance_df["sales_total"] - finance_df["cost_total"]
    return finance_df.sort_values("period_start")


def build_payment_summary(pagos_df):
    if pagos_df.empty:
        return pd.DataFrame(columns=["payment_category", "payment_count", "amount_total", "share_amount", "share_count"])

    summary = (
        pagos_df.groupby("payment_category", as_index=False)
        .agg(
            payment_count=("payment_order_key", "count"),
            amount_total=("monto_num", "sum"),
        )
        .sort_values(["amount_total", "payment_count"], ascending=[False, False])
    )
    total_amount = float(summary["amount_total"].sum())
    total_count = float(summary["payment_count"].sum())
    summary["share_amount"] = summary["amount_total"].apply(lambda value: safe_divide(value, total_amount))
    summary["share_count"] = summary["payment_count"].apply(lambda value: safe_divide(value, total_count))
    return summary


def build_payment_method_detail(pagos_df):
    if pagos_df.empty:
        return pd.DataFrame(columns=["forma_pago_clean", "payment_category", "payment_count", "amount_total", "share_amount"])

    detail = (
        pagos_df.groupby(["forma_pago_clean", "payment_category"], as_index=False)
        .agg(
            payment_count=("payment_order_key", "count"),
            amount_total=("monto_num", "sum"),
        )
        .sort_values(["amount_total", "payment_count"], ascending=[False, False])
    )
    total_amount = float(detail["amount_total"].sum())
    detail["share_amount"] = detail["amount_total"].apply(lambda value: safe_divide(value, total_amount))
    return detail


def build_product_summary(productos_df):
    if productos_df.empty:
        return pd.DataFrame(
            columns=[
                "codigo_clean",
                "nombre_clean",
                "rubro",
                "quantity_total",
                "revenue_total",
                "avg_unit_revenue",
                "active_days",
                "revenue_share",
            ]
        )

    summary = (
        productos_df.groupby(["codigo_clean", "nombre_clean", "rubro"], as_index=False)
        .agg(
            quantity_total=("cantidad_num", "sum"),
            revenue_total=("total_num", "sum"),
            active_days=("period_business_date", "nunique"),
        )
        .sort_values(["revenue_total", "quantity_total"], ascending=[False, False])
    )
    summary["avg_unit_revenue"] = summary["revenue_total"] / summary["quantity_total"].replace(0, pd.NA)
    total_revenue = float(summary["revenue_total"].sum())
    summary["revenue_share"] = summary["revenue_total"].apply(lambda value: safe_divide(value, total_revenue))
    return summary


def build_rubro_summary(productos_df):
    product_summary = build_product_summary(productos_df)
    if product_summary.empty:
        return pd.DataFrame(
            columns=[
                "rubro",
                "quantity_total",
                "revenue_total",
                "active_products",
                "avg_unit_revenue",
                "revenue_share",
            ]
        )

    summary = (
        product_summary.groupby("rubro", as_index=False)
        .agg(
            quantity_total=("quantity_total", "sum"),
            revenue_total=("revenue_total", "sum"),
            active_products=("nombre_clean", "nunique"),
        )
        .sort_values(["revenue_total", "quantity_total"], ascending=[False, False])
    )
    summary["avg_unit_revenue"] = summary["revenue_total"] / summary["quantity_total"].replace(0, pd.NA)
    total_revenue = float(summary["revenue_total"].sum())
    summary["revenue_share"] = summary["revenue_total"].apply(lambda value: safe_divide(value, total_revenue))
    category_order = {label: index for index, label in enumerate(RUBRO_ORDER)}
    summary["sort_order"] = summary["rubro"].map(category_order).fillna(len(category_order))
    summary = summary.sort_values(["sort_order", "revenue_total"], ascending=[True, False]).drop(columns=["sort_order"])
    return summary


def build_top_products(productos_df, metric="revenue_total", top_n=15):
    summary = build_product_summary(productos_df)
    if summary.empty:
        return summary

    metric_column = metric if metric in summary.columns else "revenue_total"
    return summary.sort_values([metric_column, "quantity_total"], ascending=[False, False]).head(top_n)


def build_low_contribution_products(productos_df, top_n=15):
    summary = build_product_summary(productos_df)
    if summary.empty:
        return summary

    eligible = summary[summary["quantity_total"] > 0].copy()
    if eligible.empty:
        return summary.head(0)

    eligible["contribution_index"] = eligible["avg_unit_revenue"].fillna(0) * eligible["revenue_share"].fillna(0)
    return eligible.sort_values(
        ["contribution_index", "revenue_total", "quantity_total"],
        ascending=[True, True, False],
    ).head(top_n)


def build_product_pareto(productos_df):
    summary = build_product_summary(productos_df)
    if summary.empty:
        return pd.DataFrame(columns=["nombre_clean", "revenue_total", "revenue_share", "cumulative_share", "pareto_bucket"])

    pareto = summary.sort_values("revenue_total", ascending=False).reset_index(drop=True)
    pareto["cumulative_share"] = pareto["revenue_share"].cumsum()
    pareto["pareto_bucket"] = pareto["cumulative_share"].apply(
        lambda value: "Top 80%" if value <= 0.8 else "Resto"
    )
    return pareto


def build_expense_summary(gastos_df):
    if gastos_df.empty:
        return pd.DataFrame(columns=["tipo_gasto_clean", "expense_count", "cost_total", "share_amount", "avg_expense"])

    active_expenses = gastos_df[gastos_df["active_flag"]].copy()
    if active_expenses.empty:
        active_expenses = gastos_df.copy()

    summary = (
        active_expenses.groupby("tipo_gasto_clean", as_index=False)
        .agg(
            expense_count=("id", "count"),
            cost_total=("total_num", "sum"),
        )
        .sort_values(["cost_total", "expense_count"], ascending=[False, False])
    )
    total_cost = float(summary["cost_total"].sum())
    summary["share_amount"] = summary["cost_total"].apply(lambda value: safe_divide(value, total_cost))
    summary["avg_expense"] = summary["cost_total"] / summary["expense_count"].replace(0, pd.NA)
    return summary


def build_branch_performance(pedidos_df, gastos_df):
    sales_summary = pd.DataFrame(columns=["location_key", "location_name", "sales_total", "order_count", "ticket_average"])
    if not pedidos_df.empty:
        sales_summary = (
            pedidos_df.groupby(["location_key", "location_name"], as_index=False)
            .agg(
                sales_total=("total_num", "sum"),
                order_count=("order_key", "nunique"),
            )
        )
        sales_summary["ticket_average"] = sales_summary["sales_total"] / sales_summary["order_count"].replace(0, pd.NA)

    cost_summary = pd.DataFrame(columns=["location_key", "location_name", "cost_total"])
    if not gastos_df.empty:
        cost_summary = (
            gastos_df.groupby(["location_key", "location_name"], as_index=False)
            .agg(cost_total=("total_num", "sum"))
        )

    if sales_summary.empty and cost_summary.empty:
        return pd.DataFrame(
            columns=["location_key", "location_name", "sales_total", "cost_total", "gain_total", "order_count", "ticket_average", "margin_pct"]
        )

    merged = sales_summary.merge(
        cost_summary,
        on=["location_key", "location_name"],
        how="outer",
    ).fillna({"sales_total": 0.0, "order_count": 0.0, "ticket_average": 0.0, "cost_total": 0.0})
    merged["gain_total"] = merged["sales_total"] - merged["cost_total"]
    merged["margin_pct"] = merged.apply(lambda row: safe_divide(row["gain_total"], row["sales_total"]), axis=1)
    return merged.sort_values("sales_total", ascending=False)


def customer_segment_label(order_count):
    if order_count >= 8:
        return "Fans"
    if order_count >= 4:
        return "Frecuentes"
    if order_count >= 2:
        return "Recurrentes"
    return "Ocasionales"


def build_customer_summary(pedidos_df, pagos_df):
    if pagos_df.empty and pedidos_df.empty:
        empty_customer_df = pd.DataFrame(
            columns=["cliente_clean", "identified_orders", "identified_revenue", "ticket_average", "days_active", "last_visit", "segment"]
        )
        return {
            "customers": empty_customer_df,
            "anonymous_share": 0.0,
            "identified_sales": 0.0,
            "identified_orders": 0,
            "identified_customers": 0,
            "repeat_customer_rate": 0.0,
        }

    if not pagos_df.empty:
        order_level = (
            pagos_df.groupby(["payment_order_key", "cliente_clean"], as_index=False)
            .agg(
                order_datetime=("payment_datetime", "max"),
                order_total=("monto_num", "sum"),
                location_name=("location_name", "first"),
                location_key=("location_key", "first"),
                business_date=("business_date", "max"),
            )
        )
    else:
        order_level = (
            pedidos_df.groupby(["order_key", "cliente_clean"], as_index=False)
            .agg(
                order_datetime=("order_datetime", "max"),
                order_total=("total_num", "sum"),
                location_name=("location_name", "first"),
                location_key=("location_key", "first"),
                business_date=("business_date", "max"),
            )
            .rename(columns={"order_key": "payment_order_key"})
        )

    order_level["is_identified"] = ~order_level["cliente_clean"].str.lower().eq("consumidor final")
    anonymous_share = safe_divide(
        (~order_level["is_identified"]).sum(),
        len(order_level),
    )
    identified = order_level[order_level["is_identified"]].copy()
    if identified.empty:
        empty_customer_df = pd.DataFrame(
            columns=["cliente_clean", "identified_orders", "identified_revenue", "ticket_average", "days_active", "last_visit", "segment"]
        )
        return {
            "customers": empty_customer_df,
            "anonymous_share": anonymous_share,
            "identified_sales": 0.0,
            "identified_orders": 0,
            "identified_customers": 0,
            "repeat_customer_rate": 0.0,
        }

    customer_df = (
        identified.groupby("cliente_clean", as_index=False)
        .agg(
            identified_orders=("payment_order_key", "nunique"),
            identified_revenue=("order_total", "sum"),
            days_active=("business_date", "nunique"),
            last_visit=("order_datetime", "max"),
        )
        .sort_values(["identified_revenue", "identified_orders"], ascending=[False, False])
    )
    customer_df["ticket_average"] = customer_df["identified_revenue"] / customer_df["identified_orders"].replace(0, pd.NA)
    customer_df["segment"] = customer_df["identified_orders"].apply(customer_segment_label)
    repeat_customer_rate = safe_divide((customer_df["identified_orders"] > 1).sum(), len(customer_df))
    return {
        "customers": customer_df,
        "anonymous_share": anonymous_share,
        "identified_sales": float(customer_df["identified_revenue"].sum()),
        "identified_orders": int(customer_df["identified_orders"].sum()),
        "identified_customers": int(len(customer_df)),
        "repeat_customer_rate": repeat_customer_rate,
    }


def build_customer_segment_summary(customer_df):
    if customer_df.empty:
        return pd.DataFrame(columns=["segment", "customers", "revenue_total", "share_revenue", "share_customers"])

    summary = (
        customer_df.groupby("segment", as_index=False)
        .agg(
            customers=("cliente_clean", "count"),
            revenue_total=("identified_revenue", "sum"),
        )
        .sort_values("revenue_total", ascending=False)
    )
    revenue_total = float(summary["revenue_total"].sum())
    customer_total = float(summary["customers"].sum())
    summary["share_revenue"] = summary["revenue_total"].apply(lambda value: safe_divide(value, revenue_total))
    summary["share_customers"] = summary["customers"].apply(lambda value: safe_divide(value, customer_total))
    segment_order = {"Fans": 0, "Frecuentes": 1, "Recurrentes": 2, "Ocasionales": 3}
    summary["sort_order"] = summary["segment"].map(segment_order).fillna(len(segment_order))
    return summary.sort_values("sort_order").drop(columns=["sort_order"])


TURNO_MANANA_START_MIN = 9 * 60        # 09:00
TURNO_MANANA_END_MIN   = 16 * 60 + 30  # 16:30
TURNO_NOCHE_END_MIN    = 3 * 60        # 03:00


def assign_turno(dt):
    """Turno Mañana (09:00–16:30) o Noche (16:30–03:00). None = fuera de turno."""
    if pd.isna(dt):
        return None
    minutes = dt.hour * 60 + dt.minute
    if TURNO_MANANA_START_MIN <= minutes < TURNO_MANANA_END_MIN:
        return "Mañana"
    if minutes >= TURNO_MANANA_END_MIN or minutes < TURNO_NOCHE_END_MIN:
        return "Noche"
    return None  # 03:00–09:00


def build_turno_breakdown(df_pedidos_clean):
    """Desglose de pedidos y facturación por turno Mañana / Noche."""
    _empty_turno = {"orders_count": 0, "sales_total": 0.0, "ticket_average": 0.0, "share_orders": 0.0, "share_sales": 0.0}
    empty = {"summary": {"manana": _empty_turno, "noche": _empty_turno}, "by_business_date": []}

    if df_pedidos_clean.empty:
        return empty

    work_df = df_pedidos_clean.dropna(subset=["order_datetime"]).copy()
    work_df["turno"] = work_df["order_datetime"].apply(assign_turno)
    work_df = work_df[work_df["turno"].notna()].copy()
    if work_df.empty:
        return empty

    grp = (
        work_df.groupby("turno", as_index=False)
        .agg(orders_count=("order_key", "nunique"), sales_total=("total_num", "sum"))
    )
    total_orders = float(grp["orders_count"].sum()) or 1.0
    total_sales  = float(grp["sales_total"].sum())  or 1.0

    def _row_to_dict(turno_name):
        row = grp[grp["turno"] == turno_name]
        if row.empty:
            return _empty_turno.copy()
        oc = float(row.iloc[0]["orders_count"])
        st = float(row.iloc[0]["sales_total"])
        return {
            "orders_count":  int(oc),
            "sales_total":   round(st, 2),
            "ticket_average": round(st / oc, 2) if oc else 0.0,
            "share_orders":  round(oc / total_orders, 4),
            "share_sales":   round(st / total_sales, 4),
        }

    # Desglose diario
    by_date = []
    if "business_date" in work_df.columns:
        daily = (
            work_df.groupby(["business_date", "turno"], as_index=False)
            .agg(orders_count=("order_key", "nunique"), sales_total=("total_num", "sum"))
        )
        pivot = daily.pivot_table(
            index="business_date", columns="turno",
            values=["orders_count", "sales_total"], aggfunc="sum", fill_value=0,
        )
        for bd, row in pivot.iterrows():
            by_date.append({
                "date":          str(bd),
                "manana_orders": int(row.get(("orders_count", "Mañana"), 0) or 0),
                "manana_sales":  round(float(row.get(("sales_total", "Mañana"), 0) or 0), 2),
                "noche_orders":  int(row.get(("orders_count", "Noche"), 0) or 0),
                "noche_sales":   round(float(row.get(("sales_total", "Noche"), 0) or 0), 2),
            })
        by_date.sort(key=lambda x: x["date"])

    return {
        "summary": {"manana": _row_to_dict("Mañana"), "noche": _row_to_dict("Noche")},
        "by_business_date": by_date,
    }


def build_hourly_sales(pedidos_df):
    if pedidos_df.empty:
        return pd.DataFrame(columns=["hour", "hour_label", "sales_total", "orders_count", "ticket_average"])

    work_df = pedidos_df.dropna(subset=["hour"]).copy()
    if work_df.empty:
        return pd.DataFrame(columns=["hour", "hour_label", "sales_total", "orders_count", "ticket_average"])

    summary = (
        work_df.groupby("hour", as_index=False)
        .agg(
            sales_total=("total_num", "sum"),
            orders_count=("order_key", "nunique"),
        )
    )
    summary["ticket_average"] = summary["sales_total"] / summary["orders_count"].replace(0, pd.NA)
    summary = summary[summary["hour"].isin(HEATMAP_HOURS)]
    summary["hour_sort"] = summary["hour"].apply(lambda value: HEATMAP_HOURS.index(value))
    summary["hour_label"] = summary["hour"].apply(lambda value: f"{int(value):02d}:00")
    return summary.sort_values("hour_sort").drop(columns=["hour_sort"])


def build_weekday_hour_heatmap(pedidos_df):
    if pedidos_df.empty:
        return pd.DataFrame(index=DAY_NAME_ORDER, columns=HEATMAP_HOUR_LABELS).fillna(0.0)

    work_df = pedidos_df.dropna(subset=["weekday_name", "hour"]).copy()
    work_df = work_df[work_df["hour"].isin(HEATMAP_HOURS)]
    if work_df.empty:
        return pd.DataFrame(index=DAY_NAME_ORDER, columns=HEATMAP_HOUR_LABELS).fillna(0.0)

    work_df["hour_label"] = work_df["hour"].apply(lambda value: f"{int(value):02d}:00")
    heatmap = pd.pivot_table(
        work_df,
        values="total_num",
        index="weekday_name",
        columns="hour_label",
        aggfunc="sum",
        fill_value=0.0,
    )
    heatmap = heatmap.reindex(index=DAY_NAME_ORDER, columns=HEATMAP_HOUR_LABELS, fill_value=0.0)
    return heatmap


def build_data_quality_summary(bundle):
    pedidos_df = bundle["df_pedidos_clean"]
    pagos_df = bundle["df_pagos_clean"]
    productos_df = bundle["df_productos_clean"]
    gastos_df = bundle["df_gastos_clean"]
    runs_df = bundle["df_scrape_runs_clean"]

    duplicated_runs = 0
    if not runs_df.empty:
        duplicated_runs = int(
            runs_df.duplicated(subset=["location_key", "period_start", "period_end"], keep=False).sum()
        )

    missing_order_dates = int(pedidos_df["order_datetime"].isna().sum()) if not pedidos_df.empty else 0
    blank_order_numbers = int(pedidos_df["numero"].eq("").sum()) if not pedidos_df.empty else 0
    blank_payment_orders = int(pagos_df["nro_pedido_clean"].eq("").sum()) if not pagos_df.empty else 0
    inactive_expenses = int((~gastos_df["active_flag"]).sum()) if not gastos_df.empty else 0

    overview = build_overview_metrics(bundle)
    customer_summary = build_customer_summary(pedidos_df, pagos_df)

    return {
        "missing_order_dates": missing_order_dates,
        "blank_order_numbers": blank_order_numbers,
        "blank_payment_orders": blank_payment_orders,
        "duplicated_runs": duplicated_runs,
        "inactive_expenses": inactive_expenses,
        "payment_gap_abs": abs(float(overview["payment_gap"])),
        "pending_balance": float(overview["pending_balance"]),
        "anonymous_share": float(customer_summary["anonymous_share"]),
        "products_are_period_aggregates": True,
        "available_history_days": int(pedidos_df["business_date"].nunique()) if not pedidos_df.empty else 0,
        "product_history_days": int(productos_df["period_business_date"].nunique()) if not productos_df.empty else 0,
    }


def get_today_business_date():
    return compute_business_date(pd.Timestamp.now(tz=LOCAL_TIMEZONE))


def build_today_bundle(bundle, location_selection="ambas"):
    today_business_date = get_today_business_date()
    return filter_clean_bundle(
        bundle,
        location_selection=location_selection,
        start_date=today_business_date,
        end_date=today_business_date,
    )

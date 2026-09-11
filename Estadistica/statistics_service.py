import json
from datetime import date, datetime

import pandas as pd

import data_processing as dp
from scraper import (
    build_historical_range,
    build_month_range,
    build_specific_day_range,
    build_today_shift_range,
    build_week_range,
    fetch_statistics_bundle,
    get_location_config,
)


def _serialize_scalar(value):
    if isinstance(value, (pd.Timestamp, datetime)):
        if pd.isna(value):
            return None
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (pd.Timedelta,)):
        return str(value)
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return value
    return value


def sanitize_json_compatible(value):
    if isinstance(value, dict):
        return {str(key): sanitize_json_compatible(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_json_compatible(item) for item in value]
    if isinstance(value, tuple):
        return [sanitize_json_compatible(item) for item in value]
    return _serialize_scalar(value)


def dataframe_to_records(df):
    if df is None or df.empty:
        return []
    sanitized = df.copy()
    for column in sanitized.columns:
        sanitized[column] = sanitized[column].map(_serialize_scalar)
    return sanitized.to_dict(orient="records")


def heatmap_to_payload(df):
    if df is None or df.empty:
        return {"index": [], "columns": [], "values": []}

    safe_df = df.copy()
    for column in safe_df.columns:
        safe_df[column] = safe_df[column].map(_serialize_scalar)

    return {
        "index": [str(value) for value in safe_df.index.tolist()],
        "columns": [str(value) for value in safe_df.columns.tolist()],
        "values": safe_df.values.tolist(),
    }


def build_date_range(period="today", target_date=None, year=None, month=None):
    normalized_period = str(period or "today").strip().lower()
    if normalized_period == "today":
        return build_today_shift_range()
    if normalized_period == "day":
        if target_date is None:
            raise ValueError("target_date es obligatorio cuando period='day'.")
        return build_specific_day_range(target_date)
    if normalized_period == "week":
        return build_week_range(target_date)
    if normalized_period == "month":
        if year is None or month is None:
            raise ValueError("year y month son obligatorios cuando period='month'.")
        return build_month_range(year, month)
    if normalized_period == "historical":
        start_reference = target_date if target_date is not None else None
        return build_historical_range(start_reference)
    raise ValueError(f"Periodo invalido: {period}")


def build_complete_statistics(location_key, start_date=None, end_date=None):
    bundle = dp.load_clean_data_bundle()
    filtered_bundle = dp.filter_clean_bundle(
        bundle,
        location_selection=location_key,
        start_date=start_date,
        end_date=end_date,
    )

    customer_summary = dp.build_customer_summary(
        filtered_bundle["df_pedidos_clean"],
        filtered_bundle["df_pagos_clean"],
    )

    return sanitize_json_compatible({
        "location_key": location_key,
        "date_range": {
            "start_date": _serialize_scalar(start_date),
            "end_date": _serialize_scalar(end_date),
        },
        "metadata": {
            "products_are_period_aggregates": True,
            "source": "nucleocheck",
        },
        "overview": dp.build_overview_metrics(filtered_bundle),
        "sales_timeseries_daily": dataframe_to_records(
            dp.build_sales_timeseries(filtered_bundle["df_pedidos_clean"], freq="D")
        ),
        "sales_timeseries_weekly": dataframe_to_records(
            dp.build_sales_timeseries(filtered_bundle["df_pedidos_clean"], freq="W")
        ),
        "sales_timeseries_monthly": dataframe_to_records(
            dp.build_sales_timeseries(filtered_bundle["df_pedidos_clean"], freq="M")
        ),
        "finance_timeseries_daily": dataframe_to_records(
            dp.build_finance_timeseries(
                filtered_bundle["df_pedidos_clean"],
                filtered_bundle["df_gastos_clean"],
                freq="D",
            )
        ),
        "finance_timeseries_weekly": dataframe_to_records(
            dp.build_finance_timeseries(
                filtered_bundle["df_pedidos_clean"],
                filtered_bundle["df_gastos_clean"],
                freq="W",
            )
        ),
        "finance_timeseries_monthly": dataframe_to_records(
            dp.build_finance_timeseries(
                filtered_bundle["df_pedidos_clean"],
                filtered_bundle["df_gastos_clean"],
                freq="M",
            )
        ),
        "payment_summary": dataframe_to_records(
            dp.build_payment_summary(filtered_bundle["df_pagos_clean"])
        ),
        "payment_method_detail": dataframe_to_records(
            dp.build_payment_method_detail(filtered_bundle["df_pagos_clean"])
        ),
        "product_summary": dataframe_to_records(
            dp.build_product_summary(filtered_bundle["df_productos_clean"])
        ),
        "rubro_summary": dataframe_to_records(
            dp.build_rubro_summary(filtered_bundle["df_productos_clean"])
        ),
        "top_products_by_revenue": dataframe_to_records(
            dp.build_top_products(filtered_bundle["df_productos_clean"], metric="revenue_total", top_n=15)
        ),
        "top_products_by_quantity": dataframe_to_records(
            dp.build_top_products(filtered_bundle["df_productos_clean"], metric="quantity_total", top_n=15)
        ),
        "low_contribution_products": dataframe_to_records(
            dp.build_low_contribution_products(filtered_bundle["df_productos_clean"], top_n=15)
        ),
        "product_pareto": dataframe_to_records(
            dp.build_product_pareto(filtered_bundle["df_productos_clean"])
        ),
        "expense_summary": dataframe_to_records(
            dp.build_expense_summary(filtered_bundle["df_gastos_clean"])
        ),
        "branch_performance": dataframe_to_records(
            dp.build_branch_performance(
                filtered_bundle["df_pedidos_clean"],
                filtered_bundle["df_gastos_clean"],
            )
        ),
        "customer_summary": {
            "anonymous_share": customer_summary["anonymous_share"],
            "identified_sales": customer_summary["identified_sales"],
            "identified_orders": customer_summary["identified_orders"],
            "identified_customers": customer_summary["identified_customers"],
            "repeat_customer_rate": customer_summary["repeat_customer_rate"],
        },
        "customer_segments": dataframe_to_records(
            dp.build_customer_segment_summary(customer_summary["customers"])
        ),
        "top_customers": dataframe_to_records(customer_summary["customers"].head(25)),
        "hourly_sales": dataframe_to_records(
            dp.build_hourly_sales(filtered_bundle["df_pedidos_clean"])
        ),
        "weekday_hour_heatmap": heatmap_to_payload(
            dp.build_weekday_hour_heatmap(filtered_bundle["df_pedidos_clean"])
        ),
        "data_quality": dp.build_data_quality_summary(filtered_bundle),
        "raw_counts": {
            "orders": int(len(filtered_bundle["df_pedidos_clean"])),
            "payments": int(len(filtered_bundle["df_pagos_clean"])),
            "products": int(len(filtered_bundle["df_productos_clean"])),
            "expenses": int(len(filtered_bundle["df_gastos_clean"])),
        },
        "turno_breakdown": dp.build_turno_breakdown(filtered_bundle["df_pedidos_clean"]),
    })


def scrape_and_build_complete_statistics(location_key, start_local, end_local):
    location = get_location_config(location_key)
    fetch_statistics_bundle(start_local, end_local, location)
    return build_complete_statistics(
        location_key,
        start_date=start_local.date(),
        end_date=end_local.date(),
    )


def scrape_complete_statistics_for_period(
    location_key,
    period="today",
    target_date=None,
    year=None,
    month=None,
):
    start_local, end_local = build_date_range(
        period=period,
        target_date=target_date,
        year=year,
        month=month,
    )
    return scrape_and_build_complete_statistics(location_key, start_local, end_local)


def statistics_to_json(payload, indent=2):
    return json.dumps(payload, ensure_ascii=False, indent=indent)


if __name__ == "__main__":
    result = scrape_complete_statistics_for_period("palermo", period="today")
    print(statistics_to_json(result))

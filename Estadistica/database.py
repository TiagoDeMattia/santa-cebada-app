import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
from sqlalchemy import Column, Float, Integer, MetaData, Table, Text, create_engine
from sqlalchemy.pool import StaticPool

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SQLITE_PATH = BASE_DIR / "nucleocheck.db"
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"

metadata = MetaData()

Table(
    "api_data",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("location_key", Text),
    Column("location_name", Text),
    Column("company_id", Integer),
    Column("endpoint", Text, nullable=False),
    Column("period_start", Text),
    Column("period_end", Text),
    Column("requested_at", Text),
    Column("data", Text, nullable=False),
)

Table(
    "scrape_runs",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("location_key", Text),
    Column("location_name", Text),
    Column("company_id", Integer),
    Column("period_start", Text),
    Column("period_end", Text),
    Column("fetched_at", Text),
    Column("orders_count", Integer),
    Column("payments_count", Integer),
    Column("products_count", Integer),
    Column("expenses_count", Integer),
    Column("total_amount", Float),
)

Table(
    "pedidos",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("location_key", Text),
    Column("location_name", Text),
    Column("company_id", Integer),
    Column("period_start", Text),
    Column("period_end", Text),
    Column("fecha_scraping", Text),
    Column("numero", Text),
    Column("fecha", Text),
    Column("cliente", Text),
    Column("subtotal", Text),
    Column("envio", Text),
    Column("descuento", Text),
    Column("total", Text),
    Column("total_pagado", Text),
    Column("saldo", Text),
    Column("estado", Text),
)

Table(
    "productos",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("location_key", Text),
    Column("location_name", Text),
    Column("company_id", Integer),
    Column("period_start", Text),
    Column("period_end", Text),
    Column("fecha_scraping", Text),
    Column("codigo", Text),
    Column("nombre", Text),
    Column("cantidad", Text),
    Column("total", Text),
    Column("unidades_alax", Text),
)

Table(
    "formas_pago",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("location_key", Text),
    Column("location_name", Text),
    Column("company_id", Integer),
    Column("period_start", Text),
    Column("period_end", Text),
    Column("fecha_scraping", Text),
    Column("nro_pedido", Text),
    Column("fecha", Text),
    Column("cliente", Text),
    Column("total_pedido", Text),
    Column("forma_pago", Text),
    Column("monto", Text),
)

Table(
    "gastos",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("location_key", Text),
    Column("location_name", Text),
    Column("company_id", Integer),
    Column("period_start", Text),
    Column("period_end", Text),
    Column("fecha_scraping", Text),
    Column("fecha", Text),
    Column("tipo_gasto", Text),
    Column("total", Text),
    Column("descripcion", Text),
    Column("caja", Text),
    Column("estado", Text),
)

TABLES = {table.name: table for table in metadata.sorted_tables}


def get_database_url():
    return os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL)


def is_sqlite_url(database_url):
    return str(database_url).startswith("sqlite")


@lru_cache(maxsize=1)
def get_engine():
    database_url = get_database_url()
    engine_kwargs = {"future": True}

    if is_sqlite_url(database_url):
        engine_kwargs["connect_args"] = {"check_same_thread": False}
        engine_kwargs["poolclass"] = StaticPool
    else:
        engine_kwargs["pool_pre_ping"] = True

    return create_engine(database_url, **engine_kwargs)


def get_table(table_name):
    return TABLES[table_name]


def ensure_schema():
    metadata.create_all(get_engine())


def read_table(table_name):
    ensure_schema()
    return pd.read_sql_table(table_name, get_engine())


def get_storage_label():
    database_url = get_database_url()
    if is_sqlite_url(database_url):
        return DEFAULT_SQLITE_PATH.name

    parsed = urlparse(database_url)
    database_name = parsed.path.lstrip("/") or "postgres"
    host = parsed.hostname or "cloud"
    provider = "Postgres"
    if "neon" in host:
        provider = "Neon Postgres"
    elif "supabase" in host:
        provider = "Supabase Postgres"
    return f"{provider} | {database_name}"

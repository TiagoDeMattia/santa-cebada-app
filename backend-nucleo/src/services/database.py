import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
from sqlalchemy import Column, Float, Integer, MetaData, Table, Text, create_engine, String, DateTime, text, UniqueConstraint
from sqlalchemy.pool import NullPool
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SQLITE_PATH = Path.home() / ".pm2" / "nucleocheck.db"
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"

metadata = MetaData()

# Tabla de usuarios
Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("username", String(50), unique=True, nullable=False),
    Column("nombre", String(100), nullable=True),  # Nombre del propietario
    Column("password", String(255), nullable=False),
    Column("role", String(20), nullable=False, default="NORMAL"),
    Column("created_at", DateTime, nullable=False, default=datetime.utcnow),
    Column("updated_at", DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow),
)

# Tabla de auditoría para registrar cambios
Table(
    "audit_log",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("username", String(50), nullable=False),
    Column("action", String(50), nullable=False),  # create, update, delete
    Column("entity_type", String(50), nullable=False),  # barril, producto, usuario, etc
    Column("entity_id", String(100), nullable=True),
    Column("changes", Text, nullable=True),  # JSON con los cambios
    Column("timestamp", DateTime, nullable=False, default=datetime.utcnow),
    Column("ip_address", String(50), nullable=True),
    Column("sucursal_id", String(10), nullable=True),
)

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

Table(
    "canilla_config",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("producto_id", Integer, nullable=False),
    Column("canilla_nombre", String(50), nullable=False),
    Column("canilla_numero", String(10), nullable=False),
    Column("ml_por_pinta", Integer, nullable=True),
    Column("activa", Integer, nullable=False, default=1),
    Column("es_hora_santa", Integer, nullable=False, default=0),
)

Table(
    "stock_ajuste",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("estilo", String(200), unique=True, nullable=False),
    Column("ajuste_litros", Float, nullable=False, default=0.0),
    Column("nota", String(500), nullable=True),
)

# ── Stock General ─────────────────────────────────────────────────────────────

Table(
    "sg_rubros",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("codigo", String(20), unique=True, nullable=False),
    Column("nombre", String(100), nullable=False),
    Column("descripcion", Text, nullable=True),
    Column("orden", Integer, nullable=False, default=0),
    Column("activo", Integer, nullable=False, default=1),
    Column("created_at", Text, nullable=True),
)

Table(
    "sg_productos",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("codigo", String(20), unique=True, nullable=False),
    Column("nombre", String(150), nullable=False),
    Column("nombre_proveedor", String(150), nullable=True),
    Column("descripcion", Text, nullable=True),
    Column("rubro_id", Integer, nullable=True),
    Column("rubro_id_2", Integer, nullable=True),
    Column("proveedor_id", Integer, nullable=True),
    Column("unidad_stock", String(30), nullable=False, default="unidad"),
    Column("unidad_pedido", String(30), nullable=False, default="unidad"),
    Column("activo", Integer, nullable=False, default=1),
    Column("created_at", Text, nullable=True),
)

Table(
    "sg_planilla_items",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("area", String(20), nullable=False),
    Column("producto_id", Integer, nullable=False),
    Column("rubro_id", Integer, nullable=True),
    Column("orden", Integer, nullable=False, default=0),
)

Table(
    "sg_otros_registros",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("fecha", Text, nullable=False),
    Column("area", String(20), nullable=False),
    Column("fila", Integer, nullable=False),
    Column("nombre", Text, nullable=True),
    Column("u_stock", Text, nullable=True),
    Column("u_pedido", Text, nullable=True),
    Column("stock", Float, nullable=True),
    Column("pedido", Float, nullable=True),
    Column("notas", Text, nullable=True),
)

Table(
    "sg_registros",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("fecha", Text, nullable=False),
    Column("area", Text, nullable=False),
    Column("producto_id", Integer, nullable=False),
    Column("stock", Float, nullable=True),
    Column("pedido", Float, nullable=True),
    Column("notas", Text, nullable=True),
    Column("creado_por", Text, nullable=True),
    Column("created_at", Text, nullable=True),
    Column("editado_por", Text, nullable=True),
    Column("nota_edicion", Text, nullable=True),
)

Table(
    "sg_stock_cervezas",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("sucursal_id", String(10), nullable=False, default="1"),
    Column("canilla_num", Integer, nullable=False),
    Column("estilo_actual", Text, nullable=True),
    Column("estilo_proximo", Text, nullable=True),
    Column("stock_camara", Integer, nullable=True, default=0),
    Column("stock_camara_proximo", Integer, nullable=True, default=0),
)

Table(
    "sg_stock_cervezas_historial",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("fecha", Text, nullable=False),
    Column("sucursal_id", String(10), nullable=False, default="1"),
    Column("canilla_num", Integer, nullable=False),
    Column("estilo_actual", Text, nullable=True),
    Column("tipo_actual", Text, nullable=True),
    Column("proveedor_actual", Text, nullable=True),
    Column("stock_camara", Integer, nullable=True, default=0),
    Column("aprox_litros", Integer, nullable=True, default=0),
    Column("dias_pinchado", Text, nullable=True),
    Column("estilo_proximo", Text, nullable=True),
    Column("tipo_proximo", Text, nullable=True),
    Column("proveedor_proximo", Text, nullable=True),
    Column("stock_camara_proximo", Integer, nullable=True, default=0),
    Column("aprox_litros_proximo", Integer, nullable=True, default=0),
    Column("created_at", Text, nullable=True),
    UniqueConstraint("fecha", "sucursal_id", "canilla_num", name="uq_cerveza_hist"),
)

Table(
    "sg_pedido_asignaciones",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("fecha", Text, nullable=False),
    Column("producto_id", Integer, nullable=False),
    Column("proveedor_id", Integer, nullable=True),
    Column("created_at", Text, nullable=True),
    UniqueConstraint("fecha", "producto_id", name="uq_pedido_asig"),
)

Table(
    "sg_pedido_confirmaciones",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("fecha", Text, nullable=False),
    Column("proveedor_id", Integer, nullable=False),
    Column("enviado", Integer, nullable=False, default=0),
    Column("enviado_at", Text, nullable=True),
    UniqueConstraint("fecha", "proveedor_id", name="uq_pedido_conf"),
)

Table(
    "sg_proveedores",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("nombre", String(150), nullable=False),
    Column("categoria", String(50), nullable=True),
    Column("productos", Text, nullable=True),
    Column("observaciones", Text, nullable=True),
    Column("nombre_remitente", String(100), nullable=True),
    Column("info_reco", Text, nullable=True),
    Column("activo", Integer, nullable=False, default=1),
    Column("created_at", Text, nullable=True),
)

Table(
    "sg_cerveza_umbrales",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("estilo", Text, nullable=False, unique=True),
    Column("umbral", Text, nullable=False, default="0"),
    Column("updated_at", Text, nullable=True),
    UniqueConstraint("estilo", name="uq_cerveza_umbral"),
)

# ── Metas de Venta ────────────────────────────────────────────────────────────

Table(
    "metas_venta",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("persona", Text, nullable=False),
    Column("producto_tipo", Text, nullable=False),       # 'nucleo' | 'texto'
    Column("producto_codigo", Text, nullable=True),      # código de producto NucleoCheck
    Column("producto_nombre", Text, nullable=False),     # nombre del producto
    Column("meta_cantidad", Float, nullable=False),      # objetivo
    Column("cantidad_actual", Float, nullable=False, default=0.0),   # progreso
    Column("base_periodo", Text, nullable=True),         # YYYY-MM del período de inicio (nucleo)
    Column("base_cantidad", Float, nullable=True),       # cantidad ya vendida al crear (nucleo)
    Column("fecha_inicio", Text, nullable=False),        # YYYY-MM-DD
    Column("fecha_fin", Text, nullable=False),           # YYYY-MM-DD límite
    Column("activa", Integer, nullable=False, default=1),
    Column("alcanzada", Integer, nullable=True),         # 1=sí, 0=no, NULL=en curso
    Column("creado_en", Text, nullable=False),
    Column("actualizado_en", Text, nullable=False),
    Column("ultimo_trackeo", Text, nullable=True),
)

Table(
    "app_config",
    metadata,
    Column("key", Text, primary_key=True),
    Column("value", Text, nullable=True),
)

# ── Voucher (beneficio empleados) ─────────────────────────────────────────────

Table(
    "voucher_empleados",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("nombre", Text, nullable=False),
    Column("apellido", Text, nullable=False),
    Column("activo", Integer, nullable=False, default=1),
    Column("created_at", Text, nullable=False),
)

Table(
    "voucher_presupuestos",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("empleado_id", Integer, nullable=False),
    Column("periodo", Text, nullable=False),          # YYYY-MM
    Column("presupuesto", Integer, nullable=False, default=75000),
    Column("extra", Integer, nullable=False, default=0),
    UniqueConstraint("empleado_id", "periodo"),
)

Table(
    "voucher_entradas",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("empleado_id", Integer, nullable=False),
    Column("periodo", Text, nullable=False),          # YYYY-MM
    Column("producto_nombre", Text, nullable=False),  # snapshot
    Column("producto_precio", Integer, nullable=False),  # snapshot ARS
    Column("cantidad", Integer, nullable=False, default=1),
    Column("tipo", Text, nullable=False, default="consumo"),  # consumo | descuento
    Column("fecha", Text, nullable=True),                    # YYYY-MM-DD (editable, distinta de created_at)
    Column("created_at", Text, nullable=False),
)

Table(
    "voucher_config",
    metadata,
    Column("clave", Text, primary_key=True),
    Column("valor", Text, nullable=False),
)

Table(
    "voucher_productos_habilitados",
    metadata,
    Column("codigo", Text, primary_key=True),
    Column("habilitado", Integer, nullable=False, default=1),
)

Table(
    "voucher_rubros_habilitados",
    metadata,
    Column("rubro", Text, primary_key=True),
    Column("habilitado", Integer, nullable=False, default=1),
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
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs["pool_pre_ping"] = True

    return create_engine(database_url, **engine_kwargs)


def get_table(table_name):
    return TABLES[table_name]


def _migrate_sg_productos():
    engine = get_engine()
    with engine.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(sg_productos)")).fetchall()}
    with engine.begin() as conn:
        if "unidad_stock" not in existing:
            conn.execute(text("ALTER TABLE sg_productos ADD COLUMN unidad_stock TEXT DEFAULT 'unidad'"))
            if "unidad" in existing:
                conn.execute(text("UPDATE sg_productos SET unidad_stock = unidad"))
        if "unidad_pedido" not in existing:
            conn.execute(text("ALTER TABLE sg_productos ADD COLUMN unidad_pedido TEXT DEFAULT 'unidad'"))
            if "unidad" in existing:
                conn.execute(text("UPDATE sg_productos SET unidad_pedido = unidad"))
        if "proveedor_id" not in existing:
            conn.execute(text("ALTER TABLE sg_productos ADD COLUMN proveedor_id INTEGER"))
        if "nombre_proveedor" not in existing:
            conn.execute(text("ALTER TABLE sg_productos ADD COLUMN nombre_proveedor TEXT"))


def _migrate_sg_registros():
    with get_engine().connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(sg_registros)")).fetchall()}
    with get_engine().begin() as conn:
        if "editado_por" not in existing:
            conn.execute(text("ALTER TABLE sg_registros ADD COLUMN editado_por TEXT"))
        if "nota_edicion" not in existing:
            conn.execute(text("ALTER TABLE sg_registros ADD COLUMN nota_edicion TEXT"))


def _migrate_sg_otros_registros():
    with get_engine().connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(sg_otros_registros)")).fetchall()}
    with get_engine().begin() as conn:
        if "notas" not in existing:
            conn.execute(text("ALTER TABLE sg_otros_registros ADD COLUMN notas TEXT"))


def _migrate_sg_stock_cervezas():
    engine = get_engine()
    with engine.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(sg_stock_cervezas)")).fetchall()}
    with engine.begin() as conn:
        if "stock_camara" not in existing:
            conn.execute(text("ALTER TABLE sg_stock_cervezas ADD COLUMN stock_camara INTEGER DEFAULT 0"))
        if "stock_camara_proximo" not in existing:
            conn.execute(text("ALTER TABLE sg_stock_cervezas ADD COLUMN stock_camara_proximo INTEGER DEFAULT 0"))


_schema_ready = False

def ensure_schema():
    global _schema_ready
    if _schema_ready:
        return
    metadata.create_all(get_engine())
    try:
        _migrate_sg_productos()
    except Exception:
        pass
    try:
        _migrate_sg_stock_cervezas()
    except Exception:
        pass
    try:
        _migrate_sg_registros()
    except Exception:
        pass
    try:
        _migrate_sg_otros_registros()
    except Exception:
        pass
    try:
        _migrate_voucher()
    except Exception:
        pass
    _schema_ready = True


def _migrate_voucher():
    engine = get_engine()
    with engine.connect() as conn:
        cols = {r[1] for r in conn.execute(text("PRAGMA table_info(voucher_entradas)")).fetchall()}
        tables = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
    with engine.begin() as conn:
        if "tipo" not in cols:
            conn.execute(text("ALTER TABLE voucher_entradas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'consumo'"))
        if "fecha" not in cols:
            conn.execute(text("ALTER TABLE voucher_entradas ADD COLUMN fecha TEXT"))
        conn.execute(text(
            "INSERT INTO voucher_config (clave, valor) VALUES ('presupuesto_base', '75000') "
            "ON CONFLICT(clave) DO NOTHING"
        ))
        if "voucher_productos_habilitados" not in tables:
            conn.execute(text(
                "CREATE TABLE voucher_productos_habilitados "
                "(codigo TEXT PRIMARY KEY, habilitado INTEGER NOT NULL DEFAULT 1)"
            ))
        if "voucher_rubros_habilitados" not in tables:
            conn.execute(text(
                "CREATE TABLE voucher_rubros_habilitados "
                "(rubro TEXT PRIMARY KEY, habilitado INTEGER NOT NULL DEFAULT 1)"
            ))


def read_table(table_name):
    ensure_schema()
    return pd.read_sql_table(table_name, get_engine())


def read_table_filtered(table_name, date_column=None, start_date=None, end_date=None, location_key=None):
    """Like read_table but pushes date/location filters to SQL for performance."""
    from sqlalchemy import text as _text
    ensure_schema()
    conditions = []
    params = {}
    if start_date and date_column:
        conditions.append(f"{date_column} >= :start_date")
        params["start_date"] = str(start_date)
    if end_date and date_column:
        conditions.append(f"{date_column} <= :end_date")
        params["end_date"] = str(end_date)
    if location_key:
        conditions.append("location_key = :location_key")
        params["location_key"] = location_key
    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    with get_engine().connect() as conn:
        return pd.read_sql(_text(f"SELECT * FROM {table_name}{where}"), conn, params=params)


def get_app_config(key: str, default=None):
    ensure_schema()
    with get_engine().connect() as conn:
        row = conn.execute(text("SELECT value FROM app_config WHERE key = :key"), {"key": key}).fetchone()
    return row[0] if row else default


def set_app_config(key: str, value: str):
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(
            text("INSERT INTO app_config (key, value) VALUES (:key, :value) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
            {"key": key, "value": str(value)},
        )


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

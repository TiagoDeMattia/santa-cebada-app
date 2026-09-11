import logging
import os
from functools import lru_cache
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from .database import get_engine

logger = logging.getLogger(__name__)

# Alertas en .pm2/ (writable) para evitar ProtectHome=read-only del systemd.
_PM2_HOME = Path(os.environ.get("PM2_HOME", Path.home() / ".pm2"))
_ALERTAS_DB = _PM2_HOME / "alertas.db"


@lru_cache(maxsize=1)
def _get_alertas_engine():
    return create_engine(
        f"sqlite:///{_ALERTAS_DB.as_posix()}",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
    )


def ensure_schema():
    with _get_alertas_engine().connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS panel_alertas (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                producto_id INTEGER NOT NULL UNIQUE,
                tipo        INTEGER NOT NULL,
                updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
                updated_by  TEXT,
                nota        TEXT
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS panel_alertas_nucleo (
                codigo      TEXT PRIMARY KEY,
                nombre      TEXT NOT NULL,
                tipo        INTEGER NOT NULL,
                updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
                updated_by  TEXT,
                nota        TEXT
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS panel_priorizados (
                producto_id INTEGER PRIMARY KEY,
                updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
                updated_by  TEXT
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS panel_priorizados_nucleo (
                codigo      TEXT PRIMARY KEY,
                nombre      TEXT NOT NULL,
                updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
                updated_by  TEXT
            )
        """))
        conn.commit()


def get_alertas():
    ensure_schema()

    # ── Leer alertas y priorizados desde la DB writable ─────────────
    with _get_alertas_engine().connect() as conn:
        alertas_stock = {
            row["producto_id"]: dict(row)
            for row in conn.execute(text(
                "SELECT producto_id, tipo, updated_at, updated_by, nota FROM panel_alertas"
            )).mappings()
        }
        priorizados_stock = set(
            row["producto_id"]
            for row in conn.execute(text(
                "SELECT producto_id FROM panel_priorizados"
            )).mappings()
        )

    # ── Stock products (solo lectura de nucleocheck.db) ───────────────
    with get_engine().connect() as conn:
        stock_rows = conn.execute(text("""
            SELECT
                p.id, p.nombre, p.codigo, p.unidad_stock,
                r.nombre AS rubro_nombre, r.id AS rubro_id
            FROM sg_productos p
            LEFT JOIN sg_rubros r ON p.rubro_id = r.id AND r.activo = 1
            WHERE p.activo = 1
            ORDER BY r.orden, r.nombre, p.nombre
        """)).fetchall()

    def _tipo_order_stock(pid):
        t = alertas_stock.get(pid, {}).get("tipo")
        return 0 if t == 86 else (1 if t == 85 else 2)

    result = []
    for r in sorted(stock_rows, key=lambda r: (_tipo_order_stock(r[0]), r[4] or "", r[1])):
        pid = r[0]
        alerta = alertas_stock.get(pid, {})
        result.append({
            "id": pid, "nombre": r[1], "codigo": r[2], "unidad_stock": r[3],
            "rubro_nombre": r[4], "rubro_id": r[5],
            "tipo": alerta.get("tipo"), "updated_at": alerta.get("updated_at"),
            "updated_by": alerta.get("updated_by"), "nota": alerta.get("nota"),
            "priorizado": pid in priorizados_stock,
            "source": "stock",
        })

    # ── Nucleo products from catalog cache ────────────────────────────
    try:
        from .catalogo_service import get_catalogo
        nucleo_prods = [p for p in get_catalogo("1") if p.get("activo", 1)]

        with _get_alertas_engine().connect() as conn:
            alertas_map = {
                str(row["codigo"]): dict(row)
                for row in conn.execute(text(
                    "SELECT codigo, tipo, updated_at, updated_by, nota FROM panel_alertas_nucleo"
                )).mappings()
            }
            priorizados_nucleo = set(
                str(row["codigo"])
                for row in conn.execute(text(
                    "SELECT codigo FROM panel_priorizados_nucleo"
                )).mappings()
            )

        def _tipo_order(p):
            t = alertas_map.get(p.get("codigo") or "", {}).get("tipo")
            return 0 if t == 86 else (1 if t == 85 else 2)

        nucleo_prods.sort(key=lambda p: (_tipo_order(p), p.get("categoria") or "", p.get("nombre") or ""))

        for p in nucleo_prods:
            codigo = str(p.get("codigo") or "").strip()
            if not codigo:
                continue
            alerta = alertas_map.get(codigo, {})
            result.append({
                "id": None,
                "nombre": p.get("nombre") or "",
                "codigo": codigo,
                "unidad_stock": None,
                "rubro_nombre": p.get("categoria") or None,
                "rubro_id": None,
                "tipo": alerta.get("tipo"),
                "updated_at": alerta.get("updated_at"),
                "updated_by": alerta.get("updated_by"),
                "nota": alerta.get("nota"),
                "priorizado": str(codigo) in priorizados_nucleo,
                "source": "nucleo",
            })
    except Exception as e:
        logger.warning(f"No se pudieron cargar productos de Nucleo: {e}")
        result.append({
            "id": None, "nombre": f"[Error Nucleo: {e}]", "codigo": "__error__",
            "unidad_stock": None, "rubro_nombre": None, "rubro_id": None,
            "tipo": None, "updated_at": None, "updated_by": None, "nota": None,
            "priorizado": False,
            "source": "nucleo_error",
        })

    return result


def set_alerta(producto_id: int, tipo, updated_by=None, nota=None):
    ensure_schema()
    # Leer nombre del producto (solo lectura de nucleocheck.db)
    with get_engine().connect() as conn:
        row = conn.execute(
            text("SELECT nombre FROM sg_productos WHERE id = :pid"), {"pid": producto_id}
        ).fetchone()
    nombre = row[0] if row else f"Producto #{producto_id}"

    # Leer tipo anterior y escribir en alertas.db (writable)
    with _get_alertas_engine().connect() as conn:
        row = conn.execute(
            text("SELECT tipo FROM panel_alertas WHERE producto_id = :pid"), {"pid": producto_id}
        ).fetchone()
        tipo_anterior = row[0] if row else None

        if tipo is None:
            conn.execute(text("DELETE FROM panel_alertas WHERE producto_id = :pid"), {"pid": producto_id})
        else:
            conn.execute(text("""
                INSERT INTO panel_alertas (producto_id, tipo, updated_at, updated_by, nota)
                VALUES (:pid, :tipo, strftime('%Y-%m-%d %H:%M:%S', 'now'), :by, :nota)
                ON CONFLICT(producto_id) DO UPDATE SET
                    tipo       = excluded.tipo,
                    updated_at = excluded.updated_at,
                    updated_by = excluded.updated_by,
                    nota       = excluded.nota
            """), {"pid": producto_id, "tipo": int(tipo), "by": updated_by, "nota": nota})
        conn.commit()

    from .telegram_service import notify_alerta
    notify_alerta(nombre, tipo_anterior, tipo, updated_by, nota)
    return {"success": True}


def set_priorizado(producto_id: int, priorizado: bool, updated_by=None):
    ensure_schema()
    with _get_alertas_engine().connect() as conn:
        if not priorizado:
            conn.execute(text("DELETE FROM panel_priorizados WHERE producto_id = :pid"), {"pid": producto_id})
        else:
            conn.execute(text("""
                INSERT INTO panel_priorizados (producto_id, updated_at, updated_by)
                VALUES (:pid, strftime('%Y-%m-%d %H:%M:%S', 'now'), :by)
                ON CONFLICT(producto_id) DO UPDATE SET
                    updated_at = excluded.updated_at,
                    updated_by = excluded.updated_by
            """), {"pid": producto_id, "by": updated_by})
        conn.commit()
    return {"success": True}


def set_priorizado_nucleo(codigo: str, nombre: str, priorizado: bool, updated_by=None):
    ensure_schema()
    with _get_alertas_engine().connect() as conn:
        if not priorizado:
            conn.execute(text("DELETE FROM panel_priorizados_nucleo WHERE codigo = :codigo"), {"codigo": codigo})
        else:
            conn.execute(text("""
                INSERT INTO panel_priorizados_nucleo (codigo, nombre, updated_at, updated_by)
                VALUES (:codigo, :nombre, strftime('%Y-%m-%d %H:%M:%S', 'now'), :by)
                ON CONFLICT(codigo) DO UPDATE SET
                    nombre     = excluded.nombre,
                    updated_at = excluded.updated_at,
                    updated_by = excluded.updated_by
            """), {"codigo": codigo, "nombre": nombre, "by": updated_by})
        conn.commit()
    return {"success": True}


def set_alerta_nucleo(codigo: str, nombre: str, tipo, updated_by=None, nota=None):
    ensure_schema()
    with _get_alertas_engine().connect() as conn:
        row = conn.execute(
            text("SELECT tipo FROM panel_alertas_nucleo WHERE codigo = :codigo"), {"codigo": codigo}
        ).fetchone()
        tipo_anterior = row[0] if row else None

        if tipo is None:
            conn.execute(text("DELETE FROM panel_alertas_nucleo WHERE codigo = :codigo"), {"codigo": codigo})
        else:
            conn.execute(text("""
                INSERT INTO panel_alertas_nucleo (codigo, nombre, tipo, updated_at, updated_by, nota)
                VALUES (:codigo, :nombre, :tipo, strftime('%Y-%m-%d %H:%M:%S', 'now'), :by, :nota)
                ON CONFLICT(codigo) DO UPDATE SET
                    nombre     = excluded.nombre,
                    tipo       = excluded.tipo,
                    updated_at = excluded.updated_at,
                    updated_by = excluded.updated_by,
                    nota       = excluded.nota
            """), {"codigo": codigo, "nombre": nombre, "tipo": int(tipo), "by": updated_by, "nota": nota})
        conn.commit()

    from .telegram_service import notify_alerta
    notify_alerta(nombre, tipo_anterior, tipo, updated_by, nota)
    return {"success": True}

"""Servicio para Metas de Venta."""
from datetime import datetime
from typing import Optional, List
import sqlite3
import pytz
from pathlib import Path

from sqlalchemy import text
from .database import get_engine

ARGENTINA_TZ = pytz.timezone('America/Argentina/Buenos_Aires')

# La DB con los datos de productos NucleoCheck (misma ruta que usan prediccion_service y estadistica_service)
_NUCLEO_DB = Path(__file__).resolve().parent.parent.parent / "nucleocheck.db"


def _nucleo_conn() -> sqlite3.Connection:
    return sqlite3.connect(str(_NUCLEO_DB))


def _now_arg() -> str:
    return datetime.now(ARGENTINA_TZ).strftime('%Y-%m-%d %H:%M:%S')


def _today_arg() -> str:
    return datetime.now(ARGENTINA_TZ).strftime('%Y-%m-%d')


def _current_periodo() -> str:
    return datetime.now(ARGENTINA_TZ).strftime('%Y-%m')


# ── CRUD ──────────────────────────────────────────────────────────────────────

def get_metas(activa: Optional[int] = None) -> List[dict]:
    engine = get_engine()
    with engine.connect() as conn:
        if activa is None:
            rows = conn.execute(
                text("SELECT * FROM metas_venta ORDER BY activa DESC, fecha_fin ASC, creado_en DESC")
            ).fetchall()
        else:
            rows = conn.execute(
                text("SELECT * FROM metas_venta WHERE activa = :a ORDER BY fecha_fin ASC, creado_en DESC"),
                {"a": activa}
            ).fetchall()
        return [dict(r._mapping) for r in rows]


def get_meta(meta_id: int) -> Optional[dict]:
    engine = get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM metas_venta WHERE id = :id"),
            {"id": meta_id}
        ).fetchone()
        return dict(row._mapping) if row else None


def create_meta(
    persona: str,
    producto_tipo: str,
    producto_nombre: str,
    meta_cantidad: float,
    fecha_fin: str,
    producto_codigo: Optional[str] = None,
) -> dict:
    engine = get_engine()
    now = _now_arg()
    today = _today_arg()

    base_periodo = None
    base_cantidad = None
    if producto_tipo == "nucleo" and producto_codigo:
        base_periodo = _current_periodo()
        base_cantidad = _get_periodo_cantidad(producto_codigo, base_periodo)

    with engine.begin() as conn:
        result = conn.execute(
            text("""
                INSERT INTO metas_venta
                    (persona, producto_tipo, producto_codigo, producto_nombre,
                     meta_cantidad, cantidad_actual, base_periodo, base_cantidad,
                     fecha_inicio, fecha_fin, activa, alcanzada, creado_en, actualizado_en, ultimo_trackeo)
                VALUES
                    (:persona, :tipo, :codigo, :nombre,
                     :meta, 0, :base_p, :base_c,
                     :inicio, :fin, 1, NULL, :now, :now, NULL)
            """),
            {
                "persona": persona, "tipo": producto_tipo,
                "codigo": producto_codigo, "nombre": producto_nombre,
                "meta": meta_cantidad, "base_p": base_periodo, "base_c": base_cantidad,
                "inicio": today, "fin": fecha_fin, "now": now,
            }
        )
        new_id = result.lastrowid

    return get_meta(new_id)


def update_meta(meta_id: int, **kwargs) -> Optional[dict]:
    if not kwargs:
        return get_meta(meta_id)
    engine = get_engine()
    kwargs["actualizado_en"] = _now_arg()
    sets = ", ".join(f"{k} = :{k}" for k in kwargs)
    with engine.begin() as conn:
        conn.execute(
            text(f"UPDATE metas_venta SET {sets} WHERE id = :_id"),
            {**kwargs, "_id": meta_id}
        )
    return get_meta(meta_id)


def delete_meta(meta_id: int) -> bool:
    engine = get_engine()
    with engine.begin() as conn:
        r = conn.execute(text("DELETE FROM metas_venta WHERE id = :id"), {"id": meta_id})
        return r.rowcount > 0


# ── Operaciones de cantidad ───────────────────────────────────────────────────

def ajustar_cantidad_manual(meta_id: int, delta: float) -> Optional[dict]:
    """Suma o resta delta a cantidad_actual (tipo texto)."""
    meta = get_meta(meta_id)
    if not meta:
        return None
    nueva = max(0.0, float(meta["cantidad_actual"] or 0) + delta)
    return update_meta(meta_id, cantidad_actual=nueva)


def completar_meta(meta_id: int) -> Optional[dict]:
    """Archiva una meta y determina si fue alcanzada."""
    meta = get_meta(meta_id)
    if not meta:
        return None
    alcanzada = 1 if float(meta["cantidad_actual"] or 0) >= float(meta["meta_cantidad"] or 1) else 0
    return update_meta(meta_id, activa=0, alcanzada=alcanzada)


# ── Tracking Nucleo ───────────────────────────────────────────────────────────

def _get_periodo_cantidad(codigo: str, periodo: str) -> float:
    """Cantidad más reciente registrada para un producto en un período (YYYY-MM)."""
    with _nucleo_conn() as conn:
        row = conn.execute(
            "SELECT CAST(cantidad AS REAL) AS qty FROM productos "
            "WHERE codigo = ? AND period_start LIKE ? "
            "ORDER BY fecha_scraping DESC LIMIT 1",
            (codigo, f"{periodo}%")
        ).fetchone()
        return float(row[0]) if row and row[0] else 0.0


def _calcular_cantidad_desde_base(codigo: str, base_periodo: str, base_cantidad: float) -> float:
    """
    Calcula el total vendido desde que se creó la meta.
    Para cada período posterior al base, suma la cantidad completa.
    Para el período base, descuenta lo que ya había vendido antes.
    """
    with _nucleo_conn() as conn:
        rows = conn.execute(
            "SELECT substr(period_start, 1, 7) AS periodo, MAX(CAST(cantidad AS REAL)) AS qty "
            "FROM productos WHERE codigo = ? "
            "GROUP BY substr(period_start, 1, 7) ORDER BY periodo ASC",
            (codigo,)
        ).fetchall()

    total = 0.0
    for row in rows:
        periodo = (row[0] or "")
        qty = float(row[1] or 0)
        if periodo < base_periodo:
            continue
        elif periodo == base_periodo:
            total += max(0.0, qty - base_cantidad)
        else:
            total += qty

    return total


def actualizar_nucleo_meta(meta_id: int) -> Optional[dict]:
    """Actualiza cantidad_actual de una meta tipo nucleo consultando la DB."""
    meta = get_meta(meta_id)
    if not meta or meta["producto_tipo"] != "nucleo":
        return meta

    codigo = meta.get("producto_codigo")
    base_periodo = meta.get("base_periodo")
    base_cantidad = float(meta.get("base_cantidad") or 0)

    if not codigo or not base_periodo:
        return meta

    nueva = _calcular_cantidad_desde_base(codigo, base_periodo, base_cantidad)
    return update_meta(meta_id, cantidad_actual=nueva, ultimo_trackeo=_now_arg())


def trackear_todas_nucleo() -> dict:
    """Trackea todas las metas activas de tipo nucleo (para el scheduler)."""
    metas = get_metas(activa=1)
    ok, errores = 0, []
    for meta in metas:
        if meta["producto_tipo"] != "nucleo":
            continue
        try:
            actualizar_nucleo_meta(meta["id"])
            ok += 1
        except Exception as e:
            errores.append({"id": meta["id"], "error": str(e)})
    return {"actualizadas": ok, "errores": errores}


# ── Productos NucleoCheck disponibles ─────────────────────────────────────────

def get_productos_nucleo() -> List[dict]:
    """Lista única de productos disponibles en NucleoCheck para el buscador."""
    with _nucleo_conn() as conn:
        rows = conn.execute(
            "SELECT p.codigo, p.nombre FROM productos p "
            "INNER JOIN ("
            "  SELECT codigo, MAX(fecha_scraping) AS max_dt "
            "  FROM productos "
            "  WHERE codigo IS NOT NULL AND TRIM(codigo) != '' "
            "  AND nombre IS NOT NULL AND TRIM(nombre) != '' "
            "  GROUP BY codigo"
            ") latest ON p.codigo = latest.codigo AND p.fecha_scraping = latest.max_dt "
            "GROUP BY p.codigo "
            "ORDER BY p.nombre ASC"
        ).fetchall()
        return [{"codigo": r[0], "nombre": r[1]} for r in rows]

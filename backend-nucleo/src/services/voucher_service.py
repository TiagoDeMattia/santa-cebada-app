"""Voucher — beneficio mensual de empleados."""
from datetime import datetime
from typing import List, Optional
import pytz

from sqlalchemy import text
from .database import get_engine

ARGENTINA_TZ = pytz.timezone("America/Argentina/Buenos_Aires")
PRESUPUESTO_DEFAULT = 75000


def _now() -> str:
    return datetime.now(ARGENTINA_TZ).strftime("%Y-%m-%d %H:%M:%S")


def _current_periodo() -> str:
    return datetime.now(ARGENTINA_TZ).strftime("%Y-%m")


# ── Config global ─────────────────────────────────────────────────────────────

def get_config_presupuesto() -> int:
    try:
        with get_engine().connect() as conn:
            row = conn.execute(
                text("SELECT valor FROM voucher_config WHERE clave = 'presupuesto_base'")
            ).fetchone()
            return int(row[0]) if row else PRESUPUESTO_DEFAULT
    except Exception:
        return PRESUPUESTO_DEFAULT


def set_config_presupuesto(valor: int) -> int:
    with get_engine().begin() as conn:
        conn.execute(text(
            "INSERT INTO voucher_config (clave, valor) VALUES ('presupuesto_base', :v) "
            "ON CONFLICT(clave) DO UPDATE SET valor = :v"
        ), {"v": str(valor)})
    return valor


# ── Empleados ─────────────────────────────────────────────────────────────────

def get_empleados(include_inactive: bool = True) -> List[dict]:
    engine = get_engine()
    with engine.connect() as conn:
        if include_inactive:
            rows = conn.execute(
                text("SELECT * FROM voucher_empleados ORDER BY apellido, nombre")
            ).fetchall()
        else:
            rows = conn.execute(
                text("SELECT * FROM voucher_empleados WHERE activo = 1 ORDER BY apellido, nombre")
            ).fetchall()
        return [dict(r._mapping) for r in rows]


def create_empleado(nombre: str, apellido: str) -> dict:
    engine = get_engine()
    with engine.begin() as conn:
        result = conn.execute(
            text(
                "INSERT INTO voucher_empleados (nombre, apellido, activo, created_at) "
                "VALUES (:nombre, :apellido, 1, :ts)"
            ),
            {"nombre": nombre.strip(), "apellido": apellido.strip(), "ts": _now()},
        )
        row = conn.execute(
            text("SELECT * FROM voucher_empleados WHERE id = :id"),
            {"id": result.lastrowid},
        ).fetchone()
        return dict(row._mapping)


def update_empleado(empleado_id: int, **fields) -> Optional[dict]:
    allowed = {"nombre", "apellido", "activo"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_empleado(empleado_id)
    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(f"UPDATE voucher_empleados SET {set_clause} WHERE id = :id"),
            {**updates, "id": empleado_id},
        )
        row = conn.execute(
            text("SELECT * FROM voucher_empleados WHERE id = :id"),
            {"id": empleado_id},
        ).fetchone()
        return dict(row._mapping) if row else None


def get_empleado(empleado_id: int) -> Optional[dict]:
    engine = get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM voucher_empleados WHERE id = :id"),
            {"id": empleado_id},
        ).fetchone()
        return dict(row._mapping) if row else None


# ── Presupuesto (extra individual) ────────────────────────────────────────────

def _ensure_presupuesto(conn, empleado_id: int, periodo: str) -> dict:
    row = conn.execute(
        text("SELECT * FROM voucher_presupuestos WHERE empleado_id = :e AND periodo = :p"),
        {"e": empleado_id, "p": periodo},
    ).fetchone()
    if row:
        return dict(row._mapping)
    conn.execute(
        text(
            "INSERT INTO voucher_presupuestos (empleado_id, periodo, presupuesto, extra) "
            "VALUES (:e, :p, :pr, 0)"
        ),
        {"e": empleado_id, "p": periodo, "pr": get_config_presupuesto()},
    )
    row = conn.execute(
        text("SELECT * FROM voucher_presupuestos WHERE empleado_id = :e AND periodo = :p"),
        {"e": empleado_id, "p": periodo},
    ).fetchone()
    return dict(row._mapping)


def get_presupuesto(empleado_id: int, periodo: str) -> dict:
    engine = get_engine()
    with engine.begin() as conn:
        return _ensure_presupuesto(conn, empleado_id, periodo)


def update_presupuesto(empleado_id: int, periodo: str, extra: Optional[int] = None) -> dict:
    engine = get_engine()
    with engine.begin() as conn:
        _ensure_presupuesto(conn, empleado_id, periodo)
        if extra is not None:
            conn.execute(
                text("UPDATE voucher_presupuestos SET extra = :ex WHERE empleado_id = :e AND periodo = :p"),
                {"ex": extra, "e": empleado_id, "p": periodo},
            )
        row = conn.execute(
            text("SELECT * FROM voucher_presupuestos WHERE empleado_id = :e AND periodo = :p"),
            {"e": empleado_id, "p": periodo},
        ).fetchone()
        return dict(row._mapping)


# ── Entradas ──────────────────────────────────────────────────────────────────

def get_entradas(empleado_id: int, periodo: str) -> List[dict]:
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT * FROM voucher_entradas "
                "WHERE empleado_id = :e AND periodo = :p "
                "ORDER BY created_at DESC"
            ),
            {"e": empleado_id, "p": periodo},
        ).fetchall()
        return [dict(r._mapping) for r in rows]


def get_entradas_periodo(periodo: str) -> List[dict]:
    """Todas las entradas del período (todos los empleados)."""
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT * FROM voucher_entradas "
                "WHERE periodo = :p "
                "ORDER BY empleado_id, created_at DESC"
            ),
            {"p": periodo},
        ).fetchall()
        return [dict(r._mapping) for r in rows]


def add_entrada(
    empleado_id: int,
    periodo: str,
    producto_nombre: str,
    producto_precio: int,
    cantidad: int = 1,
    tipo: str = "consumo",
    fecha: Optional[str] = None,
) -> dict:
    engine = get_engine()
    fecha_val = fecha or datetime.now(ARGENTINA_TZ).strftime("%Y-%m-%d")
    with engine.begin() as conn:
        result = conn.execute(
            text(
                "INSERT INTO voucher_entradas "
                "(empleado_id, periodo, producto_nombre, producto_precio, cantidad, tipo, fecha, created_at) "
                "VALUES (:e, :p, :pn, :pp, :c, :tipo, :fecha, :ts)"
            ),
            {
                "e": empleado_id,
                "p": periodo,
                "pn": producto_nombre.strip(),
                "pp": producto_precio,
                "c": cantidad,
                "tipo": tipo,
                "fecha": fecha_val,
                "ts": _now(),
            },
        )
        row = conn.execute(
            text("SELECT * FROM voucher_entradas WHERE id = :id"),
            {"id": result.lastrowid},
        ).fetchone()
        return dict(row._mapping)


def delete_entrada(entrada_id: int) -> bool:
    engine = get_engine()
    with engine.begin() as conn:
        result = conn.execute(
            text("DELETE FROM voucher_entradas WHERE id = :id"),
            {"id": entrada_id},
        )
        return result.rowcount > 0


# ── Resumen ───────────────────────────────────────────────────────────────────

def get_resumen_empleado(empleado_id: int, periodo: str) -> dict:
    engine = get_engine()
    with engine.begin() as conn:
        pres = _ensure_presupuesto(conn, empleado_id, periodo)
        row = conn.execute(
            text(
                "SELECT "
                "SUM(CASE WHEN tipo = 'consumo'   THEN producto_precio * cantidad ELSE 0 END) AS consumos, "
                "SUM(CASE WHEN tipo = 'descuento' THEN producto_precio * cantidad ELSE 0 END) AS descuentos "
                "FROM voucher_entradas WHERE empleado_id = :e AND periodo = :p"
            ),
            {"e": empleado_id, "p": periodo},
        ).fetchone()
        total_consumos  = int(row[0] or 0)
        total_descuentos = int(row[1] or 0)
        total_gastado = total_consumos - total_descuentos
        presupuesto_base = get_config_presupuesto()
        presupuesto_total = presupuesto_base + pres["extra"]
        diferencia = total_gastado - presupuesto_total
        return {
            "empleado_id": empleado_id,
            "periodo": periodo,
            "presupuesto_base": presupuesto_base,
            "extra": pres["extra"],
            "presupuesto_total": presupuesto_total,
            "total_consumos": total_consumos,
            "total_descuentos": total_descuentos,
            "total_gastado": total_gastado,
            "diferencia": diferencia,
            "excedido": diferencia > 0,
        }


def get_resumen_periodo(periodo: str) -> List[dict]:
    empleados = get_empleados(include_inactive=False)
    return [get_resumen_empleado(e["id"], periodo) for e in empleados]


# ── Productos del catálogo ────────────────────────────────────────────────────

def _get_codigos_habilitados() -> set:
    """Devuelve el conjunto de códigos explícitamente deshabilitados."""
    try:
        with get_engine().connect() as conn:
            rows = conn.execute(text(
                "SELECT codigo, habilitado FROM voucher_productos_habilitados"
            )).fetchall()
        return {r[0] for r in rows if r[1] == 0}
    except Exception:
        return set()


def _get_rubros_deshabilitados() -> set:
    """Devuelve el conjunto de rubros/categorías deshabilitados."""
    try:
        with get_engine().connect() as conn:
            rows = conn.execute(text(
                "SELECT rubro, habilitado FROM voucher_rubros_habilitados"
            )).fetchall()
        return {r[0] for r in rows if r[1] == 0}
    except Exception:
        return set()


def get_productos_catalogo(q: Optional[str] = None) -> List[dict]:
    import json as _json
    from .catalogo_service import get_catalogo
    try:
        productos = get_catalogo("1")
    except Exception:
        return []
    deshabilitados = _get_codigos_habilitados()
    rubros_des = _get_rubros_deshabilitados()
    activos = []
    for p in productos:
        if not p.get("activo"):
            continue
        codigo = p.get("codigo", "")
        if codigo in deshabilitados:
            continue
        if (p.get("categoria") or "") in rubros_des:
            continue
        precio = 0
        raw = p.get("raw_json")
        if raw:
            try:
                raw_data = _json.loads(raw) if isinstance(raw, str) else raw
                precio = int(raw_data.get("Price", 0) or 0)
            except Exception:
                pass
        activos.append({
            "codigo": codigo,
            "nombre": p.get("nombre", ""),
            "precio": precio,
            "categoria": p.get("categoria", ""),
        })
    if q:
        q_lower = q.lower()
        activos = [p for p in activos if q_lower in p["nombre"].lower() or q_lower in (p["categoria"] or "").lower()]
    return sorted(activos, key=lambda p: p["nombre"])


def get_productos_config() -> List[dict]:
    """Lista TODOS los productos activos del catálogo con su estado habilitado/deshabilitado para voucher."""
    import json as _json
    from .catalogo_service import get_catalogo
    try:
        productos = get_catalogo("1")
    except Exception:
        return []
    try:
        with get_engine().connect() as conn:
            rows = conn.execute(text(
                "SELECT codigo, habilitado FROM voucher_productos_habilitados"
            )).fetchall()
        estado_map = {r[0]: bool(r[1]) for r in rows}
    except Exception:
        estado_map = {}
    result = []
    for p in productos:
        if not p.get("activo"):
            continue
        codigo = p.get("codigo", "")
        precio = 0
        raw = p.get("raw_json")
        if raw:
            try:
                raw_data = _json.loads(raw) if isinstance(raw, str) else raw
                precio = int(raw_data.get("Price", 0) or 0)
            except Exception:
                pass
        result.append({
            "codigo": codigo,
            "nombre": p.get("nombre", ""),
            "precio": precio,
            "categoria": p.get("categoria", ""),
            "habilitado": estado_map.get(codigo, True),
        })
    return sorted(result, key=lambda p: p["nombre"])


def set_producto_habilitado(codigo: str, habilitado: bool) -> dict:
    with get_engine().begin() as conn:
        conn.execute(text(
            "INSERT INTO voucher_productos_habilitados (codigo, habilitado) VALUES (:c, :h) "
            "ON CONFLICT(codigo) DO UPDATE SET habilitado = :h"
        ), {"c": codigo, "h": int(habilitado)})
    return {"codigo": codigo, "habilitado": habilitado}


def get_rubros_config() -> List[dict]:
    """Lista todos los rubros/categorías del catálogo activo con su estado habilitado."""
    import json as _json
    from .catalogo_service import get_catalogo
    try:
        productos = get_catalogo("1")
    except Exception:
        return []
    try:
        with get_engine().connect() as conn:
            rows = conn.execute(text(
                "SELECT rubro, habilitado FROM voucher_rubros_habilitados"
            )).fetchall()
        estado_map = {r[0]: bool(r[1]) for r in rows}
    except Exception:
        estado_map = {}
    rubros: dict[str, bool] = {}
    for p in productos:
        if not p.get("activo"):
            continue
        cat = p.get("categoria") or ""
        if cat and cat not in rubros:
            rubros[cat] = estado_map.get(cat, True)
    return sorted([{"rubro": r, "habilitado": h} for r, h in rubros.items()], key=lambda x: x["rubro"])


def set_rubro_habilitado(rubro: str, habilitado: bool) -> dict:
    with get_engine().begin() as conn:
        conn.execute(text(
            "INSERT INTO voucher_rubros_habilitados (rubro, habilitado) VALUES (:r, :h) "
            "ON CONFLICT(rubro) DO UPDATE SET habilitado = :h"
        ), {"r": rubro, "h": int(habilitado)})
    return {"rubro": rubro, "habilitado": habilitado}

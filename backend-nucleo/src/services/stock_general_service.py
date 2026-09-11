"""
Stock General: rubros, productos, proveedores, planillas y pedidos.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from .database import get_engine, ensure_schema


def _now() -> str:
    from datetime import timezone, timedelta
    _ARG_TZ = timezone(timedelta(hours=-3))
    return datetime.now(_ARG_TZ).isoformat()


# ── Rubros ────────────────────────────────────────────────────────────────────

def get_rubros(incluir_inactivos: bool = False) -> List[Dict]:
    ensure_schema()
    cond = "" if incluir_inactivos else "WHERE activo = 1"
    with get_engine().connect() as conn:
        rows = conn.execute(text(f"SELECT * FROM sg_rubros {cond} ORDER BY orden, nombre")).fetchall()
    return [dict(r._mapping) for r in rows]


def create_rubro(codigo: str, nombre: str, descripcion: str = "", orden: int = 0) -> Dict:
    ensure_schema()
    codigo = codigo.strip().upper()
    with get_engine().begin() as conn:
        conn.execute(text("""
            INSERT INTO sg_rubros (codigo, nombre, descripcion, orden, activo, created_at)
            VALUES (:codigo, :nombre, :descripcion, :orden, 1, :ts)
        """), {"codigo": codigo, "nombre": nombre.strip(), "descripcion": descripcion.strip(),
               "orden": orden, "ts": _now()})
        row = conn.execute(text("SELECT * FROM sg_rubros WHERE codigo = :c"), {"c": codigo}).fetchone()
    return dict(row._mapping)


def update_rubro(rubro_id: int, codigo: Optional[str] = None, nombre: Optional[str] = None,
                 descripcion: Optional[str] = None, orden: Optional[int] = None,
                 activo: Optional[bool] = None) -> Dict:
    ensure_schema()
    sets, params = [], {"id": rubro_id}
    if codigo is not None:
        c = codigo.strip().upper()
        with get_engine().connect() as conn:
            dup = conn.execute(text("SELECT id FROM sg_rubros WHERE codigo = :c AND id != :id"), {"c": c, "id": rubro_id}).fetchone()
        if dup:
            raise ValueError(f"Ya existe un rubro con el código '{c}'")
        sets.append("codigo = :codigo"); params["codigo"] = c
    if nombre is not None:
        sets.append("nombre = :nombre"); params["nombre"] = nombre.strip()
    if descripcion is not None:
        sets.append("descripcion = :desc"); params["desc"] = descripcion.strip()
    if orden is not None:
        sets.append("orden = :orden"); params["orden"] = orden
    if activo is not None:
        sets.append("activo = :activo"); params["activo"] = int(activo)
    if not sets:
        raise ValueError("Nada que actualizar")
    with get_engine().begin() as conn:
        conn.execute(text(f"UPDATE sg_rubros SET {', '.join(sets)} WHERE id = :id"), params)
        row = conn.execute(text("SELECT * FROM sg_rubros WHERE id = :id"), {"id": rubro_id}).fetchone()
    return dict(row._mapping)


def delete_rubro(rubro_id: int) -> bool:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(text("UPDATE sg_rubros SET activo = 0 WHERE id = :id"), {"id": rubro_id})
    return True


# ── Productos ─────────────────────────────────────────────────────────────────

def get_productos(rubro_id: Optional[int] = None, incluir_inactivos: bool = False,
                  busqueda: Optional[str] = None) -> List[Dict]:
    ensure_schema()
    conds = [] if incluir_inactivos else ["p.activo = 1"]
    params: Dict[str, Any] = {}
    if rubro_id is not None:
        conds.append("p.rubro_id = :rubro_id"); params["rubro_id"] = rubro_id
    if busqueda:
        conds.append("(LOWER(p.nombre) LIKE :b OR LOWER(p.codigo) LIKE :b)")
        params["b"] = f"%{busqueda.lower()}%"
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    sql = f"""
        SELECT p.id, p.codigo, p.nombre, p.nombre_proveedor, p.descripcion,
               p.proveedor_id,
               pv.nombre AS proveedor_nombre,
               COALESCE(p.unidad_stock, 'unidad') AS unidad_stock,
               COALESCE(p.unidad_pedido, 'unidad') AS unidad_pedido,
               p.activo, p.created_at
        FROM sg_productos p
        LEFT JOIN sg_proveedores pv ON pv.id = p.proveedor_id
        {where}
        ORDER BY p.nombre
    """
    with get_engine().connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


def create_producto(codigo: str, nombre: str, nombre_proveedor: Optional[str] = None,
                    descripcion: str = "",
                    proveedor_id: Optional[int] = None,
                    unidad_stock: str = "unidad", unidad_pedido: str = "unidad") -> Dict:
    ensure_schema()
    codigo = codigo.strip().upper()
    with get_engine().begin() as conn:
        dup = conn.execute(text("SELECT id FROM sg_productos WHERE codigo = :c"), {"c": codigo}).fetchone()
        if dup:
            raise ValueError(f"Ya existe un producto con el código '{codigo}'")
        conn.execute(text("""
            INSERT INTO sg_productos
                (codigo, nombre, nombre_proveedor, descripcion, proveedor_id, unidad_stock, unidad_pedido, activo, created_at)
            VALUES
                (:codigo, :nombre, :nom_prov, :desc, :prov, :us, :up, 1, :ts)
        """), {"codigo": codigo, "nombre": nombre.strip(),
               "nom_prov": nombre_proveedor.strip() if nombre_proveedor else None,
               "desc": descripcion.strip(),
               "prov": proveedor_id, "us": unidad_stock, "up": unidad_pedido, "ts": _now()})
        row = conn.execute(text("SELECT * FROM sg_productos WHERE codigo = :c"), {"c": codigo}).fetchone()
    return dict(row._mapping)


def update_producto(producto_id: int, codigo: Optional[str] = None, nombre: Optional[str] = None,
                    nombre_proveedor: Optional[str] = None,
                    descripcion: Optional[str] = None,
                    proveedor_id: Optional[int] = None,
                    unidad_stock: Optional[str] = None,
                    unidad_pedido: Optional[str] = None, activo: Optional[bool] = None) -> Dict:
    ensure_schema()
    sets, params = [], {"id": producto_id}
    if codigo is not None:
        c = codigo.strip().upper()
        with get_engine().connect() as conn:
            dup = conn.execute(text("SELECT id FROM sg_productos WHERE codigo = :c AND id != :id"), {"c": c, "id": producto_id}).fetchone()
        if dup:
            raise ValueError(f"Ya existe un producto con el código '{c}'")
        sets.append("codigo = :codigo"); params["codigo"] = c
    if nombre is not None:
        sets.append("nombre = :nombre"); params["nombre"] = nombre.strip()
    if nombre_proveedor is not None:
        sets.append("nombre_proveedor = :nom_prov")
        params["nom_prov"] = nombre_proveedor.strip() if nombre_proveedor.strip() else None
    if descripcion is not None:
        sets.append("descripcion = :desc"); params["desc"] = descripcion.strip()
    if proveedor_id is not None:
        sets.append("proveedor_id = :prov"); params["prov"] = proveedor_id if proveedor_id > 0 else None
    if unidad_stock is not None:
        sets.append("unidad_stock = :us"); params["us"] = unidad_stock
    if unidad_pedido is not None:
        sets.append("unidad_pedido = :up"); params["up"] = unidad_pedido
    if activo is not None:
        sets.append("activo = :activo"); params["activo"] = int(activo)
    if not sets:
        raise ValueError("Nada que actualizar")
    with get_engine().begin() as conn:
        conn.execute(text(f"UPDATE sg_productos SET {', '.join(sets)} WHERE id = :id"), params)
        row = conn.execute(text("SELECT * FROM sg_productos WHERE id = :id"), {"id": producto_id}).fetchone()
    return dict(row._mapping)


def delete_producto(producto_id: int) -> bool:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(text("UPDATE sg_productos SET activo = 0 WHERE id = :id"), {"id": producto_id})
    return True


# ── Planilla Items (configuración persistente por área) ───────────────────────

def get_planilla_items(area: str) -> List[Dict]:
    ensure_schema()
    sql = """
        SELECT pi.id AS item_id, pi.area, pi.producto_id, pi.rubro_id, pi.orden,
               p.codigo, p.nombre,
               COALESCE(p.unidad_stock, 'unidad') AS unidad_stock,
               COALESCE(p.unidad_pedido, 'unidad') AS unidad_pedido,
               r.nombre AS rubro_nombre, r.orden AS rubro_orden
        FROM sg_planilla_items pi
        JOIN sg_productos p ON p.id = pi.producto_id AND p.activo = 1
        LEFT JOIN sg_rubros r ON r.id = pi.rubro_id
        WHERE pi.area = :area
        ORDER BY COALESCE(r.orden, 999), COALESCE(r.nombre, ''), pi.orden, p.nombre
    """
    with get_engine().connect() as conn:
        rows = conn.execute(text(sql), {"area": area}).fetchall()
    return [dict(r._mapping) for r in rows]


def add_planilla_item(area: str, producto_id: int, rubro_id: Optional[int] = None) -> Dict:
    ensure_schema()
    with get_engine().begin() as conn:
        existing = conn.execute(
            text("SELECT id FROM sg_planilla_items WHERE area = :a AND producto_id = :p"),
            {"a": area, "p": producto_id}
        ).fetchone()
        if existing:
            return {"item_id": existing.id, "already_exists": True}
        max_orden = conn.execute(
            text("SELECT COALESCE(MAX(orden), -1) FROM sg_planilla_items WHERE area = :a"),
            {"a": area}
        ).scalar()
        conn.execute(text("""
            INSERT INTO sg_planilla_items (area, producto_id, rubro_id, orden)
            VALUES (:area, :prod, :rubro, :orden)
        """), {"area": area, "prod": producto_id, "rubro": rubro_id, "orden": max_orden + 1})
        row = conn.execute(
            text("SELECT * FROM sg_planilla_items WHERE area = :a AND producto_id = :p"),
            {"a": area, "p": producto_id}
        ).fetchone()
    return dict(row._mapping)


def update_planilla_item(item_id: int, rubro_id: Optional[int] = None, orden: Optional[int] = None) -> Dict:
    ensure_schema()
    sets, params = [], {"id": item_id}
    if rubro_id is not None:
        sets.append("rubro_id = :rubro_id")
        params["rubro_id"] = rubro_id if rubro_id > 0 else None
    if orden is not None:
        sets.append("orden = :orden"); params["orden"] = orden
    if not sets:
        raise ValueError("Nada que actualizar")
    with get_engine().begin() as conn:
        conn.execute(text(f"UPDATE sg_planilla_items SET {', '.join(sets)} WHERE id = :id"), params)
        row = conn.execute(text("SELECT * FROM sg_planilla_items WHERE id = :id"), {"id": item_id}).fetchone()
    return dict(row._mapping)


def remove_planilla_item(item_id: int) -> bool:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(text("DELETE FROM sg_planilla_items WHERE id = :id"), {"id": item_id})
    return True


# ── Planilla ──────────────────────────────────────────────────────────────────

def get_planilla(fecha: str, area: str) -> List[Dict]:
    ensure_schema()
    sql = """
        SELECT
            pi.id AS item_id, pi.orden AS item_orden,
            p.id AS producto_id, p.codigo, p.nombre,
            COALESCE(p.unidad_stock, 'unidad') AS unidad_stock,
            COALESCE(p.unidad_pedido, 'unidad') AS unidad_pedido,
            pi.rubro_id,
            r.nombre AS rubro_nombre, r.orden AS rubro_orden,
            reg.id AS registro_id, reg.stock, reg.pedido, reg.notas
        FROM sg_planilla_items pi
        JOIN sg_productos p ON p.id = pi.producto_id AND p.activo = 1
        LEFT JOIN sg_rubros r ON r.id = pi.rubro_id
        LEFT JOIN sg_registros reg
            ON reg.producto_id = p.id AND reg.fecha = :fecha AND reg.area = :area
        WHERE pi.area = :area
        ORDER BY COALESCE(r.orden, 999), COALESCE(r.nombre, ''), pi.orden, p.nombre
    """
    with get_engine().connect() as conn:
        rows = conn.execute(text(sql), {"fecha": fecha, "area": area}).fetchall()
    return [dict(r._mapping) for r in rows]


def save_planilla(fecha: str, area: str, entries: List[Dict], creado_por: str = "", es_modificacion: bool = False, nota_edicion: str = "") -> int:
    ensure_schema()
    ts = _now()
    saved = 0
    with get_engine().begin() as conn:
        for e in entries:
            pid = e["producto_id"]
            existing = conn.execute(
                text("SELECT id FROM sg_registros WHERE fecha=:f AND area=:a AND producto_id=:p"),
                {"f": fecha, "a": area, "p": pid}
            ).fetchone()
            if existing:
                conn.execute(text("""
                    UPDATE sg_registros
                    SET stock=:stock, pedido=:pedido, notas=:notas, creado_por=:cp, created_at=:ts,
                        editado_por=:editado_por, nota_edicion=:nota_edicion
                    WHERE id=:id
                """), {"stock": e.get("stock"), "pedido": e.get("pedido"),
                       "notas": e.get("notas", ""), "cp": creado_por, "ts": ts, "id": existing.id,
                       "editado_por": creado_por if es_modificacion else None,
                       "nota_edicion": nota_edicion if es_modificacion else None})
            else:
                conn.execute(text("""
                    INSERT INTO sg_registros (fecha, area, producto_id, stock, pedido, notas, creado_por, created_at)
                    VALUES (:f, :a, :p, :stock, :pedido, :notas, :cp, :ts)
                """), {"f": fecha, "a": area, "p": pid,
                       "stock": e.get("stock"), "pedido": e.get("pedido"),
                       "notas": e.get("notas", ""), "cp": creado_por, "ts": ts})
            saved += 1
    return saved


# ── Otros Registros ────────────────────────────────────────────────────────────

def get_otros(fecha: str, area: str) -> List[Dict]:
    ensure_schema()
    with get_engine().connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM sg_otros_registros WHERE fecha=:f AND area=:a ORDER BY fila"),
            {"f": fecha, "a": area}
        ).fetchall()
    existing = {r._mapping["fila"]: dict(r._mapping) for r in rows}
    result = []
    for fila in range(1, 7):
        result.append(existing.get(fila, {
            "id": None, "fecha": fecha, "area": area, "fila": fila,
            "nombre": "", "u_stock": "", "u_pedido": "", "stock": None, "pedido": None, "notas": None
        }))
    return result


def save_otros(fecha: str, area: str, rows: List[Dict]) -> int:
    ensure_schema()
    saved = 0
    with get_engine().begin() as conn:
        for r in rows:
            fila = r.get("fila")
            if not fila:
                continue
            existing = conn.execute(
                text("SELECT id FROM sg_otros_registros WHERE fecha=:f AND area=:a AND fila=:fila"),
                {"f": fecha, "a": area, "fila": fila}
            ).fetchone()
            notas = r.get("notas") or None
            if existing:
                conn.execute(text("""
                    UPDATE sg_otros_registros
                    SET nombre=:nombre, u_stock=:us, u_pedido=:up, stock=:stock, pedido=:pedido, notas=:notas
                    WHERE id=:id
                """), {"nombre": r.get("nombre") or None, "us": r.get("u_stock") or None,
                       "up": r.get("u_pedido") or None, "stock": r.get("stock"),
                       "pedido": r.get("pedido"), "notas": notas, "id": existing.id})
            else:
                conn.execute(text("""
                    INSERT INTO sg_otros_registros (fecha, area, fila, nombre, u_stock, u_pedido, stock, pedido, notas)
                    VALUES (:f, :a, :fila, :nombre, :us, :up, :stock, :pedido, :notas)
                """), {"f": fecha, "a": area, "fila": fila,
                       "nombre": r.get("nombre") or None, "us": r.get("u_stock") or None,
                       "up": r.get("u_pedido") or None, "stock": r.get("stock"),
                       "pedido": r.get("pedido"), "notas": notas})
            saved += 1
    return saved


# ── Pedidos del Dia ────────────────────────────────────────────────────────────

def get_pedidos_del_dia(fecha: str) -> List[Dict]:
    ensure_schema()
    sql = """
        SELECT
            reg.id AS registro_id, reg.fecha, reg.area,
            reg.stock, reg.pedido, reg.notas,
            p.id AS producto_id, p.codigo, p.nombre,
            COALESCE(p.nombre_proveedor, p.nombre) AS nombre_pedido,
            COALESCE(p.unidad_pedido, 'unidad') AS unidad_pedido,
            p.proveedor_id,
            pv.nombre AS proveedor_nombre,
            pv.nombre_remitente,
            pv.info_reco
        FROM sg_registros reg
        JOIN sg_productos p ON p.id = reg.producto_id AND p.activo = 1
        LEFT JOIN sg_proveedores pv ON pv.id = p.proveedor_id
        WHERE reg.fecha = :fecha AND reg.pedido > 0
        ORDER BY reg.area, pv.nombre, p.nombre
    """
    with get_engine().connect() as conn:
        rows = conn.execute(text(sql), {"fecha": fecha}).fetchall()
    return [dict(r._mapping) for r in rows]


def get_periodos() -> List[str]:
    """Retorna fechas/períodos donde hay stock real cargado, ordenados desc."""
    ensure_schema()
    with get_engine().connect() as conn:
        rows = conn.execute(text("""
            SELECT DISTINCT fecha FROM (
                SELECT fecha FROM sg_registros WHERE stock IS NOT NULL
                UNION SELECT fecha FROM sg_otros_registros WHERE stock IS NOT NULL
                UNION SELECT fecha FROM sg_stock_cervezas_historial
                      WHERE estilo_actual IS NOT NULL AND estilo_actual != ''
            ) ORDER BY fecha DESC
        """)).fetchall()
    return [r[0] for r in rows if r[0]]


def get_umbrales() -> List[Dict]:
    """Retorna los umbrales de alerta por estilo de cerveza."""
    ensure_schema()
    with get_engine().connect() as conn:
        rows = conn.execute(text(
            "SELECT estilo, umbral FROM sg_cerveza_umbrales ORDER BY estilo"
        )).fetchall()
    return [dict(r._mapping) for r in rows]


def save_umbral(estilo: str, umbral: str) -> Dict:
    """Guarda o actualiza el umbral de alerta para un estilo."""
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(text("""
            INSERT INTO sg_cerveza_umbrales (estilo, umbral, updated_at)
            VALUES (:e, :u, :ts)
            ON CONFLICT(estilo) DO UPDATE SET umbral = excluded.umbral, updated_at = excluded.updated_at
        """), {"e": estilo.strip(), "u": umbral.strip(), "ts": _now()})
    return {"estilo": estilo, "umbral": umbral}


def get_pedidos_ultimo() -> Dict:
    ensure_schema()
    with get_engine().connect() as conn:
        row = conn.execute(text(
            "SELECT MAX(fecha) AS fecha FROM sg_registros WHERE pedido > 0"
        )).fetchone()
    fecha = row[0] if row and row[0] else None
    if not fecha:
        return {"fecha": None, "pedidos": []}
    pedidos = get_pedidos_del_dia(fecha)
    return {"fecha": fecha, "pedidos": pedidos}


# ── Asignaciones y Confirmaciones de Pedidos ─────────────────────────────────

def get_pedido_asignaciones(fecha: str) -> Dict[int, Optional[int]]:
    """Retorna {producto_id: proveedor_id | None} para la fecha dada."""
    ensure_schema()
    with get_engine().connect() as conn:
        rows = conn.execute(text(
            "SELECT producto_id, proveedor_id FROM sg_pedido_asignaciones WHERE fecha = :f"
        ), {"f": fecha}).fetchall()
    return {r[0]: r[1] for r in rows}


def save_pedido_asignacion(fecha: str, producto_id: int, proveedor_id: Optional[int]) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(text("""
            INSERT INTO sg_pedido_asignaciones (fecha, producto_id, proveedor_id, created_at)
            VALUES (:f, :pid, :prov, :ts)
            ON CONFLICT(fecha, producto_id) DO UPDATE SET proveedor_id = excluded.proveedor_id
        """), {"f": fecha, "pid": producto_id, "prov": proveedor_id, "ts": _now()})


def get_pedido_confirmaciones(fecha: str) -> Dict[int, bool]:
    """Retorna {proveedor_id: enviado_bool} para la fecha dada."""
    ensure_schema()
    with get_engine().connect() as conn:
        rows = conn.execute(text(
            "SELECT proveedor_id, enviado FROM sg_pedido_confirmaciones WHERE fecha = :f"
        ), {"f": fecha}).fetchall()
    return {r[0]: bool(r[1]) for r in rows}


def save_pedido_confirmacion(fecha: str, proveedor_id: int, enviado: bool) -> None:
    ensure_schema()
    ts = _now() if enviado else None
    with get_engine().begin() as conn:
        conn.execute(text("""
            INSERT INTO sg_pedido_confirmaciones (fecha, proveedor_id, enviado, enviado_at)
            VALUES (:f, :prov, :env, :ts)
            ON CONFLICT(fecha, proveedor_id) DO UPDATE SET enviado = excluded.enviado, enviado_at = excluded.enviado_at
        """), {"f": fecha, "prov": proveedor_id, "env": 1 if enviado else 0, "ts": ts})


# ── Proveedores ───────────────────────────────────────────────────────────────

def get_proveedores(incluir_inactivos: bool = False, busqueda: Optional[str] = None,
                    categoria: Optional[str] = None) -> List[Dict]:
    ensure_schema()
    conds = [] if incluir_inactivos else ["activo = 1"]
    params: Dict[str, Any] = {}
    if busqueda:
        conds.append("(LOWER(nombre) LIKE :b OR LOWER(nombre_remitente) LIKE :b)")
        params["b"] = f"%{busqueda.lower()}%"
    if categoria:
        conds.append("categoria = :cat"); params["cat"] = categoria
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    with get_engine().connect() as conn:
        rows = conn.execute(text(f"SELECT * FROM sg_proveedores {where} ORDER BY nombre"), params).fetchall()
    return [dict(r._mapping) for r in rows]


def create_proveedor(nombre: str, categoria: Optional[str] = None,
                     nombre_remitente: Optional[str] = None,
                     info_reco: Optional[str] = None) -> Dict:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(text("""
            INSERT INTO sg_proveedores
                (nombre, categoria, nombre_remitente, info_reco, activo, created_at)
            VALUES
                (:nombre, :cat, :rem, :info, 1, :ts)
        """), {"nombre": nombre.strip(), "cat": categoria, "rem": nombre_remitente, "info": info_reco, "ts": _now()})
        row = conn.execute(text("SELECT * FROM sg_proveedores WHERE nombre = :n ORDER BY id DESC LIMIT 1"),
                           {"n": nombre.strip()}).fetchone()
    return dict(row._mapping)


def update_proveedor(proveedor_id: int, nombre: Optional[str] = None, categoria: Optional[str] = None,
                     nombre_remitente: Optional[str] = None, info_reco: Optional[str] = None,
                     activo: Optional[bool] = None) -> Dict:
    ensure_schema()
    sets, params = [], {"id": proveedor_id}
    if nombre is not None:
        sets.append("nombre = :nombre"); params["nombre"] = nombre.strip()
    if categoria is not None:
        sets.append("categoria = :cat"); params["cat"] = categoria
    if nombre_remitente is not None:
        sets.append("nombre_remitente = :rem"); params["rem"] = nombre_remitente
    if info_reco is not None:
        sets.append("info_reco = :info"); params["info"] = info_reco
    if activo is not None:
        sets.append("activo = :activo"); params["activo"] = int(activo)
    if not sets:
        raise ValueError("Nada que actualizar")
    with get_engine().begin() as conn:
        conn.execute(text(f"UPDATE sg_proveedores SET {', '.join(sets)} WHERE id = :id"), params)
        row = conn.execute(text("SELECT * FROM sg_proveedores WHERE id = :id"), {"id": proveedor_id}).fetchone()
    return dict(row._mapping)


def delete_proveedor(proveedor_id: int) -> bool:
    ensure_schema()
    with get_engine().begin() as conn:
        conn.execute(text("UPDATE sg_proveedores SET activo = 0 WHERE id = :id"), {"id": proveedor_id})
    return True


# ── Historial ─────────────────────────────────────────────────────────────────

def get_historial(area: Optional[str] = None, producto_id: Optional[int] = None,
                  desde: Optional[str] = None, hasta: Optional[str] = None,
                  limit: int = 200) -> List[Dict]:
    ensure_schema()
    conds, params = [], {}
    if area:
        conds.append("reg.area = :area"); params["area"] = area
    if producto_id:
        conds.append("reg.producto_id = :pid"); params["pid"] = producto_id
    if desde:
        conds.append("reg.fecha >= :desde"); params["desde"] = desde
    if hasta:
        conds.append("reg.fecha <= :hasta"); params["hasta"] = hasta
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    sql = f"""
        SELECT reg.*,
               p.nombre AS producto_nombre, p.codigo AS producto_codigo,
               COALESCE(p.unidad_stock, 'unidad') AS unidad_stock,
               COALESCE(p.unidad_pedido, 'unidad') AS unidad_pedido,
               pi.rubro_id,
               r.nombre AS rubro_nombre,
               COALESCE(pi.orden, 999) AS item_orden,
               COALESCE(r.orden, 999) AS rubro_orden
        FROM sg_registros reg
        JOIN sg_productos p ON p.id = reg.producto_id
        LEFT JOIN sg_planilla_items pi ON pi.producto_id = reg.producto_id AND pi.area = reg.area
        LEFT JOIN sg_rubros r ON r.id = pi.rubro_id
        {where}
        ORDER BY reg.fecha DESC, reg.area, COALESCE(r.orden, 999), COALESCE(pi.orden, 999), p.nombre
        LIMIT :limit
    """
    params["limit"] = limit
    with get_engine().connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


# ── Stock Cervezas (canillas) ─────────────────────────────────────────────────

def get_canillas_config(sucursal_id: str = "1") -> List[Dict]:
    ensure_schema()
    with get_engine().connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM sg_stock_cervezas WHERE sucursal_id = :s ORDER BY canilla_num"),
            {"s": sucursal_id}
        ).fetchall()
    existing = {r._mapping["canilla_num"]: dict(r._mapping) for r in rows}
    result = []
    for i in range(1, 21):
        result.append(existing.get(i, {
            "id": None, "sucursal_id": sucursal_id, "canilla_num": i,
            "estilo_actual": None, "estilo_proximo": None,
            "stock_camara": 0, "stock_camara_proximo": 0,
        }))
    return result


def update_canilla_config(sucursal_id: str, canilla_num: int,
                          estilo_actual: Optional[str] = None,
                          estilo_proximo: Optional[str] = None,
                          stock_camara: Optional[int] = None,
                          stock_camara_proximo: Optional[int] = None) -> Dict:
    ensure_schema()
    tg_proximo: Optional[tuple] = None  # (canilla_num, estilo_actual_display, nuevo_proximo)

    with get_engine().begin() as conn:
        existing_row = conn.execute(
            text("SELECT * FROM sg_stock_cervezas WHERE sucursal_id = :s AND canilla_num = :c"),
            {"s": sucursal_id, "c": canilla_num}
        ).fetchone()
        existing = dict(existing_row._mapping) if existing_row else None

        if existing:
            # Detectar cambio de estilo_proximo para Telegram
            if estilo_proximo is not None:
                old_ep = existing.get("estilo_proximo") or ""
                new_ep = estilo_proximo or ""
                if new_ep != old_ep:
                    ea_display = existing.get("estilo_actual") or f"Canilla {canilla_num}"
                    tg_proximo = (canilla_num, ea_display, new_ep or None)

            sets, params = [], {"s": sucursal_id, "c": canilla_num}
            if estilo_actual is not None:
                sets.append("estilo_actual = :ea"); params["ea"] = estilo_actual or None
            if estilo_proximo is not None:
                sets.append("estilo_proximo = :ep"); params["ep"] = estilo_proximo or None
            if stock_camara is not None:
                sets.append("stock_camara = :sc"); params["sc"] = stock_camara
            if stock_camara_proximo is not None:
                sets.append("stock_camara_proximo = :scp"); params["scp"] = stock_camara_proximo
            if sets:
                conn.execute(
                    text(f"UPDATE sg_stock_cervezas SET {', '.join(sets)} WHERE sucursal_id = :s AND canilla_num = :c"),
                    params
                )
        else:
            if estilo_proximo:
                tg_proximo = (canilla_num, estilo_actual or f"Canilla {canilla_num}", estilo_proximo)
            conn.execute(
                text("""
                    INSERT INTO sg_stock_cervezas
                        (sucursal_id, canilla_num, estilo_actual, estilo_proximo, stock_camara, stock_camara_proximo)
                    VALUES (:s, :c, :ea, :ep, :sc, :scp)
                """),
                {"s": sucursal_id, "c": canilla_num,
                 "ea": estilo_actual or None, "ep": estilo_proximo or None,
                 "sc": stock_camara or 0, "scp": stock_camara_proximo or 0}
            )
        row = conn.execute(
            text("SELECT * FROM sg_stock_cervezas WHERE sucursal_id = :s AND canilla_num = :c"),
            {"s": sucursal_id, "c": canilla_num}
        ).fetchone()

    if tg_proximo:
        from .telegram_service import notify as _tg_notify
        cn, ea, ep = tg_proximo
        if ep:
            _tg_notify(f"🔜 <b>Próximo en Canilla {cn}</b> ({ea})\n🍺 {ep}")

    return dict(row._mapping)


def swap_canillas(sucursal_id: str, canilla_a: int, canilla_b: int,
                  estilo_a: Optional[str] = None, estilo_b: Optional[str] = None) -> None:
    """Intercambia el contenido de dos canillas.

    estilo_a / estilo_b: estilos resueltos enviados desde el frontend (incluyen fallback de barril).
    Si se proveen, se usan como estilo_actual en la DB para garantizar que el valor visible
    es exactamente el que se intercambia — independientemente de si la DB tenía null por barril.
    """
    from .telegram_service import notify as _tg_notify
    ensure_schema()
    with get_engine().begin() as conn:
        rows = conn.execute(
            text("SELECT * FROM sg_stock_cervezas WHERE sucursal_id = :s AND canilla_num IN (:a, :b)"),
            {"s": sucursal_id, "a": canilla_a, "b": canilla_b}
        ).fetchall()
        data: Dict[int, Dict] = {r._mapping["canilla_num"]: dict(r._mapping) for r in rows}
        existing_nums = set(data.keys())

        _empty: Any = lambda cn: {"canilla_num": cn, "estilo_actual": None, "estilo_proximo": None, "stock_camara": 0, "stock_camara_proximo": 0}
        a_data = data.get(canilla_a, _empty(canilla_a))
        b_data = data.get(canilla_b, _empty(canilla_b))

        # What goes INTO each canilla after the swap:
        # canilla_a gets estilo_b (resolved what was at B) + rest of B's DB data
        # canilla_b gets estilo_a (resolved what was at A) + rest of A's DB data
        for (cn, src, resolved_estilo) in [
            (canilla_a, b_data, estilo_b or b_data.get("estilo_actual")),
            (canilla_b, a_data, estilo_a or a_data.get("estilo_actual")),
        ]:
            if cn in existing_nums:
                conn.execute(text("""
                    UPDATE sg_stock_cervezas
                    SET estilo_actual = :ea, estilo_proximo = :ep,
                        stock_camara = :sc, stock_camara_proximo = :scp
                    WHERE sucursal_id = :s AND canilla_num = :c
                """), {"s": sucursal_id, "c": cn,
                       "ea": resolved_estilo or None, "ep": src.get("estilo_proximo"),
                       "sc": src.get("stock_camara") or 0, "scp": src.get("stock_camara_proximo") or 0})
            else:
                conn.execute(text("""
                    INSERT INTO sg_stock_cervezas
                        (sucursal_id, canilla_num, estilo_actual, estilo_proximo, stock_camara, stock_camara_proximo)
                    VALUES (:s, :c, :ea, :ep, :sc, :scp)
                """), {"s": sucursal_id, "c": cn,
                       "ea": resolved_estilo or None, "ep": src.get("estilo_proximo"),
                       "sc": src.get("stock_camara") or 0, "scp": src.get("stock_camara_proximo") or 0})

    # Notification shows original estilos BEFORE the swap
    ea_display = estilo_a or a_data.get("estilo_actual") or "—"
    eb_display = estilo_b or b_data.get("estilo_actual") or "—"
    epa = a_data.get("estilo_proximo") or "—"
    epb = b_data.get("estilo_proximo") or "—"
    prox_line = ""
    if epa != "—" or epb != "—":
        prox_line = f"\n🔜 Próximos: {canilla_a} ({epa}) ↔ {canilla_b} ({epb})"
    _tg_notify(f"🔄 <b>Canillas intercambiadas</b>\n🍺 Canilla {canilla_a} ({ea_display}) ↔ Canilla {canilla_b} ({eb_display}){prox_line}")


# ── Historial Stock Cervezas ──────────────────────────────────────────────────

def save_cervezas_historial(sucursal_id: str, fecha: str, rows: List[Dict]) -> None:
    ensure_schema()
    with get_engine().begin() as conn:
        for row in rows:
            conn.execute(text("""
                INSERT INTO sg_stock_cervezas_historial
                    (fecha, sucursal_id, canilla_num,
                     estilo_actual, tipo_actual, proveedor_actual,
                     stock_camara, aprox_litros, dias_pinchado,
                     estilo_proximo, tipo_proximo, proveedor_proximo,
                     stock_camara_proximo, aprox_litros_proximo, created_at)
                VALUES
                    (:fecha, :s, :cn,
                     :ea, :ta, :pa,
                     :sc, :al, :dp,
                     :ep, :tp, :pp,
                     :scp, :alp, :ts)
                ON CONFLICT(fecha, sucursal_id, canilla_num) DO UPDATE SET
                    estilo_actual = excluded.estilo_actual,
                    tipo_actual = excluded.tipo_actual,
                    proveedor_actual = excluded.proveedor_actual,
                    stock_camara = excluded.stock_camara,
                    aprox_litros = excluded.aprox_litros,
                    dias_pinchado = excluded.dias_pinchado,
                    estilo_proximo = excluded.estilo_proximo,
                    tipo_proximo = excluded.tipo_proximo,
                    proveedor_proximo = excluded.proveedor_proximo,
                    stock_camara_proximo = excluded.stock_camara_proximo,
                    aprox_litros_proximo = excluded.aprox_litros_proximo
            """), {
                "fecha": fecha, "s": sucursal_id, "cn": row["canilla_num"],
                "ea": row.get("estilo_actual"), "ta": row.get("tipo_actual"), "pa": row.get("proveedor_actual"),
                "sc": row.get("stock_camara", 0), "al": row.get("aprox_litros", 0), "dp": row.get("dias_pinchado"),
                "ep": row.get("estilo_proximo"), "tp": row.get("tipo_proximo"), "pp": row.get("proveedor_proximo"),
                "scp": row.get("stock_camara_proximo", 0), "alp": row.get("aprox_litros_proximo", 0),
                "ts": _now(),
            })


def get_cervezas_historial(sucursal_id: str, fecha: str) -> List[Dict]:
    ensure_schema()
    with get_engine().connect() as conn:
        rows = conn.execute(text("""
            SELECT * FROM sg_stock_cervezas_historial
            WHERE sucursal_id = :s AND fecha = :f
            ORDER BY canilla_num
        """), {"s": sucursal_id, "f": fecha}).fetchall()
    return [dict(r._mapping) for r in rows]


# ── Estadísticas ──────────────────────────────────────────────────────────────

# Unit normalization: all quantities → canonical base unit
# Weight → kg, Volume → l, Pack/Caja/etc with known size → u
_NORM_FACTOR = """CASE LOWER(TRIM(p.unidad_pedido))
    -- gramos → kg
    WHEN 'gr'       THEN 0.001  WHEN 'g'        THEN 0.001  WHEN 'gramos'   THEN 0.001
    WHEN 'grs'      THEN 0.001  WHEN 'gramo'    THEN 0.001  WHEN 'gr.'      THEN 0.001
    WHEN 'mg'       THEN 0.000001
    WHEN 'x1500 gr' THEN 1.5
    -- ml → l
    WHEN 'ml'       THEN 0.001  WHEN 'mililitros' THEN 0.001  WHEN 'cc'     THEN 0.001
    WHEN 'ml.'      THEN 0.001  WHEN 'pote (520 cc)' THEN 0.52
    -- volúmenes ya en litros
    WHEN 'l' THEN 1.0  WHEN 'litros' THEN 1.0  WHEN 'lt' THEN 1.0  WHEN 'lts' THEN 1.0
    -- bidones y cajas de líquido
    WHEN 'bidon(es) x5l'     THEN 5.0  WHEN 'bidon (5l)'       THEN 5.0
    WHEN 'bidon(es) x 5lts'  THEN 5.0  WHEN 'bag in box (x 5l)' THEN 5.0
    WHEN 'caja (x 12l)'      THEN 12.0
    -- bolsas de peso
    WHEN 'bolsa (x 1kg)'  THEN 1.0   WHEN 'bolsa (x 5kg)'  THEN 5.0
    WHEN 'bolsa (5kg)'    THEN 5.0   WHEN 'bolsa (x 25kg)' THEN 25.0
    -- paquetes de peso
    WHEN 'pqte (x 5kg)'  THEN 5.0   WHEN 'pqte (5kg)'  THEN 5.0
    WHEN 'pqte (1 kg)'   THEN 1.0   WHEN 'pilon (x 2,5kg)' THEN 2.5
    -- hormas de queso
    WHEN 'horma (x 4kg)'     THEN 4.0   WHEN 'horma (x 4kg apx)' THEN 4.0
    WHEN 'horma (x 4,5kg)'   THEN 4.5   WHEN 'horma (x 2,2kg)'   THEN 2.2
    -- otros con peso
    WHEN 'frasco (x 1,8 kg)' THEN 1.8
    -- packs → unidades
    WHEN 'six pack'    THEN 6.0   WHEN 'pack de 8'   THEN 8.0
    WHEN 'pack x8'     THEN 8.0   WHEN 'pack x6'     THEN 6.0
    WHEN 'pack de 24'  THEN 24.0  WHEN 'pack (x 10u)' THEN 10.0
    WHEN 'pack x100u'  THEN 100.0 WHEN 'pack (x 100)' THEN 100.0
    -- cajas con cantidad conocida
    WHEN 'caja x 4 sachet'  THEN 4.0   WHEN 'caja x 30 pqte' THEN 30.0
    WHEN 'caja (x 10u)'     THEN 10.0  WHEN 'cajas (x 2u)'   THEN 2.0
    -- otros con cantidad
    WHEN 'tubos x60u'   THEN 60.0  WHEN 'pqte (x 15u)' THEN 15.0
    WHEN 'maple'        THEN 30.0
    -- unidades simples
    WHEN 'unidad' THEN 1.0  WHEN 'piezas' THEN 1.0  WHEN 'cabeza' THEN 1.0
    ELSE 1.0
END"""

_NORM_UNIT = """CASE LOWER(TRIM(p.unidad_pedido))
    -- gramos → kg
    WHEN 'gr'       THEN 'kg'  WHEN 'g'        THEN 'kg'  WHEN 'gramos'   THEN 'kg'
    WHEN 'grs'      THEN 'kg'  WHEN 'gramo'    THEN 'kg'  WHEN 'gr.'      THEN 'kg'
    WHEN 'mg'       THEN 'kg'  WHEN 'x1500 gr' THEN 'kg'
    -- Kg ya en kg
    WHEN 'kg'       THEN 'kg'  WHEN 'kgs'      THEN 'kg'
    -- ml → l
    WHEN 'ml'       THEN 'l'   WHEN 'mililitros' THEN 'l'  WHEN 'cc'      THEN 'l'
    WHEN 'ml.'      THEN 'l'   WHEN 'pote (520 cc)' THEN 'l'
    -- litros ya en l
    WHEN 'l'   THEN 'l'  WHEN 'litros' THEN 'l'  WHEN 'lt' THEN 'l'  WHEN 'lts' THEN 'l'
    -- bidones y cajas de líquido → l
    WHEN 'bidon(es) x5l'     THEN 'l'  WHEN 'bidon (5l)'        THEN 'l'
    WHEN 'bidon(es) x 5lts'  THEN 'l'  WHEN 'bag in box (x 5l)' THEN 'l'
    WHEN 'caja (x 12l)'      THEN 'l'
    -- bolsas/pqte de peso → kg
    WHEN 'bolsa (x 1kg)'  THEN 'kg'  WHEN 'bolsa (x 5kg)'  THEN 'kg'
    WHEN 'bolsa (5kg)'    THEN 'kg'  WHEN 'bolsa (x 25kg)' THEN 'kg'
    WHEN 'pqte (x 5kg)'   THEN 'kg'  WHEN 'pqte (5kg)'    THEN 'kg'
    WHEN 'pqte (1 kg)'    THEN 'kg'  WHEN 'pilon (x 2,5kg)' THEN 'kg'
    -- hormas → kg
    WHEN 'horma (x 4kg)'     THEN 'kg'  WHEN 'horma (x 4kg apx)' THEN 'kg'
    WHEN 'horma (x 4,5kg)'   THEN 'kg'  WHEN 'horma (x 2,2kg)'   THEN 'kg'
    WHEN 'frasco (x 1,8 kg)' THEN 'kg'
    -- packs → u
    WHEN 'six pack'    THEN 'u'  WHEN 'pack de 8'    THEN 'u'  WHEN 'pack x8'    THEN 'u'
    WHEN 'pack x6'     THEN 'u'  WHEN 'pack de 24'   THEN 'u'
    WHEN 'pack (x 10u)' THEN 'u' WHEN 'pack x100u'  THEN 'u'  WHEN 'pack (x 100)' THEN 'u'
    -- cajas con cantidad → u
    WHEN 'caja x 4 sachet' THEN 'u'  WHEN 'caja x 30 pqte' THEN 'u'
    WHEN 'caja (x 10u)'    THEN 'u'  WHEN 'cajas (x 2u)'   THEN 'u'
    -- otros → u
    WHEN 'tubos x60u'   THEN 'u'  WHEN 'pqte (x 15u)' THEN 'u'
    WHEN 'maple'        THEN 'u'
    WHEN 'unidad'       THEN 'u'  WHEN 'piezas' THEN 'u'  WHEN 'cabeza' THEN 'u'
    ELSE COALESCE(p.unidad_pedido, 'u')
END"""


def get_estadisticas(modo: str = 'historico', exclude_rubros: list = None, exclude_productos: list = None, desde: str = None, hasta: str = None) -> Dict:
    import re as _re
    ensure_schema()
    fcr = "AND strftime('%d', reg.fecha) = '01'" if modo == 'primer_dia' else ""
    fdr = ""
    if desde and _re.fullmatch(r'\d{4}-\d{2}-\d{2}', desde):
        fdr += f" AND reg.fecha >= '{desde}'"
    if hasta and _re.fullmatch(r'\d{4}-\d{2}-\d{2}', hasta):
        fdr += f" AND reg.fecha <= '{hasta}'"
    NF, NU = _NORM_FACTOR, _NORM_UNIT

    # Resolve all excluded product IDs: direct exclusions ∪ products in excluded rubros
    excl_ids: set = set(int(p) for p in (exclude_productos or []))
    if exclude_rubros:
        safe_r = "','".join(r.replace("'", "''") for r in exclude_rubros)
        with get_engine().connect() as tmp:
            rows = tmp.execute(text(f"""
                SELECT DISTINCT pi.producto_id
                FROM sg_planilla_items pi
                JOIN sg_rubros r ON r.id = pi.rubro_id
                WHERE COALESCE(r.nombre, 'Sin rubro') IN ('{safe_r}')
            """)).fetchall()
            excl_ids.update(row[0] for row in rows)

    excl_pr = (f"AND reg.producto_id NOT IN ({','.join(str(i) for i in excl_ids)})" if excl_ids else "")

    with get_engine().connect() as conn:

        # ── Resumen ──────────────────────────────────────────────────────────
        resumen = conn.execute(text(f"""
            SELECT
                COUNT(DISTINCT reg.fecha) AS total_periodos,
                COUNT(CASE WHEN reg.pedido IS NOT NULL AND reg.pedido > 0 THEN 1 END) AS total_eventos_pedido,
                COUNT(DISTINCT CASE WHEN reg.pedido IS NOT NULL AND reg.pedido > 0 THEN reg.producto_id END) AS productos_pedidos,
                COUNT(DISTINCT CASE WHEN reg.stock IS NOT NULL THEN reg.producto_id END) AS productos_con_stock
            FROM sg_registros reg
            WHERE 1=1 {fcr}{fdr} {excl_pr}
        """)).fetchone()

        # ── Top productos — frecuencia + volumen normalizado ─────────────────
        top_pedidos = conn.execute(text(f"""
            SELECT
                p.nombre,
                p.codigo,
                COALESCE(r.nombre, 'Sin rubro') AS rubro_nombre,
                COALESCE(pv.nombre, 'Sin proveedor') AS proveedor_nombre,
                {NU} AS unidad_pedido,
                ROUND(SUM(reg.pedido * {NF}), 2) AS total_pedido,
                COUNT(*) AS veces_pedido,
                ROUND(SUM(reg.pedido * {NF}) / COUNT(*), 2) AS promedio_por_vez
            FROM sg_registros reg
            JOIN sg_productos p ON p.id = reg.producto_id
            LEFT JOIN sg_planilla_items pi ON pi.producto_id = p.id AND pi.area = reg.area
            LEFT JOIN sg_rubros r ON r.id = pi.rubro_id
            LEFT JOIN sg_proveedores pv ON pv.id = p.proveedor_id
            WHERE reg.pedido IS NOT NULL AND reg.pedido > 0 {fcr}{fdr} {excl_pr}
            GROUP BY reg.producto_id
            ORDER BY veces_pedido DESC, total_pedido DESC
            LIMIT 15
        """)).fetchall()

        # ── Por rubro — frecuencia ────────────────────────────────────────────
        por_rubro = conn.execute(text(f"""
            SELECT
                COALESCE(r.nombre, 'Sin rubro') AS rubro_nombre,
                COUNT(*) AS veces_pedido_total,
                COUNT(DISTINCT reg.producto_id) AS productos_distintos,
                COUNT(DISTINCT reg.fecha) AS periodos_activos
            FROM sg_registros reg
            JOIN sg_productos p ON p.id = reg.producto_id
            LEFT JOIN sg_planilla_items pi ON pi.producto_id = p.id AND pi.area = reg.area
            LEFT JOIN sg_rubros r ON r.id = pi.rubro_id
            WHERE reg.pedido IS NOT NULL AND reg.pedido > 0 {fcr}{fdr} {excl_pr}
            GROUP BY r.id, r.nombre
            ORDER BY veces_pedido_total DESC
        """)).fetchall()

        # ── Por proveedor — frecuencia ────────────────────────────────────────
        por_proveedor = conn.execute(text(f"""
            SELECT
                COALESCE(pv.nombre, 'Sin proveedor') AS proveedor_nombre,
                COUNT(*) AS veces_pedido_total,
                COUNT(DISTINCT reg.producto_id) AS productos_distintos
            FROM sg_registros reg
            JOIN sg_productos p ON p.id = reg.producto_id
            LEFT JOIN sg_proveedores pv ON pv.id = p.proveedor_id
            WHERE reg.pedido IS NOT NULL AND reg.pedido > 0 {fcr}{fdr} {excl_pr}
            GROUP BY pv.id, pv.nombre
            ORDER BY veces_pedido_total DESC
            LIMIT 10
        """)).fetchall()

        # ── Top 3 por rubro — volumen normalizado + frecuencia ───────────────
        rubro_det_rows = conn.execute(text(f"""
            WITH agg AS (
                SELECT
                    COALESCE(r.id, -1) AS rubro_id,
                    COALESCE(r.nombre, 'Sin rubro') AS rubro_nombre,
                    p.nombre AS producto_nombre,
                    {NU} AS unidad_norm,
                    ROUND(SUM(reg.pedido * {NF}), 2) AS total_pedido_norm,
                    COUNT(*) AS veces_pedido
                FROM sg_registros reg
                JOIN sg_productos p ON p.id = reg.producto_id
                LEFT JOIN sg_planilla_items pi ON pi.producto_id = p.id AND pi.area = reg.area
                LEFT JOIN sg_rubros r ON r.id = pi.rubro_id
                WHERE reg.pedido IS NOT NULL AND reg.pedido > 0 {fcr}{fdr} {excl_pr}
                GROUP BY COALESCE(r.id, -1), r.nombre, reg.producto_id, p.nombre, p.unidad_pedido
            ),
            ranked AS (
                SELECT *, ROW_NUMBER() OVER (
                    PARTITION BY rubro_id ORDER BY veces_pedido DESC, total_pedido_norm DESC
                ) AS rn
                FROM agg
            )
            SELECT rubro_nombre, producto_nombre, total_pedido_norm, unidad_norm, veces_pedido
            FROM ranked WHERE rn <= 3
            ORDER BY rubro_nombre, veces_pedido DESC
        """)).fetchall()

        # ── Evolución por período — eventos ──────────────────────────────────
        evolucion = conn.execute(text(f"""
            SELECT
                reg.fecha,
                COUNT(*) AS total_eventos_pedido,
                COUNT(DISTINCT reg.producto_id) AS productos_pedidos
            FROM sg_registros reg
            WHERE reg.pedido IS NOT NULL AND reg.pedido > 0 {fcr}{fdr} {excl_pr}
            GROUP BY reg.fecha
            ORDER BY reg.fecha ASC
        """)).fetchall()

        # ── Stock promedio ────────────────────────────────────────────────────
        stock_stats = conn.execute(text(f"""
            SELECT
                p.nombre,
                p.codigo,
                COALESCE(r.nombre, 'Sin rubro') AS rubro_nombre,
                COALESCE(p.unidad_stock, 'u') AS unidad_stock,
                ROUND(AVG(reg.stock), 1) AS stock_promedio,
                CAST(MIN(reg.stock) AS INTEGER) AS stock_min,
                CAST(MAX(reg.stock) AS INTEGER) AS stock_max,
                COUNT(*) AS periodos_registrados
            FROM sg_registros reg
            JOIN sg_productos p ON p.id = reg.producto_id
            LEFT JOIN sg_planilla_items pi ON pi.producto_id = p.id AND pi.area = reg.area
            LEFT JOIN sg_rubros r ON r.id = pi.rubro_id
            WHERE reg.stock IS NOT NULL AND reg.stock >= 0 {fcr}{fdr} {excl_pr}
            GROUP BY reg.producto_id
            HAVING periodos_registrados >= 2
            ORDER BY stock_promedio DESC
            LIMIT 20
        """)).fetchall()

        # ── Catálogo — siempre sin filtros (para panel de configuración) ──────
        cat_rubros = conn.execute(text("""
            SELECT DISTINCT COALESCE(r.nombre, 'Sin rubro') AS rubro_nombre
            FROM sg_registros reg
            JOIN sg_productos p ON p.id = reg.producto_id
            LEFT JOIN sg_planilla_items pi ON pi.producto_id = p.id AND pi.area = reg.area
            LEFT JOIN sg_rubros r ON r.id = pi.rubro_id
            WHERE reg.pedido IS NOT NULL AND reg.pedido > 0
            ORDER BY rubro_nombre
        """)).fetchall()

        cat_prods = conn.execute(text("""
            SELECT DISTINCT reg.producto_id AS id, p.nombre, COALESCE(r.nombre, 'Sin rubro') AS rubro_nombre
            FROM sg_registros reg
            JOIN sg_productos p ON p.id = reg.producto_id
            LEFT JOIN sg_planilla_items pi ON pi.producto_id = p.id AND pi.area = reg.area
            LEFT JOIN sg_rubros r ON r.id = pi.rubro_id
            WHERE reg.pedido IS NOT NULL AND reg.pedido > 0
            ORDER BY rubro_nombre, p.nombre
        """)).fetchall()

    # Group rubro detail by rubro name
    rubro_detalle: Dict[str, list] = {}
    for row in rubro_det_rows:
        d = dict(row._mapping)
        rn = d['rubro_nombre']
        rubro_detalle.setdefault(rn, []).append({
            'nombre': d['producto_nombre'],
            'total': d['total_pedido_norm'],
            'unidad': d['unidad_norm'],
            'veces': d['veces_pedido'],
        })

    return {
        'resumen': dict(resumen._mapping) if resumen else {},
        'top_pedidos': [dict(r._mapping) for r in top_pedidos],
        'por_rubro': [dict(r._mapping) for r in por_rubro],
        'por_proveedor': [dict(r._mapping) for r in por_proveedor],
        'por_rubro_detalle': [{'rubro': k, 'productos': v} for k, v in rubro_detalle.items()],
        'evolucion_pedidos': [dict(r._mapping) for r in evolucion],
        'stock_stats': [dict(r._mapping) for r in stock_stats],
        'catalog': {
            'rubros': [row._mapping['rubro_nombre'] for row in cat_rubros],
            'productos': [dict(r._mapping) for r in cat_prods],
        },
        'modo': modo,
    }


def get_producto_serie(producto_id: int) -> Dict:
    """Devuelve la serie histórica de pedido/stock normalizado para un producto."""
    ensure_schema()
    NF = _NORM_FACTOR
    NU = _NORM_UNIT

    with get_engine().connect() as conn:
        prod_row = conn.execute(text(f"""
            SELECT p.nombre, {NU} AS unidad_norm
            FROM sg_productos p
            WHERE p.id = :pid
        """), {"pid": producto_id}).fetchone()

        serie = conn.execute(text(f"""
            SELECT
                reg.fecha,
                ROUND(SUM(CASE WHEN reg.pedido IS NOT NULL AND reg.pedido > 0
                               THEN reg.pedido * {NF} END), 2) AS pedido_norm,
                ROUND(AVG(CASE WHEN reg.stock IS NOT NULL THEN reg.stock END), 1) AS stock_prom
            FROM sg_registros reg
            JOIN sg_productos p ON p.id = reg.producto_id
            WHERE reg.producto_id = :pid
            GROUP BY reg.fecha
            ORDER BY reg.fecha ASC
        """), {"pid": producto_id}).fetchall()

    prod_d = dict(prod_row._mapping) if prod_row else {}
    return {
        'producto_id': producto_id,
        'nombre': prod_d.get('nombre', 'Desconocido'),
        'unidad': prod_d.get('unidad_norm', 'u'),
        'serie': [dict(r._mapping) for r in serie],
    }

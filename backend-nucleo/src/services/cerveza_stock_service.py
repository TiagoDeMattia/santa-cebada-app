"""
Stock aproximado de cervezas.

Calcula litros restantes combinando:
  - Barriles activos desde Google Sheets (volumen según columna E: 50L/30L)
  - Ventas de productos de canilla desde la API de Nucleo
  - Config de canillas almacenada en SQLite (configurable desde el panel)
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

import concurrent.futures
import requests as _requests
from sqlalchemy import select, delete, insert, update

_SERVICES_DIR = Path(__file__).parent
if str(_SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICES_DIR))

from ..config import settings
from .database import get_engine, ensure_schema, get_table
from .barriles_service import get_barriles
from .estadistica_service import _get_live_token, _auth_headers, _location_key_from_sucursal

_API_BASE = "https://api-prod.nucleocheck.com"

# ── Configuración por defecto de canillas ─────────────────────────────────────
# 20 canillas (1-6: 473ml, 7-20: 400ml) + Hora Santa habilitable para canillas 1-10.
# producto_id=0 significa sin asignar todavía (ignorado en cálculo).

_DEFAULT_CANILLAS: List[Dict[str, Any]] = [
    # ── Canillas regulares ───────────────────────────────────────────────────
    {"producto_id": 719, "canilla_nombre": "CANILLA 1",  "canilla_numero": "1",  "ml_por_pinta": 473, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 720, "canilla_nombre": "CANILLA 2",  "canilla_numero": "2",  "ml_por_pinta": 473, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 721, "canilla_nombre": "CANILLA 3",  "canilla_numero": "3",  "ml_por_pinta": 473, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 722, "canilla_nombre": "CANILLA 4",  "canilla_numero": "4",  "ml_por_pinta": 473, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 723, "canilla_nombre": "CANILLA 5",  "canilla_numero": "5",  "ml_por_pinta": 473, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 724, "canilla_nombre": "CANILLA 6",  "canilla_numero": "6",  "ml_por_pinta": 473, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 725, "canilla_nombre": "CANILLA 7",  "canilla_numero": "7",  "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 726, "canilla_nombre": "CANILLA 8",  "canilla_numero": "8",  "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 727, "canilla_nombre": "CANILLA 9",  "canilla_numero": "9",  "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 728, "canilla_nombre": "CANILLA 10", "canilla_numero": "10", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 729, "canilla_nombre": "CANILLA 11", "canilla_numero": "11", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 730, "canilla_nombre": "CANILLA 12", "canilla_numero": "12", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 758, "canilla_nombre": "CANILLA 13", "canilla_numero": "13", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 776, "canilla_nombre": "CANILLA 14", "canilla_numero": "14", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 777, "canilla_nombre": "CANILLA 15", "canilla_numero": "15", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 778, "canilla_nombre": "CANILLA 16", "canilla_numero": "16", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 779, "canilla_nombre": "CANILLA 17", "canilla_numero": "17", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 780, "canilla_nombre": "CANILLA 18", "canilla_numero": "18", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 1},
    {"producto_id": 0,   "canilla_nombre": "CANILLA 19", "canilla_numero": "19", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 0},
    {"producto_id": 0,   "canilla_nombre": "CANILLA 20", "canilla_numero": "20", "ml_por_pinta": 400, "es_hora_santa": 0, "activa": 0},
    # ── Hora Santa (canillas 1-10, activar cuando se asigne producto) ────────
    {"producto_id": 0,   "canilla_nombre": "CANILLA 1 HORA SANTA",  "canilla_numero": "1",  "ml_por_pinta": 473, "es_hora_santa": 1, "activa": 0},
    {"producto_id": 0,   "canilla_nombre": "CANILLA 2 HORA SANTA",  "canilla_numero": "2",  "ml_por_pinta": 473, "es_hora_santa": 1, "activa": 0},
    {"producto_id": 0,   "canilla_nombre": "CANILLA 3 HORA SANTA",  "canilla_numero": "3",  "ml_por_pinta": 473, "es_hora_santa": 1, "activa": 0},
    {"producto_id": 147, "canilla_nombre": "CANILLA 4 HORA SANTA",  "canilla_numero": "4",  "ml_por_pinta": 400, "es_hora_santa": 1, "activa": 1},
    {"producto_id": 148, "canilla_nombre": "CANILLA 5 HORA SANTA",  "canilla_numero": "5",  "ml_por_pinta": 400, "es_hora_santa": 1, "activa": 1},
    {"producto_id": 149, "canilla_nombre": "CANILLA 6 HORA SANTA",  "canilla_numero": "6",  "ml_por_pinta": 400, "es_hora_santa": 1, "activa": 1},
    {"producto_id": 155, "canilla_nombre": "CANILLA 7 HORA SANTA",  "canilla_numero": "7",  "ml_por_pinta": 400, "es_hora_santa": 1, "activa": 1},
    {"producto_id": 0,   "canilla_nombre": "CANILLA 8 HORA SANTA",  "canilla_numero": "8",  "ml_por_pinta": 400, "es_hora_santa": 1, "activa": 0},
    {"producto_id": 0,   "canilla_nombre": "CANILLA 9 HORA SANTA",  "canilla_numero": "9",  "ml_por_pinta": 400, "es_hora_santa": 1, "activa": 0},
    {"producto_id": 0,   "canilla_nombre": "CANILLA 10 HORA SANTA", "canilla_numero": "10", "ml_por_pinta": 400, "es_hora_santa": 1, "activa": 0},
]


# ── DB helpers ────────────────────────────────────────────────────────────────

def _migrate_canilla_config():
    """
    Migración de canilla_config.
    1. Si no existe la columna es_hora_santa → drop & recreate.
    2. Si la columna existe pero todos los registros tienen es_hora_santa=0
       mientras hay filas (datos corruptos por bug de Pydantic) → drop & recreate.
    """
    from sqlalchemy import inspect as _inspect, text as _text
    engine = get_engine()
    inspector = _inspect(engine)
    if "canilla_config" in inspector.get_table_names():
        cols = [c["name"] for c in inspector.get_columns("canilla_config")]
        needs_reset = False
        if "es_hora_santa" not in cols:
            needs_reset = True
        else:
            # Verificar integridad de datos: debe haber al menos una fila HS
            with engine.connect() as conn:
                total = conn.execute(_text("SELECT COUNT(*) FROM canilla_config")).scalar()
                hs_count = conn.execute(_text("SELECT COUNT(*) FROM canilla_config WHERE es_hora_santa=1")).scalar()
                if total > 0 and hs_count == 0:
                    needs_reset = True
        if needs_reset:
            with engine.connect() as conn:
                conn.execute(_text("DROP TABLE canilla_config"))
                conn.commit()
    ensure_schema()


def _canilla_table():
    _migrate_canilla_config()
    return get_table("canilla_config")


def _seed_defaults_if_empty():
    """Inserta los defaults si la tabla está vacía."""
    tbl = _canilla_table()
    engine = get_engine()
    with engine.connect() as conn:
        count = conn.execute(select(tbl).limit(1)).fetchone()
        if count is None:
            conn.execute(
                insert(tbl),
                _DEFAULT_CANILLAS,
            )
            conn.commit()


def get_canilla_config() -> List[Dict[str, Any]]:
    _seed_defaults_if_empty()
    tbl = _canilla_table()
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(select(tbl).order_by(tbl.c.id)).fetchall()
    return [dict(r._mapping) for r in rows]


def save_canilla_config(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Reemplaza toda la config de canillas."""
    tbl = _canilla_table()
    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(delete(tbl))
        if entries:
            conn.execute(insert(tbl), entries)
        conn.commit()
    return get_canilla_config()


# ── Ajustes manuales ──────────────────────────────────────────────────────────

def _ajuste_table():
    ensure_schema()
    return get_table("stock_ajuste")


def get_ajustes() -> List[Dict[str, Any]]:
    tbl = _ajuste_table()
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(select(tbl).order_by(tbl.c.estilo)).fetchall()
    return [dict(r._mapping) for r in rows]


def save_ajustes(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Guarda (upsert) ajustes de litros por estilo."""
    tbl = _ajuste_table()
    engine = get_engine()
    with engine.connect() as conn:
        for e in entries:
            estilo = e["estilo"]
            exists = conn.execute(
                select(tbl).where(tbl.c.estilo == estilo)
            ).fetchone()
            if exists:
                conn.execute(
                    update(tbl)
                    .where(tbl.c.estilo == estilo)
                    .values(ajuste_litros=float(e.get("ajuste_litros", 0)), nota=e.get("nota"))
                )
            else:
                conn.execute(
                    insert(tbl).values(
                        estilo=estilo,
                        ajuste_litros=float(e.get("ajuste_litros", 0)),
                        nota=e.get("nota"),
                    )
                )
        conn.commit()
    return get_ajustes()


# ── API Nucleo ─────────────────────────────────────────────────────────────────

def _format_dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _get_ventas_productos(
    start: datetime,
    end: datetime,
    sucursal_id: str = "1",
) -> Dict[int, float]:
    """Llama a GetSalesByProductStats y retorna {product_code: quantity}."""
    try:
        location_key = _location_key_from_sucursal(sucursal_id)
        token = _get_live_token(location_key)
        headers = _auth_headers(token)

        r = _requests.get(
            f"{_API_BASE}/Stats/GetSalesByProductStats/",
            headers=headers,
            params={
                "StartDate": _format_dt(start),
                "EndDate": _format_dt(end),
                "UseTimeRange": "false",
                "DateGrouping": 0,
                "OnlyProductsSendUnitAlax": "false",
                "IsBreakDownPromotions": "false",
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        # La respuesta es {"Items": [...], "Total": ...}
        items = data.get("Items", []) if isinstance(data, dict) else data
        result: Dict[int, float] = {}
        for item in items:
            code = item.get("Code")
            if code is not None:
                try:
                    result[int(code)] = float(item.get("Quantity") or 0)
                except (ValueError, TypeError):
                    pass
        return result
    except Exception as e:
        from ..utils.logger import logger
        logger.error(f"Error consultando ventas de productos: {e}", exc_info=True)
        return {}


# ── Parsers ───────────────────────────────────────────────────────────────────

def _parse_fecha(fecha_str: str) -> Optional[datetime]:
    for fmt in ["%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d-%m-%Y"]:
        try:
            return datetime.strptime(fecha_str.strip(), fmt)
        except ValueError:
            pass
    return None


# ── Cálculo principal ─────────────────────────────────────────────────────────

def calcular_stock_cervezas(sucursal_id: str = "1") -> Dict[str, Any]:
    """
    Calcula el stock aproximado de cervezas.
    Retorna resumen por estilo, por proveedor y detalle de barriles.
    """
    canilla_cfg = get_canilla_config()

    # canilla_numero -> list of (producto_id, ml_por_pinta)
    canilla_products: Dict[str, List[tuple]] = {}
    for cfg in canilla_cfg:
        if not cfg.get("activa", 1) or cfg.get("ml_por_pinta") is None:
            continue
        if not cfg.get("producto_id"):  # skip unassigned (producto_id=0 or None)
            continue
        n = str(cfg["canilla_numero"])
        canilla_products.setdefault(n, []).append(
            (int(cfg["producto_id"]), int(cfg["ml_por_pinta"]))
        )

    # Obtener todos los barriles activos (pinchados + en cámara)
    barriles = get_barriles(filtro="activos", sucursal_id=sucursal_id)
    pinchados = [b for b in barriles if b.get("estado") == "Pinchada"]
    en_camara = [b for b in barriles if b.get("estado") != "Pinchada"]

    # Una llamada a la API por cada fecha_pinchado única.
    # Así cada barril usa exactamente las ventas desde SU propio día de pinchado.
    now = datetime.now()

    # Pre-cachear el token con timeout de 20s para evitar colgar en login lento
    try:
        location_key = _location_key_from_sucursal(sucursal_id)
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as _pre:
            _pre.submit(_get_live_token, location_key).result(timeout=20)
    except Exception:
        pass

    # Recolectar fechas únicas y parsearlas
    fechas_unicas: Dict[str, Optional[datetime]] = {}
    for b in pinchados:
        fecha_str = b.get("fecha_pinchado", "")
        if fecha_str and fecha_str not in fechas_unicas:
            fechas_unicas[fecha_str] = _parse_fecha(fecha_str)

    # Fetch paralelo: una thread por fecha única (35s de timeout por future)
    # Bug 2 fix: StartDate = día SIGUIENTE al pinchado para no contar ventas del
    # barril anterior que estaba en esa canilla la mañana del mismo día de cambio.
    ventas_por_fecha: Dict[str, Dict[int, float]] = {}
    if fechas_unicas:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(fechas_unicas), 6)) as pool:
            futures = {
                fecha_str: pool.submit(
                    _get_ventas_productos,
                    fecha_dt + timedelta(days=1),  # empezar desde el día siguiente
                    now,
                    sucursal_id,
                )
                for fecha_str, fecha_dt in fechas_unicas.items()
                if fecha_dt is not None
            }
            for fecha_str, future in futures.items():
                try:
                    ventas_por_fecha[fecha_str] = future.result(timeout=35)
                except Exception:
                    ventas_por_fecha[fecha_str] = {}
        for fecha_str, fecha_dt in fechas_unicas.items():
            if fecha_dt is None:
                ventas_por_fecha[fecha_str] = {}

    # Calcular por barril
    barriles_detalle: List[Dict[str, Any]] = []

    for b in pinchados:
        canilla_raw = str(b.get("canilla", "")).strip()
        try:
            canilla_n = str(int(float(canilla_raw))) if canilla_raw else ""
        except (ValueError, TypeError):
            canilla_n = canilla_raw
        litros_total = float(b.get("litros_barril") or 50.0)

        fecha_str = b.get("fecha_pinchado", "")
        ventas = ventas_por_fecha.get(fecha_str, {})

        productos = canilla_products.get(canilla_n, [])
        consumed = sum(
            ventas.get(pid, 0.0) * ml / 1000.0
            for pid, ml in productos
        )
        remaining = max(0.0, litros_total - consumed)
        pct = round(remaining / litros_total * 100, 1) if litros_total else 0.0

        barriles_detalle.append({
            **b,
            "litros_total": litros_total,
            "litros_consumidos": round(consumed, 1),
            "litros_disponibles": round(remaining, 1),
            "porcentaje_restante": pct,
        })

    for b in en_camara:
        litros_total = float(b.get("litros_barril") or 50.0)
        barriles_detalle.append({
            **b,
            "litros_total": litros_total,
            "litros_consumidos": 0.0,
            "litros_disponibles": litros_total,
            "porcentaje_restante": 100.0,
        })

    # Agrupar por estilo
    por_estilo: Dict[str, Dict] = {}
    for b in barriles_detalle:
        estilo = b.get("estilo") or "Sin estilo"
        if estilo not in por_estilo:
            por_estilo[estilo] = {
                "estilo": estilo,
                "proveedor": b.get("proveedor") or "",
                "litros_total": 0.0,
                "litros_consumidos": 0.0,
                "litros_disponibles": 0.0,
                "barriles_pinchados": 0,
                "barriles_camara": 0,
                "canillas": [],
            }
        por_estilo[estilo]["litros_total"] += b["litros_total"]
        por_estilo[estilo]["litros_consumidos"] += b["litros_consumidos"]
        por_estilo[estilo]["litros_disponibles"] += b["litros_disponibles"]
        if b.get("estado") == "Pinchada":
            por_estilo[estilo]["barriles_pinchados"] += 1
            canilla_val = b.get("canilla", "")
            if canilla_val:
                try:
                    por_estilo[estilo]["canillas"].append(int(canilla_val))
                except (ValueError, TypeError):
                    por_estilo[estilo]["canillas"].append(canilla_val)
        else:
            por_estilo[estilo]["barriles_camara"] += 1

    # Aplicar ajustes manuales por estilo
    ajustes_map = {a["estilo"]: float(a["ajuste_litros"]) for a in get_ajustes()}
    for e in por_estilo.values():
        ajuste = ajustes_map.get(e["estilo"], 0.0)
        e["litros_total"] = round(e["litros_total"], 1)
        e["litros_consumidos"] = round(e["litros_consumidos"], 1)
        e["ajuste_litros"] = ajuste
        e["litros_disponibles"] = round(max(0.0, e["litros_disponibles"] + ajuste), 1)
        e["porcentaje_restante"] = round(
            e["litros_disponibles"] / e["litros_total"] * 100, 1
        ) if e["litros_total"] else 0.0
        # Ordenar canillas y exponer la menor para ordenar en frontend
        e["canillas"] = sorted(e["canillas"], key=lambda x: (int(x) if str(x).isdigit() else 999))
        e["canilla_min"] = e["canillas"][0] if e["canillas"] else None

    # Bug 4 fix: propagar ajustes manuales a barriles_detalle proporcionalmente.
    # El ratio = litros_disponibles_ajustados / litros_disponibles_sin_ajuste, por estilo.
    for b in barriles_detalle:
        estilo = b.get("estilo") or "Sin estilo"
        e = por_estilo.get(estilo)
        if e is None or e.get("ajuste_litros", 0.0) == 0.0:
            continue
        unadj = e["litros_disponibles"] - e["ajuste_litros"]
        if unadj <= 0:
            continue
        ratio = e["litros_disponibles"] / unadj
        adj = round(max(0.0, b["litros_disponibles"] * ratio), 1)
        b["litros_disponibles"] = adj
        b["porcentaje_restante"] = round(adj / b["litros_total"] * 100, 1) if b["litros_total"] else 0.0

    # Agrupar por proveedor (DESPUÉS del ajuste para que los números sean consistentes)
    por_proveedor: Dict[str, Dict] = {}
    for b in barriles_detalle:
        prov = b.get("proveedor") or "Sin proveedor"
        if prov not in por_proveedor:
            por_proveedor[prov] = {
                "proveedor": prov,
                "litros_total": 0.0,
                "litros_disponibles": 0.0,
                "barriles_count": 0,
            }
        por_proveedor[prov]["litros_total"] += b["litros_total"]
        por_proveedor[prov]["litros_disponibles"] += b["litros_disponibles"]
        por_proveedor[prov]["barriles_count"] += 1

    for p in por_proveedor.values():
        p["litros_total"] = round(p["litros_total"], 1)
        p["litros_disponibles"] = round(p["litros_disponibles"], 1)
        p["porcentaje_restante"] = round(
            p["litros_disponibles"] / p["litros_total"] * 100, 1
        ) if p["litros_total"] else 0.0

    return {
        "por_estilo": sorted(por_estilo.values(), key=lambda x: -x["litros_disponibles"]),
        "por_proveedor": sorted(por_proveedor.values(), key=lambda x: -x["litros_disponibles"]),
        "barriles_detalle": sorted(barriles_detalle, key=lambda x: (x.get("estado") != "Pinchada", x.get("estilo", ""))),
        "total_litros_disponibles": round(sum(b["litros_disponibles"] for b in barriles_detalle), 1),
        "total_barriles_activos": len(barriles_detalle),
        "last_updated": datetime.now().isoformat(),
    }

"""
Servicio de estadística — wrapper del módulo Estadistica/
Adapta statistics_service.py al contexto del backend FastAPI.
"""
import sys
import os
from pathlib import Path
from datetime import datetime, date
from typing import Optional, Dict, Any
import requests as _requests

_SERVICES_DIR = Path(__file__).parent
if str(_SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICES_DIR))

from ..config import settings


def _inject_credentials():
    os.environ.setdefault("NUCLEO_EMAIL_RECOLETA", settings.sucursal_recoleta_email)
    os.environ.setdefault("NUCLEO_PASSWORD_RECOLETA", settings.nucleo_password)
    db_path = Path(__file__).parent.parent.parent / "nucleocheck.db"
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")


_inject_credentials()

import statistics_service as _svc
import data_processing as _dp
from database import ensure_schema, read_table
from scraper import (
    build_today_shift_range,
    build_shift_range_for_date,
    get_location_config,
    fetch_statistics_bundle,
    LOCATIONS,
    login_user,
    validate_token,
    build_base_headers,
    format_api_datetime,
)
from config import LOCAL_TIMEZONE


# ─── CACHÉ DE TOKENS EN MEMORIA ───────────────────────────────────────────────

_token_cache: Dict[str, Dict[str, Any]] = {}
_TOKEN_TTL_SECONDS = 50 * 60


def _get_cached_token(location_key: str) -> Optional[str]:
    entry = _token_cache.get(location_key)
    if not entry:
        return None
    if (datetime.now() - entry["obtained_at"]).total_seconds() > _TOKEN_TTL_SECONDS:
        del _token_cache[location_key]
        return None
    return entry["token"]


def _set_cached_token(location_key: str, token: str):
    _token_cache[location_key] = {"token": token, "obtained_at": datetime.now()}


def _get_live_token(location_key: str) -> str:
    cached = _get_cached_token(location_key)
    if cached:
        return cached
    location = get_location_config(location_key)
    with _requests.Session() as session:
        t1, _ = login_user(session, location["company_id"], location["email"], location["password"])
        token, _ = validate_token(session, t1)
    _set_cached_token(location_key, token)
    return token


def _auth_headers(token: str) -> Dict[str, str]:
    h = build_base_headers()
    h["Authorization"] = f"Bearer {token}"
    h["jwt-Token"] = token
    h.pop("Content-Type", None)
    return h


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def _location_key_from_sucursal(sucursal_id: str) -> str:
    mapping = {"1": "recoleta", "recoleta": "recoleta"}
    key = mapping.get(str(sucursal_id).lower())
    if not key:
        raise ValueError(f"Sucursal desconocida: {sucursal_id}")
    return key


_LOCATION_NAMES = {"recoleta": "Recoleta"}
_API_BASE = "https://api-prod.nucleocheck.com"

_TURNO_MANANA_START_H, _TURNO_MANANA_START_M = 9,  0   # 09:00
_TURNO_MANANA_END_H,   _TURNO_MANANA_END_M   = 16, 30  # 16:30
_TURNO_NOCHE_END_H,    _TURNO_NOCHE_END_M    = 3,  0   # 03:00 del día siguiente

_NOCHE_START_MINUTES = _TURNO_MANANA_END_H * 60 + _TURNO_MANANA_END_M  # 990
_NOCHE_END_MINUTES   = _TURNO_NOCHE_END_H * 60 + _TURNO_NOCHE_END_M    # 180


def _turno_ranges():
    """Devuelve (turno_nombre, is_noche, turno_start, turno_end, manana_start, manana_end)."""
    from datetime import time as _time, timedelta as _td
    now = datetime.now(LOCAL_TIMEZONE)
    now_minutes = now.hour * 60 + now.minute

    business_date = now.date()
    if now.hour < 8:
        business_date = business_date - _td(days=1)

    is_noche = now_minutes >= _NOCHE_START_MINUTES or now_minutes < _NOCHE_END_MINUTES

    noche_start_t  = _time(_TURNO_MANANA_END_H,   _TURNO_MANANA_END_M)
    noche_end_t    = _time(_TURNO_NOCHE_END_H,    _TURNO_NOCHE_END_M)
    manana_start_t = _time(_TURNO_MANANA_START_H, _TURNO_MANANA_START_M)
    manana_end_t   = _time(_TURNO_MANANA_END_H,   _TURNO_MANANA_END_M)

    if is_noche:
        if now_minutes >= _NOCHE_START_MINUTES:
            t_start = datetime.combine(now.date(), noche_start_t, tzinfo=LOCAL_TIMEZONE)
            t_end   = min(now, datetime.combine(now.date() + _td(days=1), noche_end_t, tzinfo=LOCAL_TIMEZONE))
        else:
            t_start = datetime.combine(now.date() - _td(days=1), noche_start_t, tzinfo=LOCAL_TIMEZONE)
            t_end   = min(now, datetime.combine(now.date(), noche_end_t, tzinfo=LOCAL_TIMEZONE))
    else:
        t_start = datetime.combine(business_date, manana_start_t, tzinfo=LOCAL_TIMEZONE)
        t_end   = min(now, datetime.combine(business_date, manana_end_t, tzinfo=LOCAL_TIMEZONE))

    manana_start = datetime.combine(business_date, manana_start_t, tzinfo=LOCAL_TIMEZONE)
    manana_end   = datetime.combine(business_date, manana_end_t,   tzinfo=LOCAL_TIMEZONE)

    turno_nombre = "Turno Noche" if is_noche else "Turno Mañana"
    return turno_nombre, is_noche, t_start, t_end, manana_start, manana_end


def _fetch_cobrado(session, auth_h: dict, start, end):
    """Retorna (monto_cobrado, pedidos_cobrados) para el rango dado."""
    r = session.get(
        f"{_API_BASE}/Stats/GetSalesPaymentMethods/",
        headers=auth_h,
        params={"StartDate": format_api_datetime(start),
                "EndDate": format_api_datetime(end),
                "UseTimeRange": "false"},
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    monto = float(data.get("Total") or 0)
    pedidos = len(set(
        str(item.get("OrderId")) for item in (data.get("Items") or [])
        if item.get("OrderId")
    ))
    return monto, pedidos


# ─── FACTURACIÓN EN VIVO (DASHBOARD) ─────────────────────────────────────────

def _get_facturacion_live(location_key: str) -> Dict[str, Any]:
    """
    Facturación en tiempo real con desglose por turno:
    - facturacion_turno: cobrado en el turno activo + mesas abiertas
    - facturacion_total: día completo + mesas abiertas
    - facturacion_turno_manana: turno mañana cerrado (solo cuando estamos en noche)
    - turno_actual: 'Turno Mañana' | 'Turno Noche'
    """
    try:
        token = _get_live_token(location_key)
        turno_nombre, is_noche, t_start, t_end, manana_start, manana_end = _turno_ranges()
        dia_start, dia_end = build_today_shift_range()

        with _requests.Session() as session:
            auth_h = _auth_headers(token)

            cobrado_turno, pedidos_turno = _fetch_cobrado(session, auth_h, t_start, t_end)
            cobrado_dia,   pedidos_dia   = _fetch_cobrado(session, auth_h, dia_start, dia_end)

            cobrado_manana, pedidos_manana = (0.0, 0)
            if is_noche:
                cobrado_manana, pedidos_manana = _fetch_cobrado(session, auth_h, manana_start, manana_end)

            r_mesas = session.get(
                f"{_API_BASE}/RestaurantPendingOrders/GetRestaurantPendingOrders/",
                headers=auth_h,
                params={"AverageCommensalFrom": "", "AverageCommensalTo": ""},
                timeout=15,
            )
            r_mesas.raise_for_status()
            mesas_data = r_mesas.json() if isinstance(r_mesas.json(), list) else []
            total_mesas_abiertas = sum(float(m.get("Total") or 0) for m in mesas_data)
            comensales_mesas = sum(int(m.get("QuantityCommensal") or 0) for m in mesas_data)

            r_sum = session.get(f"{_API_BASE}/Order/GetCompanySummary", headers=auth_h, timeout=10)
            r_sum.raise_for_status()
            summary = r_sum.json()

        comensales = int(summary.get("CommensalQuantity") or 0) or comensales_mesas
        facturacion_turno = cobrado_turno + total_mesas_abiertas
        facturacion_total = cobrado_dia   + total_mesas_abiertas
        pedidos_count_turno = pedidos_turno + len(mesas_data)
        pedidos_count_dia   = pedidos_dia   + len(mesas_data)

        return {
            "turno_actual": turno_nombre,
            "facturacion_turno": facturacion_turno,
            "facturacion_cobrada": cobrado_turno,
            "facturacion_turno_manana": cobrado_manana if is_noche else None,
            "total_mesas_abiertas": total_mesas_abiertas,
            "facturacion_total": facturacion_total,
            "pedidos_cobrados": pedidos_turno,
            "mesas_count": len(mesas_data),
            "pedidos_count": pedidos_count_turno,
            "pedidos_count_dia": pedidos_count_dia,
            "ticket_promedio": facturacion_turno / pedidos_count_turno if pedidos_count_turno > 0 else 0.0,
            "mesas_abiertas": int(summary.get("TablesOpenQuantity") or 0),
            "mesas_en_cobro": int(summary.get("TablesPaymentQuantity") or 0),
            "mesas_total": int(summary.get("TablesTotalQuantity") or 0),
            "mesas_libres": int(summary.get("TablesFreeQuantity") or 0),
            "ocupacion_pct": float(summary.get("OccupancyPercentage") or 0),
            "comensales": comensales,
            "ok": True,
        }
    except Exception as e:
        return {
            "turno_actual": "Turno Mañana",
            "facturacion_turno": 0.0,
            "facturacion_cobrada": 0.0, "total_mesas_abiertas": 0.0,
            "facturacion_total": 0.0, "facturacion_turno_manana": None,
            "pedidos_cobrados": 0, "mesas_count": 0,
            "pedidos_count": 0, "pedidos_count_dia": 0, "ticket_promedio": 0.0,
            "mesas_abiertas": 0, "mesas_en_cobro": 0,
            "mesas_total": 0, "mesas_libres": 0,
            "ocupacion_pct": 0.0, "comensales": 0,
            "ok": False, "error": str(e),
        }


# ─── ESTADÍSTICA DEL DÍA ──────────────────────────────────────────────────────

def _build_db_stats_for_location(location_key: str, business_date) -> Dict[str, Any]:
    """Stats del día desde la DB local (productos vendidos, gastos, última actualización)."""
    bundle = _dp.load_clean_data_bundle(start_date=business_date, end_date=business_date, location_key=location_key)
    filtered = _dp.filter_clean_bundle(bundle, location_selection=location_key,
                                        start_date=business_date, end_date=business_date)
    overview = _dp.build_overview_metrics(filtered)
    productos_df = filtered["df_productos_clean"]
    productos_vendidos = int(productos_df["cantidad_num"].sum()) if not productos_df.empty else 0

    runs_df = filtered["df_scrape_runs_clean"]
    ultima_actualizacion = None
    if not runs_df.empty and "fetched_at_dt" in runs_df.columns:
        last = runs_df["fetched_at_dt"].dropna().max()
        if last is not None and str(last) != "NaT":
            ultima_actualizacion = last.isoformat() if hasattr(last, "isoformat") else str(last)

    return {
        "facturacion_cerrada": overview["sales_total"],
        "pedidos_count": overview["order_count"],
        "ticket_promedio": overview["ticket_average"],
        "productos_vendidos": productos_vendidos,
        "gastos_total": overview["cost_total"],
        "ultima_actualizacion": ultima_actualizacion,
    }


def get_stats_hoy(sucursal_id: str = "ambas") -> Dict[str, Any]:
    """Stats del turno actual desde la DB (sin mesas abiertas)."""
    ensure_schema()
    start_local, _ = build_today_shift_range()
    business_date_hoy = start_local.date()
    loc_key = None if sucursal_id in ("ambas", "all") else _location_key_from_sucursal(sucursal_id)
    bundle = _dp.load_clean_data_bundle(start_date=business_date_hoy, end_date=business_date_hoy, location_key=loc_key)

    location_selection = "ambas"
    if sucursal_id not in ("ambas", "all"):
        location_selection = _location_key_from_sucursal(sucursal_id)

    filtered = _dp.filter_clean_bundle(bundle, location_selection=location_selection,
                                        start_date=business_date_hoy, end_date=business_date_hoy)
    overview = _dp.build_overview_metrics(filtered)
    productos_df = filtered["df_productos_clean"]
    productos_vendidos = int(productos_df["cantidad_num"].sum()) if not productos_df.empty else 0

    runs_df = filtered["df_scrape_runs_clean"]
    ultima_actualizacion = None
    if not runs_df.empty and "fetched_at_dt" in runs_df.columns:
        last = runs_df["fetched_at_dt"].dropna().max()
        if last is not None and str(last) != "NaT":
            ultima_actualizacion = last.isoformat() if hasattr(last, "isoformat") else str(last)

    return {
        "fecha": business_date_hoy.isoformat(),
        "turno_inicio": start_local.isoformat(),
        "facturacion_total": overview["sales_total"],
        "pedidos_count": overview["order_count"],
        "ticket_promedio": overview["ticket_average"],
        "productos_vendidos": productos_vendidos,
        "gastos_total": overview["cost_total"],
        "ultima_actualizacion": ultima_actualizacion,
    }


def get_stats_hoy_por_sucursal(include_open_orders: bool = True) -> Dict[str, Any]:
    """
    Stats del día por sucursal con datos en vivo (facturación + mesas abiertas).
    Productos y gastos vienen de la DB local.
    """
    ensure_schema()
    start_local, _ = build_today_shift_range()
    business_date_hoy = start_local.date()

    sucursales_data = []
    total_facturacion = 0.0
    total_mesas = 0
    total_pedidos = 0
    total_gastos = 0.0
    total_productos = 0

    for location_key in ["recoleta"]:
        db_stats = _build_db_stats_for_location(location_key, business_date_hoy)
        live = _get_facturacion_live(location_key) if include_open_orders else None

        if live and live["ok"]:
            row = {
                "turno_actual": live["turno_actual"],
                "facturacion_turno": live["facturacion_turno"],
                "facturacion_cobrada": live["facturacion_cobrada"],
                "total_mesas_abiertas": live["total_mesas_abiertas"],
                "facturacion_total": live["facturacion_total"],
                "facturacion_turno_manana": live["facturacion_turno_manana"],
                "pedidos_cobrados": live["pedidos_cobrados"],
                "mesas_count": live["mesas_count"],
                "pedidos_count": live["pedidos_count"],
                "pedidos_count_dia": live["pedidos_count_dia"],
                "ticket_promedio": live["ticket_promedio"],
                "mesas_abiertas": live["mesas_abiertas"],
                "mesas_en_cobro": live["mesas_en_cobro"],
                "mesas_total": live["mesas_total"],
                "mesas_libres": live["mesas_libres"],
                "ocupacion_pct": live["ocupacion_pct"],
                "comensales": live["comensales"],
                "mesas_ok": True,
            }
        else:
            row = {
                "turno_actual": "Turno Mañana",
                "facturacion_turno": db_stats["facturacion_cerrada"],
                "facturacion_cobrada": db_stats["facturacion_cerrada"],
                "total_mesas_abiertas": 0.0,
                "facturacion_total": db_stats["facturacion_cerrada"],
                "facturacion_turno_manana": None,
                "pedidos_cobrados": db_stats["pedidos_count"],
                "mesas_count": 0,
                "pedidos_count": db_stats["pedidos_count"],
                "pedidos_count_dia": db_stats["pedidos_count"],
                "ticket_promedio": db_stats["ticket_promedio"],
                "mesas_abiertas": 0, "mesas_en_cobro": 0,
                "mesas_total": 0, "mesas_libres": 0,
                "ocupacion_pct": 0.0, "comensales": 0,
                "mesas_ok": False,
            }

        sucursales_data.append({
            "location_key": location_key,
            "nombre": _LOCATION_NAMES.get(location_key, location_key.title()),
            **row,
            "productos_vendidos": db_stats["productos_vendidos"],
            "gastos_total": db_stats["gastos_total"],
            "ultima_actualizacion": db_stats["ultima_actualizacion"],
        })

        total_facturacion += row["facturacion_total"]
        total_mesas += row["mesas_abiertas"]
        total_pedidos += row["pedidos_count"]
        total_gastos += db_stats["gastos_total"]
        total_productos += db_stats["productos_vendidos"]

    return {
        "fecha": business_date_hoy.isoformat(),
        "turno_inicio": start_local.isoformat(),
        "sucursales": sucursales_data,
        "totales": {
            "facturacion_total": total_facturacion,
            "mesas_abiertas": total_mesas,
            "pedidos_count": total_pedidos,
            "gastos_total": total_gastos,
            "productos_vendidos": total_productos,
        },
    }


# ─── ESTADÍSTICAS COMPLETAS CON CACHÉ ────────────────────────────────────────


def get_stats_completas(
    sucursal_id: str = "ambas",
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    turno: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Estadísticas completas del período.
    1. Busca en caché (instantáneo si ya fue procesado).
    2. Si no hay caché, procesa con pandas y guarda el resultado.
    turno: None | "manana" | "noche"
    """
    from .stats_cache_service import get_cached, save_cache

    ensure_schema()
    location_selection = "ambas"
    if sucursal_id not in ("ambas", "all"):
        location_selection = _location_key_from_sucursal(sucursal_id)

    turno_key = turno if turno in ("manana", "noche") else None

    # Intentar desde caché
    cached = get_cached(location_selection, start_date, end_date, turno=turno_key)
    if cached is not None:
        cached["_from_cache"] = True
        return cached

    # Procesar y guardar en caché
    result = _svc.build_complete_statistics(
        location_key=location_selection,
        start_date=start_date,
        end_date=end_date,
        turno=turno_key,
    )

    result["_from_cache"] = False
    result["_generated_at"] = datetime.now(LOCAL_TIMEZONE).isoformat()

    try:
        save_cache(location_selection, start_date, end_date, result, turno=turno_key)
    except Exception:
        pass

    return result


# ─── SCRAPING / ACTUALIZACIÓN ─────────────────────────────────────────────────

def _get_last_scraped_period_start(location_key: str) -> Optional[datetime]:
    """Retorna el period_start más reciente guardado en pedidos para esta ubicación."""
    try:
        from database import get_engine
        from sqlalchemy import text
        with get_engine().connect() as conn:
            row = conn.execute(
                text(
                    "SELECT period_start FROM pedidos "
                    "WHERE location_key = :key "
                    "ORDER BY period_start DESC LIMIT 1"
                ),
                {"key": location_key},
            ).fetchone()
        if row:
            return datetime.fromisoformat(row[0])
    except Exception:
        pass
    return None


def _incremental_start(location_key: str, requested_start: datetime) -> datetime:
    """
    Calcula el inicio efectivo del scraping preservando datos históricos.

    - Si ya hay datos de días anteriores a hoy → empieza desde el turno de hoy.
    - Si ya hay datos de hoy → refresca desde el inicio del turno de hoy.
    - Si no hay datos → usa el inicio solicitado (primera carga).
    """
    from datetime import timedelta
    last = _get_last_scraped_period_start(location_key)
    if last is None:
        return requested_start

    today_start, _ = build_today_shift_range()

    if last >= today_start:
        # Ya tenemos datos de hoy; volvemos a arrancar desde hoy para actualizarlo
        return max(requested_start, today_start)
    else:
        # Último dato es de un día anterior; el próximo a buscar es el día siguiente
        next_day = (last + timedelta(days=1)).date()
        next_start, _ = build_shift_range_for_date(next_day)
        effective = max(requested_start, next_start)
        # Si el día siguiente ya es hoy o futuro, arrancamos desde hoy
        return max(effective, today_start) if next_start > today_start else effective


def actualizar_stats(
    sucursal_id: str = "ambas",
    period: str = "today",
    target_date: Optional[date] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Scraping incremental de NucleoCheck.
    Nunca reprocesa períodos históricos ya almacenados: solo añade datos
    desde la última fecha guardada hacia adelante, preservando el historial.
    """
    from .stats_cache_service import invalidate

    start_local, end_local = _svc.build_date_range(
        period=period, target_date=target_date, year=year, month=month,
    )

    if sucursal_id in ("ambas", "all"):
        location_keys = list(LOCATIONS.keys())
    else:
        location_keys = [_location_key_from_sucursal(sucursal_id)]

    resultados = []
    for key in location_keys:
        location = get_location_config(key)

        # Inicio incremental: no pisar datos históricos ya guardados
        effective_start = _incremental_start(key, start_local)

        if effective_start >= end_local:
            # Ya estamos al día, nada nuevo que buscar
            resultados.append({
                "sucursal": location["name"],
                "location_key": key,
                "pedidos": 0,
                "facturacion": 0.0,
                "period_start": effective_start.isoformat(),
                "period_end": end_local.isoformat(),
                "actualizado_en": datetime.now(LOCAL_TIMEZONE).isoformat(),
                "note": "Ya al día, no hay datos nuevos que agregar.",
            })
            continue

        bundle = fetch_statistics_bundle(effective_start, end_local, location)
        from scraper import summarize_unique_orders
        order_count, total = summarize_unique_orders(bundle["payments"])
        _token_cache.pop(key, None)
        resultados.append({
            "sucursal": location["name"],
            "location_key": key,
            "pedidos": order_count,
            "facturacion": total,
            "period_start": effective_start.isoformat(),
            "period_end": end_local.isoformat(),
            "actualizado_en": datetime.now(LOCAL_TIMEZONE).isoformat(),
        })

    # Invalidar caché para que la próxima consulta use datos frescos
    try:
        invalidated = invalidate(
            location_key=sucursal_id if sucursal_id not in ("ambas", "all") else None,
            start_date=start_local.date(),
            end_date=end_local.date(),
        )
    except Exception:
        invalidated = 0

    return {
        "success": True,
        "period": period,
        "resultados": resultados,
        "cache_invalidated": invalidated,
    }


# ─── META / INFO ──────────────────────────────────────────────────────────────

def get_ultima_actualizacion() -> Optional[str]:
    try:
        ensure_schema()
        runs_df = read_table("scrape_runs")
        if runs_df.empty:
            return None
        last = runs_df["fetched_at"].dropna().max()
        return str(last) if last else None
    except Exception:
        return None


def get_rango_disponible() -> Dict[str, Any]:
    try:
        ensure_schema()
        from database import get_engine
        from sqlalchemy import text
        with get_engine().connect() as conn:
            row = conn.execute(text("SELECT MIN(fecha), MAX(fecha) FROM pedidos")).fetchone()
        return {
            "min_date": row[0][:10] if row and row[0] else None,
            "max_date": row[1][:10] if row and row[1] else None,
        }
    except Exception:
        return {"min_date": None, "max_date": None}


def get_cache_info() -> Dict[str, Any]:
    """Info del caché de estadísticas procesadas."""
    from .stats_cache_service import list_cache_entries, get_cache_size_mb
    return {
        "entries": list_cache_entries(),
        "size_mb": get_cache_size_mb(),
    }


def get_vales_counters(location_key: str = "recoleta") -> Dict[str, Any]:
    """
    Facturación acumulada de Vales 1 (Ricardo Rojas, PoS 4 cfg=2),
    Vales 2 (Gustavo Ariel Otero, PoS 2 cfg=3) y
    Vales 3 (Karina Melo, PoS 5 cfg=4).
    Fuente: NucleoCheck API InvoiceList/Find filtrado por PointOfSaleNumber.
    Períodos: semana actual (lunes → hoy) y mes actual (día 1 → hoy).
    """
    from datetime import date, timedelta, timezone as _tz
    from email.utils import format_datetime as _fmt_dt

    # Argentina = UTC-3
    now_utc = datetime.now(_tz.utc)
    local_today = (now_utc - timedelta(hours=3)).date()
    week_start  = local_today - timedelta(days=local_today.weekday())
    month_start = local_today.replace(day=1)

    def _to_api_date(d: date) -> str:
        # Business day starts at 8 AM Argentina = 11 AM UTC
        from datetime import datetime as _dt
        dt_utc = _dt(d.year, d.month, d.day, 11, 0, 0, tzinfo=_tz.utc)
        return _fmt_dt(dt_utc, usegmt=True)

    date_from_week  = _to_api_date(week_start)
    date_from_month = _to_api_date(month_start)
    date_to         = _fmt_dt(now_utc, usegmt=True)

    token = _get_live_token(location_key)
    headers = _auth_headers(token)

    def _fetch_total(pos_number: int, date_from: str, cfg_id=None) -> float:
        url = f"{_API_BASE}/InvoiceList/Find"
        resp = _requests.get(url, headers=headers, params={
            "DateFrom": date_from,
            "DateTo":   date_to,
            "PointOfSaleNumber": pos_number,
        }, timeout=30)
        resp.raise_for_status()
        invoices = resp.json()
        if cfg_id is not None:
            invoices = [i for i in invoices if i.get("SystemConfigurationFCEId") == cfg_id]
        return round(sum(float(i.get("Total") or 0) for i in invoices), 2)

    return {
        "vales1": {
            "nombre":  "Vales 1 - Rick",
            # PoS=4 is shared with Cebados SRL (cfg=1); Ricardo Rojas=cfg=2, filter client-side
            "semanal": _fetch_total(4, date_from_week,  cfg_id=2),
            "mensual": _fetch_total(4, date_from_month, cfg_id=2),
        },
        "vales2": {
            "nombre":  "Vales 2 - Gustavo",
            "semanal": _fetch_total(2, date_from_week),
            "mensual": _fetch_total(2, date_from_month),
        },
        "vales3": {
            "nombre":  "Vales 3 - Karina",
            # PoS=5, cfg=4 = Karina Melo
            "semanal": _fetch_total(5, date_from_week,  cfg_id=4),
            "mensual": _fetch_total(5, date_from_month, cfg_id=4),
        },
        "semana_desde": str(week_start),
        "mes_desde":    str(month_start),
        "hasta":        str(local_today),
    }

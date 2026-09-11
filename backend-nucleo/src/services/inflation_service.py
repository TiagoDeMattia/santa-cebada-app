"""
Servicio de datos de inflación argentina (IPC INDEC via argentinadatos.com).
Computa el índice acumulado mensual y los factores de conversión a pesos de hoy.
"""
import threading
from datetime import datetime
from typing import Dict, Optional, Any

import requests

_API_URL = "https://api.argentinadatos.com/v1/finanzas/indices/inflacion"
_TTL_HOURS = 24
_cache_lock = threading.Lock()
_cache: Dict[str, Any] = {}


def _fetch_monthly_changes() -> Dict[str, float]:
    """Descarga variaciones mensuales (%) desde argentinadatos.com."""
    r = requests.get(_API_URL, timeout=15)
    r.raise_for_status()
    raw = r.json()
    return {
        item["fecha"][:7]: float(item["valor"])
        for item in raw
        if item.get("fecha") and item.get("valor") is not None
    }


def _compute_cumulative(monthly_pct: Dict[str, float]) -> Dict[str, float]:
    """
    Convierte variaciones % mensuales en índice acumulado.
    Arranca en 1.0 desde el primer mes disponible.
    """
    index: Dict[str, float] = {}
    acc = 1.0
    for month in sorted(monthly_pct.keys()):
        acc *= 1 + monthly_pct[month] / 100
        index[month] = acc
    return index


def get_inflation_indices() -> Dict[str, Any]:
    """
    Retorna factores de ajuste por mes respecto al mes más reciente disponible.

    factor[mes] = IPC[más_reciente] / IPC[mes]
    Multiplicar un valor histórico por su factor → pesos de hoy.

    Estructura devuelta:
        {
            "indices":    {"YYYY-MM": factor_float, ...},
            "ipc_values": {"YYYY-MM": cumulative_index, ...},
            "base_month": "YYYY-MM",
            "source":     "ArgentinaDatos – IPC INDEC (var. mensual acumulada)",
        }
    """
    with _cache_lock:
        cached   = _cache.get("result")
        cached_at: Optional[datetime] = _cache.get("cached_at")
        if cached and cached_at:
            age_h = (datetime.now() - cached_at).total_seconds() / 3600
            if age_h < _TTL_HOURS:
                return cached

    try:
        monthly_pct = _fetch_monthly_changes()
    except Exception:
        with _cache_lock:
            if _cache.get("result"):
                return _cache["result"]
        return {
            "indices":    {},
            "ipc_values": {},
            "base_month": None,
            "source":     "ArgentinaDatos – sin datos (error de red)",
        }

    if not monthly_pct:
        return {
            "indices":    {},
            "ipc_values": {},
            "base_month": None,
            "source":     "ArgentinaDatos – sin datos",
        }

    ipc = _compute_cumulative(monthly_pct)
    sorted_months = sorted(ipc.keys())
    base_month  = sorted_months[-1]
    base_value  = ipc[base_month]

    indices = {
        month: round(base_value / val, 6)
        for month, val in ipc.items()
        if val > 0
    }

    result = {
        "indices":    indices,
        "ipc_values": {m: round(v, 6) for m, v in ipc.items()},
        "base_month": base_month,
        "source":     "ArgentinaDatos / INDEC – IPC Nivel General",
    }

    with _cache_lock:
        _cache["result"]    = result
        _cache["cached_at"] = datetime.now()

    return result

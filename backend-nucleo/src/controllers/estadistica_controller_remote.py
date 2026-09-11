"""
Controlador de estadísticas
"""
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
from datetime import date

from ..middleware.auth import get_current_user, TokenPayload
from ..utils.logger import logger

router = APIRouter(prefix="/estadistica", tags=["Estadística"])


def _svc():
    from ..services.estadistica_service import (
        get_stats_hoy,
        get_stats_hoy_por_sucursal,
        get_stats_completas,
        actualizar_stats,
        get_ultima_actualizacion,
        get_rango_disponible,
        get_cache_info,
    )
    return {
        "hoy": get_stats_hoy,
        "hoy_por_sucursal": get_stats_hoy_por_sucursal,
        "completas": get_stats_completas,
        "actualizar": actualizar_stats,
        "ultima": get_ultima_actualizacion,
        "rango": get_rango_disponible,
        "cache_info": get_cache_info,
    }


@router.get("/hoy")
async def stats_hoy(
    sucursal_id: str = Query("ambas"),
    current_user: TokenPayload = Depends(get_current_user),
):
    try:
        return _svc()["hoy"](sucursal_id=sucursal_id)
    except Exception as e:
        logger.error(f"Error stats hoy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hoy-por-sucursal")
async def stats_hoy_por_sucursal(
    include_open_orders: bool = Query(True),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Stats del día por sucursal con facturación en vivo (cobrado + mesas abiertas)."""
    try:
        return _svc()["hoy_por_sucursal"](include_open_orders=include_open_orders)
    except Exception as e:
        logger.error(f"Error stats hoy por sucursal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/completas")
async def stats_completas(
    sucursal_id: str = Query("ambas"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    force_refresh: bool = Query(False, description="Ignorar caché y reprocesar"),
    turno: Optional[str] = Query(None, description="Filtro de turno: manana | noche"),
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Estadísticas completas del período.
    Usa caché automáticamente — primera consulta procesa y guarda,
    las siguientes son instantáneas.
    force_refresh=true ignora el caché y reprocesa.
    turno: manana | noche | None (ambos)
    """
    try:
        if force_refresh:
            from ..services.stats_cache_service import invalidate
            loc = sucursal_id if sucursal_id not in ("ambas", "all") else None
            invalidate(location_key=loc, start_date=start_date, end_date=end_date)

        return _svc()["completas"](
            sucursal_id=sucursal_id,
            start_date=start_date,
            end_date=end_date,
            turno=turno,
        )
    except Exception as e:
        logger.error(f"Error stats completas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/actualizar")
async def actualizar_estadisticas(
    sucursal_id: str = Query("ambas"),
    period: str = Query("today"),
    target_date: Optional[date] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Scraping de NucleoCheck → guarda en DB → invalida caché del período.
    La próxima consulta de estadísticas reprocesará los datos frescos.
    """
    try:
        return _svc()["actualizar"](
            sucursal_id=sucursal_id,
            period=period,
            target_date=target_date,
            year=year,
            month=month,
        )
    except Exception as e:
        logger.error(f"Error actualizando estadísticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/meta")
async def meta_estadisticas(
    current_user: TokenPayload = Depends(get_current_user),
):
    """Metadatos: última actualización, rango disponible e info del caché."""
    try:
        s = _svc()
        return {
            "ultima_actualizacion": s["ultima"](),
            "rango_disponible": s["rango"](),
            "cache": s["cache_info"](),
        }
    except Exception as e:
        logger.error(f"Error meta estadísticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/inflation")
async def get_inflation(
    current_user: TokenPayload = Depends(get_current_user),
):
    """Índices IPC mensuales (INDEC) para ajustar valores históricos por inflación."""
    try:
        import asyncio
        from ..services.inflation_service import get_inflation_indices
        return await asyncio.to_thread(get_inflation_indices)
    except Exception as e:
        logger.error(f"Error obteniendo inflación: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vales")
async def get_vales(
    current_user: TokenPayload = Depends(get_current_user),
):
    """Facturación acumulada de Vales 1 (Rick) y Vales 2 (Gustavo) — semanal y mensual."""
    try:
        from ..services.estadistica_service import get_vales_counters
        return get_vales_counters()
    except Exception as e:
        logger.error(f"Error vales: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vales-turno")
async def get_vales_turno(
    current_user: TokenPayload = Depends(get_current_user),
):
    """Monitor de vales en tiempo real para el turno activo."""
    try:
        from ..services.estadistica_service import get_vales_turno
        return get_vales_turno()
    except Exception as e:
        logger.error(f"Error vales-turno: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/comida-turno")
async def get_comida_turno_endpoint(
    current_user: TokenPayload = Depends(get_current_user),
):
    """Ratio platos de comida / pedidos del turno activo (API live)."""
    try:
        from ..services.estadistica_service import get_comida_turno
        return get_comida_turno()
    except Exception as e:
        logger.error(f"Error comida-turno: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cache")
async def limpiar_cache(
    sucursal_id: Optional[str] = Query(None, description="Sucursal específica o vacío para todo"),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Limpia el caché de estadísticas procesadas."""
    try:
        from ..services.stats_cache_service import invalidate
        count = invalidate(location_key=sucursal_id)
        return {"deleted": count, "message": f"Se eliminaron {count} entradas del caché"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

"""
API de predicción de ventas.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from ..middleware.auth import get_current_user, TokenPayload
from ..utils.logger import logger

router = APIRouter(prefix="/prediccion", tags=["Prediccion"])


@router.get("")
async def get_prediccion(
    horizon:     str = Query("week", description="day|week|month|quarter|year"),
    segment:     str = Query("total", description="total|product"),
    product:     Optional[str] = Query(None),
    model:       Optional[str] = Query(None, description="Forzar modelo específico"),
    sucursal_id: str = Query("1"),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Predicción completa con selección automática de modelo."""
    import asyncio
    try:
        from ..services.prediccion_service import predict, _location_key_from_sucursal_pred
        loc = _location_key_from_sucursal_pred(sucursal_id)
        return await asyncio.wait_for(
            asyncio.to_thread(predict, location_key=loc, horizon=horizon,
                              segment=segment, product=product, force_model=model),
            timeout=120.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout generando predicción")
    except Exception as e:
        logger.error(f"Error predicción: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info")
async def get_info(
    sucursal_id: str = Query("1"),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Rango de datos disponibles y resumen."""
    try:
        from ..services.prediccion_service import get_data_range, _location_key_from_sucursal_pred
        loc = _location_key_from_sucursal_pred(sucursal_id)
        return get_data_range(loc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invalidar-cache")
async def invalidar_cache(
    current_user: TokenPayload = Depends(get_current_user),
):
    """Limpia el caché de predicciones."""
    from ..services.prediccion_service import invalidate_cache
    invalidate_cache()
    return {"ok": True, "mensaje": "Caché limpiado"}


@router.get("/productos-lista")
async def productos_lista(
    sucursal_id: str = Query("1"),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Lista de todos los productos ordenados por facturación total."""
    import asyncio
    try:
        from ..services.prediccion_service import get_productos_lista, _location_key_from_sucursal_pred
        loc = _location_key_from_sucursal_pred(sucursal_id)
        return await asyncio.to_thread(get_productos_lista, loc)
    except Exception as e:
        logger.error(f"Error productos-lista: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/producto-evolucion")
async def producto_evolucion(
    nombre:      str = Query(...),
    start_date:  Optional[str] = Query(None),
    end_date:    Optional[str] = Query(None),
    sucursal_id: str = Query("1"),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Evolución diaria de ventas para un producto específico con insights automáticos."""
    import asyncio
    try:
        from ..services.prediccion_service import get_producto_evolucion, _location_key_from_sucursal_pred
        loc = _location_key_from_sucursal_pred(sucursal_id)
        return await asyncio.wait_for(
            asyncio.to_thread(get_producto_evolucion, nombre, start_date, end_date, loc),
            timeout=30.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout cargando evolución del producto")
    except Exception as e:
        logger.error(f"Error producto-evolucion: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

"""
Rutas de stock aproximado de cervezas.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from pydantic import BaseModel

from ..middleware.auth import get_current_user, TokenPayload
from ..utils.logger import logger

router = APIRouter(prefix="/cerveza-stock", tags=["Cerveza Stock"])


class CanillaConfigEntry(BaseModel):
    producto_id: int
    canilla_nombre: str
    canilla_numero: str
    ml_por_pinta: Optional[int] = None
    activa: int = 1
    es_hora_santa: int = 0


class AjusteEntry(BaseModel):
    estilo: str
    ajuste_litros: float = 0.0
    nota: Optional[str] = None


@router.get("")
async def get_stock(
    sucursal_id: str = Query("1"),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Calcula y retorna el stock aproximado de cervezas."""
    import asyncio
    try:
        from ..services.cerveza_stock_service import calcular_stock_cervezas
        return await asyncio.wait_for(
            asyncio.to_thread(calcular_stock_cervezas, sucursal_id=sucursal_id),
            timeout=55.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout calculando stock de cervezas")
    except Exception as e:
        logger.error(f"Error calculando stock cervezas: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug")
async def debug_stock(
    sucursal_id: str = Query("1"),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Diagnóstico: muestra cada paso del cálculo de stock."""
    from datetime import datetime
    from ..services.cerveza_stock_service import (
        get_canilla_config, _parse_fecha, _get_ventas_productos
    )
    from ..services.barriles_service import get_barriles

    out = {}

    # 1. Canilla config
    canilla_cfg = get_canilla_config()
    canilla_products = {}
    for cfg in canilla_cfg:
        if not cfg.get("activa") or cfg.get("ml_por_pinta") is None:
            continue
        n = str(cfg["canilla_numero"])
        canilla_products.setdefault(n, []).append(
            (int(cfg["producto_id"]), int(cfg["ml_por_pinta"]))
        )
    out["canilla_products"] = {k: v for k, v in canilla_products.items()}

    # 2. Barriles pinchados con su canilla
    barriles = get_barriles(filtro="activos", sucursal_id=sucursal_id)
    pinchados = [b for b in barriles if b.get("estado") == "Pinchada"]
    out["pinchados"] = [
        {
            "estilo": b.get("estilo"),
            "canilla": b.get("canilla"),
            "canilla_type": type(b.get("canilla")).__name__,
            "fecha_pinchado": b.get("fecha_pinchado"),
            "canilla_en_config": str(b.get("canilla", "")).strip() in canilla_products,
        }
        for b in pinchados
    ]

    # 3. Ventas desde la primera fecha de pinchado
    now = datetime.now()
    fechas_sample = {}
    for b in pinchados[:3]:  # solo primeras 3 para no saturar
        fecha_str = b.get("fecha_pinchado", "")
        if fecha_str and fecha_str not in fechas_sample:
            fecha_dt = _parse_fecha(fecha_str)
            ventas = _get_ventas_productos(fecha_dt, now, sucursal_id) if fecha_dt else {}
            fechas_sample[fecha_str] = {
                "parsed_ok": fecha_dt is not None,
                "parsed_as": str(fecha_dt) if fecha_dt else None,
                "ventas_count": len(ventas),
                "ventas_sample": dict(list(ventas.items())[:10]),
            }
    out["ventas_por_fecha_sample"] = fechas_sample

    # 4. Raw de la API para la primera fecha (para verificar estructura)
    for b in pinchados[:1]:
        fecha_str = b.get("fecha_pinchado", "")
        if fecha_str:
            from ..services.cerveza_stock_service import _parse_fecha, _format_dt
            from ..services.estadistica_service import _get_live_token, _auth_headers, _location_key_from_sucursal
            import requests as _req
            fecha_dt = _parse_fecha(fecha_str)
            if fecha_dt:
                try:
                    loc = _location_key_from_sucursal(sucursal_id)
                    tok = _get_live_token(loc)
                    h = _auth_headers(tok)
                    r = _req.get(
                        "https://api-prod.nucleocheck.com/Stats/GetSalesByProductStats/",
                        headers=h,
                        params={
                            "StartDate": _format_dt(fecha_dt),
                            "EndDate": _format_dt(now),
                            "UseTimeRange": "false",
                            "DateGrouping": 0,
                            "OnlyProductsSendUnitAlax": "false",
                            "IsBreakDownPromotions": "false",
                        },
                        timeout=30,
                    )
                    raw = r.json()
                    top_level_keys = list(raw.keys()) if isinstance(raw, dict) else f"list of {len(raw)}"
                    items = raw.get("Items", []) if isinstance(raw, dict) else raw
                    first_item = items[0] if items else {}
                    out["api_raw_debug"] = {
                        "status_code": r.status_code,
                        "top_level_keys": top_level_keys,
                        "items_count": len(items),
                        "first_item_keys": list(first_item.keys()) if first_item else [],
                        "first_item": first_item,
                    }
                except Exception as ex:
                    out["api_raw_debug"] = {"error": str(ex)}

    return out


@router.get("/canillas")
async def get_canillas(
    current_user: TokenPayload = Depends(get_current_user),
):
    """Retorna la config de canillas."""
    try:
        from ..services.cerveza_stock_service import get_canilla_config
        return get_canilla_config()
    except Exception as e:
        logger.error(f"Error obteniendo config canillas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/canillas")
async def update_canillas(
    entries: List[CanillaConfigEntry],
    current_user: TokenPayload = Depends(get_current_user),
):
    """Reemplaza toda la config de canillas."""
    try:
        from ..services.cerveza_stock_service import save_canilla_config
        return save_canilla_config([e.model_dump() for e in entries])
    except Exception as e:
        logger.error(f"Error guardando config canillas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ajustes")
async def get_ajustes(
    current_user: TokenPayload = Depends(get_current_user),
):
    """Retorna los ajustes manuales de litros por estilo."""
    try:
        from ..services.cerveza_stock_service import get_ajustes as _get
        return _get()
    except Exception as e:
        logger.error(f"Error obteniendo ajustes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/ajustes")
async def save_ajustes(
    entries: List[AjusteEntry],
    current_user: TokenPayload = Depends(get_current_user),
):
    """Guarda ajustes manuales de litros por estilo."""
    try:
        from ..services.cerveza_stock_service import save_ajustes as _save
        return _save([e.model_dump() for e in entries])
    except Exception as e:
        logger.error(f"Error guardando ajustes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

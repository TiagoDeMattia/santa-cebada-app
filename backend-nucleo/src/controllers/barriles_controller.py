"""
Controlador de barriles de cerveza
"""
import asyncio
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from typing import Optional
from pydantic import BaseModel

from ..middleware.auth import get_current_user, TokenPayload
from ..utils.logger import logger

router = APIRouter(prefix="/barriles", tags=["Barriles"])


def _update_nucleo_canilla_bg(canilla_num: str, estilo: str):
    """Wrapper sincrónico para ejecutar en background thread."""
    try:
        from ..services.nucleo_canilla_service import actualizar_nombre_canilla
        result = actualizar_nombre_canilla(canilla_num, estilo)
        if result.get("ok"):
            logger.info(f"NucleoCheck canilla {canilla_num} actualizada: {estilo}")
        else:
            logger.warning(f"NucleoCheck canilla {canilla_num} con errores: {result}")
    except Exception as e:
        logger.error(f"Error actualizando NucleoCheck canilla {canilla_num}: {e}")


class UpdateBarrilRequest(BaseModel):
    row: int
    sucursal_id: str = "1"
    fecha_pinchado: Optional[str] = None
    nombre_pincho: Optional[str] = None
    fecha_despinchado: Optional[str] = None
    nombre_despincho: Optional[str] = None
    fecha_retirado: Optional[str] = None
    canilla: Optional[str] = None
    estilo: Optional[str] = None  # para actualizar nombre en NucleoCheck al pinchar
    mover_a_vacios: bool = False
    reordenar_auto: bool = False


@router.get("")
async def listar_barriles(
    filtro: Optional[str] = Query(None, description="activos | historial | None"),
    sucursal_id: Optional[str] = Query("1", description="1=Recoleta | 2=Palermo"),
    current_user: TokenPayload = Depends(get_current_user),
):
    try:
        from ..services.barriles_service import get_barriles
        return get_barriles(filtro=filtro, sucursal_id=sucursal_id)
    except Exception as e:
        logger.error(f"Error listando barriles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/personal")
async def get_personal(
    sucursal_id: Optional[str] = Query("1", description="1=Recoleta | 2=Palermo"),
    current_user: TokenPayload = Depends(get_current_user)
):
    """Lista el personal desde INFO B3:B12."""
    try:
        from ..services.barriles_service import get_personal
        return get_personal(sucursal_id=sucursal_id)
    except Exception as e:
        logger.error(f"Error obteniendo personal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events")
async def barrel_events_stream():
    """SSE: el visor se suscribe aquí y recibe 'barrel_update' cuando hay cambios."""
    from ..services.barrel_events import subscribe, unsubscribe

    async def generator():
        q = subscribe()
        try:
            yield "data: connected\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=30.0)
                    yield f"data: {event}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            unsubscribe(q)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.patch("/update")
async def actualizar_barril(
    data: UpdateBarrilRequest,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Actualiza múltiples campos de un barril en una sola operación batch."""
    try:
        from ..services.barriles_service import update_barril_completo
        from ..services.audit_service import log_change
        from ..services.barrel_events import broadcast

        result = update_barril_completo(
            row=data.row,
            fecha_pinchado=data.fecha_pinchado,
            nombre_pincho=data.nombre_pincho,
            fecha_despinchado=data.fecha_despinchado,
            nombre_despincho=data.nombre_despincho,
            fecha_retirado=data.fecha_retirado,
            canilla=data.canilla,
            sucursal_id=data.sucursal_id,
        )

        if data.mover_a_vacios:
            from ..services.barriles_service import mover_barril_post_despinchado
            mover_barril_post_despinchado(row=data.row, sucursal_id=data.sucursal_id)
        elif data.reordenar_auto:
            from ..services.barriles_service import reordenar_sheet
            reordenar_sheet(sucursal_id=data.sucursal_id)

        # Registrar en auditoría
        changes = {}
        if data.fecha_pinchado is not None:
            changes["fecha_pinchado"] = data.fecha_pinchado
        if data.nombre_pincho is not None:
            changes["nombre_pincho"] = data.nombre_pincho
        if data.fecha_despinchado is not None:
            changes["fecha_despinchado"] = data.fecha_despinchado
        if data.nombre_despincho is not None:
            changes["nombre_despincho"] = data.nombre_despincho
        if data.fecha_retirado is not None:
            changes["fecha_retirado"] = data.fecha_retirado
        if data.canilla is not None:
            changes["canilla"] = data.canilla

        log_change(
            username=current_user.sub,
            action="update",
            entity_type="barril",
            entity_id=str(data.row),
            changes=changes,
        )

        # Notificar al visor en tiempo real
        await broadcast("barrel_update")

        # Actualizar nombre en NucleoCheck al pinchar (fire-and-forget)
        is_pinchado = data.fecha_pinchado is not None
        canilla_num = (data.canilla or "").strip()
        estilo_val  = (data.estilo or "").strip()
        if is_pinchado and canilla_num and estilo_val:
            loop = asyncio.get_running_loop()
            loop.run_in_executor(
                None,
                _update_nucleo_canilla_bg,
                canilla_num,
                estilo_val,
            )

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error actualizando barril: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reordenar")
async def reordenar(
    sucursal_id: Optional[str] = Query("1", description="1=Recoleta | 2=Palermo"),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Reordena el sheet: Pinchadas por canilla, En Cámara debajo,
    Para Retirar bajo VACIOS, Retiradas bajo RETIRADAS.
    """
    try:
        from ..services.barriles_service import reordenar_sheet
        return reordenar_sheet(sucursal_id)
    except Exception as e:
        logger.error(f"Error reordenando sheet: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/catalogo")
async def catalogo_birras(
    sucursal_id: Optional[str] = Query("1", description="1=Recoleta | 2=Palermo"),
    current_user: TokenPayload = Depends(get_current_user)
):
    """Catálogo de birras disponibles (hoja INFO)."""
    try:
        from ..services.barriles_service import get_catalogo_birras
        return get_catalogo_birras(sucursal_id=sucursal_id)
    except Exception as e:
        logger.error(f"Error obteniendo catálogo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info-birras")
async def info_birras_con_precio(
    sucursal_id: Optional[str] = Query("1", description="1=Recoleta | 2=Palermo"),
    current_user: TokenPayload = Depends(get_current_user)
):
    """Birras con precio desde INFO: nombres en B16:B1000, código en D, precios en I29:J35."""
    try:
        from ..services.barriles_service import get_info_birras_con_precio
        return get_info_birras_con_precio(sucursal_id=sucursal_id)
    except Exception as e:
        logger.error(f"Error obteniendo info-birras: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug/info-sheet")
async def debug_info_sheet(
    sucursal_id: Optional[str] = Query("1"),
    current_user: TokenPayload = Depends(get_current_user)
):
    """DEBUG: Ver si el sheet INFO existe y qué nombres hay disponibles"""
    try:
        from ..services.barriles_service import SUCURSALES_CONFIG, _get_client
        
        config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
        gc = _get_client()
        sh = gc.open_by_key(config["sheet_id"])
        
        # Obtener lista de sheets disponibles
        sheets_list = [{"title": ws.title, "id": ws.id} for ws in sh.worksheets()]
        
        # Buscar sheet INFO
        info_sheet_name = config.get("info_sheet_name", "INFO")
        info_sheet_exists = any(ws.title == info_sheet_name for ws in sh.worksheets())
        
        return {
            "config_sheet_id": config["sheet_id"],
            "config_info_sheet_name": info_sheet_name,
            "info_sheet_exists": info_sheet_exists,
            "available_sheets": sheets_list,
            "mensaje": "Para ver contenido, especifica sheet_name en el body"
        }
    except Exception as e:
        import traceback
        logger.error(f"Error en debug_info_sheet: {e}", exc_info=True)
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.post("/debug/read-sheet-range")
async def debug_read_sheet_range(
    sucursal_id: Optional[str] = Query("1"),
    sheet_name: str = "INFO",
    range_str: str = "A1:F30",
    current_user: TokenPayload = Depends(get_current_user)
):
    """DEBUG: Lee un rango específico de un sheet específico"""
    try:
        from ..services.barriles_service import SUCURSALES_CONFIG, _get_client
        
        config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
        gc = _get_client()
        sh = gc.open_by_key(config["sheet_id"])
        
        try:
            ws = sh.worksheet(sheet_name)
        except Exception as e:
            return {
                "error": f"Sheet '{sheet_name}' no encontrado",
                "mensaje": str(e)
            }
        
        # Obtener rango
        valores = ws.range(range_str)
        
        # Convertir a matriz por filas
        filas_data = {}
        for cell in valores:
            fila = cell.row
            col = cell.col
            if fila not in filas_data:
                filas_data[fila] = {}
            filas_data[fila][col] = cell.value
        
        # Formatear respuesta
        filas_formateadas = []
        for fila_num in sorted(filas_data.keys()):
            fila_dict = filas_data[fila_num]
            filas_formateadas.append({
                "fila": fila_num,
                "col_A": fila_dict.get(1, ""),
                "col_B": fila_dict.get(2, ""),
                "col_C": fila_dict.get(3, ""),
                "col_D": fila_dict.get(4, ""),
                "col_E": fila_dict.get(5, ""),
                "col_F": fila_dict.get(6, ""),
            })
        
        return {
            "sheet_name": ws.title,
            "rango": range_str,
            "total_filas": len(filas_formateadas),
            "filas": filas_formateadas[:30]  # Limitar a 30 filas
        }
    except Exception as e:
        import traceback
        logger.error(f"Error en debug_read_sheet_range: {e}", exc_info=True)
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.get("/visor2")
async def get_visor2(
    sucursal_id: Optional[str] = Query("1", description="1=Recoleta | 2=Palermo"),
    current_user: TokenPayload = Depends(get_current_user)
):
    """Datos para el visor 2: cartelería agrupada por categoría."""
    try:
        from ..services.barriles_service import get_carteleria_visor2
        return get_carteleria_visor2(sucursal_id=sucursal_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error obteniendo visor2: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/visor")
async def get_visor(
    sucursal_id: Optional[str] = Query("1", description="1=Recoleta | 2=Palermo"),
    current_user: TokenPayload = Depends(get_current_user)
):
    """Datos para el visor: barriles activos enriquecidos con amargor, ABV y precio."""
    try:
        from ..services.barriles_service import get_visor_data
        return get_visor_data(sucursal_id=sucursal_id)
    except Exception as e:
        logger.error(f"Error obteniendo datos del visor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

"""
Controlador para el historial de auditoría (solo ADMIN)
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional

from ..middleware.auth import get_current_user, TokenPayload
from ..services.audit_service import get_audit_log, get_audit_stats
from ..utils.logger import logger

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/log")
async def obtener_historial(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    entity_type: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    sucursal_id: Optional[str] = Query(None),
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Obtiene el historial de auditoría.
    Solo accesible para usuarios ADMIN.
    """
    # Verificar que es ADMIN (el rol en el token es "admin" en minúscula)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo ADMIN puede acceder al historial")
    
    try:
        logs = get_audit_log(
            limit=limit,
            offset=offset,
            entity_type=entity_type,
            username=username,
            sucursal_id=sucursal_id,
        )
        return {
            "success": True,
            "data": logs,
            "count": len(logs),
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logger.error(f"Error obteniendo historial: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def obtener_estadisticas(
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Obtiene estadísticas del historial de auditoría.
    Solo accesible para usuarios ADMIN.
    """
    # Verificar que es ADMIN (el rol en el token es "admin" en minúscula)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo ADMIN puede acceder a las estadísticas")
    
    try:
        stats = get_audit_stats()
        return {
            "success": True,
            "data": stats,
        }
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

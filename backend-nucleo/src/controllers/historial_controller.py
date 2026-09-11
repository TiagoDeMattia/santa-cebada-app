"""
Controlador para endpoints de historial de stocks.
"""
from typing import Optional
from fastapi import HTTPException

from ..services import historial_service
from ..utils.logger import logger


def capturar_snapshot(sucursal: str, tipo: str):
    """Captura un snapshot del estado actual."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        snapshot = historial_service.capturar_snapshot(sucursal, tipo)
        return {
            "success": True,
            "message": "Snapshot capturado exitosamente",
            **snapshot
        }
    except Exception as e:
        logger.error(f"Error capturando snapshot: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def capturar_snapshot_completo(sucursal: str):
    """Captura snapshots de cocina y salón."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        snapshots = historial_service.capturar_snapshot_completo(sucursal)
        return {
            "success": True,
            "message": f"Snapshots de {sucursal} capturados exitosamente",
            **snapshots
        }
    except Exception as e:
        logger.error(f"Error capturando snapshots completos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def capturar_todas_las_sucursales():
    """Captura snapshots de todas las sucursales."""
    try:
        snapshots = historial_service.capturar_todas_las_sucursales()
        return {
            "success": True,
            "message": "Snapshots de todas las sucursales capturados exitosamente",
            **snapshots
        }
    except Exception as e:
        logger.error(f"Error capturando todos los snapshots: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def detectar_cambios(sucursal: str, tipo: str):
    """Detecta cambios desde el último snapshot."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        cambios = historial_service.detectar_cambios(sucursal, tipo)
        return {
            "success": True,
            "sucursal": sucursal,
            "tipo": tipo,
            "total_cambios": len(cambios),
            "cambios": cambios
        }
    except Exception as e:
        logger.error(f"Error detectando cambios: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_snapshots(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limit: int = 50
):
    """Obtiene snapshots históricos."""
    try:
        if sucursal and sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        if limit < 1 or limit > 500:
            raise HTTPException(status_code=400, detail="Limit debe estar entre 1 y 500")
        
        snapshots = historial_service.get_snapshots(
            sucursal=sucursal,
            tipo=tipo,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            limit=limit
        )
        
        return {
            "success": True,
            "filtros": {
                "sucursal": sucursal,
                "tipo": tipo,
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
                "limit": limit
            },
            "total": len(snapshots),
            "snapshots": snapshots
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo snapshots: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_snapshot_detalle(snapshot_id: int):
    """Obtiene el detalle completo de un snapshot."""
    try:
        snapshot = historial_service.get_snapshot_detalle(snapshot_id)
        return {
            "success": True,
            **snapshot
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error obteniendo detalle de snapshot: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_cambios(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    codigo_producto: Optional[str] = None,
    tipo_cambio: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limit: int = 100
):
    """Obtiene cambios históricos."""
    try:
        if sucursal and sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        if tipo_cambio and tipo_cambio not in ["stock", "pedido", "nuevo", "eliminado"]:
            raise HTTPException(status_code=400, detail="Tipo de cambio inválido")
        
        if limit < 1 or limit > 1000:
            raise HTTPException(status_code=400, detail="Limit debe estar entre 1 y 1000")
        
        cambios = historial_service.get_cambios(
            sucursal=sucursal,
            tipo=tipo,
            codigo_producto=codigo_producto,
            tipo_cambio=tipo_cambio,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            limit=limit
        )
        
        return {
            "success": True,
            "filtros": {
                "sucursal": sucursal,
                "tipo": tipo,
                "codigo_producto": codigo_producto,
                "tipo_cambio": tipo_cambio,
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
                "limit": limit
            },
            "total": len(cambios),
            "cambios": cambios
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo cambios: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

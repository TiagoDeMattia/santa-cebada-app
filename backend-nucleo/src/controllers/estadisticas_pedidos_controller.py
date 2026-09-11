"""
Controlador para endpoints de estadísticas de pedidos.
"""
from typing import Optional
from fastapi import HTTPException

from ..services import estadisticas_pedidos_service
from ..utils.logger import logger


def get_stocks_y_pedidos_actuales(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None
):
    """Obtiene stocks y pedidos actuales."""
    try:
        if sucursal and sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        productos = estadisticas_pedidos_service.get_stocks_y_pedidos_actuales(
            sucursal=sucursal,
            tipo=tipo
        )
        
        return {
            "success": True,
            "filtros": {
                "sucursal": sucursal,
                "tipo": tipo
            },
            "total": len(productos),
            "productos": productos
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo stocks y pedidos actuales: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_promedio_pedidos(
    codigo_producto: Optional[str] = None,
    nombre_producto: Optional[str] = None,
    sucursal: str = "recoleta",
    tipo: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limit: int = 50
):
    """Obtiene promedio de pedidos con filtros."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Solo disponible para 'recoleta' por ahora")
        
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        if limit < 1 or limit > 200:
            raise HTTPException(status_code=400, detail="Limit debe estar entre 1 y 200")
        
        productos = estadisticas_pedidos_service.get_promedio_pedidos(
            codigo_producto=codigo_producto,
            nombre_producto=nombre_producto,
            sucursal=sucursal,
            tipo=tipo,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            limit=limit
        )
        
        return {
            "success": True,
            "filtros": {
                "codigo_producto": codigo_producto,
                "nombre_producto": nombre_producto,
                "sucursal": sucursal,
                "tipo": tipo,
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
                "limit": limit
            },
            "total": len(productos),
            "productos": productos
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo promedio de pedidos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_estadisticas_semanales(
    sucursal: str = "recoleta",
    tipo: Optional[str] = None,
    semanas: int = 12
):
    """Obtiene estadísticas semanales para gráficos."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Solo disponible para 'recoleta' por ahora")
        
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        if semanas < 1 or semanas > 52:
            raise HTTPException(status_code=400, detail="Semanas debe estar entre 1 y 52")
        
        estadisticas = estadisticas_pedidos_service.get_estadisticas_semanales(
            sucursal=sucursal,
            tipo=tipo,
            semanas=semanas
        )
        
        return {
            "success": True,
            "filtros": {
                "sucursal": sucursal,
                "tipo": tipo,
                "semanas": semanas
            },
            **estadisticas
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas semanales: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_top_productos_por_semana(
    sucursal: str = "recoleta",
    tipo: Optional[str] = None,
    limit: int = 10
):
    """Obtiene top productos por semana."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Solo disponible para 'recoleta' por ahora")
        
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        if limit < 1 or limit > 50:
            raise HTTPException(status_code=400, detail="Limit debe estar entre 1 y 50")
        
        productos = estadisticas_pedidos_service.get_top_productos_por_semana(
            sucursal=sucursal,
            tipo=tipo,
            limit=limit
        )
        
        return {
            "success": True,
            "filtros": {
                "sucursal": sucursal,
                "tipo": tipo,
                "limit": limit
            },
            "total": len(productos),
            "productos": productos
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo top productos por semana: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_promedio_ventas_por_producto(
    codigo_producto: str,
    sucursal: str = "recoleta"
):
    """Obtiene promedio de ventas de un producto específico."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Solo disponible para 'recoleta' por ahora")
        
        resultado = estadisticas_pedidos_service.get_promedio_ventas_por_producto(
            codigo_producto=codigo_producto,
            sucursal=sucursal
        )
        
        if "error" in resultado:
            raise HTTPException(status_code=404, detail=resultado["error"])
        
        return {
            "success": True,
            **resultado
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo promedio de ventas: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

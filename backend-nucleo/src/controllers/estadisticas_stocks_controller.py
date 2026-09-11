"""
Controlador para endpoints de estadísticas de stocks.
"""
from typing import Optional
from fastapi import HTTPException

from ..services import estadisticas_stocks_service
from ..utils.logger import logger


def get_productos_mas_pedidos(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    limit: int = 20
):
    """Obtiene los productos más pedidos (estado actual)."""
    try:
        if sucursal and sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        if limit < 1 or limit > 100:
            raise HTTPException(status_code=400, detail="Limit debe estar entre 1 y 100")
        
        productos = estadisticas_stocks_service.get_productos_mas_pedidos(
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
        logger.error(f"Error obteniendo productos más pedidos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_productos_mas_pedidos_historico(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limit: int = 20
):
    """Obtiene los productos más pedidos (histórico)."""
    try:
        if sucursal and sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        if limit < 1 or limit > 100:
            raise HTTPException(status_code=400, detail="Limit debe estar entre 1 y 100")
        
        productos = estadisticas_stocks_service.get_productos_mas_pedidos_historico(
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
            "total": len(productos),
            "productos": productos
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo productos más pedidos histórico: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_tendencias_producto(
    codigo_producto: str,
    sucursal: str,
    tipo: str,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None
):
    """Obtiene tendencias de un producto específico."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        tendencias = estadisticas_stocks_service.get_tendencias_producto(
            codigo_producto=codigo_producto,
            sucursal=sucursal,
            tipo=tipo,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta
        )
        
        if "error" in tendencias:
            raise HTTPException(status_code=404, detail=tendencias["error"])
        
        return {
            "success": True,
            **tendencias
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo tendencias: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def predecir_stock(
    codigo_producto: str,
    sucursal: str,
    tipo: str
):
    """Predice el stock futuro de un producto."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        prediccion = estadisticas_stocks_service.predecir_stock(
            codigo_producto=codigo_producto,
            sucursal=sucursal,
            tipo=tipo
        )
        
        if "error" in prediccion:
            raise HTTPException(status_code=404, detail=prediccion["error"])
        
        return {
            "success": True,
            **prediccion
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error prediciendo stock: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def comparar_sucursales(tipo: Optional[str] = None):
    """Compara stocks y pedidos entre sucursales."""
    try:
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        comparacion = estadisticas_stocks_service.comparar_sucursales(tipo=tipo)
        
        return {
            "success": True,
            "tipo": tipo,
            **comparacion
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparando sucursales: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_alertas_stock_bajo(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    umbral: float = 2.0
):
    """Obtiene productos con stock bajo."""
    try:
        if sucursal and sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        if umbral < 0:
            raise HTTPException(status_code=400, detail="Umbral debe ser mayor o igual a 0")
        
        alertas = estadisticas_stocks_service.get_alertas_stock_bajo(
            sucursal=sucursal,
            tipo=tipo,
            umbral=umbral
        )
        
        return {
            "success": True,
            "filtros": {
                "sucursal": sucursal,
                "tipo": tipo,
                "umbral": umbral
            },
            "total": len(alertas),
            "alertas": alertas
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo alertas de stock bajo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

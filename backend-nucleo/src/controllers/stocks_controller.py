"""
Controlador para endpoints de stocks y pedidos.
"""
from typing import Optional
from fastapi import HTTPException

from ..services import stocks_service
from ..utils.logger import logger


def get_stocks_cocina(sucursal: str):
    """Obtiene stocks de cocina de una sucursal."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        stocks = stocks_service.get_stocks_cocina(sucursal)
        return {
            "success": True,
            "sucursal": sucursal,
            "tipo": "cocina",
            "total": len(stocks),
            "productos": stocks
        }
    except Exception as e:
        logger.error(f"Error obteniendo stocks cocina {sucursal}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_stocks_salon(sucursal: str):
    """Obtiene stocks de salón de una sucursal."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        stocks = stocks_service.get_stocks_salon(sucursal)
        return {
            "success": True,
            "sucursal": sucursal,
            "tipo": "salon",
            "total": len(stocks),
            "productos": stocks
        }
    except Exception as e:
        logger.error(f"Error obteniendo stocks salón {sucursal}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_stocks_completos(sucursal: str):
    """Obtiene todos los stocks de una sucursal."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        stocks = stocks_service.get_stocks_completos(sucursal)
        return {
            "success": True,
            **stocks
        }
    except Exception as e:
        logger.error(f"Error obteniendo stocks completos {sucursal}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_pedidos(sucursal: str):
    """Obtiene productos con pedido activo de una sucursal."""
    try:
        if sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        pedidos = stocks_service.get_pedidos(sucursal)
        return {
            "success": True,
            "sucursal": sucursal,
            "total": len(pedidos),
            "productos": pedidos
        }
    except Exception as e:
        logger.error(f"Error obteniendo pedidos {sucursal}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def buscar_productos(
    query: str,
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    solo_con_pedido: bool = False
):
    """Busca productos por nombre, código o proveedor."""
    try:
        if sucursal and sucursal not in ["recoleta"]:
            raise HTTPException(status_code=400, detail="Sucursal debe ser 'recoleta'")
        
        if tipo and tipo not in ["cocina", "salon"]:
            raise HTTPException(status_code=400, detail="Tipo debe ser 'cocina' o 'salon'")
        
        if not query or len(query.strip()) < 2:
            raise HTTPException(status_code=400, detail="Query debe tener al menos 2 caracteres")
        
        resultados = stocks_service.buscar_productos(
            query=query,
            sucursal=sucursal,
            tipo=tipo,
            solo_con_pedido=solo_con_pedido
        )
        
        return {
            "success": True,
            "query": query,
            "filtros": {
                "sucursal": sucursal,
                "tipo": tipo,
                "solo_con_pedido": solo_con_pedido
            },
            "total": len(resultados),
            "productos": resultados
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error buscando productos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_productos_central():
    """Obtiene el catálogo completo de productos."""
    try:
        productos = stocks_service.get_productos_central()
        
        # Agrupar por tipo
        cocina = [p for p in productos if p["tipo"] == "cocina"]
        salon = [p for p in productos if p["tipo"] == "salon"]
        
        return {
            "success": True,
            "total": len(productos),
            "cocina": len(cocina),
            "salon": len(salon),
            "productos": productos
        }
    except Exception as e:
        logger.error(f"Error obteniendo productos centrales: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

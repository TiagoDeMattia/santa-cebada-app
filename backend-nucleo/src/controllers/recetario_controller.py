"""
Controlador para endpoints de recetario.
"""
from typing import Optional
from fastapi import HTTPException

from ..services.recetario_service import RecetarioService
from ..utils.logger import logger


_svc: RecetarioService | None = None


def _get_svc() -> RecetarioService:
    global _svc
    if _svc is None:
        _svc = RecetarioService()
    return _svc


def generar_linkeos_automaticos(sucursal: str = "recoleta"):
    """Genera linkeos automáticos entre productos Nucleo y Stock."""
    try:
        resultado = _get_svc().generar_linkeos_automaticos(sucursal)
        return resultado
    except Exception as e:
        logger.error(f"Error generando linkeos automáticos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_linkeos(activo_solo: bool = False):
    """Obtiene todos los linkeos."""
    try:
        linkeos = _get_svc().get_linkeos(activo_solo)
        return {
            "success": True,
            "total": len(linkeos),
            "linkeos": linkeos
        }
    except Exception as e:
        logger.error(f"Error obteniendo linkeos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def actualizar_linkeo(
    linkeo_id: int,
    unidad_medida_stock: Optional[str] = None,
    cantidad_stock: Optional[float] = None,
    unidad_medida_nucleo: Optional[str] = None,
    cantidad_nucleo: Optional[float] = None,
    activo: Optional[bool] = None
):
    """Actualiza un linkeo."""
    try:
        resultado = _get_svc().actualizar_linkeo(
            linkeo_id=linkeo_id,
            unidad_medida_stock=unidad_medida_stock,
            cantidad_stock=cantidad_stock,
            unidad_medida_nucleo=unidad_medida_nucleo,
            cantidad_nucleo=cantidad_nucleo,
            activo=activo
        )
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error actualizando linkeo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def eliminar_linkeo(linkeo_id: int):
    """Elimina un linkeo."""
    try:
        resultado = _get_svc().eliminar_linkeo(linkeo_id)
        return resultado
    except Exception as e:
        logger.error(f"Error eliminando linkeo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def crear_linkeo_manual(
    producto_nucleo_id: int,
    producto_nucleo_codigo: str,
    producto_nucleo_nombre: str,
    producto_stock_codigo: str,
    producto_stock_nombre: str,
    categoria: str,
    unidad_medida_stock: str = "L",
    cantidad_stock: float = 1.0,
    unidad_medida_nucleo: str = "ml",
    cantidad_nucleo: float = 75.0
):
    """Crea un linkeo manual."""
    try:
        resultado = _get_svc().crear_linkeo_manual(
            producto_nucleo_id=producto_nucleo_id,
            producto_nucleo_codigo=producto_nucleo_codigo,
            producto_nucleo_nombre=producto_nucleo_nombre,
            producto_stock_codigo=producto_stock_codigo,
            producto_stock_nombre=producto_stock_nombre,
            categoria=categoria,
            unidad_medida_stock=unidad_medida_stock,
            cantidad_stock=cantidad_stock,
            unidad_medida_nucleo=unidad_medida_nucleo,
            cantidad_nucleo=cantidad_nucleo
        )
        return resultado
    except Exception as e:
        logger.error(f"Error creando linkeo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_unidades_medida():
    """Obtiene todas las unidades de medida disponibles."""
    try:
        unidades = _get_svc().get_unidades_medida()
        return {
            "success": True,
            "total": len(unidades),
            "unidades": unidades
        }
    except Exception as e:
        logger.error(f"Error obteniendo unidades de medida: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def crear_unidad_medida(
    nombre: str,
    abreviatura: str,
    tipo: str,
    conversion_a_base: float,
    unidad_base: str
):
    """Crea una nueva unidad de medida."""
    try:
        resultado = _get_svc().crear_unidad_medida(
            nombre=nombre,
            abreviatura=abreviatura,
            tipo=tipo,
            conversion_a_base=conversion_a_base,
            unidad_base=unidad_base
        )
        return resultado
    except Exception as e:
        logger.error(f"Error creando unidad de medida: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_productos_stock(sucursal: str = "recoleta"):
    """Obtiene productos de stock disponibles."""
    try:
        from ..services.stocks_service import get_stocks_salon
        productos = get_stocks_salon(sucursal)
        return {
            "success": True,
            "total": len(productos),
            "productos": productos
        }
    except Exception as e:
        logger.error(f"Error obteniendo productos de stock: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_productos_nucleo(sucursal: str = "recoleta"):
    """Obtiene productos de Nucleo disponibles."""
    try:
        from ..services.nucleo_service import NucleoService
        import asyncio
        
        nucleo_service = NucleoService()
        sucursal_id = "1" if sucursal == "recoleta" else "2"
        session = asyncio.run(nucleo_service.get_session(sucursal_id))
        productos = nucleo_service.obtener_todos_productos(session)
        
        return {
            "success": True,
            "total": len(productos),
            "productos": productos
        }
    except Exception as e:
        logger.error(f"Error obteniendo productos de Nucleo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



def tomar_snapshot(sucursal: str = "recoleta"):
    """Toma un snapshot del stock actual."""
    try:
        resultado = _get_svc().tomar_snapshot_stock(sucursal)
        return resultado
    except Exception as e:
        logger.error(f"Error tomando snapshot: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def procesar_ventas(sucursal: str = "recoleta"):
    """Procesa las ventas y actualiza el stock aproximado."""
    try:
        resultado = _get_svc().procesar_ventas(sucursal)
        return resultado
    except Exception as e:
        logger.error(f"Error procesando ventas: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def get_stock_aproximado(categoria: Optional[str] = None):
    """Obtiene el stock aproximado de todos los productos."""
    try:
        productos = _get_svc().get_stock_aproximado(categoria)
        return {
            "success": True,
            "total": len(productos),
            "productos": productos
        }
    except Exception as e:
        logger.error(f"Error obteniendo stock aproximado: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

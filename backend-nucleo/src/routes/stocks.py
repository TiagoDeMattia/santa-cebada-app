"""
Rutas para gestión de stocks y pedidos.
"""
from fastapi import APIRouter, Query
from typing import Optional

from ..controllers import stocks_controller

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/cocina")
def get_stocks_cocina(
    sucursal: str = Query(..., description="Sucursal: 'recoleta' o 'palermo'")
):
    """
    Obtiene stocks y pedidos de cocina de una sucursal.
    
    **Parámetros:**
    - sucursal: "recoleta" o "palermo"
    
    **Retorna:**
    - Lista de productos de cocina con stock y pedido
    """
    return stocks_controller.get_stocks_cocina(sucursal)


@router.get("/salon")
def get_stocks_salon(
    sucursal: str = Query(..., description="Sucursal: 'recoleta' o 'palermo'")
):
    """
    Obtiene stocks y pedidos de salón de una sucursal.
    
    **Parámetros:**
    - sucursal: "recoleta" o "palermo"
    
    **Retorna:**
    - Lista de productos de salón con stock y pedido
    """
    return stocks_controller.get_stocks_salon(sucursal)


@router.get("/completo")
def get_stocks_completos(
    sucursal: str = Query(..., description="Sucursal: 'recoleta' o 'palermo'")
):
    """
    Obtiene todos los stocks de una sucursal (cocina + salón).
    
    **Parámetros:**
    - sucursal: "recoleta" o "palermo"
    
    **Retorna:**
    - Objeto con stocks de cocina y salón
    """
    return stocks_controller.get_stocks_completos(sucursal)


@router.get("/pedidos")
def get_pedidos(
    sucursal: str = Query(..., description="Sucursal: 'recoleta' o 'palermo'")
):
    """
    Obtiene productos con pedido activo (pedido > 0) de una sucursal.
    
    **Parámetros:**
    - sucursal: "recoleta" o "palermo"
    
    **Retorna:**
    - Lista de productos con pedido activo
    """
    return stocks_controller.get_pedidos(sucursal)


@router.get("/buscar")
def buscar_productos(
    query: str = Query(..., min_length=2, description="Texto a buscar (mínimo 2 caracteres)"),
    sucursal: Optional[str] = Query(None, description="Filtrar por sucursal: 'recoleta' o 'palermo'"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo: 'cocina' o 'salon'"),
    solo_con_pedido: bool = Query(False, description="Solo productos con pedido > 0")
):
    """
    Busca productos por nombre, código o proveedor.
    
    **Parámetros:**
    - query: Texto a buscar (mínimo 2 caracteres)
    - sucursal: (Opcional) Filtrar por sucursal
    - tipo: (Opcional) Filtrar por tipo
    - solo_con_pedido: (Opcional) Solo productos con pedido activo
    
    **Retorna:**
    - Lista de productos que coinciden con la búsqueda
    """
    return stocks_controller.buscar_productos(
        query=query,
        sucursal=sucursal,
        tipo=tipo,
        solo_con_pedido=solo_con_pedido
    )


@router.get("/productos-central")
def get_productos_central():
    """
    Obtiene el catálogo completo de productos desde CENTRAL DE PRODUCTOS.
    
    **Retorna:**
    - Lista completa de productos (cocina + salón)
    """
    return stocks_controller.get_productos_central()

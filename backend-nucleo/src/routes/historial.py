"""
Rutas para gestión de historial de stocks.
"""
from fastapi import APIRouter, Query
from typing import Optional

from ..controllers import historial_controller

router = APIRouter(prefix="/historial", tags=["historial"])


@router.post("/snapshot")
def capturar_snapshot(
    sucursal: str = Query(..., description="Sucursal: 'recoleta' o 'palermo'"),
    tipo: str = Query(..., description="Tipo: 'cocina' o 'salon'")
):
    """
    Captura un snapshot del estado actual de stocks.
    
    **Parámetros:**
    - sucursal: "recoleta" o "palermo"
    - tipo: "cocina" o "salon"
    
    **Retorna:**
    - Información del snapshot capturado
    """
    return historial_controller.capturar_snapshot(sucursal, tipo)


@router.post("/snapshot/completo")
def capturar_snapshot_completo(
    sucursal: str = Query(..., description="Sucursal: 'recoleta' o 'palermo'")
):
    """
    Captura snapshots de cocina y salón de una sucursal.
    
    **Parámetros:**
    - sucursal: "recoleta" o "palermo"
    
    **Retorna:**
    - Información de los snapshots capturados (cocina + salón)
    """
    return historial_controller.capturar_snapshot_completo(sucursal)


@router.post("/snapshot/todas")
def capturar_todas_las_sucursales():
    """
    Captura snapshots de todas las sucursales (Recoleta y Palermo).
    
    **Retorna:**
    - Información de todos los snapshots capturados
    
    **Nota:** Este endpoint se ejecuta automáticamente los LUNES a las 9 AM (horario Argentina)
    """
    return historial_controller.capturar_todas_las_sucursales()


@router.get("/cambios/detectar")
def detectar_cambios(
    sucursal: str = Query(..., description="Sucursal: 'recoleta' o 'palermo'"),
    tipo: str = Query(..., description="Tipo: 'cocina' o 'salon'")
):
    """
    Detecta cambios entre el último snapshot y el estado actual.
    
    **Parámetros:**
    - sucursal: "recoleta" o "palermo"
    - tipo: "cocina" o "salon"
    
    **Retorna:**
    - Lista de cambios detectados (stock, pedido, nuevos, eliminados)
    """
    return historial_controller.detectar_cambios(sucursal, tipo)


@router.get("/snapshots")
def get_snapshots(
    sucursal: Optional[str] = Query(None, description="Filtrar por sucursal"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    limit: int = Query(50, ge=1, le=500, description="Límite de resultados")
):
    """
    Obtiene snapshots históricos con filtros.
    
    **Parámetros:**
    - sucursal: (Opcional) Filtrar por sucursal
    - tipo: (Opcional) Filtrar por tipo
    - fecha_desde: (Opcional) Fecha desde
    - fecha_hasta: (Opcional) Fecha hasta
    - limit: Límite de resultados (1-500)
    
    **Retorna:**
    - Lista de snapshots históricos
    """
    return historial_controller.get_snapshots(
        sucursal=sucursal,
        tipo=tipo,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=limit
    )


@router.get("/snapshots/{snapshot_id}")
def get_snapshot_detalle(
    snapshot_id: int
):
    """
    Obtiene el detalle completo de un snapshot (incluye todos los productos).
    
    **Parámetros:**
    - snapshot_id: ID del snapshot
    
    **Retorna:**
    - Snapshot completo con todos los productos
    """
    return historial_controller.get_snapshot_detalle(snapshot_id)


@router.get("/cambios")
def get_cambios(
    sucursal: Optional[str] = Query(None, description="Filtrar por sucursal"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    codigo_producto: Optional[str] = Query(None, description="Filtrar por código de producto"),
    tipo_cambio: Optional[str] = Query(None, description="Tipo de cambio: stock, pedido, nuevo, eliminado"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="Límite de resultados")
):
    """
    Obtiene cambios históricos con filtros.
    
    **Parámetros:**
    - sucursal: (Opcional) Filtrar por sucursal
    - tipo: (Opcional) Filtrar por tipo
    - codigo_producto: (Opcional) Filtrar por producto específico
    - tipo_cambio: (Opcional) Tipo de cambio (stock, pedido, nuevo, eliminado)
    - fecha_desde: (Opcional) Fecha desde
    - fecha_hasta: (Opcional) Fecha hasta
    - limit: Límite de resultados (1-1000)
    
    **Retorna:**
    - Lista de cambios históricos
    """
    return historial_controller.get_cambios(
        sucursal=sucursal,
        tipo=tipo,
        codigo_producto=codigo_producto,
        tipo_cambio=tipo_cambio,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=limit
    )

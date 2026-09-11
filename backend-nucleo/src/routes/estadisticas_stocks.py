"""
Rutas para estadísticas de stocks y pedidos.
"""
from fastapi import APIRouter, Query, Path
from typing import Optional

from ..controllers import estadisticas_stocks_controller

router = APIRouter(prefix="/estadisticas-stocks", tags=["estadisticas-stocks"])


@router.get("/productos-mas-pedidos")
def get_productos_mas_pedidos(
    sucursal: Optional[str] = Query(None, description="Filtrar por sucursal: 'recoleta' o 'palermo'"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo: 'cocina' o 'salon'"),
    limit: int = Query(20, ge=1, le=100, description="Límite de resultados")
):
    """
    Obtiene los productos más pedidos basándose en el estado actual.
    
    **Parámetros:**
    - sucursal: (Opcional) Filtrar por sucursal
    - tipo: (Opcional) Filtrar por tipo
    - limit: Límite de resultados (1-100)
    
    **Retorna:**
    - Lista de productos ordenados por cantidad de pedido (descendente)
    
    **Ejemplo:**
    - `/estadisticas-stocks/productos-mas-pedidos?sucursal=recoleta&limit=10`
    """
    return estadisticas_stocks_controller.get_productos_mas_pedidos(
        sucursal=sucursal,
        tipo=tipo,
        limit=limit
    )


@router.get("/productos-mas-pedidos/historico")
def get_productos_mas_pedidos_historico(
    sucursal: Optional[str] = Query(None, description="Filtrar por sucursal"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    limit: int = Query(20, ge=1, le=100, description="Límite de resultados")
):
    """
    Obtiene los productos más pedidos basándose en el historial.
    Cuenta cuántas veces cada producto tuvo pedido > 0.
    
    **Parámetros:**
    - sucursal: (Opcional) Filtrar por sucursal
    - tipo: (Opcional) Filtrar por tipo
    - fecha_desde: (Opcional) Fecha desde
    - fecha_hasta: (Opcional) Fecha hasta
    - limit: Límite de resultados (1-100)
    
    **Retorna:**
    - Lista de productos con frecuencia de pedido y estadísticas
    
    **Ejemplo:**
    - `/estadisticas-stocks/productos-mas-pedidos/historico?fecha_desde=2026-04-01`
    """
    return estadisticas_stocks_controller.get_productos_mas_pedidos_historico(
        sucursal=sucursal,
        tipo=tipo,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=limit
    )


@router.get("/tendencias/{codigo_producto}")
def get_tendencias_producto(
    codigo_producto: str = Path(..., description="Código del producto (ej: C001, S001)"),
    sucursal: str = Query(..., description="Sucursal: 'recoleta' o 'palermo'"),
    tipo: str = Query(..., description="Tipo: 'cocina' o 'salon'"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)")
):
    """
    Obtiene la tendencia de stock y pedido de un producto específico.
    
    **Parámetros:**
    - codigo_producto: Código del producto (ej: C001, S001)
    - sucursal: Sucursal
    - tipo: Tipo (cocina/salon)
    - fecha_desde: (Opcional) Fecha desde
    - fecha_hasta: (Opcional) Fecha hasta
    
    **Retorna:**
    - Tendencia del producto con datos históricos y estadísticas
    
    **Ejemplo:**
    - `/estadisticas-stocks/tendencias/C001?sucursal=recoleta&tipo=cocina`
    """
    return estadisticas_stocks_controller.get_tendencias_producto(
        codigo_producto=codigo_producto,
        sucursal=sucursal,
        tipo=tipo,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )


@router.get("/prediccion/{codigo_producto}")
def predecir_stock(
    codigo_producto: str = Path(..., description="Código del producto (ej: C001, S001)"),
    sucursal: str = Query(..., description="Sucursal: 'recoleta' o 'palermo'"),
    tipo: str = Query(..., description="Tipo: 'cocina' o 'salon'")
):
    """
    Predice el stock futuro de un producto basándose en:
    - Stock actual
    - Pedido actual
    - Consumo promedio histórico
    
    **Fórmula:** Stock Predicho = Stock Actual + Pedido Actual - Consumo Promedio
    
    **Parámetros:**
    - codigo_producto: Código del producto
    - sucursal: Sucursal
    - tipo: Tipo (cocina/salon)
    
    **Retorna:**
    - Predicción de stock con estado, alerta y recomendación
    
    **Ejemplo:**
    - `/estadisticas-stocks/prediccion/C001?sucursal=recoleta&tipo=cocina`
    """
    return estadisticas_stocks_controller.predecir_stock(
        codigo_producto=codigo_producto,
        sucursal=sucursal,
        tipo=tipo
    )


@router.get("/comparar-sucursales")
def comparar_sucursales(
    tipo: Optional[str] = Query(None, description="Filtrar por tipo: 'cocina' o 'salon'")
):
    """
    Compara stocks y pedidos entre Recoleta y Palermo.
    
    **Parámetros:**
    - tipo: (Opcional) Filtrar por tipo
    
    **Retorna:**
    - Comparación entre sucursales con estadísticas y diferencias significativas
    
    **Ejemplo:**
    - `/estadisticas-stocks/comparar-sucursales`
    - `/estadisticas-stocks/comparar-sucursales?tipo=cocina`
    """
    return estadisticas_stocks_controller.comparar_sucursales(tipo=tipo)


@router.get("/alertas-stock-bajo")
def get_alertas_stock_bajo(
    sucursal: Optional[str] = Query(None, description="Filtrar por sucursal"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    umbral: float = Query(2.0, ge=0, description="Umbral de stock bajo")
):
    """
    Obtiene productos con stock bajo (menor al umbral).
    
    **Parámetros:**
    - sucursal: (Opcional) Filtrar por sucursal
    - tipo: (Opcional) Filtrar por tipo
    - umbral: Cantidad mínima de stock (default: 2.0)
    
    **Retorna:**
    - Lista de productos con stock bajo ordenados por cantidad (ascendente)
    
    **Ejemplo:**
    - `/estadisticas-stocks/alertas-stock-bajo?umbral=3`
    - `/estadisticas-stocks/alertas-stock-bajo?sucursal=recoleta&umbral=5`
    """
    return estadisticas_stocks_controller.get_alertas_stock_bajo(
        sucursal=sucursal,
        tipo=tipo,
        umbral=umbral
    )

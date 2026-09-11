"""
Rutas para estadísticas de pedidos.
"""
from fastapi import APIRouter, Query, Path
from typing import Optional

from ..controllers import estadisticas_pedidos_controller

router = APIRouter(prefix="/estadisticas-pedidos", tags=["estadisticas-pedidos"])


@router.get("/stocks-actuales")
def get_stocks_y_pedidos_actuales(
    sucursal: Optional[str] = Query(None, description="Filtrar por sucursal: 'recoleta' o 'palermo'"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo: 'cocina' o 'salon'")
):
    """
    Obtiene stocks y pedidos actuales desde Google Sheets.
    
    **Parámetros:**
    - sucursal: (Opcional) Filtrar por sucursal
    - tipo: (Opcional) Filtrar por tipo
    
    **Retorna:**
    - Lista de productos con stock y pedido actual
    
    **Ejemplo:**
    - `/estadisticas-pedidos/stocks-actuales?sucursal=recoleta&tipo=cocina`
    
    **Nota**: Este endpoint usa cache de 5 minutos para mejorar rendimiento.
    """
    return estadisticas_pedidos_controller.get_stocks_y_pedidos_actuales(
        sucursal=sucursal,
        tipo=tipo
    )


@router.get("/promedio-pedidos")
def get_promedio_pedidos(
    codigo_producto: Optional[str] = Query(None, description="Filtrar por código de producto"),
    nombre_producto: Optional[str] = Query(None, description="Buscar por nombre (parcial)"),
    sucursal: str = Query("recoleta", description="Sucursal (solo 'recoleta' disponible)"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo: 'cocina' o 'salon'"),
    fecha_desde: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    limit: int = Query(50, ge=1, le=200, description="Límite de resultados")
):
    """
    Obtiene el promedio de pedidos por producto desde el historial.
    
    **Parámetros:**
    - codigo_producto: (Opcional) Filtrar por código exacto
    - nombre_producto: (Opcional) Buscar por nombre (búsqueda parcial)
    - sucursal: Sucursal (default: 'recoleta')
    - tipo: (Opcional) Filtrar por tipo
    - fecha_desde: (Opcional) Fecha desde
    - fecha_hasta: (Opcional) Fecha hasta
    - limit: Límite de resultados (1-200)
    
    **Retorna:**
    - Lista de productos con estadísticas de pedidos:
      - veces_pedido: Cantidad de veces que se pidió
      - cantidad_total: Suma total pedida
      - cantidad_promedio: Promedio por pedido
      - cantidad_max: Cantidad máxima pedida
      - cantidad_min: Cantidad mínima pedida
      - primera_fecha: Primera vez que se pidió
      - ultima_fecha: Última vez que se pidió
    
    **Ejemplo:**
    - `/estadisticas-pedidos/promedio-pedidos?nombre_producto=repollo`
    - `/estadisticas-pedidos/promedio-pedidos?codigo_producto=C001`
    """
    return estadisticas_pedidos_controller.get_promedio_pedidos(
        codigo_producto=codigo_producto,
        nombre_producto=nombre_producto,
        sucursal=sucursal,
        tipo=tipo,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=limit
    )


@router.get("/semanales")
def get_estadisticas_semanales(
    sucursal: str = Query("recoleta", description="Sucursal (solo 'recoleta' disponible)"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo: 'cocina' o 'salon'"),
    semanas: int = Query(12, ge=1, le=52, description="Número de semanas a analizar")
):
    """
    Obtiene estadísticas de pedidos por semana para gráficos.
    
    **Parámetros:**
    - sucursal: Sucursal (default: 'recoleta')
    - tipo: (Opcional) Filtrar por tipo
    - semanas: Número de semanas a analizar (1-52)
    
    **Retorna:**
    - Estadísticas semanales con:
      - semanas: Array de datos por semana
      - total_productos: Total de productos distintos
      - total_pedidos: Total de registros de pedidos
      - promedio_semanal: Promedio de pedidos por semana
      - rango_fechas: Rango de fechas disponibles
    
    **Ejemplo:**
    - `/estadisticas-pedidos/semanales?semanas=8`
    - `/estadisticas-pedidos/semanales?tipo=cocina&semanas=12`
    """
    return estadisticas_pedidos_controller.get_estadisticas_semanales(
        sucursal=sucursal,
        tipo=tipo,
        semanas=semanas
    )


@router.get("/top-productos-semana")
def get_top_productos_por_semana(
    sucursal: str = Query("recoleta", description="Sucursal (solo 'recoleta' disponible)"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo: 'cocina' o 'salon'"),
    limit: int = Query(10, ge=1, le=50, description="Límite de productos")
):
    """
    Obtiene los productos más pedidos con desglose por semana.
    
    **Parámetros:**
    - sucursal: Sucursal (default: 'recoleta')
    - tipo: (Opcional) Filtrar por tipo
    - limit: Límite de productos (1-50)
    
    **Retorna:**
    - Lista de productos con:
      - codigo_producto: Código del producto
      - nombre_producto: Nombre del producto
      - tipo: Tipo (cocina/salon)
      - semanas: Array con cantidad por semana
      - cantidad_total: Total pedido en todas las semanas
    
    **Ejemplo:**
    - `/estadisticas-pedidos/top-productos-semana?limit=5`
    """
    return estadisticas_pedidos_controller.get_top_productos_por_semana(
        sucursal=sucursal,
        tipo=tipo,
        limit=limit
    )


@router.get("/producto/{codigo_producto}")
def get_promedio_ventas_por_producto(
    codigo_producto: str = Path(..., description="Código del producto (ej: C001, S001)"),
    sucursal: str = Query("recoleta", description="Sucursal (solo 'recoleta' disponible)")
):
    """
    Obtiene el promedio de ventas/pedidos de un producto específico.
    
    **Parámetros:**
    - codigo_producto: Código del producto (ej: C001, S001)
    - sucursal: Sucursal (default: 'recoleta')
    
    **Retorna:**
    - Estadísticas detalladas del producto:
      - veces_pedido: Cantidad de veces que se pidió
      - cantidad_total: Suma total pedida
      - cantidad_promedio: Promedio por pedido
      - cantidad_max: Cantidad máxima pedida
      - cantidad_min: Cantidad mínima pedida
      - primera_fecha: Primera vez que se pidió
      - ultima_fecha: Última vez que se pidió
      - semanas: Array con datos por semana
      - stock_actual: Stock y pedido actual
    
    **Ejemplo:**
    - `/estadisticas-pedidos/producto/C001`
    - `/estadisticas-pedidos/producto/S015`
    """
    return estadisticas_pedidos_controller.get_promedio_ventas_por_producto(
        codigo_producto=codigo_producto,
        sucursal=sucursal
    )

"""
Servicio para estadísticas de stocks y pedidos.
Analiza patrones de consumo, tendencias y genera predicciones.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict
import json

from ..services import stocks_service, historial_service
from ..utils.logger import logger


def get_productos_mas_pedidos(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Obtiene los productos más pedidos basándose en el estado actual.
    
    Args:
        sucursal: Filtrar por sucursal
        tipo: Filtrar por tipo (cocina/salon)
        limit: Cantidad de productos a retornar
    
    Returns:
        Lista de productos ordenados por cantidad de pedido
    """
    productos = []
    
    # Determinar sucursales a analizar
    sucursales = [sucursal] if sucursal else ["recoleta"]
    
    for suc in sucursales:
        # Determinar tipos a analizar
        tipos = [tipo] if tipo else ["cocina", "salon"]
        
        for t in tipos:
            if t == "cocina":
                prods = stocks_service.get_stocks_cocina(suc)
            else:
                prods = stocks_service.get_stocks_salon(suc)
            
            for p in prods:
                if p["tiene_pedido"]:
                    productos.append({
                        "codigo_producto": p["codigo_producto"],
                        "producto": p["producto"],
                        "codigo_grupo": p["codigo_grupo"],
                        "sucursal": suc,
                        "tipo": t,
                        "pedido_cantidad": p["pedido_cantidad"],
                        "pedido_unidad": p["pedido_unidad"],
                        "stock_cantidad": p["stock_cantidad"],
                        "stock_unidad": p["stock_unidad"],
                    })
    
    # Ordenar por cantidad de pedido (descendente)
    productos_ordenados = sorted(
        productos,
        key=lambda x: x["pedido_cantidad"],
        reverse=True
    )
    
    return productos_ordenados[:limit]


def get_productos_mas_pedidos_historico(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Obtiene los productos más pedidos basándose en el historial.
    Cuenta cuántas veces cada producto tuvo pedido > 0.
    
    Args:
        sucursal: Filtrar por sucursal
        tipo: Filtrar por tipo
        fecha_desde: Fecha desde
        fecha_hasta: Fecha hasta
        limit: Cantidad de productos a retornar
    
    Returns:
        Lista de productos con frecuencia de pedido
    """
    # Obtener snapshots del período
    snapshots = historial_service.get_snapshots(
        sucursal=sucursal,
        tipo=tipo,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=500
    )
    
    if not snapshots:
        logger.warning("No hay snapshots en el período especificado")
        return []
    
    # Contar frecuencia de pedidos por producto
    producto_stats = defaultdict(lambda: {
        "veces_pedido": 0,
        "cantidad_total": 0.0,
        "cantidad_promedio": 0.0,
        "cantidad_max": 0.0,
        "cantidad_min": float('inf'),
        "nombre": "",
        "codigo_grupo": "",
        "unidad": "",
    })
    
    for snapshot in snapshots:
        # Obtener detalle del snapshot
        detalle = historial_service.get_snapshot_detalle(snapshot["id"])
        
        for producto in detalle["productos"]:
            if producto["tiene_pedido"]:
                codigo = producto["codigo_producto"]
                cantidad = producto["pedido_cantidad"]
                
                producto_stats[codigo]["veces_pedido"] += 1
                producto_stats[codigo]["cantidad_total"] += cantidad
                producto_stats[codigo]["cantidad_max"] = max(
                    producto_stats[codigo]["cantidad_max"],
                    cantidad
                )
                producto_stats[codigo]["cantidad_min"] = min(
                    producto_stats[codigo]["cantidad_min"],
                    cantidad
                )
                producto_stats[codigo]["nombre"] = producto["producto"]
                producto_stats[codigo]["codigo_grupo"] = producto["codigo_grupo"]
                producto_stats[codigo]["unidad"] = producto["pedido_unidad"]
    
    # Calcular promedios
    resultados = []
    for codigo, stats in producto_stats.items():
        if stats["veces_pedido"] > 0:
            stats["cantidad_promedio"] = stats["cantidad_total"] / stats["veces_pedido"]
            
            resultados.append({
                "codigo_producto": codigo,
                "producto": stats["nombre"],
                "codigo_grupo": stats["codigo_grupo"],
                "veces_pedido": stats["veces_pedido"],
                "cantidad_total": round(stats["cantidad_total"], 2),
                "cantidad_promedio": round(stats["cantidad_promedio"], 2),
                "cantidad_max": stats["cantidad_max"],
                "cantidad_min": stats["cantidad_min"] if stats["cantidad_min"] != float('inf') else 0,
                "unidad": stats["unidad"],
            })
    
    # Ordenar por frecuencia de pedido
    resultados_ordenados = sorted(
        resultados,
        key=lambda x: (x["veces_pedido"], x["cantidad_total"]),
        reverse=True
    )
    
    return resultados_ordenados[:limit]


def get_tendencias_producto(
    codigo_producto: str,
    sucursal: str,
    tipo: str,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None
) -> Dict[str, Any]:
    """
    Obtiene la tendencia de stock y pedido de un producto específico.
    
    Args:
        codigo_producto: Código del producto
        sucursal: Sucursal
        tipo: Tipo (cocina/salon)
        fecha_desde: Fecha desde
        fecha_hasta: Fecha hasta
    
    Returns:
        Tendencia del producto con datos históricos
    """
    # Obtener snapshots
    snapshots = historial_service.get_snapshots(
        sucursal=sucursal,
        tipo=tipo,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=500
    )
    
    if not snapshots:
        return {
            "codigo_producto": codigo_producto,
            "error": "No hay datos históricos disponibles"
        }
    
    # Extraer datos del producto de cada snapshot
    datos_historicos = []
    
    for snapshot in snapshots:
        detalle = historial_service.get_snapshot_detalle(snapshot["id"])
        
        # Buscar el producto en el snapshot
        producto = next(
            (p for p in detalle["productos"] if p["codigo_producto"] == codigo_producto),
            None
        )
        
        if producto:
            datos_historicos.append({
                "fecha": snapshot["fecha_hora"],
                "stock": producto["stock_cantidad"],
                "pedido": producto["pedido_cantidad"],
                "tiene_pedido": producto["tiene_pedido"],
            })
    
    if not datos_historicos:
        return {
            "codigo_producto": codigo_producto,
            "error": "Producto no encontrado en el historial"
        }
    
    # Ordenar por fecha
    datos_historicos.sort(key=lambda x: x["fecha"])
    
    # Calcular estadísticas
    stocks = [d["stock"] for d in datos_historicos]
    pedidos = [d["pedido"] for d in datos_historicos if d["tiene_pedido"]]
    
    # Obtener datos actuales
    if tipo == "cocina":
        productos_actuales = stocks_service.get_stocks_cocina(sucursal)
    else:
        productos_actuales = stocks_service.get_stocks_salon(sucursal)
    
    producto_actual = next(
        (p for p in productos_actuales if p["codigo_producto"] == codigo_producto),
        None
    )
    
    return {
        "codigo_producto": codigo_producto,
        "producto": producto_actual["producto"] if producto_actual else "",
        "sucursal": sucursal,
        "tipo": tipo,
        "actual": {
            "stock": producto_actual["stock_cantidad"] if producto_actual else 0,
            "pedido": producto_actual["pedido_cantidad"] if producto_actual else 0,
            "unidad_stock": producto_actual["stock_unidad"] if producto_actual else "",
            "unidad_pedido": producto_actual["pedido_unidad"] if producto_actual else "",
        },
        "historico": datos_historicos,
        "estadisticas": {
            "stock_promedio": round(sum(stocks) / len(stocks), 2) if stocks else 0,
            "stock_max": max(stocks) if stocks else 0,
            "stock_min": min(stocks) if stocks else 0,
            "pedido_promedio": round(sum(pedidos) / len(pedidos), 2) if pedidos else 0,
            "pedido_max": max(pedidos) if pedidos else 0,
            "pedido_min": min(pedidos) if pedidos else 0,
            "veces_pedido": len(pedidos),
            "total_snapshots": len(datos_historicos),
        }
    }


def predecir_stock(
    codigo_producto: str,
    sucursal: str,
    tipo: str
) -> Dict[str, Any]:
    """
    Predice el stock futuro basándose en:
    - Stock actual
    - Pedido actual
    - Consumo promedio histórico
    
    Fórmula: Stock Predicho = Stock Actual + Pedido Actual - Consumo Promedio
    
    Args:
        codigo_producto: Código del producto
        sucursal: Sucursal
        tipo: Tipo (cocina/salon)
    
    Returns:
        Predicción de stock
    """
    # Obtener tendencias
    tendencias = get_tendencias_producto(codigo_producto, sucursal, tipo)
    
    if "error" in tendencias:
        return tendencias
    
    actual = tendencias["actual"]
    stats = tendencias["estadisticas"]
    
    # Calcular consumo promedio (diferencia entre snapshots)
    historico = tendencias["historico"]
    consumos = []
    
    for i in range(1, len(historico)):
        anterior = historico[i-1]
        actual_hist = historico[i]
        
        # Consumo = Stock anterior + Pedido anterior - Stock actual
        consumo = anterior["stock"] + anterior["pedido"] - actual_hist["stock"]
        if consumo > 0:  # Solo considerar consumos positivos
            consumos.append(consumo)
    
    consumo_promedio = round(sum(consumos) / len(consumos), 2) if consumos else 0
    
    # Predicción
    stock_predicho = actual["stock"] + actual["pedido"] - consumo_promedio
    
    # Determinar estado
    if stock_predicho < 0:
        estado = "CRÍTICO - Stock insuficiente"
        alerta = "ALTA"
    elif stock_predicho < stats["stock_promedio"] * 0.3:
        estado = "BAJO - Considerar aumentar pedido"
        alerta = "MEDIA"
    elif stock_predicho > stats["stock_promedio"] * 2:
        estado = "ALTO - Posible sobre-stock"
        alerta = "BAJA"
    else:
        estado = "NORMAL - Stock adecuado"
        alerta = "NINGUNA"
    
    return {
        "codigo_producto": codigo_producto,
        "producto": tendencias["producto"],
        "sucursal": sucursal,
        "tipo": tipo,
        "stock_actual": actual["stock"],
        "pedido_actual": actual["pedido"],
        "consumo_promedio": consumo_promedio,
        "stock_predicho": round(stock_predicho, 2),
        "unidad": actual["unidad_stock"],
        "estado": estado,
        "alerta": alerta,
        "recomendacion": _generar_recomendacion(
            stock_predicho,
            actual["pedido"],
            consumo_promedio,
            stats["stock_promedio"]
        )
    }


def _generar_recomendacion(
    stock_predicho: float,
    pedido_actual: float,
    consumo_promedio: float,
    stock_promedio: float
) -> str:
    """Genera una recomendación basada en la predicción."""
    if stock_predicho < 0:
        cantidad_faltante = abs(stock_predicho)
        return f"Aumentar pedido en {round(cantidad_faltante + consumo_promedio, 2)} unidades"
    elif stock_predicho < stock_promedio * 0.3:
        return f"Aumentar pedido en {round(consumo_promedio * 0.5, 2)} unidades"
    elif stock_predicho > stock_promedio * 2:
        return "Reducir pedido o no pedir esta semana"
    else:
        return "Mantener pedido actual"


def comparar_sucursales(
    tipo: Optional[str] = None
) -> Dict[str, Any]:
    """
    Compara stocks y pedidos entre Recoleta y Palermo.
    
    Args:
        tipo: Filtrar por tipo (cocina/salon)
    
    Returns:
        Comparación entre sucursales
    """
    # Obtener datos de ambas sucursales
    tipos = [tipo] if tipo else ["cocina", "salon"]
    
    comparacion = {
        "recoleta": {},
        "palermo": {},
        "diferencias": {}
    }
    
    for t in tipos:
        if t == "cocina":
            recoleta = stocks_service.get_stocks_cocina("recoleta")
            palermo = stocks_service.get_stocks_cocina("palermo")
        else:
            recoleta = stocks_service.get_stocks_salon("recoleta")
            palermo = stocks_service.get_stocks_salon("palermo")
        
        # Crear diccionarios por código
        recoleta_dict = {p["codigo_producto"]: p for p in recoleta}
        palermo_dict = {p["codigo_producto"]: p for p in palermo}
        
        # Estadísticas por sucursal
        comparacion["recoleta"][t] = {
            "total_productos": len(recoleta),
            "con_pedido": sum(1 for p in recoleta if p["tiene_pedido"]),
            "stock_total": sum(p["stock_cantidad"] for p in recoleta),
            "pedido_total": sum(p["pedido_cantidad"] for p in recoleta if p["tiene_pedido"]),
        }
        
        comparacion["palermo"][t] = {
            "total_productos": len(palermo),
            "con_pedido": sum(1 for p in palermo if p["tiene_pedido"]),
            "stock_total": sum(p["stock_cantidad"] for p in palermo),
            "pedido_total": sum(p["pedido_cantidad"] for p in palermo if p["tiene_pedido"]),
        }
        
        # Encontrar diferencias significativas
        diferencias = []
        
        for codigo in set(recoleta_dict.keys()) | set(palermo_dict.keys()):
            r = recoleta_dict.get(codigo)
            p = palermo_dict.get(codigo)
            
            if r and p:
                # Ambas sucursales tienen el producto
                diff_stock = r["stock_cantidad"] - p["stock_cantidad"]
                diff_pedido = r["pedido_cantidad"] - p["pedido_cantidad"]
                
                # Solo reportar diferencias significativas
                if abs(diff_stock) > 2 or abs(diff_pedido) > 2:
                    diferencias.append({
                        "codigo_producto": codigo,
                        "producto": r["producto"],
                        "recoleta_stock": r["stock_cantidad"],
                        "palermo_stock": p["stock_cantidad"],
                        "diferencia_stock": round(diff_stock, 2),
                        "recoleta_pedido": r["pedido_cantidad"],
                        "palermo_pedido": p["pedido_cantidad"],
                        "diferencia_pedido": round(diff_pedido, 2),
                    })
            elif r and not p:
                # Solo en Recoleta
                diferencias.append({
                    "codigo_producto": codigo,
                    "producto": r["producto"],
                    "solo_en": "recoleta",
                    "stock": r["stock_cantidad"],
                    "pedido": r["pedido_cantidad"],
                })
            elif p and not r:
                # Solo en Palermo
                diferencias.append({
                    "codigo_producto": codigo,
                    "producto": p["producto"],
                    "solo_en": "palermo",
                    "stock": p["stock_cantidad"],
                    "pedido": p["pedido_cantidad"],
                })
        
        comparacion["diferencias"][t] = diferencias
    
    return comparacion


def get_alertas_stock_bajo(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    umbral: float = 2.0
) -> List[Dict[str, Any]]:
    """
    Obtiene productos con stock bajo (menor al umbral).
    
    Args:
        sucursal: Filtrar por sucursal
        tipo: Filtrar por tipo
        umbral: Cantidad mínima de stock
    
    Returns:
        Lista de productos con stock bajo
    """
    productos_bajo_stock = []
    
    sucursales = [sucursal] if sucursal else ["recoleta"]
    
    for suc in sucursales:
        tipos = [tipo] if tipo else ["cocina", "salon"]
        
        for t in tipos:
            if t == "cocina":
                productos = stocks_service.get_stocks_cocina(suc)
            else:
                productos = stocks_service.get_stocks_salon(suc)
            
            for p in productos:
                if p["stock_cantidad"] < umbral:
                    productos_bajo_stock.append({
                        "codigo_producto": p["codigo_producto"],
                        "producto": p["producto"],
                        "sucursal": suc,
                        "tipo": t,
                        "stock_actual": p["stock_cantidad"],
                        "unidad": p["stock_unidad"],
                        "pedido_actual": p["pedido_cantidad"],
                        "tiene_pedido": p["tiene_pedido"],
                        "nivel_alerta": "CRÍTICO" if p["stock_cantidad"] == 0 else "BAJO",
                    })
    
    # Ordenar por stock (ascendente)
    productos_bajo_stock.sort(key=lambda x: x["stock_actual"])
    
    return productos_bajo_stock

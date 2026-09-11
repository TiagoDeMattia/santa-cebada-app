"""
Servicio para estadísticas de pedidos con historial importado.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import sqlite3
import os
from functools import lru_cache
from time import time

from ..services import stocks_service
from ..utils.logger import logger

# Cache para stocks con timeout
_stocks_cache = {}
_cache_timeout = 300  # 5 minutos


def _get_db_connection():
    """Obtiene conexión a la base de datos."""
    db_path = os.path.join(os.path.dirname(__file__), "stocks_historial.db")
    db_path = os.path.abspath(db_path)
    return sqlite3.connect(db_path)


def _get_cached_stocks(sucursal: str, tipo: str):
    """Obtiene stocks con cache."""
    cache_key = f"{sucursal}_{tipo}"
    now = time()
    
    if cache_key in _stocks_cache:
        cached_data, timestamp = _stocks_cache[cache_key]
        if now - timestamp < _cache_timeout:
            return cached_data
    
    # Obtener datos frescos
    if tipo == "cocina":
        data = stocks_service.get_stocks_cocina(sucursal)
    else:
        data = stocks_service.get_stocks_salon(sucursal)
    
    _stocks_cache[cache_key] = (data, now)
    return data


def get_stocks_y_pedidos_actuales(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Obtiene stocks y pedidos actuales (solo productos con pedido).
    
    Args:
        sucursal: Filtrar por sucursal ('recoleta' o 'palermo')
        tipo: Filtrar por tipo ('cocina' o 'salon')
    
    Returns:
        Lista de productos con stock y pedido actual (ordenados: salón primero, luego cocina)
    """
    productos = []
    
    # Determinar sucursales a consultar
    sucursales = [sucursal] if sucursal else ["recoleta"]
    
    for suc in sucursales:
        # Determinar tipos a consultar
        tipos = [tipo] if tipo else ["cocina", "salon"]
        
        for t in tipos:
            prods = _get_cached_stocks(suc, t)
            
            for p in prods:
                # Solo incluir productos con pedido
                if p["tiene_pedido"] and p["pedido_cantidad"] > 0:
                    productos.append({
                        "codigo_producto": p["codigo_producto"],
                        "producto": p["producto"],
                        "codigo_grupo": p["codigo_grupo"],
                        "sucursal": suc,
                        "tipo": t,
                        "stock_cantidad": p["stock_cantidad"],
                        "stock_unidad": p["stock_unidad"],
                        "pedido_cantidad": p["pedido_cantidad"],
                        "pedido_unidad": p["pedido_unidad"],
                        "tiene_pedido": p["tiene_pedido"],
                    })
    
    # Ordenar: primero salón, luego cocina
    productos.sort(key=lambda x: (0 if x["tipo"] == "salon" else 1, x["producto"]))
    
    return productos


def get_promedio_pedidos(
    codigo_producto: Optional[str] = None,
    nombre_producto: Optional[str] = None,
    sucursal: str = "recoleta",
    tipo: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Obtiene el promedio de pedidos por producto desde el historial importado.
    
    Args:
        codigo_producto: Filtrar por código de producto
        nombre_producto: Buscar por nombre de producto (parcial)
        sucursal: Sucursal ('recoleta' - único disponible por ahora)
        tipo: Filtrar por tipo ('cocina' o 'salon')
        fecha_desde: Fecha desde (YYYY-MM-DD)
        fecha_hasta: Fecha hasta (YYYY-MM-DD)
        limit: Límite de resultados
    
    Returns:
        Lista de productos con promedio de pedidos
    """
    conn = _get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Construir query
        query = """
            SELECT 
                codigo_producto,
                nombre_producto,
                tipo,
                COUNT(*) as veces_pedido,
                SUM(cantidad) as cantidad_total,
                AVG(cantidad) as cantidad_promedio,
                MAX(cantidad) as cantidad_max,
                MIN(cantidad) as cantidad_min,
                MIN(fecha) as primera_fecha,
                MAX(fecha) as ultima_fecha
            FROM historial_pedidos_importado
            WHERE sucursal = ?
        """
        params = [sucursal]
        
        if codigo_producto:
            query += " AND codigo_producto = ?"
            params.append(codigo_producto)
        
        if nombre_producto:
            query += " AND nombre_producto LIKE ?"
            params.append(f"%{nombre_producto}%")
        
        if tipo:
            query += " AND tipo = ?"
            params.append(tipo)
        
        if fecha_desde:
            query += " AND fecha >= ?"
            params.append(fecha_desde)
        
        if fecha_hasta:
            query += " AND fecha <= ?"
            params.append(fecha_hasta)
        
        query += """
            GROUP BY codigo_producto, nombre_producto, tipo
            ORDER BY cantidad_total DESC
            LIMIT ?
        """
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        resultados = []
        for row in rows:
            resultados.append({
                "codigo_producto": row[0],
                "nombre_producto": row[1],
                "tipo": row[2],
                "veces_pedido": row[3],
                "cantidad_total": round(row[4], 2),
                "cantidad_promedio": round(row[5], 2),
                "cantidad_max": row[6],
                "cantidad_min": row[7],
                "primera_fecha": row[8],
                "ultima_fecha": row[9],
            })
        
        return resultados
        
    finally:
        conn.close()


def get_estadisticas_semanales(
    sucursal: str = "recoleta",
    tipo: Optional[str] = None,
    semanas: int = 12
) -> Dict[str, Any]:
    """
    Obtiene estadísticas de pedidos por semana.
    
    Args:
        sucursal: Sucursal ('recoleta')
        tipo: Filtrar por tipo ('cocina' o 'salon')
        semanas: Número de semanas a analizar
    
    Returns:
        Estadísticas semanales con datos para gráficos
    """
    conn = _get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Obtener rango de fechas
        cursor.execute("""
            SELECT MIN(fecha), MAX(fecha)
            FROM historial_pedidos_importado
            WHERE sucursal = ?
        """, (sucursal,))
        fecha_min, fecha_max = cursor.fetchone()
        
        if not fecha_min or not fecha_max:
            return {
                "semanas": [],
                "total_productos": 0,
                "total_pedidos": 0,
                "promedio_semanal": 0
            }
        
        # Query para estadísticas semanales
        query = """
            SELECT 
                strftime('%Y-%W', fecha) as semana,
                MIN(fecha) as fecha_inicio,
                MAX(fecha) as fecha_fin,
                COUNT(DISTINCT codigo_producto) as productos_distintos,
                COUNT(*) as total_registros,
                SUM(cantidad) as cantidad_total
            FROM historial_pedidos_importado
            WHERE sucursal = ?
        """
        params = [sucursal]
        
        if tipo:
            query += " AND tipo = ?"
            params.append(tipo)
        
        query += """
            GROUP BY semana
            ORDER BY semana DESC
            LIMIT ?
        """
        params.append(semanas)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        semanas_data = []
        for row in rows:
            semanas_data.append({
                "semana": row[0],
                "fecha_inicio": row[1],
                "fecha_fin": row[2],
                "productos_distintos": row[3],
                "total_registros": row[4],
                "cantidad_total": round(row[5], 2),
            })
        
        # Invertir para que esté en orden cronológico
        semanas_data.reverse()
        
        # Calcular totales
        total_productos = sum(s["productos_distintos"] for s in semanas_data)
        total_pedidos = sum(s["total_registros"] for s in semanas_data)
        promedio_semanal = round(total_pedidos / len(semanas_data), 2) if semanas_data else 0
        
        return {
            "semanas": semanas_data,
            "total_productos": total_productos,
            "total_pedidos": total_pedidos,
            "promedio_semanal": promedio_semanal,
            "rango_fechas": {
                "min": fecha_min,
                "max": fecha_max
            }
        }
        
    finally:
        conn.close()


def get_top_productos_por_semana(
    sucursal: str = "recoleta",
    tipo: Optional[str] = None,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Obtiene los productos más pedidos por semana.
    
    Args:
        sucursal: Sucursal ('recoleta')
        tipo: Filtrar por tipo
        limit: Límite de productos
    
    Returns:
        Lista de productos con pedidos por semana
    """
    conn = _get_db_connection()
    cursor = conn.cursor()
    
    try:
        query = """
            SELECT 
                codigo_producto,
                nombre_producto,
                tipo,
                strftime('%Y-%W', fecha) as semana,
                SUM(cantidad) as cantidad_semana
            FROM historial_pedidos_importado
            WHERE sucursal = ?
        """
        params = [sucursal]
        
        if tipo:
            query += " AND tipo = ?"
            params.append(tipo)
        
        query += """
            GROUP BY codigo_producto, nombre_producto, tipo, semana
            ORDER BY cantidad_semana DESC
            LIMIT ?
        """
        params.append(limit * 20)  # Obtener más para agrupar
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Agrupar por producto
        productos_dict = {}
        for row in rows:
            codigo = row[0]
            if codigo not in productos_dict:
                productos_dict[codigo] = {
                    "codigo_producto": row[0],
                    "nombre_producto": row[1],
                    "tipo": row[2],
                    "semanas": [],
                    "cantidad_total": 0
                }
            
            productos_dict[codigo]["semanas"].append({
                "semana": row[3],
                "cantidad": row[4]
            })
            productos_dict[codigo]["cantidad_total"] += row[4]
        
        # Convertir a lista y ordenar por cantidad total
        productos_list = list(productos_dict.values())
        productos_list.sort(key=lambda x: x["cantidad_total"], reverse=True)
        
        return productos_list[:limit]
        
    finally:
        conn.close()


def get_promedio_ventas_por_producto(
    codigo_producto: str,
    sucursal: str = "recoleta"
) -> Dict[str, Any]:
    """
    Obtiene el promedio de ventas/pedidos de un producto específico.
    
    Args:
        codigo_producto: Código del producto
        sucursal: Sucursal ('recoleta')
    
    Returns:
        Estadísticas detalladas del producto
    """
    conn = _get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Obtener datos del producto
        cursor.execute("""
            SELECT 
                codigo_producto,
                nombre_producto,
                tipo,
                COUNT(*) as veces_pedido,
                SUM(cantidad) as cantidad_total,
                AVG(cantidad) as cantidad_promedio,
                MAX(cantidad) as cantidad_max,
                MIN(cantidad) as cantidad_min,
                MIN(fecha) as primera_fecha,
                MAX(fecha) as ultima_fecha
            FROM historial_pedidos_importado
            WHERE sucursal = ? AND codigo_producto = ?
            GROUP BY codigo_producto, nombre_producto, tipo
        """, (sucursal, codigo_producto))
        
        row = cursor.fetchone()
        
        if not row:
            return {
                "error": "Producto no encontrado en el historial",
                "codigo_producto": codigo_producto
            }
        
        # Obtener datos por semana
        cursor.execute("""
            SELECT 
                strftime('%Y-%W', fecha) as semana,
                MIN(fecha) as fecha_inicio,
                MAX(fecha) as fecha_fin,
                SUM(cantidad) as cantidad
            FROM historial_pedidos_importado
            WHERE sucursal = ? AND codigo_producto = ?
            GROUP BY semana
            ORDER BY semana
        """, (sucursal, codigo_producto))
        
        semanas = []
        for semana_row in cursor.fetchall():
            semanas.append({
                "semana": semana_row[0],
                "fecha_inicio": semana_row[1],
                "fecha_fin": semana_row[2],
                "cantidad": semana_row[3]
            })
        
        # Obtener stock y pedido actual
        stock_actual = None
        try:
            prods = _get_cached_stocks(sucursal, row[2])
            stock_actual = next(
                (p for p in prods if p["codigo_producto"] == codigo_producto),
                None
            )
        except:
            pass
        
        return {
            "codigo_producto": row[0],
            "nombre_producto": row[1],
            "tipo": row[2],
            "veces_pedido": row[3],
            "cantidad_total": round(row[4], 2),
            "cantidad_promedio": round(row[5], 2),
            "cantidad_max": row[6],
            "cantidad_min": row[7],
            "primera_fecha": row[8],
            "ultima_fecha": row[9],
            "semanas": semanas,
            "stock_actual": {
                "stock": stock_actual["stock_cantidad"] if stock_actual else 0,
                "pedido": stock_actual["pedido_cantidad"] if stock_actual else 0,
                "unidad": stock_actual["stock_unidad"] if stock_actual else ""
            } if stock_actual else None
        }
        
    finally:
        conn.close()

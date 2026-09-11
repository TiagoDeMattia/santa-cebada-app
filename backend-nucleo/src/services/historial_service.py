"""
Servicio para gestión de historial de stocks.
Captura snapshots semanales y permite consultar cambios históricos.

IMPORTANTE: Los snapshots se capturan los LUNES a las 9 AM (horario Argentina - UTC-3)
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import json
import sqlite3
from pathlib import Path

from ..services import stocks_service
from ..utils.logger import logger


# Path a la base de datos de historial
HISTORIAL_DB_PATH = Path(__file__).resolve().parent / "stocks_historial.db"


def get_db_connection():
    """Obtiene una conexión a la base de datos de historial."""
    conn = sqlite3.connect(str(HISTORIAL_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def crear_tablas_historial():
    """
    Crea las tablas necesarias para el historial de stocks.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Tabla de snapshots completos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS snapshots_stocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha_hora DATETIME NOT NULL,
            sucursal VARCHAR(20) NOT NULL,
            tipo VARCHAR(20) NOT NULL,
            total_productos INTEGER NOT NULL,
            total_con_pedido INTEGER NOT NULL,
            datos_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Tabla de cambios individuales (para análisis detallado)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cambios_stocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha_hora DATETIME NOT NULL,
            sucursal VARCHAR(20) NOT NULL,
            tipo VARCHAR(20) NOT NULL,
            codigo_producto VARCHAR(10) NOT NULL,
            nombre_producto VARCHAR(200),
            codigo_grupo VARCHAR(10),
            stock_anterior DECIMAL(10,2),
            stock_nuevo DECIMAL(10,2),
            unidad_stock VARCHAR(50),
            pedido_anterior DECIMAL(10,2),
            pedido_nuevo DECIMAL(10,2),
            unidad_pedido VARCHAR(50),
            tipo_cambio VARCHAR(20),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Índices para optimizar consultas
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_snapshots_fecha 
        ON snapshots_stocks(fecha_hora)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_snapshots_sucursal 
        ON snapshots_stocks(sucursal)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_cambios_fecha 
        ON cambios_stocks(fecha_hora)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_cambios_producto 
        ON cambios_stocks(codigo_producto)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_cambios_sucursal 
        ON cambios_stocks(sucursal)
    """)
    
    conn.commit()
    conn.close()
    
    logger.info("✓ Tablas de historial creadas/verificadas")


def capturar_snapshot(sucursal: str, tipo: str) -> Dict[str, Any]:
    """
    Captura un snapshot del estado actual de stocks.
    
    Args:
        sucursal: "recoleta" o "palermo"
        tipo: "cocina" o "salon"
    
    Returns:
        Información del snapshot capturado
    """
    try:
        # Obtener stocks actuales
        if tipo == "cocina":
            productos = stocks_service.get_stocks_cocina(sucursal)
        elif tipo == "salon":
            productos = stocks_service.get_stocks_salon(sucursal)
        else:
            raise ValueError(f"Tipo inválido: {tipo}")
        
        # Contar productos con pedido
        total_con_pedido = sum(1 for p in productos if p["tiene_pedido"])
        
        # Guardar snapshot
        conn = get_db_connection()
        cursor = conn.cursor()
        
        fecha_hora = datetime.now()
        datos_json = json.dumps(productos, ensure_ascii=False)
        
        cursor.execute("""
            INSERT INTO snapshots_stocks 
            (fecha_hora, sucursal, tipo, total_productos, total_con_pedido, datos_json)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (fecha_hora, sucursal, tipo, len(productos), total_con_pedido, datos_json))
        
        snapshot_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info(f"✓ Snapshot capturado: {sucursal}/{tipo} - {len(productos)} productos")
        
        return {
            "id": snapshot_id,
            "fecha_hora": fecha_hora.isoformat(),
            "sucursal": sucursal,
            "tipo": tipo,
            "total_productos": len(productos),
            "total_con_pedido": total_con_pedido,
        }
    
    except Exception as e:
        logger.error(f"Error capturando snapshot {sucursal}/{tipo}: {str(e)}")
        raise


def capturar_snapshot_completo(sucursal: str) -> Dict[str, Any]:
    """
    Captura snapshots de cocina y salón de una sucursal.
    
    Args:
        sucursal: "recoleta" o "palermo"
    
    Returns:
        Información de los snapshots capturados
    """
    cocina = capturar_snapshot(sucursal, "cocina")
    salon = capturar_snapshot(sucursal, "salon")
    
    return {
        "sucursal": sucursal,
        "fecha_hora": cocina["fecha_hora"],
        "cocina": cocina,
        "salon": salon,
    }


def capturar_todas_las_sucursales() -> Dict[str, Any]:
    """
    Captura snapshots de Recoleta.

    Returns:
        Información del snapshot capturado
    """
    recoleta = capturar_snapshot_completo("recoleta")

    return {
        "fecha_hora": recoleta["fecha_hora"],
        "recoleta": recoleta,
    }


def detectar_cambios(sucursal: str, tipo: str) -> List[Dict[str, Any]]:
    """
    Detecta cambios entre el último snapshot y el estado actual.
    
    Args:
        sucursal: "recoleta" o "palermo"
        tipo: "cocina" o "salon"
    
    Returns:
        Lista de cambios detectados
    """
    try:
        # Obtener último snapshot
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, fecha_hora, datos_json
            FROM snapshots_stocks
            WHERE sucursal = ? AND tipo = ?
            ORDER BY fecha_hora DESC
            LIMIT 1
        """, (sucursal, tipo))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            logger.info(f"No hay snapshot anterior para {sucursal}/{tipo}")
            return []
        
        snapshot_id, fecha_anterior, datos_json = row
        productos_anteriores = json.loads(datos_json)
        
        # Obtener estado actual
        if tipo == "cocina":
            productos_actuales = stocks_service.get_stocks_cocina(sucursal)
        else:
            productos_actuales = stocks_service.get_stocks_salon(sucursal)
        
        # Crear diccionarios para comparación rápida
        anteriores_dict = {p["codigo_producto"]: p for p in productos_anteriores}
        actuales_dict = {p["codigo_producto"]: p for p in productos_actuales}
        
        # Detectar cambios
        cambios = []
        fecha_hora = datetime.now()
        
        for codigo, actual in actuales_dict.items():
            anterior = anteriores_dict.get(codigo)
            
            if not anterior:
                # Producto nuevo
                cambios.append({
                    "codigo_producto": codigo,
                    "nombre_producto": actual["producto"],
                    "tipo_cambio": "nuevo",
                    "stock_anterior": None,
                    "stock_nuevo": actual["stock_cantidad"],
                    "pedido_anterior": None,
                    "pedido_nuevo": actual["pedido_cantidad"],
                })
                continue
            
            # Detectar cambios en stock
            if anterior["stock_cantidad"] != actual["stock_cantidad"]:
                cambios.append({
                    "codigo_producto": codigo,
                    "nombre_producto": actual["producto"],
                    "tipo_cambio": "stock",
                    "stock_anterior": anterior["stock_cantidad"],
                    "stock_nuevo": actual["stock_cantidad"],
                    "unidad_stock": actual["stock_unidad"],
                    "pedido_anterior": anterior["pedido_cantidad"],
                    "pedido_nuevo": actual["pedido_cantidad"],
                })
            
            # Detectar cambios en pedido
            elif anterior["pedido_cantidad"] != actual["pedido_cantidad"]:
                cambios.append({
                    "codigo_producto": codigo,
                    "nombre_producto": actual["producto"],
                    "tipo_cambio": "pedido",
                    "stock_anterior": anterior["stock_cantidad"],
                    "stock_nuevo": actual["stock_cantidad"],
                    "pedido_anterior": anterior["pedido_cantidad"],
                    "pedido_nuevo": actual["pedido_cantidad"],
                    "unidad_pedido": actual["pedido_unidad"],
                })
        
        # Detectar productos eliminados
        for codigo, anterior in anteriores_dict.items():
            if codigo not in actuales_dict:
                cambios.append({
                    "codigo_producto": codigo,
                    "nombre_producto": anterior["producto"],
                    "tipo_cambio": "eliminado",
                    "stock_anterior": anterior["stock_cantidad"],
                    "stock_nuevo": None,
                    "pedido_anterior": anterior["pedido_cantidad"],
                    "pedido_nuevo": None,
                })
        
        # Guardar cambios en la base de datos
        if cambios:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            for cambio in cambios:
                cursor.execute("""
                    INSERT INTO cambios_stocks
                    (fecha_hora, sucursal, tipo, codigo_producto, nombre_producto,
                     stock_anterior, stock_nuevo, unidad_stock,
                     pedido_anterior, pedido_nuevo, unidad_pedido, tipo_cambio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    fecha_hora, sucursal, tipo,
                    cambio["codigo_producto"],
                    cambio["nombre_producto"],
                    cambio.get("stock_anterior"),
                    cambio.get("stock_nuevo"),
                    cambio.get("unidad_stock"),
                    cambio.get("pedido_anterior"),
                    cambio.get("pedido_nuevo"),
                    cambio.get("unidad_pedido"),
                    cambio["tipo_cambio"]
                ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"✓ Detectados {len(cambios)} cambios en {sucursal}/{tipo}")
        
        return cambios
    
    except Exception as e:
        logger.error(f"Error detectando cambios {sucursal}/{tipo}: {str(e)}")
        raise


def get_snapshots(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Obtiene snapshots históricos con filtros.
    
    Args:
        sucursal: Filtrar por sucursal
        tipo: Filtrar por tipo
        fecha_desde: Fecha desde (formato: YYYY-MM-DD)
        fecha_hasta: Fecha hasta (formato: YYYY-MM-DD)
        limit: Límite de resultados
    
    Returns:
        Lista de snapshots
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT id, fecha_hora, sucursal, tipo, total_productos, total_con_pedido FROM snapshots_stocks WHERE 1=1"
    params = []
    
    if sucursal:
        query += " AND sucursal = ?"
        params.append(sucursal)
    
    if tipo:
        query += " AND tipo = ?"
        params.append(tipo)
    
    if fecha_desde:
        query += " AND DATE(fecha_hora) >= ?"
        params.append(fecha_desde)
    
    if fecha_hasta:
        query += " AND DATE(fecha_hora) <= ?"
        params.append(fecha_hasta)
    
    query += " ORDER BY fecha_hora DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    snapshots = []
    for row in rows:
        snapshots.append({
            "id": row[0],
            "fecha_hora": row[1],
            "sucursal": row[2],
            "tipo": row[3],
            "total_productos": row[4],
            "total_con_pedido": row[5],
        })
    
    return snapshots


def get_snapshot_detalle(snapshot_id: int) -> Dict[str, Any]:
    """
    Obtiene el detalle completo de un snapshot.
    
    Args:
        snapshot_id: ID del snapshot
    
    Returns:
        Snapshot con todos los productos
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, fecha_hora, sucursal, tipo, total_productos, total_con_pedido, datos_json
        FROM snapshots_stocks
        WHERE id = ?
    """, (snapshot_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise ValueError(f"Snapshot {snapshot_id} no encontrado")
    
    productos = json.loads(row[6])
    
    return {
        "id": row[0],
        "fecha_hora": row[1],
        "sucursal": row[2],
        "tipo": row[3],
        "total_productos": row[4],
        "total_con_pedido": row[5],
        "productos": productos,
    }


def get_cambios(
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    codigo_producto: Optional[str] = None,
    tipo_cambio: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Obtiene cambios históricos con filtros.
    
    Args:
        sucursal: Filtrar por sucursal
        tipo: Filtrar por tipo
        codigo_producto: Filtrar por producto
        tipo_cambio: Filtrar por tipo de cambio (stock, pedido, nuevo, eliminado)
        fecha_desde: Fecha desde
        fecha_hasta: Fecha hasta
        limit: Límite de resultados
    
    Returns:
        Lista de cambios
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT id, fecha_hora, sucursal, tipo, codigo_producto, nombre_producto,
               stock_anterior, stock_nuevo, unidad_stock,
               pedido_anterior, pedido_nuevo, unidad_pedido, tipo_cambio
        FROM cambios_stocks
        WHERE 1=1
    """
    params = []
    
    if sucursal:
        query += " AND sucursal = ?"
        params.append(sucursal)
    
    if tipo:
        query += " AND tipo = ?"
        params.append(tipo)
    
    if codigo_producto:
        query += " AND codigo_producto = ?"
        params.append(codigo_producto)
    
    if tipo_cambio:
        query += " AND tipo_cambio = ?"
        params.append(tipo_cambio)
    
    if fecha_desde:
        query += " AND DATE(fecha_hora) >= ?"
        params.append(fecha_desde)
    
    if fecha_hasta:
        query += " AND DATE(fecha_hora) <= ?"
        params.append(fecha_hasta)
    
    query += " ORDER BY fecha_hora DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    cambios = []
    for row in rows:
        cambios.append({
            "id": row[0],
            "fecha_hora": row[1],
            "sucursal": row[2],
            "tipo": row[3],
            "codigo_producto": row[4],
            "nombre_producto": row[5],
            "stock_anterior": row[6],
            "stock_nuevo": row[7],
            "unidad_stock": row[8],
            "pedido_anterior": row[9],
            "pedido_nuevo": row[10],
            "unidad_pedido": row[11],
            "tipo_cambio": row[12],
        })
    
    return cambios

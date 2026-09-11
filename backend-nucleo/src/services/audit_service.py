"""
Servicio de auditoría para registrar cambios en el sistema.
"""
from datetime import datetime
from typing import Optional, Dict, Any
import json
import pandas as pd
from sqlalchemy import text

from .database import get_engine, get_table
from ..utils.logger import logger


def log_change(
    username: str,
    action: str,  # "create", "update", "delete"
    entity_type: str,  # "barril", "producto", "usuario", etc
    entity_id: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    sucursal_id: Optional[str] = None,
) -> bool:
    """
    Registra un cambio en la tabla de auditoría.
    
    Args:
        username: Usuario que realizó el cambio
        action: Tipo de acción (create, update, delete)
        entity_type: Tipo de entidad (barril, producto, usuario, etc)
        entity_id: ID de la entidad afectada
        changes: Dict con los cambios realizados
        ip_address: Dirección IP del cliente
        sucursal_id: ID de la sucursal (1=Recoleta, 2=Palermo)
    
    Returns:
        True si se registró correctamente, False en caso de error
    """
    try:
        engine = get_engine()
        
        # Convertir changes a JSON si es un dict
        changes_json = None
        if changes:
            changes_json = json.dumps(changes, default=str)
        
        # Insertar en la tabla de auditoría
        with engine.connect() as conn:
            stmt = text("""
                INSERT INTO audit_log 
                (username, action, entity_type, entity_id, changes, timestamp, ip_address, sucursal_id)
                VALUES (:username, :action, :entity_type, :entity_id, :changes, :timestamp, :ip_address, :sucursal_id)
            """)
            
            conn.execute(stmt, {
                "username": username,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "changes": changes_json,
                "timestamp": datetime.utcnow(),
                "ip_address": ip_address,
                "sucursal_id": sucursal_id,
            })
            conn.commit()
        
        logger.info(f"Auditoría: {username} {action} {entity_type} {entity_id}")
        return True
    except Exception as e:
        logger.error(f"Error registrando auditoría: {e}")
        return False


def get_audit_log(
    limit: int = 100,
    offset: int = 0,
    entity_type: Optional[str] = None,
    username: Optional[str] = None,
    sucursal_id: Optional[str] = None,
) -> list:
    """
    Obtiene el historial de auditoría con filtros opcionales.
    """
    try:
        import sqlite3
        import os
        
        # Usar sqlite3 directamente en lugar de SQLAlchemy
        db_path = os.path.join(os.path.dirname(__file__), 'nucleocheck.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Construir query con filtros
        query = "SELECT * FROM audit_log WHERE 1=1"
        params = []
        
        if entity_type:
            query += " AND entity_type = ?"
            params.append(entity_type)
        
        if username:
            query += " AND username = ?"
            params.append(username)
        
        if sucursal_id:
            query += " AND sucursal_id = ?"
            params.append(sucursal_id)
        
        # Ordenar por timestamp descendente (más recientes primero)
        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.append(limit)
        params.append(offset)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        # Convertir a lista de dicts
        logs = []
        for row in rows:
            log_dict = {
                "id": row[0],
                "username": row[1],
                "action": row[2],
                "entity_type": row[3],
                "entity_id": row[4],
                "changes": json.loads(row[5]) if row[5] else None,
                "timestamp": row[6],
                "ip_address": row[7],
                "sucursal_id": row[8],
            }
            logs.append(log_dict)
        
        logger.info(f"Auditoría: Se obtuvieron {len(logs)} registros")
        return logs
    except Exception as e:
        logger.error(f"Error obteniendo auditoría: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_audit_stats() -> Dict[str, Any]:
    """
    Obtiene estadísticas del historial de auditoría.
    
    Returns:
        Dict con estadísticas
    """
    try:
        engine = get_engine()
        
        with engine.connect() as conn:
            # Total de cambios
            result = conn.execute(text("SELECT COUNT(*) FROM audit_log"))
            total = result.scalar()
            
            # Cambios por tipo de entidad
            result = conn.execute(text("""
                SELECT entity_type, COUNT(*) as count 
                FROM audit_log 
                GROUP BY entity_type 
                ORDER BY count DESC
            """))
            by_entity = {row[0]: row[1] for row in result.fetchall()}
            
            # Cambios por usuario
            result = conn.execute(text("""
                SELECT username, COUNT(*) as count 
                FROM audit_log 
                GROUP BY username 
                ORDER BY count DESC
            """))
            by_user = {row[0]: row[1] for row in result.fetchall()}
            
            # Cambios por acción
            result = conn.execute(text("""
                SELECT action, COUNT(*) as count 
                FROM audit_log 
                GROUP BY action 
                ORDER BY count DESC
            """))
            by_action = {row[0]: row[1] for row in result.fetchall()}
        
        return {
            "total": total,
            "by_entity_type": by_entity,
            "by_user": by_user,
            "by_action": by_action,
        }
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas de auditoría: {e}")
        return {"total": 0, "by_entity_type": {}, "by_user": {}, "by_action": {}}

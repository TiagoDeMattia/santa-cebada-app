"""
Script para inicializar la base de datos con el usuario admin
"""
import sys
from src.services.database import ensure_schema, get_table, get_engine
from src.services.users_service import create_user, get_user_by_username
from src.utils.logger import logger

def init_database():
    """Inicializa la base de datos y crea el usuario admin"""
    try:
        # Crear tablas
        logger.info("Creando tablas...")
        ensure_schema()
        logger.info("✓ Tablas creadas")
        
        # Crear usuario admin si no existe
        admin_user = get_user_by_username("tdemattia")
        if admin_user:
            logger.info("✓ Usuario admin ya existe")
        else:
            logger.info("Creando usuario admin...")
            create_user("tdemattia", "13502", "ADMIN")
            logger.info("✓ Usuario admin creado: tdemattia / 13502")
        
        logger.info("✓ Base de datos inicializada correctamente")
        return True
    except Exception as e:
        logger.error(f"Error al inicializar base de datos: {str(e)}")
        return False

if __name__ == "__main__":
    success = init_database()
    sys.exit(0 if success else 1)

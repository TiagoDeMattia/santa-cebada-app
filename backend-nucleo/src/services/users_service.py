"""
Servicio de gestión de usuarios
"""
from sqlalchemy import select, insert, update, delete
from sqlalchemy.exc import IntegrityError
import hashlib
import secrets
from datetime import datetime
from ..services.database import get_engine, get_table
from ..utils.logger import logger


def hash_password(password: str) -> str:
    """Hashea una contraseña usando SHA256 con salt"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${pwd_hash}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña contra su hash"""
    try:
        salt, pwd_hash = hashed_password.split('$')
        return hashlib.sha256((salt + plain_password).encode()).hexdigest() == pwd_hash
    except:
        return False


def create_user(username: str, password: str, role: str = "NORMAL", nombre: str = None) -> dict:
    """Crea un nuevo usuario"""
    try:
        users_table = get_table("users")
        engine = get_engine()
        
        hashed_pwd = hash_password(password)
        now = datetime.utcnow()
        
        stmt = insert(users_table).values(
            username=username.lower().strip(),
            nombre=nombre,
            password=hashed_pwd,
            role=role.upper(),
            created_at=now,
            updated_at=now,
        )
        
        with engine.connect() as conn:
            result = conn.execute(stmt)
            conn.commit()
            user_id = result.lastrowid
        
        logger.info(f"Usuario creado: {username} (rol: {role})")
        return {
            "id": user_id,
            "username": username.lower().strip(),
            "nombre": nombre,
            "role": role.upper(),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
    except IntegrityError:
        logger.error(f"Usuario ya existe: {username}")
        raise ValueError(f"El usuario '{username}' ya existe")
    except Exception as e:
        logger.error(f"Error al crear usuario: {str(e)}")
        raise


def get_user_by_username(username: str) -> dict | None:
    """Obtiene un usuario por nombre de usuario"""
    try:
        users_table = get_table("users")
        engine = get_engine()
        
        stmt = select(users_table).where(
            users_table.c.username == username.lower().strip()
        )
        
        with engine.connect() as conn:
            result = conn.execute(stmt).fetchone()
        
        if not result:
            return None
        
        return {
            "id": result.id,
            "username": result.username,
            "nombre": result.nombre,
            "password": result.password,
            "role": result.role,
            "created_at": result.created_at.isoformat() if result.created_at else None,
            "updated_at": result.updated_at.isoformat() if result.updated_at else None,
        }
    except Exception as e:
        logger.error(f"Error al obtener usuario: {str(e)}")
        return None


def get_all_users() -> list:
    """Obtiene todos los usuarios"""
    try:
        users_table = get_table("users")
        engine = get_engine()
        
        stmt = select(users_table)
        
        with engine.connect() as conn:
            results = conn.execute(stmt).fetchall()
        
        return [
            {
                "id": r.id,
                "username": r.username,
                "nombre": r.nombre,
                "role": r.role,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in results
        ]
    except Exception as e:
        logger.error(f"Error al obtener usuarios: {str(e)}")
        return []


def update_user(user_id: int, nombre: str = None, password: str = None, role: str = None) -> dict:
    """Actualiza un usuario"""
    try:
        users_table = get_table("users")
        engine = get_engine()
        
        updates = {"updated_at": datetime.utcnow()}
        if nombre is not None:
            updates["nombre"] = nombre
        if password:
            updates["password"] = hash_password(password)
        if role:
            updates["role"] = role.upper()
        
        stmt = update(users_table).where(
            users_table.c.id == user_id
        ).values(**updates)
        
        with engine.connect() as conn:
            conn.execute(stmt)
            conn.commit()
        
        logger.info(f"Usuario actualizado: ID {user_id}")
        return get_user_by_username_id(user_id)
    except Exception as e:
        logger.error(f"Error al actualizar usuario: {str(e)}")
        raise


def get_user_by_username_id(user_id: int) -> dict:
    """Obtiene un usuario por ID"""
    try:
        users_table = get_table("users")
        engine = get_engine()
        
        stmt = select(users_table).where(users_table.c.id == user_id)
        
        with engine.connect() as conn:
            result = conn.execute(stmt).fetchone()
        
        if not result:
            return None
        
        return {
            "id": result.id,
            "username": result.username,
            "nombre": result.nombre,
            "role": result.role,
            "created_at": result.created_at.isoformat() if result.created_at else None,
            "updated_at": result.updated_at.isoformat() if result.updated_at else None,
        }
    except Exception as e:
        logger.error(f"Error al obtener usuario por ID: {str(e)}")
        return None


def delete_user(user_id: int) -> bool:
    """Elimina un usuario"""
    try:
        users_table = get_table("users")
        engine = get_engine()
        
        stmt = delete(users_table).where(users_table.c.id == user_id)
        
        with engine.connect() as conn:
            conn.execute(stmt)
            conn.commit()
        
        logger.info(f"Usuario eliminado: ID {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error al eliminar usuario: {str(e)}")
        raise


def authenticate_user(username: str, password: str) -> dict | None:
    """Autentica un usuario"""
    user = get_user_by_username(username)
    if not user:
        logger.warning(f"Usuario no encontrado: {username}")
        return None
    
    logger.info(f"Usuario encontrado: {username}, verificando contraseña...")
    if not verify_password(password, user["password"]):
        logger.warning(f"Contraseña incorrecta para: {username}")
        return None
    
    logger.info(f"Contraseña correcta para: {username}")
    # Retornar sin la contraseña
    return {
        "id": user["id"],
        "username": user["username"],
        "nombre": user["nombre"],
        "role": user["role"],
        "created_at": user["created_at"],
        "updated_at": user["updated_at"],
    }

"""
Controlador de autenticación
"""
from fastapi import APIRouter, Header, HTTPException, status, Depends
from datetime import timedelta

from ..models.schemas import LoginRequest, TokenResponse, ApiResponse, UserCreate, UserResponse, UserUpdate
from ..middleware.auth import create_token, verify_token, JWTBearer
from ..services.users_service import (
    authenticate_user, create_user, get_all_users, 
    update_user, delete_user, get_user_by_username_id
)
from ..utils.logger import logger

router = APIRouter(prefix="/auth", tags=["Autenticación"])
jwt_bearer = JWTBearer()


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    """
    Inicia sesión y retorna token JWT
    """
    logger.info(f"[LOGIN] Iniciando login para usuario: {data.username}")
    username_lower = data.username.lower().strip()
    
    # Duración del token: 30 días con rememberMe, 8 horas sin él
    token_ttl = timedelta(days=30) if data.remember_me else timedelta(hours=8)

    # Usuarios hardcoded especiales
    _HARDCODED = {
        "visor":  ("visor123", "visor",  "Usuario Visor"),
        "cajero": ("cajero",   "cajero", "Cajero"),
    }
    if username_lower in _HARDCODED:
        pwd, role, nombre = _HARDCODED[username_lower]
        if data.password != pwd:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
        logger.info(f"[LOGIN] Usuario hardcoded reconocido: {username_lower}")
        token = create_token(username=username_lower, role=role, nombre=nombre, expires_delta=token_ttl)
        return TokenResponse(access_token=token, token_type="bearer", expires_in=int(token_ttl.total_seconds()))

    logger.info(f"[LOGIN] Intentando autenticar contra base de datos...")
    # Intentar autenticar contra la base de datos
    user = authenticate_user(username_lower, data.password)

    if not user:
        logger.warning(f"[LOGIN] Login fallido: {data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    # Convertir rol de BD a formato esperado por JWT
    role_map = {"ADMIN": "admin", "NORMAL": "user", "VISOR": "visor", "SALON": "salon", "COCINA": "cocina", "CAJERO": "cajero", "VALES": "cajero"}
    jwt_role = role_map.get(user["role"], "user")

    token = create_token(
        username=user["username"],
        role=jwt_role,
        nombre=user.get("nombre"),
        expires_delta=token_ttl,
    )
    logger.info(f"[LOGIN] Login exitoso: {data.username} (rol: {user['role']}, ttl: {token_ttl})")
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=int(token_ttl.total_seconds()),
    )


@router.post("/verify", response_model=ApiResponse)
async def verify_token_endpoint(authorization: str = Header(default="")):
    """
    Verifica si un token es válido.
    Acepta el token via cabecera Authorization: Bearer <token>
    """
    token = authorization[7:] if authorization.lower().startswith("bearer ") else authorization
    is_valid = verify_token(token)
    return ApiResponse(
        success=is_valid,
        message="Token válido" if is_valid else "Token inválido o expirado",
    )


# ─── GESTIÓN DE USUARIOS (solo ADMIN) ──────────────────────────────────────────

@router.post("/users", response_model=UserResponse)
async def create_new_user(data: UserCreate, current_user = Depends(jwt_bearer)):
    """
    Crea un nuevo usuario (solo ADMIN)
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden crear usuarios",
        )
    
    try:
        from ..services.audit_service import log_change
        
        user = create_user(data.username, data.password, data.role, data.nombre)
        logger.info(f"Usuario creado por {current_user.sub}: {data.username}")
        
        # Registrar en auditoría
        log_change(
            username=current_user.sub,
            action="create",
            entity_type="usuario",
            entity_id=data.username,
            changes={"username": data.username, "nombre": data.nombre, "role": data.role},
        )
        
        return UserResponse(**user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/users", response_model=list[UserResponse])
async def list_users(current_user = Depends(jwt_bearer)):
    """
    Lista todos los usuarios (solo ADMIN)
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden ver usuarios",
        )
    
    users = get_all_users()
    return [UserResponse(**u) for u in users]


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user_endpoint(user_id: int, data: UserUpdate, current_user = Depends(jwt_bearer)):
    """
    Actualiza un usuario (solo ADMIN)
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden actualizar usuarios",
        )
    
    try:
        from ..services.audit_service import log_change
        
        user = update_user(user_id, data.nombre, data.password, data.role)
        logger.info(f"Usuario actualizado por {current_user.sub}: ID {user_id}")
        
        # Registrar en auditoría
        changes = {}
        if data.nombre is not None:
            changes["nombre"] = data.nombre
        if data.password:
            changes["password"] = "***"
        if data.role:
            changes["role"] = data.role
        
        log_change(
            username=current_user.sub,
            action="update",
            entity_type="usuario",
            entity_id=str(user_id),
            changes=changes,
        )
        
        return UserResponse(**user)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/users/{user_id}", response_model=ApiResponse)
async def delete_user_endpoint(user_id: int, current_user = Depends(jwt_bearer)):
    """
    Elimina un usuario (solo ADMIN)
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden eliminar usuarios",
        )
    
    try:
        from ..services.audit_service import log_change
        
        delete_user(user_id)
        logger.info(f"Usuario eliminado por {current_user.sub}: ID {user_id}")
        
        # Registrar en auditoría
        log_change(
            username=current_user.sub,
            action="delete",
            entity_type="usuario",
            entity_id=str(user_id),
        )
        
        return ApiResponse(
            success=True,
            message="Usuario eliminado correctamente",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

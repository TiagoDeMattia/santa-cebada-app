"""
Middleware de autenticación JWT
"""
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
from pydantic import BaseModel

from ..config import settings


class TokenPayload(BaseModel):
    sub: str  # username
    exp: datetime
    iat: datetime
    role: str = "user"
    nombre: Optional[str] = None  # Nombre del propietario


class JWTBearer(HTTPBearer):
    """
    Security scheme para autenticación JWT
    """

    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> TokenPayload:
        credentials: HTTPAuthorizationCredentials = await super().__call__(request)

        if credentials:
            if not credentials.scheme == "Bearer":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Esquema de autenticación inválido",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            payload = decode_token(credentials.credentials)
            if payload is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token inválido o expirado",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return payload
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No se proporcionaron credenciales",
                headers={"WWW-Authenticate": "Bearer"},
            )


def create_token(
    username: str,
    role: str = "user",
    nombre: Optional[str] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Crea un token JWT para un usuario
    """
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.jwt_expiration_minutes)

    payload = {
        "sub": username,
        "iat": now,
        "exp": expire,
        "role": role,
        "nombre": nombre,
    }

    encoded_jwt = jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return encoded_jwt


def decode_token(token: str) -> Optional[TokenPayload]:
    """
    Decodifica y valida un token JWT
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return TokenPayload(**payload)
    except (JWTError, Exception):
        return None


def verify_token(token: str) -> bool:
    """Verifica si un token es válido"""
    return decode_token(token) is not None


async def get_current_user(token_payload: TokenPayload = Depends(JWTBearer())) -> TokenPayload:
    """
    Dependencia para obtener el usuario actual desde el token
    """
    return token_payload


def require_auth(required_role: Optional[str] = None):
    """
    Decorador para requerir autenticación y opcionalmente un rol específico
    """
    async def dependency(current_user: TokenPayload = Depends(get_current_user)):
        if required_role and current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos suficientes",
            )
        return current_user
    return dependency

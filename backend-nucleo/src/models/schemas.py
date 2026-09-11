"""
Esquemas Pydantic para request/response
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ─── PRODUCTOS ─────────────────────────────────────────────────────────────────

class Producto(BaseModel):
    id: Optional[int] = None
    codigo: str
    nombre: str
    precio: Optional[float] = None
    precio_sin_iva: Optional[float] = None
    alicuota_id: Optional[int] = None
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    activo: bool = True
    company_id: Optional[int] = None

    class Config:
        from_attributes = True


class ProductoCreate(BaseModel):
    codigo: str
    nombre: str
    precio: float
    alicuota_id: Optional[int] = 1
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    company_id: Optional[int] = None


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    precio: Optional[float] = None
    alicuota_id: Optional[int] = None
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    activo: Optional[bool] = None


class PrecioUpdate(BaseModel):
    codigo: str
    precio: float
    sucursal_id: str = "1"


# ─── SUCURSALES ────────────────────────────────────────────────────────────────

class Sucursal(BaseModel):
    id: str
    nombre: str
    company_id: int
    email: str


# ─── ACTUALIZACION DESDE SHEET ─────────────────────────────────────────────────

class ActualizarDesdeSheetRequest(BaseModel):
    sucursal_id: str = "1"
    modo_prueba: bool = False


class ActualizacionResultado(BaseModel):
    exitosos: int
    fallidos: int
    detalles_fallidos: List[Dict[str, Any]] = []
    detalles_exitosos: List[Dict[str, Any]] = []
    total_procesados: int = 0


# ─── AUTH ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserCreate(BaseModel):
    username: str
    nombre: Optional[str] = None  # Nombre del propietario
    password: str
    role: str = "NORMAL"  # ADMIN, NORMAL, o VISOR


class UserUpdate(BaseModel):
    nombre: Optional[str] = None  # Nombre del propietario
    password: Optional[str] = None
    role: Optional[str] = None  # ADMIN, NORMAL, o VISOR


class UserResponse(BaseModel):
    id: int
    username: str
    nombre: Optional[str] = None  # Nombre del propietario
    role: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ─── RESPUESTAS GENERICAS ──────────────────────────────────────────────────────

class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    error: Optional[str] = None

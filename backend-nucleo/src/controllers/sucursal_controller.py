"""
Controlador de sucursales
"""
from fastapi import APIRouter, Depends
from typing import List

from ..models.schemas import Sucursal, ApiResponse
from ..config import settings
from ..middleware.auth import get_current_user, TokenPayload

router = APIRouter(prefix="/sucursales", tags=["Sucursales"])


@router.get("", response_model=List[Sucursal])
async def listar_sucursales(current_user: TokenPayload = Depends(get_current_user)):
    """
    Lista todas las sucursales disponibles
    """
    sucursales = []
    for data in settings.sucursales.values():
        sucursales.append(Sucursal(**data))
    return sucursales


@router.get("/{sucursal_id}", response_model=Sucursal)
async def obtener_sucursal(
    sucursal_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Obtiene detalles de una sucursal por ID
    """
    sucursal = settings.sucursales.get(sucursal_id)
    if not sucursal:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=404,
            detail="Sucursal no encontrada",
        )
    return Sucursal(**sucursal)

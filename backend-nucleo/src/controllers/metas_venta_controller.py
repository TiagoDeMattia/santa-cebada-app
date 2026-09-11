"""FastAPI router — Metas de Venta."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..middleware.auth import get_current_user
from ..services import metas_venta_service as svc

router = APIRouter(prefix="/metas-venta", tags=["metas-venta"])


class MetaIn(BaseModel):
    persona: str
    producto_tipo: str          # 'nucleo' | 'texto'
    producto_nombre: str
    meta_cantidad: float
    fecha_fin: str              # YYYY-MM-DD
    producto_codigo: Optional[str] = None


class MetaUpdate(BaseModel):
    persona: Optional[str] = None
    producto_nombre: Optional[str] = None
    meta_cantidad: Optional[float] = None
    fecha_fin: Optional[str] = None


class AjusteIn(BaseModel):
    delta: float


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/productos-nucleo")
def get_productos_nucleo(current_user=Depends(get_current_user)):
    return svc.get_productos_nucleo()


@router.get("/")
def get_metas(activa: Optional[int] = None, current_user=Depends(get_current_user)):
    return svc.get_metas(activa)


@router.post("/")
def create_meta(body: MetaIn, current_user=Depends(get_current_user)):
    try:
        return svc.create_meta(
            persona=body.persona,
            producto_tipo=body.producto_tipo,
            producto_nombre=body.producto_nombre,
            meta_cantidad=body.meta_cantidad,
            fecha_fin=body.fecha_fin,
            producto_codigo=body.producto_codigo,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{meta_id}")
def update_meta(meta_id: int, body: MetaUpdate, current_user=Depends(get_current_user)):
    updated = svc.update_meta(meta_id, **body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(404, "Meta no encontrada")
    return updated


@router.delete("/{meta_id}")
def delete_meta(meta_id: int, current_user=Depends(get_current_user)):
    if not svc.delete_meta(meta_id):
        raise HTTPException(404, "Meta no encontrada")
    return {"ok": True}


@router.post("/{meta_id}/trackear")
def trackear_meta(meta_id: int, current_user=Depends(get_current_user)):
    updated = svc.actualizar_nucleo_meta(meta_id)
    if not updated:
        raise HTTPException(404, "Meta no encontrada")
    return updated


@router.post("/{meta_id}/ajustar")
def ajustar_meta(meta_id: int, body: AjusteIn, current_user=Depends(get_current_user)):
    updated = svc.ajustar_cantidad_manual(meta_id, body.delta)
    if not updated:
        raise HTTPException(404, "Meta no encontrada")
    return updated


@router.post("/{meta_id}/completar")
def completar_meta(meta_id: int, current_user=Depends(get_current_user)):
    updated = svc.completar_meta(meta_id)
    if not updated:
        raise HTTPException(404, "Meta no encontrada")
    return updated


@router.post("/trackear-todas")
def trackear_todas(current_user=Depends(get_current_user)):
    return svc.trackear_todas_nucleo()

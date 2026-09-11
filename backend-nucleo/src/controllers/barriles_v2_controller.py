"""FastAPI router — Barriles V2."""
import asyncio
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field

from ..middleware.auth import get_current_user, TokenPayload
from ..services import barriles_v2_service as svc

logger = logging.getLogger(__name__)


def _update_nucleo_canilla_bg(canilla_num: str, estilo: str):
    """Fire-and-forget: actualiza nombre de producto en NucleoCheck al pinchar."""
    try:
        from ..services.nucleo_canilla_service import actualizar_nombre_canilla
        result = actualizar_nombre_canilla(canilla_num, estilo)
        if result.get("ok"):
            logger.info(f"[bv2] NucleoCheck canilla {canilla_num} → {estilo}")
        else:
            logger.warning(f"[bv2] NucleoCheck canilla {canilla_num} con errores: {result}")
    except Exception as e:
        logger.error(f"[bv2] Error actualizando NucleoCheck canilla {canilla_num}: {e}")

router = APIRouter(prefix="/barriles-v2", tags=["barriles-v2"])


def _username(current_user: TokenPayload = Depends(get_current_user)) -> Optional[str]:
    return current_user.sub if current_user else None


# ─── Proveedores ─────────────────────────────────────────────────────────────

class ProveedorIn(BaseModel):
    nombre: str


class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[int] = None


@router.get("/proveedores")
def get_proveedores(include_inactive: bool = False,
                    current_user=Depends(get_current_user)):
    return svc.get_proveedores(include_inactive)


@router.post("/proveedores")
def create_proveedor(body: ProveedorIn, current_user=Depends(get_current_user)):
    try:
        return svc.create_proveedor(body.nombre)
    except Exception as e:
        msg = str(e)
        if "UNIQUE" in msg or "unique" in msg:
            raise HTTPException(status_code=409, detail="Ya existe un proveedor con ese nombre")
        raise HTTPException(status_code=400, detail=msg)


@router.patch("/proveedores/{proveedor_id}")
def update_proveedor(proveedor_id: int, body: ProveedorUpdate,
                     current_user=Depends(get_current_user)):
    try:
        updated = svc.update_proveedor(proveedor_id, **body.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        msg = str(e)
        if "UNIQUE" in msg or "unique" in msg:
            raise HTTPException(status_code=409, detail="Ya existe un proveedor con ese nombre")
        raise HTTPException(status_code=400, detail=msg)
    if not updated:
        raise HTTPException(404, "Proveedor no encontrado")
    return updated


# ─── Birras ──────────────────────────────────────────────────────────────────

class BirraIn(BaseModel):
    estilo: str
    proveedor_id: int
    tipo: str = 'B'
    abv: str = ''
    amargor: str = ''
    descripcion: str = ''
    palabras_destacar: str = ''


class BirraUpdate(BaseModel):
    estilo: Optional[str] = None
    proveedor_id: Optional[int] = None
    tipo: Optional[str] = None
    abv: Optional[str] = None
    amargor: Optional[str] = None
    descripcion: Optional[str] = None
    palabras_destacar: Optional[str] = None
    activo: Optional[int] = None


@router.get("/birras")
def get_birras(include_inactive: bool = False,
               current_user=Depends(get_current_user)):
    return svc.get_birras(include_inactive)


@router.post("/birras")
def create_birra(body: BirraIn, current_user=Depends(get_current_user)):
    try:
        return svc.create_birra(**body.model_dump())
    except Exception as e:
        msg = str(e)
        if "UNIQUE" in msg or "unique" in msg:
            raise HTTPException(status_code=409, detail="Ya existe una birra con ese nombre para este proveedor")
        raise HTTPException(status_code=400, detail=msg)


@router.patch("/birras/{birra_id}")
def update_birra(birra_id: int, body: BirraUpdate,
                 current_user=Depends(get_current_user)):
    try:
        updated = svc.update_birra(birra_id, **body.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        msg = str(e)
        if "UNIQUE" in msg or "unique" in msg:
            raise HTTPException(status_code=409, detail="Ya existe una birra con ese nombre para este proveedor")
        raise HTTPException(status_code=400, detail=msg)
    if not updated:
        raise HTTPException(404, "Birra no encontrada")
    return updated


# ─── Personal ────────────────────────────────────────────────────────────────

class PersonalIn(BaseModel):
    nombre: str


class PersonalUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[int] = None


@router.get("/personal")
def get_personal(include_inactive: bool = False,
                 current_user=Depends(get_current_user)):
    return svc.get_personal_full(include_inactive)


@router.post("/personal")
def create_personal(body: PersonalIn, current_user=Depends(get_current_user)):
    try:
        return svc.create_personal(body.nombre)
    except Exception as e:
        raise HTTPException(400, str(e))


@router.patch("/personal/{personal_id}")
def update_personal(personal_id: int, body: PersonalUpdate,
                    current_user=Depends(get_current_user)):
    updated = svc.update_personal(personal_id, **body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(404, "Personal no encontrado")
    return updated


# ─── Precios ─────────────────────────────────────────────────────────────────

class PrecioIn(BaseModel):
    tipo: str
    precio_normal: int = 0
    precio_hora_santa: int = 0


@router.get("/precios")
def get_precios(current_user=Depends(get_current_user)):
    return svc.get_precios()


@router.put("/precios")
def upsert_precio(body: PrecioIn, current_user=Depends(get_current_user)):
    return svc.upsert_precio(body.tipo, body.precio_normal, body.precio_hora_santa)


@router.post("/precios/sync")
def sync_precios(current_user=Depends(get_current_user)):
    try:
        return svc.sync_precios_from_sheets()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sincronizando precios: {e}")


# ─── Barriles ────────────────────────────────────────────────────────────────

class BarrilIn(BaseModel):
    birra_id: int
    litros: int = 50
    codigo: str = ''
    ingreso_at: Optional[str] = None
    nota: str = ''


class BarrilUpdate(BaseModel):
    litros: Optional[int] = None
    codigo: Optional[str] = None
    canilla: Optional[Any] = None          # int | None | "" → handled in service
    ingreso_at: Optional[str] = None
    fecha_pinchado: Optional[str] = None
    nombre_pincho: Optional[str] = None
    turno_pinchado: Optional[str] = None
    fecha_despinchado: Optional[str] = None
    nombre_despincho: Optional[str] = None
    turno_despinchado: Optional[str] = None
    fecha_retirado: Optional[str] = None
    nota: Optional[str] = None


@router.get("/barriles")
def get_barriles(filtro: Optional[str] = None,
                 current_user=Depends(get_current_user)):
    return svc.get_barriles(filtro)


@router.get("/barriles/{barril_id}")
def get_barril(barril_id: int, current_user=Depends(get_current_user)):
    b = svc.get_barril(barril_id)
    if not b:
        raise HTTPException(404, "Barril no encontrado")
    return b


@router.post("/barriles")
def create_barril(body: BarrilIn, current_user=Depends(get_current_user)):
    try:
        usuario = current_user.sub if current_user else None
        return svc.create_barril(
            birra_id=body.birra_id, litros=body.litros,
            codigo=body.codigo, ingreso_at=body.ingreso_at,
            nota=body.nota, usuario=usuario,
        )
    except Exception as e:
        raise HTTPException(400, str(e))


@router.patch("/barriles/{barril_id}")
async def update_barril(barril_id: int, body: BarrilUpdate,
                        current_user=Depends(get_current_user)):
    usuario = current_user.sub if current_user else None
    kwargs = body.model_dump(exclude_unset=True)
    updated = svc.update_barril(barril_id, usuario=usuario, **kwargs)
    if not updated:
        raise HTTPException(404, "Barril no encontrado")

    # Actualizar nombre en NucleoCheck al pinchar (fire-and-forget)
    canilla_num = str(body.canilla or '').strip()
    estilo_val  = (updated.get('estilo') or '').strip()
    if body.fecha_pinchado and canilla_num and estilo_val:
        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, _update_nucleo_canilla_bg, canilla_num, estilo_val)

    return updated


@router.delete("/barriles/{barril_id}")
def delete_barril(barril_id: int, current_user=Depends(get_current_user)):
    usuario = current_user.sub if current_user else None
    svc.delete_barril(barril_id, usuario)
    return {"success": True}


# ─── Auditoría ────────────────────────────────────────────────────────────────

@router.get("/audit")
def get_audit(limit: int = 500, barril_id: Optional[int] = None,
              current_user=Depends(get_current_user)):
    return svc.get_audit(limit=limit, barril_id=barril_id)


# ─── Visor ───────────────────────────────────────────────────────────────────

@router.get("/visor")
def get_visor_barriles(current_user=Depends(get_current_user)):
    return svc.get_visor_barriles()


@router.get("/visor2")
def get_visor2(current_user=Depends(get_current_user)):
    return svc.get_visor2()


class GrupoIn(BaseModel):
    id: str
    nombre: str
    horario: str = ''
    orden: int = 0


class ItemIn(BaseModel):
    grupo_id: str
    nombre: str
    precio: str = ''
    orden: int = 0
    item_id: Optional[int] = None


class MenuItemIn(BaseModel):
    item_id: Optional[int] = None
    label: str
    value: str = ''
    orden: int = 0


@router.put("/visor/grupo")
def upsert_grupo(body: GrupoIn, current_user=Depends(get_current_user)):
    return svc.upsert_visor_grupo(body.id, body.nombre, body.horario, body.orden)


@router.put("/visor/item")
def upsert_item(body: ItemIn, current_user=Depends(get_current_user)):
    return svc.upsert_visor_item(
        body.grupo_id, body.nombre, body.precio, body.orden, body.item_id
    )


@router.delete("/visor/item/{item_id}")
def delete_item(item_id: int, current_user=Depends(get_current_user)):
    svc.delete_visor_item(item_id)
    return {"success": True}


@router.put("/visor2/menu")
def upsert_menu(body: MenuItemIn, current_user=Depends(get_current_user)):
    return svc.upsert_menu_ejecutivo_item(
        body.item_id, body.label, body.value, body.orden
    )


@router.delete("/visor2/menu/{item_id}")
def delete_menu(item_id: int, current_user=Depends(get_current_user)):
    svc.delete_menu_ejecutivo_item(item_id)
    return {"success": True}


# ─── Migración ───────────────────────────────────────────────────────────────

@router.post("/migrar")
def migrar(current_user=Depends(get_current_user)):
    usuario = current_user.sub if current_user else None
    return svc.migrar_desde_sheets(usuario)


# ─── Info general ─────────────────────────────────────────────────────────────

@router.get("/info")
def get_info(current_user=Depends(get_current_user)):
    return {
        "max_canillas": svc.MAX_CANILLAS,
        "turnos": svc.TURNOS,
        "estados": svc.ESTADOS,
    }

"""FastAPI router — Voucher (beneficio mensual empleados)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..middleware.auth import get_current_user
from ..services import voucher_service as svc

router = APIRouter(prefix="/voucher", tags=["voucher"])


# ── Models ────────────────────────────────────────────────────────────────────

class EmpleadoIn(BaseModel):
    nombre: str
    apellido: str


class EmpleadoUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    activo: Optional[int] = None


class EntradaIn(BaseModel):
    periodo: str
    producto_nombre: str
    producto_precio: int
    cantidad: int = 1
    tipo: str = "consumo"  # consumo | descuento
    fecha: Optional[str] = None  # YYYY-MM-DD, defaults to today in service


class PresupuestoUpdate(BaseModel):
    periodo: str
    extra: Optional[int] = None


class ConfigPresupuestoIn(BaseModel):
    presupuesto: int


# ── Config global ─────────────────────────────────────────────────────────────

@router.get("/config/presupuesto")
def get_config_presupuesto(current_user=Depends(get_current_user)):
    return {"presupuesto_base": svc.get_config_presupuesto()}


@router.put("/config/presupuesto")
def set_config_presupuesto(body: ConfigPresupuestoIn, current_user=Depends(get_current_user)):
    val = svc.set_config_presupuesto(body.presupuesto)
    return {"presupuesto_base": val}


# ── Empleados ─────────────────────────────────────────────────────────────────

@router.get("/empleados")
def get_empleados(
    include_inactive: bool = True,
    current_user=Depends(get_current_user),
):
    return svc.get_empleados(include_inactive)


@router.post("/empleados")
def create_empleado(body: EmpleadoIn, current_user=Depends(get_current_user)):
    try:
        return svc.create_empleado(body.nombre, body.apellido)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/empleados/{empleado_id}")
def update_empleado(
    empleado_id: int,
    body: EmpleadoUpdate,
    current_user=Depends(get_current_user),
):
    updated = svc.update_empleado(empleado_id, **body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(404, "Empleado no encontrado")
    return updated


# ── Productos del catálogo ────────────────────────────────────────────────────

@router.get("/productos")
def get_productos(q: Optional[str] = None, current_user=Depends(get_current_user)):
    return svc.get_productos_catalogo(q)


class ProductoHabilitadoIn(BaseModel):
    habilitado: bool


@router.get("/productos/config")
def get_productos_config(current_user=Depends(get_current_user)):
    return svc.get_productos_config()


@router.patch("/productos/{codigo}/habilitado")
def set_producto_habilitado(
    codigo: str,
    body: ProductoHabilitadoIn,
    current_user=Depends(get_current_user),
):
    return svc.set_producto_habilitado(codigo, body.habilitado)


# ── Rubros ────────────────────────────────────────────────────────────────────

class RubroHabilitadoIn(BaseModel):
    habilitado: bool


@router.get("/rubros/config")
def get_rubros_config(current_user=Depends(get_current_user)):
    return svc.get_rubros_config()


@router.patch("/rubros/{rubro}/habilitado")
def set_rubro_habilitado(
    rubro: str,
    body: RubroHabilitadoIn,
    current_user=Depends(get_current_user),
):
    return svc.set_rubro_habilitado(rubro, body.habilitado)


# ── Presupuesto (extra individual) ───────────────────────────────────────────

@router.get("/presupuesto/{empleado_id}")
def get_presupuesto(
    empleado_id: int,
    periodo: str,
    current_user=Depends(get_current_user),
):
    if not svc.get_empleado(empleado_id):
        raise HTTPException(404, "Empleado no encontrado")
    return svc.get_presupuesto(empleado_id, periodo)


@router.put("/presupuesto/{empleado_id}")
def update_presupuesto(
    empleado_id: int,
    body: PresupuestoUpdate,
    current_user=Depends(get_current_user),
):
    if not svc.get_empleado(empleado_id):
        raise HTTPException(404, "Empleado no encontrado")
    return svc.update_presupuesto(empleado_id, body.periodo, extra=body.extra)


# ── Entradas ──────────────────────────────────────────────────────────────────

@router.get("/entradas")
def get_entradas_periodo(periodo: str, current_user=Depends(get_current_user)):
    """Todas las entradas del período (todos los empleados)."""
    return svc.get_entradas_periodo(periodo)


@router.get("/entradas/{empleado_id}")
def get_entradas(
    empleado_id: int,
    periodo: str,
    current_user=Depends(get_current_user),
):
    if not svc.get_empleado(empleado_id):
        raise HTTPException(404, "Empleado no encontrado")
    return svc.get_entradas(empleado_id, periodo)


@router.post("/entradas/{empleado_id}")
def add_entrada(
    empleado_id: int,
    body: EntradaIn,
    current_user=Depends(get_current_user),
):
    if not svc.get_empleado(empleado_id):
        raise HTTPException(404, "Empleado no encontrado")
    try:
        return svc.add_entrada(
            empleado_id,
            body.periodo,
            body.producto_nombre,
            body.producto_precio,
            body.cantidad,
            body.tipo,
            body.fecha,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/entradas/{entrada_id}")
def delete_entrada(entrada_id: int, current_user=Depends(get_current_user)):
    if not svc.delete_entrada(entrada_id):
        raise HTTPException(404, "Entrada no encontrada")
    return {"ok": True}


# ── Resumen ───────────────────────────────────────────────────────────────────

@router.get("/resumen")
def get_resumen_periodo(periodo: str, current_user=Depends(get_current_user)):
    return svc.get_resumen_periodo(periodo)


@router.get("/resumen/{empleado_id}")
def get_resumen_empleado(
    empleado_id: int,
    periodo: str,
    current_user=Depends(get_current_user),
):
    if not svc.get_empleado(empleado_id):
        raise HTTPException(404, "Empleado no encontrado")
    return svc.get_resumen_empleado(empleado_id, periodo)

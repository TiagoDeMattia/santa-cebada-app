from fastapi import APIRouter, Body
from ..services import alertas_service as svc

router = APIRouter(prefix="/panel-alertas", tags=["panel-alertas"])


@router.get("")
def get_alertas():
    return svc.get_alertas()


@router.post("/priorizar/{producto_id}")
def set_priorizado(producto_id: int, body: dict = Body(...)):
    return svc.set_priorizado(producto_id, bool(body.get("priorizado")), body.get("updated_by"))


@router.post("/priorizar/nucleo/{codigo}")
def set_priorizado_nucleo(codigo: str, body: dict = Body(...)):
    return svc.set_priorizado_nucleo(
        codigo,
        body.get("nombre", ""),
        bool(body.get("priorizado")),
        body.get("updated_by"),
    )


@router.post("/nucleo/{codigo}")
def set_alerta_nucleo(codigo: str, body: dict = Body(...)):
    return svc.set_alerta_nucleo(
        codigo,
        body.get("nombre", ""),
        body.get("tipo"),
        body.get("updated_by"),
        body.get("nota"),
    )


@router.post("/{producto_id}")
def set_alerta(producto_id: int, body: dict = Body(...)):
    return svc.set_alerta(producto_id, body.get("tipo"), body.get("updated_by"), body.get("nota"))

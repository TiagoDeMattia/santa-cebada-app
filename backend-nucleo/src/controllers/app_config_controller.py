from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..middleware.auth import get_current_user
from ..services.database import get_app_config, set_app_config

router = APIRouter(prefix="/app-config", tags=["app-config"])

DEFAULTS = {
    "vales_objetivo_pct": "15.0",
}


class ConfigValue(BaseModel):
    value: float


@router.get("/vales-objetivo-pct")
def get_vales_objetivo_pct(_=Depends(get_current_user)):
    val = get_app_config("vales_objetivo_pct", DEFAULTS["vales_objetivo_pct"])
    return {"key": "vales_objetivo_pct", "value": float(val)}


@router.put("/vales-objetivo-pct")
def update_vales_objetivo_pct(body: ConfigValue, _=Depends(get_current_user)):
    if not (1 <= body.value <= 100):
        raise HTTPException(status_code=400, detail="El porcentaje debe estar entre 1 y 100")
    set_app_config("vales_objetivo_pct", str(body.value))
    return {"key": "vales_objetivo_pct", "value": body.value}

"""
Endpoint público para widgets de iPhone. Auth via ?key= en lugar de JWT.
"""
from fastapi import APIRouter, HTTPException, Query
from ..config.settings import settings
from ..services.widget_service import get_widgets_data

router = APIRouter(prefix="/widgets", tags=["widgets"])


@router.get("/data")
def widget_data(key: str = Query(...), location: str = Query("recoleta")):
    if key != settings.widget_api_key:
        raise HTTPException(status_code=401, detail="API key inválida")
    try:
        return get_widgets_data(location)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

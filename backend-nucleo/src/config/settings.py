"""
Configuración centralizada del backend
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Dict
import os
from pathlib import Path

# Directorio raíz del backend (donde está main.py y credentials.json)
_BACKEND_ROOT = Path(__file__).parent.parent.parent


class Settings(BaseSettings):
    # NucleoCheck
    nucleo_password: str = "13502"
    nucleo_api_base: str = "https://api-prod.nucleocheck.com"
    nucleo_url: str = "https://prod.nucleocheck.com"

    # Sucursales
    sucursal_recoleta_email: str = "tdemattia@santacebada.com.ar"
    sucursal_recoleta_company_id: int = 1041

    # Google Sheets
    sheet_id: str = "1P04HAcUGN4tE-wgyMCIe7rNsTa5qIbckL8fMW7meTzk"
    sheet_name: str = "Lista consolidada"
    credentials_json_path: str = str(_BACKEND_ROOT / "credentials.json")

    @field_validator("credentials_json_path")
    @classmethod
    def resolve_creds_path(cls, v: str) -> str:
        p = Path(v)
        return str(p if p.is_absolute() else _BACKEND_ROOT / v)

    # Widget API key (usado por Scriptable en iPhone, sin JWT)
    widget_api_key: str = "santa-widget-sc2025"

    # Telegram notifications (Panel 85 & 86)
    telegram_bot_token: str = ""
    telegram_chat_ids: str = ""

    # Groq API (Asistente IA carta)
    groq_api_key: str = ""

    # JWT
    jwt_secret: str = "cambia_esto_en_produccion"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    @property
    def sucursales(self) -> Dict[str, Dict]:
        return {
            "1": {
                "id": "1",
                "nombre": "Recoleta",
                "company_id": self.sucursal_recoleta_company_id,
                "email": self.sucursal_recoleta_email,
            },
        }

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

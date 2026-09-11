"""
Servicio para lectura de Google Sheets
"""
import gspread
from google.oauth2.service_account import Credentials
from gspread.utils import ValueRenderOption
from typing import List, Dict
from pathlib import Path

from ..config import settings
from ..utils.logger import logger
from ..utils.helpers import normalizar_precio, normalizar_codigo


class SheetService:
    """
    Servicio para leer productos desde Google Sheets
    """

    def __init__(self):
        self.sheet_id = settings.sheet_id
        self.sheet_name = settings.sheet_name
        self.credentials_path = settings.credentials_json_path
        self._gc: gspread.Client = None

    def _get_client(self) -> gspread.Client:
        """
        Obtiene cliente autorizado de Google Sheets
        """
        if self._gc is None:
            scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
            creds = Credentials.from_service_account_file(
                self.credentials_path,
                scopes=scopes
            )
            self._gc = gspread.authorize(creds)
        return self._gc

    def leer_productos(self) -> List[Dict]:
        """
        Lee productos del Sheet
        Columnas esperadas (0-indexed):
        - Col E (index 4): Código
        - Col G (index 6): Precio
        """
        gc = self._get_client()
        sheet = gc.open_by_key(self.sheet_id).worksheet(self.sheet_name)
        rows = sheet.get_all_values(value_render_option=ValueRenderOption.formatted)

        productos = []
        for row in rows[1:]:  # Saltar header
            try:
                codigo_raw = row[4] if len(row) > 4 else ""
                precio_raw = row[6] if len(row) > 6 else ""

                if not codigo_raw.strip() or not precio_raw.strip():
                    continue

                codigo = normalizar_codigo(codigo_raw)
                precio = normalizar_precio(precio_raw)

                productos.append({
                    "codigo": codigo,
                    "precio": precio,
                })
            except (ValueError, IndexError) as e:
                logger.warning(f"Fila inválida: {e}")
                continue

        logger.info(f"{len(productos)} productos leídos del Sheet")
        return productos

    def leer_grupos(self) -> List[Dict]:
        """
        Lee grupos de productos del Sheet
        Columnas esperadas:
        - Col I (index 8): Código grupo
        - Col J (index 9): Nombre grupo
        - Col K (index 10): Código producto grupo
        - Col L (index 11): Nombre producto grupo
        - Col M (index 12): Precio grupo
        """
        gc = self._get_client()
        sheet = gc.open_by_key(self.sheet_id).worksheet(self.sheet_name)
        rows = sheet.get_all_values(value_render_option=ValueRenderOption.formatted)

        grupos = []
        for row in rows[1:]:
            try:
                codigo_grupo = row[8] if len(row) > 8 else ""
                nombre_grupo = row[9] if len(row) > 9 else ""
                codigo_producto = row[10] if len(row) > 10 else ""
                nombre_producto = row[11] if len(row) > 11 else ""
                precio_grupo_raw = row[12] if len(row) > 12 else ""

                if not codigo_grupo.strip():
                    continue

                precio_grupo = None
                if precio_grupo_raw.strip():
                    precio_grupo = normalizar_precio(precio_grupo_raw)

                grupos.append({
                    "codigo_grupo": normalizar_codigo(codigo_grupo),
                    "nombre_grupo": nombre_grupo.strip(),
                    "codigo_producto": normalizar_codigo(codigo_producto) if codigo_producto.strip() else None,
                    "nombre_producto": nombre_producto.strip() if nombre_producto.strip() else None,
                    "precio_grupo": precio_grupo,
                })
            except (ValueError, IndexError) as e:
                logger.warning(f"Fila de grupo inválida: {e}")
                continue

        logger.info(f"{len(grupos)} grupos leídos del Sheet")
        return grupos

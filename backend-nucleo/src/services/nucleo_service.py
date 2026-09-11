"""
Servicio para comunicación con API de NucleoCheck
"""
import asyncio
import re
import requests
from typing import Dict, List, Optional, Any

from ..config import settings
from ..utils.logger import logger
from ..utils.helpers import normalizar_codigo, obtener_tasa_iva, calcular_precio_sin_iva


class NucleoService:
    """
    Servicio para interactuar con la API de NucleoCheck
    Maneja autenticación via JWT y todas las operaciones con productos
    """

    def __init__(self):
        self.api_base = settings.nucleo_api_base
        self.nucleo_url = settings.nucleo_url
        self._session: Optional[requests.Session] = None
        self._jwt_cache: Dict[str, str] = {}

    # ─── AUTENTICACIÓN ───────────────────────────────────────────────────────────

    async def obtener_jwt(self, sucursal_id: str, headless: bool = True) -> str:
        """
        Obtiene JWT haciendo login automático en NucleoCheck.
        Corre Playwright en un thread separado para compatibilidad con Windows/uvicorn.
        """
        import concurrent.futures
        import asyncio

        loop = asyncio.get_running_loop()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            token = await loop.run_in_executor(
                pool,
                lambda: self._obtener_jwt_sync(sucursal_id, headless)
            )
        return token

    def _obtener_jwt_sync(self, sucursal_id: str, headless: bool = True) -> str:
        """Versión síncrona del login con Playwright (corre en thread)."""
        from playwright.sync_api import sync_playwright

        sucursal = settings.sucursales.get(sucursal_id)
        if not sucursal:
            raise ValueError(f"Sucursal {sucursal_id} no encontrada")

        email = sucursal.get("email", "").strip()
        if not email or email.startswith("COMPLETAR_"):
            raise ValueError(
                f"Completá el email de {sucursal['nombre']} en la configuración"
            )

        logger.info(f"Obteniendo JWT para sucursal: {sucursal['nombre']}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=headless)
            context = browser.new_context()
            page = context.new_page()

            try:
                page.goto(f"{self.nucleo_url}/login")
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(2000)

                email_selectors = [
                    'input[type="email"]',
                    'input[name="email"]',
                    'input[formcontrolname="email"]',
                    'input[formcontrolname="EmailUser"]',
                    'input[formcontrolname="username"]',
                    'input[type="text"]',
                ]
                email_input = None
                for sel in email_selectors:
                    try:
                        loc = page.locator(sel).first
                        if loc.is_visible(timeout=1500):
                            email_input = loc
                            break
                    except Exception:
                        continue

                if email_input is None:
                    raise Exception("No se encontró el campo de email en el login")

                email_input.fill(email)

                pwd_input = page.locator('input[type="password"]').first
                pwd_input.wait_for(timeout=5000)
                pwd_input.fill(settings.nucleo_password)

                submit_selectors = [
                    'button[type="submit"]',
                    'button:has-text("Ingresar")',
                    'button:has-text("Login")',
                    'button:has-text("Iniciar")',
                    'input[type="submit"]',
                ]
                for sel in submit_selectors:
                    try:
                        btn = page.locator(sel).first
                        if btn.is_visible(timeout=1000):
                            btn.click()
                            break
                    except Exception:
                        continue

                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(3000)

                try:
                    modal = page.locator('.modal button, button:has-text("Cerrar")').first
                    if modal.is_visible(timeout=2000):
                        modal.click()
                        page.wait_for_timeout(500)
                except Exception:
                    pass

                jwt_token = page.evaluate("""() => {
                    const stores = [localStorage, sessionStorage];
                    for (const store of stores) {
                        for (let i = 0; i < store.length; i++) {
                            const key = store.key(i);
                            const val = store.getItem(key);
                            if (val && val.startsWith('eyJ')) return val;
                            try {
                                const parsed = JSON.parse(val);
                                if (typeof parsed === 'string' && parsed.startsWith('eyJ')) return parsed;
                                if (parsed && typeof parsed === 'object') {
                                    for (const innerValue of Object.values(parsed)) {
                                        if (typeof innerValue === 'string' && innerValue.startsWith('eyJ')) {
                                            return innerValue;
                                        }
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                    return null;
                }""")

                if not jwt_token:
                    raise Exception("No se pudo obtener el JWT del browser")

                logger.info("JWT obtenido exitosamente")
                self._jwt_cache[sucursal_id] = jwt_token
                return jwt_token

            finally:
                browser.close()

    def crear_sesion(self, jwt_token: str) -> requests.Session:
        """
        Crea una sesión HTTP con headers de autenticación
        """
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {jwt_token}",
            "Content-Type": "application/json",
            "Origin": self.nucleo_url,
            "Referer": f"{self.nucleo_url}/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        })
        self._session = session
        return session

    async def get_session(self, sucursal_id: str, headless: bool = True) -> requests.Session:
        """
        Obtiene sesión válida para una sucursal
        """
        if sucursal_id in self._jwt_cache:
            jwt_token = self._jwt_cache[sucursal_id]
        else:
            jwt_token = await self.obtener_jwt(sucursal_id, headless=headless)

        return self.crear_sesion(jwt_token)

    # ─── PRODUCTOS ───────────────────────────────────────────────────────────────

    def obtener_indice_productos(self, session: requests.Session) -> Dict[str, int]:
        """
        Obtiene índice de productos por código
        Retorna dict: {codigo: id_interno}
        """
        indice = {}
        aliases = {}
        page_number = 1
        page_size = 100
        total_pages = 1

        while page_number <= total_pages:
            r = session.get(f"{self.api_base}/Product/FindPaged/", params={
                "Code": "",
                "Name": "",
                "IsCommensal": "false",
                "PageNumber": page_number,
                "PageSize": page_size,
                "SortOrder": ""
            })
            r.raise_for_status()
            data = r.json()
            total_pages = data.get("TotalPages", 1)

            for producto in data.get("Data", []):
                codigo = str(producto.get("Code", "")).strip()
                if not codigo:
                    continue

                indice.setdefault(codigo, producto["Id"])

                codigo_upper = codigo.upper()
                if codigo_upper in aliases and aliases[codigo_upper] != producto["Id"]:
                    aliases[codigo_upper] = None
                else:
                    aliases[codigo_upper] = producto["Id"]

            page_number += 1

        for codigo_upper, product_id in aliases.items():
            if product_id is not None and codigo_upper not in indice:
                indice[codigo_upper] = product_id

        return indice

    def obtener_producto(self, session: requests.Session, id_interno: int) -> Dict:
        """
        Obtiene datos completos de un producto
        """
        r = session.get(f"{self.api_base}/Product/FindById/{id_interno}")
        r.raise_for_status()
        return r.json()

    def actualizar_precio(
        self,
        session: requests.Session,
        codigo: str,
        precio_nuevo: float,
        indice_productos: Dict[str, int]
    ) -> Dict[str, Any]:
        """
        Actualiza el precio de un producto
        Retorna dict con resultado de la operación
        """
        codigo = normalizar_codigo(codigo)
        precio_nuevo = float(precio_nuevo)

        id_interno = indice_productos.get(codigo)
        if id_interno is None:
            id_interno = indice_productos.get(codigo.upper())

        if id_interno is None:
            return {"success": False, "error": f"Código {codigo} no encontrado"}

        try:
            producto = self.obtener_producto(session, id_interno)

            alicuota = producto.get("AlicuotaId")
            tasas = {1: 1.21, 2: 1.105, 3: 1.0}
            tasa = tasas.get(alicuota, 1.21)
            precio_sin_iva = round(precio_nuevo / tasa, 5)

            if producto.get("PriceListProducts"):
                producto["PriceListProducts"][0]["Price"] = precio_nuevo
                producto["PriceListProducts"][0]["PriceNoTax"] = precio_sin_iva
            else:
                return {"success": False, "error": f"Producto {codigo} no tiene PriceListProducts"}

            r = session.post(f"{self.api_base}/Product/SaveProduct", json=producto)
            r.raise_for_status()
            resp = r.json()

            if resp.get("Product"):
                logger.info(f"Precio actualizado: {codigo} → ${precio_nuevo:,.0f}")
                return {
                    "success": True,
                    "codigo": codigo,
                    "precio_anterior": producto["PriceListProducts"][0].get("Price"),
                    "precio_nuevo": precio_nuevo,
                }
            else:
                return {"success": False, "error": f"Error guardando: {resp}"}

        except Exception as e:
            logger.error(f"Error actualizando {codigo}: {e}")
            return {"success": False, "error": str(e)}

    # ─── CONSULTAS GENERALES ─────────────────────────────────────────────────────

    def obtener_todos_productos(
        self,
        session: requests.Session,
        page_size: int = 100
    ) -> List[Dict]:
        """
        Obtiene todos los productos paginados
        """
        productos = []
        page_number = 1
        total_pages = 1

        while page_number <= total_pages:
            r = session.get(f"{self.api_base}/Product/FindPaged/", params={
                "Code": "",
                "Name": "",
                "IsCommensal": "false",
                "PageNumber": page_number,
                "PageSize": page_size,
                "SortOrder": ""
            })
            r.raise_for_status()
            data = r.json()
            total_pages = data.get("TotalPages", 1)
            productos.extend(data.get("Data", []))
            page_number += 1

        return productos

    def obtener_producto_por_id(
        self,
        session: requests.Session,
        producto_id: int
    ) -> Optional[Dict]:
        """
        Obtiene un producto por su ID interno
        """
        try:
            r = session.get(f"{self.api_base}/Product/FindById/{producto_id}")
            r.raise_for_status()
            return r.json()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                return None
            raise

    def buscar_productos(
        self,
        session: requests.Session,
        codigo: Optional[str] = None,
        nombre: Optional[str] = None,
        page_size: int = 100
    ) -> List[Dict]:
        """
        Busca productos por código o nombre
        """
        r = session.get(f"{self.api_base}/Product/FindPaged/", params={
            "Code": codigo or "",
            "Name": nombre or "",
            "IsCommensal": "false",
            "PageNumber": 1,
            "PageSize": page_size,
            "SortOrder": ""
        })
        r.raise_for_status()
        data = r.json()
        return data.get("Data", [])
    
    def obtener_ventas_por_producto(
        self,
        session: requests.Session,
        fecha_inicio: str,
        fecha_fin: str
    ) -> List[Dict]:
        """
        Obtiene ventas por producto en un rango de fechas.
        
        Args:
            session: Sesión autenticada
            fecha_inicio: Fecha inicio en formato ISO (YYYY-MM-DDTHH:MM:SS)
            fecha_fin: Fecha fin en formato ISO (YYYY-MM-DDTHH:MM:SS)
        
        Returns:
            Lista de productos vendidos con cantidad
        """
        r = session.get(f"{self.api_base}/Stats/GetSalesByProductStats/", params={
            "StartDate": fecha_inicio,
            "EndDate": fecha_fin,
            "UseTimeRange": "false",
            "DateGrouping": 0,
            "OnlyProductsSendUnitAlax": "false",
            "IsBreakDownPromotions": "false",
        })
        r.raise_for_status()
        data = r.json()
        
        # Retornar lista de productos con sus ventas
        productos_vendidos = []
        for item in data.get("Items", []):
            productos_vendidos.append({
                "producto_id": item.get("ProductId"),
                "producto_codigo": item.get("ProductCode", ""),
                "producto_nombre": item.get("ProductName", ""),
                "cantidad_vendida": item.get("Quantity", 0),
                "total_venta": item.get("Total", 0),
            })
        
        return productos_vendidos

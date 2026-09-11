"""
actualizar_precios.py
─────────────────────
Login via Playwright (solo para obtener el JWT),
luego todo via API con requests. Sin browser para los productos.
"""

import asyncio
import re
import requests
import gspread
from google.oauth2.service_account import Credentials
from gspread.utils import ValueRenderOption
from playwright.async_api import async_playwright

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

NUCLEO_PASSWORD  = "13502"
API_BASE         = "https://api-prod.nucleocheck.com"
NUCLEO_URL       = "https://prod.nucleocheck.com"

SUCURSALES = {
    "1": {
        "nombre": "Recoleta",
        "company_id": 1041,
        "email": "tdemattia@santacebada.com.ar",
    },
    "2": {
        "nombre": "Palermo",
        "company_id": 827,
        "email": "tiagolautarodemattia@hotmail.com",
    },
}

SHEET_ID         = "1P04HAcUGN4tE-wgyMCIe7rNsTa5qIbckL8fMW7meTzk"
SHEET_NAME       = "Lista consolidada"
CREDENTIALS_JSON = "credentials.json"

COL_CODIGO  = 4
COL_PRECIO  = 6
FILA_INICIO = 1

# True  → procesa solo el PRIMER producto
# False → procesa TODOS
MODO_PRUEBA = False

def normalizar_precio(valor):
    texto = str(valor).strip()
    texto = texto.replace("$", "").replace(" ", "")
    texto = re.sub(r"[^\d,.-]", "", texto)

    if not texto:
        raise ValueError("Precio vacio")

    if "," in texto and "." in texto:
        if texto.rfind(",") > texto.rfind("."):
            texto = texto.replace(".", "").replace(",", ".")
        else:
            texto = texto.replace(",", "")
    elif "," in texto:
        partes = texto.split(",")
        if len(partes) == 2 and len(partes[1]) in (1, 2):
            texto = texto.replace(".", "").replace(",", ".")
        else:
            texto = texto.replace(",", "")
    elif "." in texto:
        partes = texto.split(".")
        # Si termina en 3 digitos, asumimos separador de miles: 14.500 -> 14500
        if not (len(partes) == 2 and len(partes[1]) in (1, 2)):
            texto = texto.replace(".", "")

    return float(texto)

def normalizar_codigo(valor):
    codigo = str(valor).strip()
    if not codigo:
        raise ValueError("Codigo vacio")
    return codigo

# ─── OBTENER JWT VIA PLAYWRIGHT ───────────────────────────────────────────────

async def obtener_jwt(sucursal):
    email = str(sucursal.get("email", "")).strip()
    if not email or email.startswith("COMPLETAR_"):
        raise ValueError(
            f"Completá el email de {sucursal['nombre']} en SUCURSALES antes de ejecutar."
        )

    print(f"🔐 Abriendo browser para login de {sucursal['nombre']}...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page    = await context.new_page()

        await page.goto(f"{NUCLEO_URL}/login")
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)

        # Buscar campo email
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
                if await loc.is_visible(timeout=1500):
                    email_input = loc
                    print(f"   Email selector: {sel}")
                    break
            except Exception:
                continue

        if email_input is None:
            raise Exception("No se encontró el campo de email en el login")

        await email_input.fill(email)

        pwd_input = page.locator('input[type="password"]').first
        await pwd_input.wait_for(timeout=5000)
        await pwd_input.fill(NUCLEO_PASSWORD)

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
                if await btn.is_visible(timeout=1000):
                    await btn.click()
                    print(f"   Submit selector: {sel}")
                    break
            except Exception:
                continue

        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(3000)

        # Cerrar modal si aparece
        try:
            modal = page.locator('.modal button, button:has-text("Cerrar")').first
            if await modal.is_visible(timeout=2000):
                await modal.click()
                await page.wait_for_timeout(500)
        except Exception:
            pass

        # Extraer JWT del localStorage/sessionStorage
        jwt = await page.evaluate("""() => {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const val = localStorage.getItem(key);
                if (val && val.startsWith('eyJ')) return val;
            }
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const val = sessionStorage.getItem(key);
                if (val && val.startsWith('eyJ')) return val;
            }
            return null;
        }""")

        if not jwt:
            all_storage = await page.evaluate("""() => {
                const items = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    items[key] = localStorage.getItem(key).substring(0, 80);
                }
                return items;
            }""")
            print(f"   localStorage: {all_storage}")

        await browser.close()

    if not jwt:
        raise Exception("No se pudo obtener el JWT del browser")

    print(f"   JWT obtenido: {jwt[:40]}...")
    return jwt

# ─── SESIÓN API ───────────────────────────────────────────────────────────────

def crear_sesion(jwt):
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {jwt}",
        "Content-Type":  "application/json",
        "Origin":        NUCLEO_URL,
        "Referer":       f"{NUCLEO_URL}/",
        "User-Agent":    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    })
    return session

# ─── ÍNDICE DE PRODUCTOS POR CÓDIGO ───────────────────────────────────────────

def obtener_indice_productos(session):
    indice = {}
    aliases = {}
    page_number = 1
    page_size = 100
    total_pages = 1

    while page_number <= total_pages:
        r = session.get(f"{API_BASE}/Product/FindPaged/", params={
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

# ─── OBTENER DATOS COMPLETOS DEL PRODUCTO ─────────────────────────────────────

def obtener_producto(session, id_interno):
    r = session.get(f"{API_BASE}/Product/FindById/{id_interno}")
    r.raise_for_status()
    return r.json()

# ─── ACTUALIZAR PRECIO ────────────────────────────────────────────────────────

def actualizar_precio(session, codigo, precio_nuevo, indice_productos):
    codigo = normalizar_codigo(codigo)
    precio_nuevo = float(precio_nuevo)

    id_interno = indice_productos.get(codigo)
    if id_interno is None:
        id_interno = indice_productos.get(codigo.upper())

    if id_interno is None:
        print(f"  ⚠️  Código {codigo} no encontrado en NucleoCheck")
        return False

    producto = obtener_producto(session, id_interno)

    alicuota = producto.get("AlicuotaId")
    tasas = {1: 1.21, 2: 1.105, 3: 1.0}
    tasa = tasas.get(alicuota, 1.21)
    precio_sin_iva = round(precio_nuevo / tasa, 5)

    if producto.get("PriceListProducts"):
        producto["PriceListProducts"][0]["Price"]      = precio_nuevo
        producto["PriceListProducts"][0]["PriceNoTax"] = precio_sin_iva
    else:
        print(f"  ⚠️  Producto {codigo} no tiene PriceListProducts")
        return False

    r = session.post(f"{API_BASE}/Product/SaveProduct", json=producto)
    r.raise_for_status()
    resp = r.json()

    if resp.get("Product"):
        print(f"  ✅ Código {codigo} → ${precio_nuevo:,.0f}")
        return True
    else:
        print(f"  ❌ Error guardando código {codigo}: {resp}")
        return False

# ─── LEER SHEET ───────────────────────────────────────────────────────────────

def leer_productos():
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds  = Credentials.from_service_account_file(CREDENTIALS_JSON, scopes=scopes)
    gc     = gspread.authorize(creds)
    sheet  = gc.open_by_key(SHEET_ID).worksheet(SHEET_NAME)
    rows   = sheet.get_all_values(value_render_option=ValueRenderOption.formatted)

    productos = []
    for row in rows[FILA_INICIO:]:
        try:
            codigo = normalizar_codigo(row[COL_CODIGO])
            precio_raw = str(row[COL_PRECIO]).strip()
            if not precio_raw:
                continue
            precio = normalizar_precio(precio_raw)
            productos.append({"codigo": codigo, "precio": precio})
        except (ValueError, IndexError):
            continue
    return productos

# ─── MAIN ─────────────────────────────────────────────────────────────────────

async def main():
    print("📋 Leyendo productos del Sheet...")
    productos = leer_productos()
    print(f"   {len(productos)} productos encontrados\n")

    if not productos:
        print("No hay productos para procesar.")
        return

    # Selección de sucursal
    print("¿Qué sucursal querés actualizar?")
    for k, v in SUCURSALES.items():
        print(f"  {k} - {v['nombre']}")
    opcion = input("Ingresá 1 o 2: ").strip()
    if opcion not in SUCURSALES:
        print("Opción inválida.")
        return
    sucursal = SUCURSALES[opcion]
    print(f"\n📍 Sucursal: {sucursal['nombre']}\n")

    if MODO_PRUEBA:
        print(f"⚠️  MODO PRUEBA — procesando solo el primer producto: código {productos[0]['codigo']}")
        productos = productos[:1]
    else:
        print(f"🚀 MODO COMPLETO — procesando {len(productos)} productos")

    print()

    jwt     = await obtener_jwt(sucursal)
    session = crear_sesion(jwt)
    print("✅ Sesión API lista\n")

    print("📦 Armando índice de productos por código...")
    indice_productos = obtener_indice_productos(session)
    print(f"   {len(indice_productos)} códigos indexados\n")

    exitosos = 0
    fallidos = []

    for prod in productos:
        try:
            ok = actualizar_precio(session, prod["codigo"], prod["precio"], indice_productos)
            if ok:
                exitosos += 1
            else:
                fallidos.append(prod["codigo"])
        except Exception as e:
            print(f"  ❌ Error en código {prod['codigo']}: {e}")
            fallidos.append(prod["codigo"])

    print(f"\n{'─'*40}")
    print(f"✅ Exitosos : {exitosos}")
    print(f"❌ Fallidos : {len(fallidos)}")
    if fallidos:
        print(f"   Códigos  : {', '.join(fallidos)}")

if __name__ == "__main__":
    asyncio.run(main())

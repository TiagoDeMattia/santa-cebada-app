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
from datetime import datetime
from pathlib import Path
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

COL_GRUPO_CODIGO          = 9
COL_GRUPO_NOMBRE          = 10
COL_GRUPO_PRODUCTO_CODIGO = 11
COL_GRUPO_PRODUCTO_NOMBRE = 12
COL_GRUPO_PRECIO          = 13

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

def obtener_tasa_iva(alicuota_id=None, alicuota_percentage=None):
    if alicuota_percentage is not None:
        try:
            porcentaje = float(alicuota_percentage)
            if porcentaje > 0:
                return 1 + (porcentaje / 100)
        except (TypeError, ValueError):
            pass

    tasas = {1: 1.21, 2: 1.105, 3: 1.0}
    return tasas.get(alicuota_id, 1.21)

def calcular_precio_sin_iva(precio, alicuota_id=None, alicuota_percentage=None):
    tasa = obtener_tasa_iva(alicuota_id=alicuota_id, alicuota_percentage=alicuota_percentage)
    return round(float(precio) / tasa, 5)

def normalizar_texto_comparacion(valor):
    texto = str(valor or "").strip()
    texto = re.sub(r"\s+", " ", texto)
    return texto.casefold()

def texto_visible(valor):
    return re.sub(r"\s+", " ", str(valor or "").strip())

def clave_codigo(valor):
    return normalizar_codigo(valor).upper()

def ordenar_codigo(valor):
    codigo = str(valor).strip()
    if codigo.isdigit():
        return (0, int(codigo), "")
    return (1, codigo.casefold(), codigo)

def resumir_numeros_a_rangos(numeros):
    if not numeros:
        return []

    numeros = sorted(set(int(n) for n in numeros))
    rangos = []
    inicio = numeros[0]
    fin = numeros[0]

    for numero in numeros[1:]:
        if numero == fin + 1:
            fin = numero
            continue

        rangos.append(f"{inicio}-{fin}" if inicio != fin else str(inicio))
        inicio = fin = numero

    rangos.append(f"{inicio}-{fin}" if inicio != fin else str(inicio))
    return rangos

def formatear_codigos(codigos):
    codigos_visibles = [texto_visible(c) for c in codigos if texto_visible(c)]
    numericos = [int(c) for c in codigos_visibles if c.isdigit()]
    alfanumericos = sorted(
        {c for c in codigos_visibles if not c.isdigit()},
        key=ordenar_codigo
    )

    partes = resumir_numeros_a_rangos(numericos) + alfanumericos
    return ", ".join(partes) if partes else "-"

def imprimir_seccion(titulo):
    print(f"\n{'=' * 70}")
    print(titulo)
    print(f"{'=' * 70}")

def imprimir_bloque(label, lineas):
    print(label)
    if not lineas:
        print("  - Ninguno")
        return

    for linea in lineas:
        print(f"  - {linea}")

def formatear_monto(valor):
    return f"${float(valor):,.2f}"

def timestamp_archivo():
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def obtener_items_paginados(session, endpoint, params_base, page_size=100):
    items = []
    page_number = 1
    total_pages = 1

    while page_number <= total_pages:
        params = dict(params_base)
        params["PageNumber"] = page_number
        params["PageSize"] = page_size

        r = session.get(f"{API_BASE}{endpoint}", params=params)
        r.raise_for_status()
        data = r.json()

        total_pages = data.get("TotalPages", 1)
        items.extend(data.get("Data", []))
        page_number += 1

    return items

def obtener_items_lista(session, endpoint, params_base):
    r = session.get(f"{API_BASE}{endpoint}", params=params_base)
    r.raise_for_status()
    return r.json()

def construir_item_comparable(codigo, nombre, rubro="", subrubro="", activo=True):
    codigo = normalizar_codigo(codigo)
    return {
        "codigo": codigo,
        "codigo_clave": clave_codigo(codigo),
        "nombre": texto_visible(nombre),
        "nombre_cmp": normalizar_texto_comparacion(nombre),
        "rubro": texto_visible(rubro),
        "rubro_cmp": normalizar_texto_comparacion(rubro),
        "subrubro": texto_visible(subrubro),
        "subrubro_cmp": normalizar_texto_comparacion(subrubro),
        "activo": bool(activo),
    }

def construir_mapa_por_codigo(items):
    mapa = {}
    duplicados = []

    for item in items:
        clave = item["codigo_clave"]
        if clave in mapa:
            duplicados.append(item["codigo"])
            continue
        mapa[clave] = item

    return mapa, sorted(set(duplicados), key=ordenar_codigo)

def obtener_estadisticas_vacantes(items, codigos_excluidos=None):
    codigos_excluidos = set(codigos_excluidos or [])
    codigos_numericos = {
        int(item["codigo"])
        for item in items
        if item["codigo"].isdigit() and int(item["codigo"]) not in codigos_excluidos
    }

    if not codigos_numericos:
        return {
            "maximo": 0,
            "total_vacantes": 0,
            "vacantes": [],
        }

    maximo = max(codigos_numericos)
    esperados = set(range(1, maximo + 1)) - codigos_excluidos
    vacantes = sorted(esperados - codigos_numericos)

    return {
        "maximo": maximo,
        "total_vacantes": len(vacantes),
        "vacantes": vacantes,
    }

# ─── OBTENER JWT VIA PLAYWRIGHT ───────────────────────────────────────────────

async def obtener_jwt(sucursal, headless=False):
    email = str(sucursal.get("email", "")).strip()
    if not email or email.startswith("COMPLETAR_"):
        raise ValueError(
            f"Completá el email de {sucursal['nombre']} en SUCURSALES antes de ejecutar."
        )

    print(f"🔐 Abriendo browser para login de {sucursal['nombre']}...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
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
                    } catch (e) {
                    }
                }
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

async def obtener_sesion_sucursal(sucursal, headless=False):
    jwt = await obtener_jwt(sucursal, headless=headless)
    return crear_sesion(jwt)

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

def obtener_indice_grupos(session):
    r = session.get(f"{API_BASE}/ProductOptionGroupList/Find/", params={
        "ActivationState": 1,
        "Name": ""
    })
    r.raise_for_status()

    indice = {}
    aliases = {}
    for grupo in r.json():
        codigo = str(grupo.get("Code", "")).strip()
        if not codigo:
            continue

        indice.setdefault(codigo, grupo["Id"])

        codigo_upper = codigo.upper()
        if codigo_upper in aliases and aliases[codigo_upper] != grupo["Id"]:
            aliases[codigo_upper] = None
        else:
            aliases[codigo_upper] = grupo["Id"]

    for codigo_upper, group_id in aliases.items():
        if group_id is not None and codigo_upper not in indice:
            indice[codigo_upper] = group_id

    return indice

def obtener_productos_comparacion(session):
    productos = obtener_items_paginados(
        session,
        "/Product/FindPaged/",
        {
            "Code": "",
            "Name": "",
            "IsCommensal": "false",
            "SortOrder": "",
        },
    )

    return [
        construir_item_comparable(
            producto.get("Code"),
            producto.get("Name"),
            rubro=producto.get("CategoryName"),
            subrubro=producto.get("SubCategoryName"),
            activo=producto.get("IsActive", True),
        )
        for producto in productos
        if str(producto.get("Code", "")).strip()
    ]

def obtener_insumos_comparacion(session):
    insumos = obtener_items_lista(
        session,
        "/SupplyList/Find/",
        {
            "ActivationState": 1,
            "Name": "",
            "Code": "",
        },
    )

    return [
        construir_item_comparable(
            insumo.get("Code"),
            insumo.get("Name"),
            activo=insumo.get("IsActive", True),
        )
        for insumo in insumos
        if str(insumo.get("Code", "")).strip()
    ]

def obtener_ingredientes_comparacion(session):
    ingredientes = obtener_items_paginados(
        session,
        "/IngredientList/FindPaged/",
        {
            "ActivationState": 1,
            "Name": "",
            "SortOrder": "",
        },
    )

    return [
        construir_item_comparable(
            ingrediente.get("Code"),
            ingrediente.get("Name"),
            rubro=ingrediente.get("CategoryName"),
            subrubro=ingrediente.get("SubCategoryName"),
            activo=ingrediente.get("IsActive", True),
        )
        for ingrediente in ingredientes
        if str(ingrediente.get("Code", "")).strip()
    ]

def obtener_servicios_comparacion(session):
    servicios = obtener_items_lista(
        session,
        "/ServiceList/Find/",
        {
            "ActivationState": 1,
            "Name": "",
        },
    )

    return [
        construir_item_comparable(
            servicio.get("Code"),
            servicio.get("Name"),
            activo=servicio.get("IsActive", True),
        )
        for servicio in servicios
        if str(servicio.get("Code", "")).strip()
    ]

def obtener_proveedores_comparacion(session):
    proveedores = obtener_items_paginados(
        session,
        "/SupplierList/FindPaged/",
        {
            "ActivationState": 1,
            "Name": "",
            "DocumentNumber": "",
            "SortOrder": "",
        },
    )

    return [
        construir_item_comparable(
            proveedor.get("Code"),
            proveedor.get("Name"),
            activo=proveedor.get("IsActive", True),
        )
        for proveedor in proveedores
        if str(proveedor.get("Code", "")).strip()
    ]

def obtener_rubros(session):
    rubros = obtener_items_lista(
        session,
        "/CategoryList/Find/",
        {
            "ActivationState": 1,
            "Name": "",
        },
    )
    return sorted(
        {texto_visible(rubro.get("Name")) for rubro in rubros if texto_visible(rubro.get("Name"))},
        key=lambda valor: valor.casefold(),
    )

def obtener_subrubros(session):
    subrubros = obtener_items_lista(
        session,
        "/SubCategoryList/Find/",
        {
            "ActivationState": 1,
            "Name": "",
        },
    )
    return sorted(
        {
            f"{texto_visible(subrubro.get('CategoryName'))} > {texto_visible(subrubro.get('Name'))}"
            for subrubro in subrubros
            if texto_visible(subrubro.get("Name"))
        },
        key=lambda valor: valor.casefold(),
    )

def obtener_datos_comparacion(session, tipo_comparacion):
    if tipo_comparacion == "1":
        return {
            "tipo": "Productos",
            "items": obtener_productos_comparacion(session),
            "rubros": obtener_rubros(session),
            "subrubros": obtener_subrubros(session),
        }
    if tipo_comparacion == "2":
        return {
            "tipo": "Insumos",
            "items": obtener_insumos_comparacion(session),
        }
    if tipo_comparacion == "3":
        return {
            "tipo": "Servicios",
            "items": obtener_servicios_comparacion(session),
        }
    if tipo_comparacion == "4":
        return {
            "tipo": "Proveedores",
            "items": obtener_proveedores_comparacion(session),
        }
    if tipo_comparacion == "5":
        return {
            "tipo": "Ingredientes",
            "items": obtener_ingredientes_comparacion(session),
        }

    raise ValueError("Tipo de comparación inválido")

def obtener_tipos_comparacion():
    return [
        ("1", "Productos"),
        ("2", "Insumos"),
        ("3", "Servicios"),
        ("4", "Proveedores"),
        ("5", "Ingredientes"),
    ]

def obtener_configuracion_equiparacion(tipo_comparacion):
    configuraciones = {
        "1": {
            "tipo": "Productos",
            "find_endpoint": "/Product/FindById",
            "save_endpoint": "/Product/SaveProduct",
            "response_key": "Product",
            "indice_fn": obtener_indice_productos,
            "items_fn": obtener_productos_comparacion,
            "has_categories": True,
            "has_price": True,
        },
        "2": {
            "tipo": "Insumos",
            "find_endpoint": "/Supply/FindById",
            "save_endpoint": "/Supply/SaveSupply",
            "response_key": "Supply",
            "list_endpoint": "/SupplyList/Find/",
            "list_params": {
                "ActivationState": 1,
                "Name": "",
                "Code": "",
            },
            "has_categories": False,
            "has_price": False,
        },
        "3": {
            "tipo": "Servicios",
            "find_endpoint": "/Service/FindById",
            "save_endpoint": "/Service/SaveService",
            "response_key": "Service",
            "list_endpoint": "/ServiceList/Find/",
            "list_params": {
                "ActivationState": 1,
                "Name": "",
            },
            "has_categories": False,
            "has_price": False,
        },
        "4": {
            "tipo": "Proveedores",
            "find_endpoint": "/Supplier/FindById",
            "save_endpoint": "/Supplier/SaveSupplier",
            "response_key": "Supplier",
            "list_endpoint": "/SupplierList/FindPaged/",
            "list_params": {
                "ActivationState": 1,
                "Name": "",
                "DocumentNumber": "",
                "SortOrder": "",
            },
            "paginated": True,
            "has_categories": False,
            "has_price": False,
        },
        "5": {
            "tipo": "Ingredientes",
            "find_endpoint": "/Ingredient/FindById",
            "save_endpoint": "/Ingredient/SaveIngredient",
            "response_key": "Ingredient",
            "list_endpoint": "/IngredientList/FindPaged/",
            "list_params": {
                "ActivationState": 1,
                "Name": "",
                "SortOrder": "",
            },
            "paginated": True,
            "has_categories": True,
            "has_price": False,
        },
    }
    if tipo_comparacion not in configuraciones:
        raise ValueError("Tipo de equiparación inválido")
    return configuraciones[tipo_comparacion]

def obtener_indice_por_codigo_generico(session, configuracion):
    if configuracion.get("indice_fn"):
        return configuracion["indice_fn"](session)

    if configuracion.get("paginated"):
        items = obtener_items_paginados(
            session,
            configuracion["list_endpoint"],
            configuracion["list_params"],
        )
    else:
        items = obtener_items_lista(
            session,
            configuracion["list_endpoint"],
            configuracion["list_params"],
        )

    indice = {}
    aliases = {}
    for item in items:
        codigo = str(item.get("Code", "")).strip()
        item_id = item.get("Id")
        if not codigo or item_id is None:
            continue

        indice.setdefault(codigo, item_id)
        codigo_upper = codigo.upper()
        if codigo_upper in aliases and aliases[codigo_upper] != item_id:
            aliases[codigo_upper] = None
        else:
            aliases[codigo_upper] = item_id

    for codigo_upper, item_id in aliases.items():
        if item_id is not None and codigo_upper not in indice:
            indice[codigo_upper] = item_id

    return indice

def obtener_entidad_por_id(session, configuracion, id_interno):
    r = session.get(f"{API_BASE}{configuracion['find_endpoint']}/{id_interno}")
    r.raise_for_status()
    return r.json()

def obtener_entidad_por_codigo(session, codigo, indice_codigos, configuracion):
    codigo = normalizar_codigo(codigo)
    id_interno = indice_codigos.get(codigo)
    if id_interno is None:
        id_interno = indice_codigos.get(codigo.upper())
    if id_interno is None:
        return None

    if configuracion["tipo"] == "Productos":
        return obtener_producto(session, id_interno)

    return obtener_entidad_por_id(session, configuracion, id_interno)

def obtener_codigos_todos_para_equiparar(session, tipo_comparacion):
    datos = obtener_datos_comparacion(session, tipo_comparacion)
    codigos = []
    vistos = set()
    for item in datos["items"]:
        codigo = item["codigo"]
        clave = clave_codigo(codigo)
        if clave in vistos:
            continue
        vistos.add(clave)
        codigos.append(codigo)
    return codigos

def construir_cambios_equiparacion_entidad(configuracion, entidad_origen, entidad_destino):
    cambios = []

    nombre_origen = texto_visible(entidad_origen.get("Name"))
    nombre_destino = texto_visible(entidad_destino.get("Name"))
    if normalizar_texto_comparacion(nombre_origen) != normalizar_texto_comparacion(nombre_destino):
        cambios.append({
            "campo": "nombre",
            "origen": nombre_origen,
            "destino": nombre_destino,
        })

    activo_origen = bool(entidad_origen.get("IsActive", True))
    activo_destino = bool(entidad_destino.get("IsActive", True))
    if activo_origen != activo_destino:
        cambios.append({
            "campo": "activo",
            "origen": activo_origen,
            "destino": activo_destino,
        })

    if configuracion.get("has_price"):
        precio_origen = obtener_precio_producto(entidad_origen)
        precio_destino = obtener_precio_producto(entidad_destino)
        if precio_origen != precio_destino:
            cambios.append({
                "campo": "precio",
                "origen": precio_origen,
                "destino": precio_destino,
            })

    if configuracion.get("has_categories"):
        rubro_origen = texto_visible(entidad_origen.get("CategoryName"))
        rubro_destino = texto_visible(entidad_destino.get("CategoryName"))
        if normalizar_texto_comparacion(rubro_origen) != normalizar_texto_comparacion(rubro_destino):
            cambios.append({
                "campo": "rubro",
                "origen": rubro_origen,
                "destino": rubro_destino,
            })

        subrubro_origen = texto_visible(entidad_origen.get("SubCategoryName"))
        subrubro_destino = texto_visible(entidad_destino.get("SubCategoryName"))
        if normalizar_texto_comparacion(subrubro_origen) != normalizar_texto_comparacion(subrubro_destino):
            cambios.append({
                "campo": "subrubro",
                "origen": subrubro_origen,
                "destino": subrubro_destino,
            })

    return cambios

def preparar_equiparacion_entidad(
    codigo,
    configuracion,
    entidad_origen,
    entidad_destino,
    categorias_destino=None,
    subcategorias_destino=None,
):
    cambios = construir_cambios_equiparacion_entidad(
        configuracion,
        entidad_origen,
        entidad_destino,
    )
    plan = {
        "ok": True,
        "codigo": codigo,
        "tipo": configuracion["tipo"],
        "nombre_origen": texto_visible(entidad_origen.get("Name")),
        "nombre_destino": texto_visible(entidad_destino.get("Name")),
        "cambios": cambios,
        "activo_origen": bool(entidad_origen.get("IsActive", True)),
        "nombre_visible_origen": texto_visible(entidad_origen.get("Name")),
    }

    if configuracion.get("has_categories"):
        resolucion = resolver_ids_categoria_destino(
            entidad_origen,
            entidad_destino,
            categorias_destino or {},
            subcategorias_destino or {},
        )
        if not resolucion["ok"]:
            return {
                "ok": False,
                "codigo": codigo,
                "tipo": configuracion["tipo"],
                "nombre_origen": texto_visible(entidad_origen.get("Name")),
                "nombre_destino": texto_visible(entidad_destino.get("Name")),
                "error": resolucion["error"],
                "cambios": cambios,
            }
        plan["category_id"] = resolucion["category_id"]
        plan["subcategory_id"] = resolucion["subcategory_id"]

    if configuracion.get("has_price"):
        plan["precio_origen"] = obtener_precio_producto(entidad_origen)

    return plan

def aplicar_equiparacion_entidad(session_destino, entidad_destino, plan, configuracion):
    entidad_destino["Name"] = plan["nombre_visible_origen"]
    entidad_destino["IsActive"] = plan["activo_origen"]

    if configuracion.get("has_categories"):
        entidad_destino["CategoryId"] = int(plan["category_id"] or 0)
        entidad_destino["SubCategoryId"] = int(plan["subcategory_id"] or 0)

    if configuracion.get("has_price"):
        if not aplicar_precio_producto(entidad_destino, plan["precio_origen"]):
            return {
                "ok": False,
                "codigo": plan["codigo"],
                "error": "La entidad destino no tiene estructura de precio válida",
            }

    r = session_destino.post(f"{API_BASE}{configuracion['save_endpoint']}", json=entidad_destino)
    r.raise_for_status()
    resp = r.json()

    if not resp.get(configuracion["response_key"]):
        return {
            "ok": False,
            "codigo": plan["codigo"],
            "error": f"Error guardando {configuracion['tipo'].lower()}: {resp}",
        }

    return {
        "ok": True,
        "codigo": plan["codigo"],
        "nombre": plan["nombre_visible_origen"],
        "cambios": plan["cambios"],
    }

def comparar_entidades(tipo_nombre, items_recoleta, items_palermo):
    mapa_recoleta, duplicados_recoleta = construir_mapa_por_codigo(items_recoleta)
    mapa_palermo, duplicados_palermo = construir_mapa_por_codigo(items_palermo)

    claves_recoleta = set(mapa_recoleta.keys())
    claves_palermo = set(mapa_palermo.keys())
    claves_comunes = claves_recoleta & claves_palermo

    solo_recoleta = sorted(
        [mapa_recoleta[clave]["codigo"] for clave in claves_recoleta - claves_palermo],
        key=ordenar_codigo,
    )
    solo_palermo = sorted(
        [mapa_palermo[clave]["codigo"] for clave in claves_palermo - claves_recoleta],
        key=ordenar_codigo,
    )

    diferencias_nombre = []
    diferencias_rubro = []

    for clave in sorted(claves_comunes, key=lambda valor: ordenar_codigo(mapa_recoleta[valor]["codigo"])):
        recoleta = mapa_recoleta[clave]
        palermo = mapa_palermo[clave]

        if recoleta["nombre_cmp"] != palermo["nombre_cmp"]:
            diferencias_nombre.append(
                f"{recoleta['codigo']} | Recoleta: {recoleta['nombre']} | Palermo: {palermo['nombre']}"
            )

        if (
            recoleta["rubro_cmp"] != palermo["rubro_cmp"]
            or recoleta["subrubro_cmp"] != palermo["subrubro_cmp"]
        ):
            diferencias_rubro.append(
                (
                    f"{recoleta['codigo']} | Recoleta: "
                    f"{recoleta['rubro'] or '(sin rubro)'} > {recoleta['subrubro'] or '(sin subrubro)'}"
                    f" | Palermo: {palermo['rubro'] or '(sin rubro)'} > "
                    f"{palermo['subrubro'] or '(sin subrubro)'}"
                )
            )

    return {
        "tipo": tipo_nombre,
        "total_recoleta": len(items_recoleta),
        "total_palermo": len(items_palermo),
        "duplicados_recoleta": duplicados_recoleta,
        "duplicados_palermo": duplicados_palermo,
        "solo_recoleta": solo_recoleta,
        "solo_palermo": solo_palermo,
        "diferencias_nombre": diferencias_nombre,
        "diferencias_rubro": diferencias_rubro,
    }

def imprimir_reporte_comparacion(reporte, tipo_comparacion, datos_recoleta=None, datos_palermo=None):
    imprimir_seccion(f"Comparación Recoleta vs Palermo - {reporte['tipo']}")
    print(f"Total Recoleta: {reporte['total_recoleta']}")
    print(f"Total Palermo : {reporte['total_palermo']}")
    print(f"Diferencias de nombre: {len(reporte['diferencias_nombre'])}")
    print(f"Solo en Recoleta: {len(reporte['solo_recoleta'])}")
    print(f"Solo en Palermo : {len(reporte['solo_palermo'])}")

    if reporte["duplicados_recoleta"]:
        print(
            f"Códigos duplicados en Recoleta: {formatear_codigos(reporte['duplicados_recoleta'])}"
        )
    if reporte["duplicados_palermo"]:
        print(
            f"Códigos duplicados en Palermo : {formatear_codigos(reporte['duplicados_palermo'])}"
        )

    imprimir_bloque("Códigos con nombre distinto:", reporte["diferencias_nombre"])

    print("Códigos solo en Recoleta:")
    print(f"  - Total: {len(reporte['solo_recoleta'])}")
    print(f"  - Códigos: {formatear_codigos(reporte['solo_recoleta'])}")

    print("Códigos solo en Palermo:")
    print(f"  - Total: {len(reporte['solo_palermo'])}")
    print(f"  - Códigos: {formatear_codigos(reporte['solo_palermo'])}")

    if tipo_comparacion == "1":
        print(f"Diferencias de rubro/subrubro: {len(reporte['diferencias_rubro'])}")
        imprimir_bloque("Productos con rubro/subrubro distinto:", reporte["diferencias_rubro"])

        vacantes_recoleta = obtener_estadisticas_vacantes(
            datos_recoleta["items"],
            codigos_excluidos={998, 999, 1000},
        )
        vacantes_palermo = obtener_estadisticas_vacantes(
            datos_palermo["items"],
            codigos_excluidos={998, 999, 1000},
        )

        print("Vacantes de productos en Recoleta:")
        print(f"  - Máximo analizado: {vacantes_recoleta['maximo']}")
        print(f"  - Total vacantes: {vacantes_recoleta['total_vacantes']}")
        print(f"  - Rangos/códigos: {formatear_codigos(vacantes_recoleta['vacantes'])}")

        print("Vacantes de productos en Palermo:")
        print(f"  - Máximo analizado: {vacantes_palermo['maximo']}")
        print(f"  - Total vacantes: {vacantes_palermo['total_vacantes']}")
        print(f"  - Rangos/códigos: {formatear_codigos(vacantes_palermo['vacantes'])}")

        rubros_recoleta = set(datos_recoleta.get("rubros", []))
        rubros_palermo = set(datos_palermo.get("rubros", []))
        subrubros_recoleta = set(datos_recoleta.get("subrubros", []))
        subrubros_palermo = set(datos_palermo.get("subrubros", []))

        imprimir_bloque(
            "Rubros solo en Recoleta:",
            sorted(rubros_recoleta - rubros_palermo, key=lambda valor: valor.casefold()),
        )
        imprimir_bloque(
            "Rubros solo en Palermo:",
            sorted(rubros_palermo - rubros_recoleta, key=lambda valor: valor.casefold()),
        )
        imprimir_bloque(
            "Subrubros solo en Recoleta:",
            sorted(subrubros_recoleta - subrubros_palermo, key=lambda valor: valor.casefold()),
        )
        imprimir_bloque(
            "Subrubros solo en Palermo:",
            sorted(subrubros_palermo - subrubros_recoleta, key=lambda valor: valor.casefold()),
        )

def resumir_reporte_comparacion(reporte):
    return (
        f"{reporte['tipo']}: "
        f"nombres={len(reporte['diferencias_nombre'])} | "
        f"solo_recoleta={len(reporte['solo_recoleta'])} | "
        f"solo_palermo={len(reporte['solo_palermo'])}"
    )

def generar_texto_resumen(resultado):
    tipo = resultado.get("tipo")

    if tipo == "actualizacion":
        lineas = [
            f"Resumen de actualización - {resultado['subtipo'].capitalize()}",
            f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Sucursal: {resultado['sucursal']}",
            f"Exitosos: {resultado['exitosos']}",
            f"Fallidos: {len(resultado['fallidos'])}",
            "",
            "Cambios realizados:",
        ]

        cambios = resultado.get("cambios", [])
        if cambios:
            for cambio in cambios:
                if resultado["subtipo"] == "productos":
                    lineas.append(
                        (
                            f"- {cambio['codigo']} | {cambio['nombre']} | "
                            f"Viejo: {formatear_monto(cambio['precio_viejo'])} | "
                            f"Nuevo: {formatear_monto(cambio['precio_nuevo'])}"
                        )
                    )
                else:
                    lineas.append(
                        (
                            f"- Grupo {cambio['grupo_codigo']} ({cambio['grupo_nombre']}) / "
                            f"Producto {cambio['producto_codigo']} ({cambio['producto_nombre']}) | "
                            f"Viejo: {formatear_monto(cambio['precio_viejo'])} | "
                            f"Nuevo: {formatear_monto(cambio['precio_nuevo'])}"
                        )
                    )
        else:
            lineas.append("- Ningún cambio exitoso")

        lineas.extend(["", "Registros fallidos:"])
        if resultado.get("fallidos"):
            for fallido in resultado["fallidos"]:
                lineas.append(f"- {fallido}")
        else:
            lineas.append("- Ninguno")

        return "\n".join(lineas)

    if tipo == "comparacion":
        reporte = resultado["reporte"]
        tipo_comparacion = resultado["tipo_comparacion"]
        datos_recoleta = resultado["datos_recoleta"]
        datos_palermo = resultado["datos_palermo"]

        lineas = [
            f"Resumen de comparación - {reporte['tipo']}",
            f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Recoleta: {reporte['total_recoleta']}",
            f"Total Palermo: {reporte['total_palermo']}",
            f"Diferencias de nombre: {len(reporte['diferencias_nombre'])}",
            f"Solo en Recoleta: {len(reporte['solo_recoleta'])}",
            f"Solo en Palermo: {len(reporte['solo_palermo'])}",
            "",
            "Códigos con nombre distinto:",
        ]

        if reporte["diferencias_nombre"]:
            lineas.extend(f"- {linea}" for linea in reporte["diferencias_nombre"])
        else:
            lineas.append("- Ninguno")

        lineas.extend([
            "",
            f"Códigos solo en Recoleta ({len(reporte['solo_recoleta'])}): {formatear_codigos(reporte['solo_recoleta'])}",
            f"Códigos solo en Palermo ({len(reporte['solo_palermo'])}): {formatear_codigos(reporte['solo_palermo'])}",
        ])

        if tipo_comparacion == "1":
            vacantes_recoleta = obtener_estadisticas_vacantes(
                datos_recoleta["items"], codigos_excluidos={998, 999, 1000}
            )
            vacantes_palermo = obtener_estadisticas_vacantes(
                datos_palermo["items"], codigos_excluidos={998, 999, 1000}
            )

            lineas.extend([
                "",
                f"Diferencias de rubro/subrubro: {len(reporte['diferencias_rubro'])}",
            ])
            if reporte["diferencias_rubro"]:
                lineas.extend(f"- {linea}" for linea in reporte["diferencias_rubro"])
            else:
                lineas.append("- Ninguno")

            lineas.extend([
                "",
                (
                    f"Vacantes Recoleta: máximo {vacantes_recoleta['maximo']} | "
                    f"total {vacantes_recoleta['total_vacantes']} | "
                    f"{formatear_codigos(vacantes_recoleta['vacantes'])}"
                ),
                (
                    f"Vacantes Palermo: máximo {vacantes_palermo['maximo']} | "
                    f"total {vacantes_palermo['total_vacantes']} | "
                    f"{formatear_codigos(vacantes_palermo['vacantes'])}"
                ),
                "",
                "Rubros solo en Recoleta:",
            ])

            rubros_recoleta = sorted(
                set(datos_recoleta.get("rubros", [])) - set(datos_palermo.get("rubros", [])),
                key=lambda valor: valor.casefold(),
            )
            rubros_palermo = sorted(
                set(datos_palermo.get("rubros", [])) - set(datos_recoleta.get("rubros", [])),
                key=lambda valor: valor.casefold(),
            )
            subrubros_recoleta = sorted(
                set(datos_recoleta.get("subrubros", [])) - set(datos_palermo.get("subrubros", [])),
                key=lambda valor: valor.casefold(),
            )
            subrubros_palermo = sorted(
                set(datos_palermo.get("subrubros", [])) - set(datos_recoleta.get("subrubros", [])),
                key=lambda valor: valor.casefold(),
            )

            lineas.extend(f"- {valor}" for valor in rubros_recoleta) if rubros_recoleta else lineas.append("- Ninguno")
            lineas.append("")
            lineas.append("Rubros solo en Palermo:")
            lineas.extend(f"- {valor}" for valor in rubros_palermo) if rubros_palermo else lineas.append("- Ninguno")
            lineas.append("")
            lineas.append("Subrubros solo en Recoleta:")
            lineas.extend(f"- {valor}" for valor in subrubros_recoleta) if subrubros_recoleta else lineas.append("- Ninguno")
            lineas.append("")
            lineas.append("Subrubros solo en Palermo:")
            lineas.extend(f"- {valor}" for valor in subrubros_palermo) if subrubros_palermo else lineas.append("- Ninguno")

        return "\n".join(lineas)

    if tipo == "equiparacion":
        lineas = [
            (
                f"Resumen de equiparacion - {resultado['tipo_entidad']} | "
                f"{resultado['origen']} -> {resultado['destino']}"
            ),
            f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Solicitados: {len(resultado.get('codigos', []))}",
            f"Aplicados: {resultado['aplicados']}",
            f"Fallidos: {len(resultado['fallidos'])}",
            "",
            "Cambios aplicados:",
        ]

        if resultado.get("cambios"):
            for cambio in resultado["cambios"]:
                lineas.append(f"- {cambio['codigo']} | {cambio['nombre']}")
                if cambio.get("detalle"):
                    for detalle in cambio["detalle"]:
                        origen = detalle["origen"]
                        destino = detalle["destino"]
                        if detalle["campo"] == "precio":
                            origen = formatear_monto(origen or 0)
                            destino = formatear_monto(destino or 0)
                        elif detalle["campo"] == "activo":
                            origen = "Activo" if origen else "Inactivo"
                            destino = "Activo" if destino else "Inactivo"
                        else:
                            origen = origen or "(vacio)"
                            destino = destino or "(vacio)"
                        lineas.append(
                            f"  - {detalle['campo']}: destino={destino} | origen={origen}"
                        )
        else:
            lineas.append("- Ningun cambio aplicado")

        lineas.extend(["", "Registros fallidos:"])
        if resultado.get("fallidos"):
            for fallido in resultado["fallidos"]:
                lineas.append(f"- {fallido}")
        else:
            lineas.append("- Ninguno")

        return "\n".join(lineas)

    return "No hay resumen disponible."

def guardar_resumen(resultado):
    nombre_base = "resumen_proceso"
    if resultado.get("tipo") == "actualizacion":
        nombre_base = f"resumen_actualizacion_{resultado['subtipo']}"
    elif resultado.get("tipo") == "comparacion":
        nombre_base = f"resumen_comparacion_{resultado['reporte']['tipo'].lower()}"
    elif resultado.get("tipo") == "equiparacion":
        nombre_base = f"resumen_equiparacion_{resultado.get('tipo_entidad', 'entidades').lower()}"

    ruta = Path.cwd() / f"{nombre_base}_{timestamp_archivo()}.txt"
    ruta.write_text(generar_texto_resumen(resultado), encoding="utf-8")
    return ruta

def menu_post_proceso():
    print("\n¿Qué querés hacer ahora?")
    print("  1 - Utilizar otra función")
    print("  2 - Guardar resumen")
    print("  3 - Cerrar")
    return input("Ingresá 1, 2 o 3: ").strip()

# ─── OBTENER DATOS COMPLETOS DEL PRODUCTO ─────────────────────────────────────

def obtener_producto(session, id_interno):
    r = session.get(f"{API_BASE}/Product/FindById/{id_interno}")
    r.raise_for_status()
    return r.json()

def obtener_producto_por_codigo(session, codigo, indice_productos):
    codigo = normalizar_codigo(codigo)
    id_interno = indice_productos.get(codigo)
    if id_interno is None:
        id_interno = indice_productos.get(codigo.upper())
    if id_interno is None:
        return None
    return obtener_producto(session, id_interno)

def obtener_grupo_producto(session, id_grupo):
    r = session.get(f"{API_BASE}/ProductOptionGroup/FindById/{id_grupo}")
    r.raise_for_status()
    return r.json()

def obtener_precio_producto(producto):
    if producto.get("PriceListProducts"):
        return float(producto["PriceListProducts"][0].get("Price", 0) or 0)
    return None

def aplicar_precio_producto(producto, precio_nuevo):
    if not producto.get("PriceListProducts"):
        return False

    precio_sin_iva = calcular_precio_sin_iva(
        precio_nuevo,
        alicuota_id=producto.get("AlicuotaId")
    )
    producto["PriceListProducts"][0]["Price"] = float(precio_nuevo)
    producto["PriceListProducts"][0]["PriceNoTax"] = precio_sin_iva
    return True

def obtener_indices_categorias(session):
    categorias = obtener_items_lista(
        session,
        "/CategoryList/Find/",
        {
            "ActivationState": 1,
            "Name": "",
        },
    )
    subcategorias = obtener_items_lista(
        session,
        "/SubCategoryList/Find/",
        {
            "ActivationState": 1,
            "Name": "",
        },
    )

    categorias_por_nombre = {}
    for categoria in categorias:
        nombre = texto_visible(categoria.get("Name"))
        if not nombre:
            continue
        categorias_por_nombre[normalizar_texto_comparacion(nombre)] = {
            "id": categoria.get("Id"),
            "nombre": nombre,
        }

    subcategorias_por_clave = {}
    for subcategoria in subcategorias:
        nombre_categoria = texto_visible(subcategoria.get("CategoryName"))
        nombre_subcategoria = texto_visible(subcategoria.get("Name"))
        if not nombre_subcategoria:
            continue
        clave = (
            normalizar_texto_comparacion(nombre_categoria),
            normalizar_texto_comparacion(nombre_subcategoria),
        )
        subcategorias_por_clave[clave] = {
            "id": subcategoria.get("Id"),
            "nombre": nombre_subcategoria,
            "categoria_nombre": nombre_categoria,
        }

    return categorias_por_nombre, subcategorias_por_clave

def parsear_codigos_seleccionados(texto):
    codigos = []
    vistos = set()

    for parte in str(texto or "").split(","):
        codigo = parte.strip()
        if not codigo:
            continue
        codigo = normalizar_codigo(codigo)
        clave = clave_codigo(codigo)
        if clave in vistos:
            continue
        vistos.add(clave)
        codigos.append(codigo)

    return codigos

def construir_cambios_equiparacion(producto_origen, producto_destino):
    cambios = []

    nombre_origen = texto_visible(producto_origen.get("Name"))
    nombre_destino = texto_visible(producto_destino.get("Name"))
    if normalizar_texto_comparacion(nombre_origen) != normalizar_texto_comparacion(nombre_destino):
        cambios.append({
            "campo": "nombre",
            "origen": nombre_origen,
            "destino": nombre_destino,
        })

    precio_origen = obtener_precio_producto(producto_origen)
    precio_destino = obtener_precio_producto(producto_destino)
    if precio_origen != precio_destino:
        cambios.append({
            "campo": "precio",
            "origen": precio_origen,
            "destino": precio_destino,
        })

    activo_origen = bool(producto_origen.get("IsActive", True))
    activo_destino = bool(producto_destino.get("IsActive", True))
    if activo_origen != activo_destino:
        cambios.append({
            "campo": "activo",
            "origen": activo_origen,
            "destino": activo_destino,
        })

    rubro_origen = texto_visible(producto_origen.get("CategoryName"))
    rubro_destino = texto_visible(producto_destino.get("CategoryName"))
    if normalizar_texto_comparacion(rubro_origen) != normalizar_texto_comparacion(rubro_destino):
        cambios.append({
            "campo": "rubro",
            "origen": rubro_origen,
            "destino": rubro_destino,
        })

    subrubro_origen = texto_visible(producto_origen.get("SubCategoryName"))
    subrubro_destino = texto_visible(producto_destino.get("SubCategoryName"))
    if normalizar_texto_comparacion(subrubro_origen) != normalizar_texto_comparacion(subrubro_destino):
        cambios.append({
            "campo": "subrubro",
            "origen": subrubro_origen,
            "destino": subrubro_destino,
        })

    return cambios

def resolver_ids_categoria_destino(
    producto_origen,
    producto_destino,
    categorias_destino,
    subcategorias_destino,
):
    rubro_origen = texto_visible(producto_origen.get("CategoryName"))
    subrubro_origen = texto_visible(producto_origen.get("SubCategoryName"))
    category_id_destino = int(producto_destino.get("CategoryId") or 0)
    subcategory_id_destino = int(producto_destino.get("SubCategoryId") or 0)

    if not rubro_origen and not subrubro_origen:
        return {
            "ok": True,
            "category_id": category_id_destino,
            "subcategory_id": subcategory_id_destino,
        }

    categoria = categorias_destino.get(normalizar_texto_comparacion(rubro_origen))
    if not categoria:
        return {
            "ok": False,
            "error": f"Rubro '{rubro_origen or '(sin rubro)'}' inexistente en destino",
        }

    if not subrubro_origen:
        return {
            "ok": True,
            "category_id": categoria["id"],
            "subcategory_id": subcategory_id_destino,
        }

    clave_subcategoria = (
        normalizar_texto_comparacion(rubro_origen),
        normalizar_texto_comparacion(subrubro_origen),
    )
    subcategoria = subcategorias_destino.get(clave_subcategoria)
    if not subcategoria:
        return {
            "ok": False,
            "error": (
                f"Subrubro '{rubro_origen or '(sin rubro)'} > "
                f"{subrubro_origen}' inexistente en destino"
            ),
        }

    return {
        "ok": True,
        "category_id": categoria["id"],
        "subcategory_id": subcategoria["id"],
    }

def preparar_equiparacion_producto(
    codigo,
    producto_origen,
    producto_destino,
    categorias_destino,
    subcategorias_destino,
):
    cambios = construir_cambios_equiparacion(producto_origen, producto_destino)
    resolucion = resolver_ids_categoria_destino(
        producto_origen,
        producto_destino,
        categorias_destino,
        subcategorias_destino,
    )

    if not resolucion["ok"]:
        return {
            "ok": False,
            "codigo": codigo,
            "nombre_origen": texto_visible(producto_origen.get("Name")),
            "nombre_destino": texto_visible(producto_destino.get("Name")),
            "error": resolucion["error"],
            "cambios": cambios,
        }

    return {
        "ok": True,
        "codigo": codigo,
        "nombre_origen": texto_visible(producto_origen.get("Name")),
        "nombre_destino": texto_visible(producto_destino.get("Name")),
        "cambios": cambios,
        "category_id": resolucion["category_id"],
        "subcategory_id": resolucion["subcategory_id"],
        "precio_origen": obtener_precio_producto(producto_origen),
        "activo_origen": bool(producto_origen.get("IsActive", True)),
        "nombre_visible_origen": texto_visible(producto_origen.get("Name")),
    }

def aplicar_equiparacion_producto(session_destino, producto_destino, plan):
    producto_destino["Name"] = plan["nombre_visible_origen"]
    producto_destino["IsActive"] = plan["activo_origen"]
    producto_destino["CategoryId"] = int(plan["category_id"] or 0)
    producto_destino["SubCategoryId"] = int(plan["subcategory_id"] or 0)

    if not aplicar_precio_producto(producto_destino, plan["precio_origen"]):
        return {
            "ok": False,
            "codigo": plan["codigo"],
            "error": "El producto destino no tiene PriceListProducts",
        }

    r = session_destino.post(f"{API_BASE}/Product/SaveProduct", json=producto_destino)
    r.raise_for_status()
    resp = r.json()

    if not resp.get("Product"):
        return {
            "ok": False,
            "codigo": plan["codigo"],
            "error": f"Error guardando producto: {resp}",
        }

    return {
        "ok": True,
        "codigo": plan["codigo"],
        "nombre": plan["nombre_visible_origen"],
        "cambios": plan["cambios"],
    }

def imprimir_preview_equiparacion(origen_nombre, destino_nombre, planes, errores):
    imprimir_seccion(f"Preview equiparacion {origen_nombre} -> {destino_nombre}")
    print(f"Codigos evaluados: {len(planes) + len(errores)}")
    print(f"Listos para aplicar: {len(planes)}")
    print(f"Con error: {len(errores)}")

    for plan in planes:
        print(f"\nCodigo {plan['codigo']}: {plan['nombre_destino'] or '(sin nombre)'} -> {plan['nombre_origen'] or '(sin nombre)'}")
        if not plan["cambios"]:
            print("  - Sin diferencias")
            continue
        for cambio in plan["cambios"]:
            origen = cambio["origen"]
            destino = cambio["destino"]
            if cambio["campo"] == "precio":
                origen = formatear_monto(origen or 0)
                destino = formatear_monto(destino or 0)
            elif cambio["campo"] == "activo":
                origen = "Activo" if origen else "Inactivo"
                destino = "Activo" if destino else "Inactivo"
            else:
                origen = origen or "(vacio)"
                destino = destino or "(vacio)"
            print(f"  - {cambio['campo']}: destino={destino} | origen={origen}")

    if errores:
        print("\nCodigos con error:")
        for error in errores:
            print(f"  - {error['codigo']}: {error['error']}")

def construir_payload_grupo(grupo):
    payload = {
        "Id": grupo.get("Id"),
        "Code": grupo.get("Code"),
        "Name": grupo.get("Name"),
        "Description": grupo.get("Description", ""),
        "IsMultipleSelectionAllowed": grupo.get("IsMultipleSelectionAllowed", False),
        "PicturePath": grupo.get("PicturePath", ""),
        "IsDisplayed": grupo.get("IsDisplayed", False),
        "DisplayNumber": grupo.get("DisplayNumber"),
        "Options": [],
        "DateCreated": grupo.get("DateCreated"),
        "DateUpdated": grupo.get("DateUpdated"),
        "CreatedUserId": grupo.get("CreatedUserId"),
        "UpdatedUserId": grupo.get("UpdatedUserId"),
        "IsActive": grupo.get("IsActive", True),
        "CurrentTimeZone": grupo.get("CurrentTimeZone", -3),
    }

    for option in grupo.get("Options", []):
        payload["Options"].append({
            "ProductId": option.get("ProductId"),
            "Price": float(option.get("Price", 0) or 0),
            "PriceNoTax": float(option.get("PriceNoTax", 0) or 0),
            "AlicuotaPercentage": float(option.get("AlicuotaPercentage", 0) or 0),
            "AlicuotaId": option.get("AlicuotaId", 0),
            "ObservationTypeId": option.get("ObservationTypeId"),
            "SizeId": option.get("SizeId"),
        })

    return payload

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
    nombre_producto = texto_visible(producto.get("Name"))
    precio_viejo = None
    if producto.get("PriceListProducts"):
        precio_viejo = float(producto["PriceListProducts"][0].get("Price", 0) or 0)

    precio_sin_iva = calcular_precio_sin_iva(
        precio_nuevo,
        alicuota_id=producto.get("AlicuotaId")
    )

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
        return {
            "ok": True,
            "codigo": codigo,
            "nombre": nombre_producto,
            "precio_viejo": precio_viejo,
            "precio_nuevo": precio_nuevo,
        }
    else:
        print(f"  ❌ Error guardando código {codigo}: {resp}")
        return {"ok": False}

def actualizar_precio_adicional(
    session,
    adicional,
    indice_productos,
    indice_grupos,
    cache_grupos,
):
    grupo_codigo = normalizar_codigo(adicional["grupo_codigo"])
    producto_codigo = normalizar_codigo(adicional["producto_codigo"])
    precio_nuevo = float(adicional["precio"])

    id_grupo = indice_grupos.get(grupo_codigo)
    if id_grupo is None:
        id_grupo = indice_grupos.get(grupo_codigo.upper())

    if id_grupo is None:
        print(f"  ⚠️  Grupo {grupo_codigo} no encontrado en NucleoCheck")
        return False

    id_producto = indice_productos.get(producto_codigo)
    if id_producto is None:
        id_producto = indice_productos.get(producto_codigo.upper())

    if id_producto is None:
        print(
            f"  ⚠️  Producto {producto_codigo} no encontrado para el grupo {grupo_codigo}"
        )
        return False

    grupo = cache_grupos.get(id_grupo)
    if grupo is None:
        grupo = obtener_grupo_producto(session, id_grupo)
        cache_grupos[id_grupo] = grupo

    opciones = [
        opcion
        for opcion in grupo.get("Options", [])
        if opcion.get("ProductId") == id_producto
    ]

    if not opciones:
        print(
            f"  ⚠️  El producto {producto_codigo} no existe dentro del grupo {grupo_codigo}"
        )
        return False

    if len(opciones) > 1:
        print(
            f"  ⚠️  El producto {producto_codigo} aparece más de una vez en el grupo {grupo_codigo}"
        )
        return False

    opcion = opciones[0]
    precio_viejo = float(opcion.get("Price", 0) or 0)
    opcion["Price"] = precio_nuevo
    opcion["PriceNoTax"] = calcular_precio_sin_iva(
        precio_nuevo,
        alicuota_id=opcion.get("AlicuotaId"),
        alicuota_percentage=opcion.get("AlicuotaPercentage"),
    )

    payload = construir_payload_grupo(grupo)
    r = session.post(f"{API_BASE}/ProductOptionGroup/SaveProductOptionGroup", json=payload)
    r.raise_for_status()
    resp = r.json()

    if resp.get("ProductOptionGroup"):
        print(
            f"  ✅ Grupo {grupo_codigo} / producto {producto_codigo} → ${precio_nuevo:,.0f}"
        )
        return {
            "ok": True,
            "grupo_codigo": grupo_codigo,
            "grupo_nombre": texto_visible(grupo.get("Name")),
            "producto_codigo": producto_codigo,
            "producto_nombre": texto_visible(opcion.get("Name") or adicional.get("producto_nombre")),
            "precio_viejo": precio_viejo,
            "precio_nuevo": precio_nuevo,
        }

    print(
        f"  ❌ Error guardando grupo {grupo_codigo} / producto {producto_codigo}: {resp}"
    )
    return {"ok": False}

# ─── LEER SHEET ───────────────────────────────────────────────────────────────

def leer_filas_sheet():
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds  = Credentials.from_service_account_file(CREDENTIALS_JSON, scopes=scopes)
    gc     = gspread.authorize(creds)
    sheet  = gc.open_by_key(SHEET_ID).worksheet(SHEET_NAME)
    return sheet.get_all_values(value_render_option=ValueRenderOption.formatted)

def leer_productos(rows=None):
    if rows is None:
        rows = leer_filas_sheet()

    productos = []
    for fila, row in enumerate(rows[FILA_INICIO:], start=FILA_INICIO + 1):
        try:
            codigo = normalizar_codigo(row[COL_CODIGO])
            precio_raw = str(row[COL_PRECIO]).strip()
            if not precio_raw:
                continue
            precio = normalizar_precio(precio_raw)
            productos.append({
                "codigo": codigo,
                "precio": precio,
                "identificador": codigo,
                "fila": fila,
            })
        except (ValueError, IndexError):
            continue
    return productos

def leer_adicionales_grupos(rows=None):
    if rows is None:
        rows = leer_filas_sheet()

    adicionales = []
    for fila, row in enumerate(rows[FILA_INICIO:], start=FILA_INICIO + 1):
        try:
            grupo_codigo = normalizar_codigo(row[COL_GRUPO_CODIGO])
            producto_codigo = normalizar_codigo(row[COL_GRUPO_PRODUCTO_CODIGO])
            precio_raw = str(row[COL_GRUPO_PRECIO]).strip()
            if not precio_raw:
                continue

            adicionales.append({
                "grupo_codigo": grupo_codigo,
                "grupo_nombre": str(row[COL_GRUPO_NOMBRE]).strip(),
                "producto_codigo": producto_codigo,
                "producto_nombre": str(row[COL_GRUPO_PRODUCTO_NOMBRE]).strip(),
                "precio": normalizar_precio(precio_raw),
                "identificador": f"{grupo_codigo}/{producto_codigo}",
                "fila": fila,
            })
        except (ValueError, IndexError):
            continue

    return adicionales

# ─── MAIN ─────────────────────────────────────────────────────────────────────

async def flujo_actualizar_precios():
    print("Actualizar precios:")
    for k, v in SUCURSALES.items():
        print(f"  {k} - {v['nombre']}")

    opcion = input("Ingresá 1 o 2: ").strip()
    if opcion not in SUCURSALES:
        print("Opción inválida.")
        return None

    sucursal = SUCURSALES[opcion]
    print(f"\n📍 Sucursal: {sucursal['nombre']}\n")

    print("¿Qué querés actualizar?")
    print("  1 - Productos")
    print("  2 - Adicionales")
    tipo_actualizacion = input("Ingresá 1 o 2: ").strip()
    if tipo_actualizacion not in {"1", "2"}:
        print("Opción inválida.")
        return None

    print("\n📋 Leyendo datos del Sheet...")
    rows = leer_filas_sheet()

    if tipo_actualizacion == "1":
        items = leer_productos(rows)
        descripcion_items = "productos"
    else:
        items = leer_adicionales_grupos(rows)
        descripcion_items = "adicionales"

    print(f"   {len(items)} {descripcion_items} encontrados\n")

    if not items:
        print("No hay datos para procesar.")
        return None

    if MODO_PRUEBA:
        print(
            f"⚠️  MODO PRUEBA — procesando solo el primer registro: {items[0]['identificador']}"
        )
        items = items[:1]
    else:
        print(f"🚀 MODO COMPLETO — procesando {len(items)} {descripcion_items}")

    print()

    session = await obtener_sesion_sucursal(sucursal, headless=False)
    print("✅ Sesión API lista\n")

    print("📦 Armando índice de productos por código...")
    indice_productos = obtener_indice_productos(session)
    print(f"   {len(indice_productos)} códigos indexados\n")

    indice_grupos = {}
    cache_grupos = {}
    if tipo_actualizacion == "2":
        print("🧩 Armando índice de grupos por código...")
        indice_grupos = obtener_indice_grupos(session)
        print(f"   {len(indice_grupos)} grupos indexados\n")

    exitosos = 0
    fallidos = []
    cambios = []

    for item in items:
        try:
            if tipo_actualizacion == "1":
                resultado_item = actualizar_precio(
                    session,
                    item["codigo"],
                    item["precio"],
                    indice_productos
                )
            else:
                resultado_item = actualizar_precio_adicional(
                    session,
                    item,
                    indice_productos,
                    indice_grupos,
                    cache_grupos,
                )

            if resultado_item.get("ok"):
                exitosos += 1
                cambios.append(resultado_item)
            else:
                fallidos.append(item["identificador"])
        except Exception as e:
            print(f"  ❌ Error en {item['identificador']}: {e}")
            fallidos.append(item["identificador"])

    print(f"\n{'─'*40}")
    print(f"✅ Exitosos : {exitosos}")
    print(f"❌ Fallidos : {len(fallidos)}")
    if fallidos:
        print(f"   Registros: {', '.join(fallidos)}")

    return {
        "tipo": "actualizacion",
        "subtipo": "productos" if tipo_actualizacion == "1" else "adicionales",
        "sucursal": sucursal["nombre"],
        "exitosos": exitosos,
        "fallidos": fallidos,
        "cambios": cambios,
    }

async def flujo_equiparar_productos():
    print("Equiparar productos:")
    print("  1 - Recoleta -> Palermo")
    print("  2 - Palermo -> Recoleta")

    direccion = input("Ingresá 1 o 2: ").strip()
    if direccion == "1":
        origen = SUCURSALES["1"]
        destino = SUCURSALES["2"]
    elif direccion == "2":
        origen = SUCURSALES["2"]
        destino = SUCURSALES["1"]
    else:
        print("Opcion invalida.")
        return None

    codigos = parsear_codigos_seleccionados(
        input("Ingresá los códigos separados por coma: ").strip()
    )
    if not codigos:
        print("No ingresaste codigos validos.")
        return None

    print(f"\nPreparando equiparacion {origen['nombre']} -> {destino['nombre']}...")

    print(f"\nIniciando sesion en {origen['nombre']}...")
    session_origen = await obtener_sesion_sucursal(origen, headless=True)
    print(f"Sesion {origen['nombre']} lista")

    print(f"\nIniciando sesion en {destino['nombre']}...")
    session_destino = await obtener_sesion_sucursal(destino, headless=True)
    print(f"Sesion {destino['nombre']} lista")

    print(f"\nArmando indice de productos de {origen['nombre']}...")
    indice_origen = obtener_indice_productos(session_origen)
    print(f"   {len(indice_origen)} codigos indexados")

    print(f"\nArmando indice de productos de {destino['nombre']}...")
    indice_destino = obtener_indice_productos(session_destino)
    print(f"   {len(indice_destino)} codigos indexados")

    print(f"\nDescargando rubros y subrubros de {destino['nombre']}...")
    categorias_destino, subcategorias_destino = obtener_indices_categorias(session_destino)
    print(
        f"   {len(categorias_destino)} rubros y {len(subcategorias_destino)} subrubros disponibles"
    )

    planes = []
    errores = []

    for codigo in codigos:
        producto_origen = obtener_producto_por_codigo(session_origen, codigo, indice_origen)
        if producto_origen is None:
            errores.append({
                "codigo": codigo,
                "error": f"Codigo inexistente en {origen['nombre']}",
            })
            continue

        producto_destino = obtener_producto_por_codigo(session_destino, codigo, indice_destino)
        if producto_destino is None:
            errores.append({
                "codigo": codigo,
                "error": f"Codigo inexistente en {destino['nombre']}",
            })
            continue

        plan = preparar_equiparacion_producto(
            codigo,
            producto_origen,
            producto_destino,
            categorias_destino,
            subcategorias_destino,
        )
        if plan["ok"]:
            plan["producto_destino"] = producto_destino
            planes.append(plan)
        else:
            errores.append(plan)

    imprimir_preview_equiparacion(origen["nombre"], destino["nombre"], planes, errores)

    confirmacion = input("\n¿Aplicar cambios en destino? (s/n): ").strip().casefold()
    if confirmacion not in {"s", "si", "sí"}:
        print("Operacion cancelada.")
        return {
            "tipo": "equiparacion",
            "origen": origen["nombre"],
            "destino": destino["nombre"],
            "codigos": codigos,
            "aplicados": 0,
            "fallidos": [f"{error['codigo']} | {error['error']}" for error in errores],
            "cambios": [],
        }

    aplicados = 0
    fallidos = [f"{error['codigo']} | {error['error']}" for error in errores]
    cambios = []

    for plan in planes:
        try:
            resultado = aplicar_equiparacion_producto(
                session_destino,
                plan["producto_destino"],
                plan,
            )
            if resultado["ok"]:
                aplicados += 1
                cambios.append({
                    "codigo": resultado["codigo"],
                    "nombre": resultado["nombre"],
                    "detalle": plan["cambios"],
                })
                print(f"  OK {resultado['codigo']} | {resultado['nombre']}")
            else:
                mensaje = f"{resultado['codigo']} | {resultado['error']}"
                fallidos.append(mensaje)
                print(f"  ERROR {mensaje}")
        except Exception as e:
            mensaje = f"{plan['codigo']} | {e}"
            fallidos.append(mensaje)
            print(f"  ERROR {mensaje}")

    print(f"\n{'=' * 40}")
    print(f"Aplicados: {aplicados}")
    print(f"Fallidos : {len(fallidos)}")

    return {
        "tipo": "equiparacion",
        "origen": origen["nombre"],
        "destino": destino["nombre"],
        "codigos": codigos,
        "aplicados": aplicados,
        "fallidos": fallidos,
        "cambios": cambios,
    }

async def flujo_equiparar_productos():
    tipos_comparacion = obtener_tipos_comparacion()

    print("Equiparar:")
    for codigo_tipo, nombre_tipo in tipos_comparacion:
        print(f"  {codigo_tipo} - {nombre_tipo}")

    tipo_comparacion = input("Ingresá 1, 2, 3, 4 o 5: ").strip()
    if tipo_comparacion not in {codigo for codigo, _ in tipos_comparacion}:
        print("Opción inválida.")
        return None

    configuracion = obtener_configuracion_equiparacion(tipo_comparacion)

    print("\nDirección:")
    print("  1 - Recoleta -> Palermo")
    print("  2 - Palermo -> Recoleta")

    direccion = input("Ingresá 1 o 2: ").strip()
    if direccion == "1":
        origen = SUCURSALES["1"]
        destino = SUCURSALES["2"]
    elif direccion == "2":
        origen = SUCURSALES["2"]
        destino = SUCURSALES["1"]
    else:
        print("Opción inválida.")
        return None

    print("\nModo:")
    print("  1 - Códigos seleccionados")
    print("  2 - Todo")

    modo = input("Ingresá 1 o 2: ").strip()
    if modo not in {"1", "2"}:
        print("Opción inválida.")
        return None

    print(
        f"\nPreparando equiparación de {configuracion['tipo']} "
        f"{origen['nombre']} -> {destino['nombre']}..."
    )

    print(f"\nIniciando sesión en {origen['nombre']}...")
    session_origen = await obtener_sesion_sucursal(origen, headless=True)
    print(f"Sesión {origen['nombre']} lista")

    print(f"\nIniciando sesión en {destino['nombre']}...")
    session_destino = await obtener_sesion_sucursal(destino, headless=True)
    print(f"Sesión {destino['nombre']} lista")

    print(f"\nArmando índice de {configuracion['tipo'].lower()} de {origen['nombre']}...")
    indice_origen = obtener_indice_por_codigo_generico(session_origen, configuracion)
    print(f"   {len(indice_origen)} códigos indexados")

    print(f"\nArmando índice de {configuracion['tipo'].lower()} de {destino['nombre']}...")
    indice_destino = obtener_indice_por_codigo_generico(session_destino, configuracion)
    print(f"   {len(indice_destino)} códigos indexados")

    categorias_destino = {}
    subcategorias_destino = {}
    if configuracion.get("has_categories"):
        print(f"\nDescargando rubros y subrubros de {destino['nombre']}...")
        categorias_destino, subcategorias_destino = obtener_indices_categorias(session_destino)
        print(
            f"   {len(categorias_destino)} rubros y {len(subcategorias_destino)} subrubros disponibles"
        )

    if modo == "1":
        codigos = parsear_codigos_seleccionados(
            input("Ingresá los códigos separados por coma: ").strip()
        )
        if not codigos:
            print("No ingresaste códigos válidos.")
            return None
    else:
        print(f"\nObteniendo todos los códigos de {configuracion['tipo'].lower()} desde origen...")
        codigos = obtener_codigos_todos_para_equiparar(session_origen, tipo_comparacion)
        print(f"   {len(codigos)} códigos encontrados")
        if not codigos:
            print("No hay códigos para procesar.")
            return None

    planes = []
    errores = []

    for codigo in codigos:
        entidad_origen = obtener_entidad_por_codigo(
            session_origen,
            codigo,
            indice_origen,
            configuracion,
        )
        if entidad_origen is None:
            errores.append({
                "codigo": codigo,
                "error": f"Código inexistente en {origen['nombre']}",
            })
            continue

        entidad_destino = obtener_entidad_por_codigo(
            session_destino,
            codigo,
            indice_destino,
            configuracion,
        )
        if entidad_destino is None:
            errores.append({
                "codigo": codigo,
                "error": f"Código inexistente en {destino['nombre']}",
            })
            continue

        plan = preparar_equiparacion_entidad(
            codigo,
            configuracion,
            entidad_origen,
            entidad_destino,
            categorias_destino,
            subcategorias_destino,
        )
        if plan["ok"]:
            plan["entidad_destino"] = entidad_destino
            planes.append(plan)
        else:
            errores.append(plan)

    imprimir_preview_equiparacion(
        f"{origen['nombre']} ({configuracion['tipo']})",
        f"{destino['nombre']} ({configuracion['tipo']})",
        planes,
        errores,
    )

    confirmacion = input("\n¿Aplicar cambios en destino? (s/n): ").strip().casefold()
    if confirmacion not in {"s", "si", "sí"}:
        print("Operación cancelada.")
        return {
            "tipo": "equiparacion",
            "tipo_entidad": configuracion["tipo"],
            "origen": origen["nombre"],
            "destino": destino["nombre"],
            "codigos": codigos,
            "aplicados": 0,
            "fallidos": [f"{error['codigo']} | {error['error']}" for error in errores],
            "cambios": [],
        }

    aplicados = 0
    fallidos = [f"{error['codigo']} | {error['error']}" for error in errores]
    cambios = []

    for plan in planes:
        try:
            resultado = aplicar_equiparacion_entidad(
                session_destino,
                plan["entidad_destino"],
                plan,
                configuracion,
            )
            if resultado["ok"]:
                aplicados += 1
                cambios.append({
                    "codigo": resultado["codigo"],
                    "nombre": resultado["nombre"],
                    "detalle": plan["cambios"],
                })
                print(f"  OK {resultado['codigo']} | {resultado['nombre']}")
            else:
                mensaje = f"{resultado['codigo']} | {resultado['error']}"
                fallidos.append(mensaje)
                print(f"  ERROR {mensaje}")
        except Exception as e:
            mensaje = f"{plan['codigo']} | {e}"
            fallidos.append(mensaje)
            print(f"  ERROR {mensaje}")

    print(f"\n{'=' * 40}")
    print(f"Aplicados: {aplicados}")
    print(f"Fallidos : {len(fallidos)}")

    return {
        "tipo": "equiparacion",
        "tipo_entidad": configuracion["tipo"],
        "origen": origen["nombre"],
        "destino": destino["nombre"],
        "codigos": codigos,
        "aplicados": aplicados,
        "fallidos": fallidos,
        "cambios": cambios,
    }

async def flujo_comparar():
    tipos_comparacion = obtener_tipos_comparacion()

    print("Comparar:")
    for codigo_tipo, nombre_tipo in tipos_comparacion:
        print(f"  {codigo_tipo} - {nombre_tipo}")

    tipo_comparacion = input("Ingresá 1, 2, 3, 4 o 5: ").strip()
    if tipo_comparacion not in {codigo for codigo, _ in tipos_comparacion}:
        print("Opción inválida.")
        return None

    print("\n🔐 Iniciando sesión en Recoleta...")
    session_recoleta = await obtener_sesion_sucursal(SUCURSALES["1"], headless=True)
    print("✅ Sesión Recoleta lista")

    print("\n🔐 Iniciando sesión en Palermo...")
    session_palermo = await obtener_sesion_sucursal(SUCURSALES["2"], headless=True)
    print("✅ Sesión Palermo lista")

    print(f"\n📥 Descargando datos de Recoleta para tipo {tipo_comparacion}...")
    datos_recoleta = obtener_datos_comparacion(session_recoleta, tipo_comparacion)
    print(f"   {len(datos_recoleta['items'])} registros obtenidos")

    print(f"\n📥 Descargando datos de Palermo para tipo {tipo_comparacion}...")
    datos_palermo = obtener_datos_comparacion(session_palermo, tipo_comparacion)
    print(f"   {len(datos_palermo['items'])} registros obtenidos")

    reporte = comparar_entidades(
        datos_recoleta["tipo"],
        datos_recoleta["items"],
        datos_palermo["items"],
    )
    imprimir_reporte_comparacion(
        reporte,
        tipo_comparacion,
        datos_recoleta=datos_recoleta,
        datos_palermo=datos_palermo,
    )

    return {
        "tipo": "comparacion",
        "tipo_comparacion": tipo_comparacion,
        "reporte": reporte,
        "datos_recoleta": datos_recoleta,
        "datos_palermo": datos_palermo,
    }

async def main():
    while True:
        print("Función:")
        print("  1 - Actualizar precios")
        print("  2 - Comparar")
        print("  3 - Equiparar productos")

        funcion = input("Ingresá 1, 2 o 3: ").strip()
        if funcion == "1":
            resultado = await flujo_actualizar_precios()
        elif funcion == "2":
            resultado = await flujo_comparar()
        elif funcion == "3":
            resultado = await flujo_equiparar_productos()
        else:
            print("Opción inválida.")
            continue

        if not resultado:
            continue

        while True:
            opcion_post = menu_post_proceso()
            if opcion_post == "1":
                print()
                break
            if opcion_post == "2":
                ruta = guardar_resumen(resultado)
                print(f"✅ Resumen guardado en: {ruta}")
                continue
            if opcion_post == "3":
                print("Cerrando...")
                return

            print("Opción inválida.")

if __name__ == "__main__":
    asyncio.run(main())

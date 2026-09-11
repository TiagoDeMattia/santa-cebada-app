"""
analizador_api.py
─────────────────
Abre NucleoCheck en un browser visible, intercepta todos los requests de red,
y cuando cerrás el browser guarda un reporte con los llamados a la API.

USO:
    python analizador_api.py

Luego:
    1. Logeate manualmente en NucleoCheck
    2. Andá a un producto y editá el precio
    3. Guardá el producto
    4. Cerrá el browser (o presioná Enter en la terminal)
    5. Revisá el archivo "api_requests.txt" generado
"""

import asyncio
import json
from datetime import datetime
from playwright.async_api import async_playwright

NUCLEO_URL = "https://prod.nucleocheck.com"
OUTPUT_FILE = "api_requests.txt"

# Métodos y keywords que nos interesan
METODOS_INTERES   = {"PUT", "PATCH", "POST"}
KEYWORDS_INTERES  = ["product", "precio", "price", "item", "menu"]

requests_capturados = []

def es_interesante(request):
    if request.method in METODOS_INTERES:
        return True
    url_lower = request.url.lower()
    if any(k in url_lower for k in KEYWORDS_INTERES):
        return True
    return False

async def main():
    print("🔍 Analizador de API NucleoCheck")
    print("─" * 40)
    print("1. Se abrirá el browser — logeate manualmente")
    print("2. Editá un producto y guardá")
    print("3. Cuando termines, volvé acá y presioná Enter")
    print("─" * 40)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page    = await context.new_page()

        # Interceptar TODOS los requests
        async def on_request(request):
            try:
                post_data = request.post_data
            except Exception:
                post_data = None

            entry = {
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "method":    request.method,
                "url":       request.url,
                "headers":   dict(request.headers),
                "post_data": post_data,
                "interesante": es_interesante(request),
            }
            requests_capturados.append(entry)

            if es_interesante(request):
                print(f"  🟡 [{request.method}] {request.url}")
                if post_data:
                    print(f"       BODY: {post_data[:300]}")

        # Interceptar responses para capturar el body
        async def on_response(response):
            if es_interesante(response.request):
                try:
                    body = await response.text()
                    # Adjuntar body al último request capturado que coincida
                    for entry in reversed(requests_capturados):
                        if entry["url"] == response.request.url:
                            entry["response_status"] = response.status
                            entry["response_body"]   = body[:500]
                            break
                except Exception:
                    pass

        page.on("request",  on_request)
        page.on("response", on_response)

        await page.goto(NUCLEO_URL)

        # Esperar que el usuario termine
        print("\n⏳ Esperando... (presioná Enter cuando termines de editar)")
        await asyncio.get_event_loop().run_in_executor(None, input)

        await browser.close()

    # ── Guardar reporte ──────────────────────────────────────────────────
    interesantes = [r for r in requests_capturados if r["interesante"]]
    todos        = requests_capturados

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("=" * 60 + "\n")
        f.write("REPORTE API NUCLEOCHECK\n")
        f.write(f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total requests: {len(todos)} | Interesantes: {len(interesantes)}\n")
        f.write("=" * 60 + "\n\n")

        f.write("── REQUESTS INTERESANTES ──\n\n")
        for r in interesantes:
            f.write(f"[{r['timestamp']}] {r['method']} {r['url']}\n")
            if r.get("post_data"):
                f.write(f"  BODY: {r['post_data']}\n")
            if r.get("response_status"):
                f.write(f"  RESPONSE ({r['response_status']}): {r.get('response_body','')}\n")
            f.write("\n")

        f.write("\n── TODOS LOS REQUESTS ──\n\n")
        for r in todos:
            f.write(f"[{r['timestamp']}] {r['method']} {r['url']}\n")

    print(f"\n✅ Reporte guardado en: {OUTPUT_FILE}")
    print(f"   {len(interesantes)} requests interesantes encontrados")

if __name__ == "__main__":
    asyncio.run(main())

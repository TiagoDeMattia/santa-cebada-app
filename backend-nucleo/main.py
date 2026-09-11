"""
Backend Nucleo - API para gestión de precios Santa Cebada
"""
import asyncio
import sys

# Windows requiere ProactorEventLoop para que Playwright pueda
# lanzar subprocesos desde dentro de uvicorn/asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from pathlib import Path

from src.config import settings
from src.routes import api_router
from src.utils.logger import setup_logger, logger

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"


async def _periodic_inflation_refresh():
    """Mantiene el cache de inflacion caliente; refresca cada 12 horas."""
    from src.services.inflation_service import get_inflation_indices
    while True:
        try:
            await asyncio.to_thread(get_inflation_indices)
        except Exception:
            pass
        await asyncio.sleep(12 * 3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager para la aplicacion
    """
    # Startup
    logger.info("Iniciando Backend Nucleo...")
    logger.info(f"Environment: {'development' if settings.debug else 'production'}")
    logger.info(f"Server: {settings.host}:{settings.port}")

    # Crear tablas si no existen
    from src.services.database import ensure_schema
    ensure_schema()
    logger.info("Base de datos inicializada")

    # Crear tablas de historial
    from src.services.historial_service import crear_tablas_historial
    crear_tablas_historial()
    logger.info("Tablas de historial inicializadas")

    # Inicializar schema de Barriles V2
    from src.services.barriles_v2_service import ensure_schema as bv2_schema
    bv2_schema()
    logger.info("Schema Barriles V2 inicializado")

    # Iniciar scheduler para capturas automaticas
    from src.services.scheduler_service import start_scheduler
    await start_scheduler()

    # Iniciar refresh periodico de inflacion (cada 12h; ArgentinaDatos se actualiza
    # dentro de las 24h de que INDEC publica el IPC mensual)
    asyncio.create_task(_periodic_inflation_refresh())

    yield

    # Shutdown
    logger.info("Apagando Backend Nucleo...")
    from src.services.scheduler_service import stop_scheduler
    await stop_scheduler()


app = FastAPI(
    title="Backend Nucleo - Santa Cebada",
    description="""
    API para gestión de precios y productos del sistema NucleoCheck.

    ## Funcionalidades

    - **Productos**: Listar, buscar, actualizar precios
    - **Sucursales**: Gestión de Recoleta y Palermo
    - **Actualización masiva**: Desde Google Sheets
    - **Comparación**: Detectar diferencias entre sucursales

    ## Autenticación

    Todos los endpoints requieren autenticación JWT.
    Primero obtén un token en `/api/auth/login`.
    """,
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios reales
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers API
app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "backend-nucleo"}


# Catch-all: sirve el frontend React (SPA). Siempre registrado para que
# un restart del backend durante el deploy no quede atascado en modo JSON.
@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    from fastapi.responses import JSONResponse
    file_path = FRONTEND_DIST / full_path
    if file_path.is_file():
        return FileResponse(str(file_path))
    index_path = FRONTEND_DIST / "index.html"
    if index_path.is_file():
        return FileResponse(
            str(index_path),
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )
    return JSONResponse({"status": "ok", "message": "Backend Nucleo - Santa Cebada", "docs": "/docs"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        loop="asyncio",
    )

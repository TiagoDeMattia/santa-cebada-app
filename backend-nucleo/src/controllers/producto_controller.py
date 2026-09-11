"""
Controlador de productos y precios
"""
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional, List

from ..models.schemas import (
    Producto,
    ProductoUpdate,
    PrecioUpdate,
    ActualizarDesdeSheetRequest,
    ActualizacionResultado,
    ApiResponse,
)
from ..services.producto_service import ProductoService
from ..middleware.auth import get_current_user, TokenPayload
from ..utils.logger import logger

router = APIRouter(prefix="/productos", tags=["Productos"])


def get_service() -> ProductoService:
    return ProductoService()


def get_catalogo_service():
    from ..services.catalogo_service import buscar_en_catalogo, get_cache_info
    return buscar_en_catalogo, get_cache_info


# ─── LISTAR / BUSCAR ──────────────────────────────────────────────────────────

@router.get("", response_model=List[Producto])
async def listar_productos(
    codigo: Optional[str] = Query(None),
    nombre: Optional[str] = Query(None),
    sucursal_id: str = Query("1", description="1=Recoleta, 2=Palermo"),
    usar_cache: bool = Query(True, description="Usar catálogo cacheado (más rápido)"),
    force_refresh: bool = Query(False, description="Forzar descarga desde NucleoCheck"),
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Lista/busca productos. Por defecto usa el catálogo cacheado (muy rápido).
    Pasá force_refresh=true para actualizar el caché desde NucleoCheck.
    """
    if usar_cache:
        try:
            buscar, _ = get_catalogo_service()
            productos = buscar(
                sucursal_id=sucursal_id,
                codigo=codigo,
                nombre=nombre,
                force_refresh=force_refresh,
            )
            return [
                Producto(
                    id=p.get("product_id"),
                    codigo=p.get("codigo") or "",
                    nombre=p.get("nombre") or "",
                    precio=p.get("precio"),
                    categoria=p.get("categoria"),
                    subcategoria=p.get("subcategoria"),
                    activo=bool(p.get("activo", 1)),
                    alicuota_id=p.get("alicuota_id"),
                    company_id=p.get("company_id"),
                )
                for p in productos
                if p.get("codigo") and p.get("nombre")
            ]
        except Exception as e:
            logger.warning(f"Caché falló, usando API directa: {e}")
            # Fallback a API directa

    # API directa (lenta, requiere Playwright)
    try:
        service = get_service()
        productos = await service.buscar_productos(codigo=codigo, nombre=nombre, sucursal_id=sucursal_id)
        return [
            Producto(
                id=p.get("Id"),
                codigo=p.get("Code") or "",
                nombre=p.get("Name") or "",
                categoria=p.get("CategoryName"),
                subcategoria=p.get("SubCategoryName"),
                activo=p.get("IsActive", True),
            )
            for p in productos
        ]
    except Exception as e:
        logger.error(f"Error listando productos: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/cache-info")
async def cache_info(current_user: TokenPayload = Depends(get_current_user)):
    """Estado del caché de catálogo para ambas sucursales."""
    try:
        _, get_info = get_catalogo_service()
        return get_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── ACTUALIZAR PRECIO ────────────────────────────────────────────────────────

@router.post("/actualizar-precio", response_model=ApiResponse)
async def actualizar_precio(
    data: PrecioUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Actualiza el precio de un producto por código."""
    try:
        # Usar login directo (sin Playwright) si el producto está en caché
        from ..services.catalogo_service import buscar_en_catalogo, _make_session, _API_BASE
        from ..utils.helpers import normalizar_codigo, calcular_precio_sin_iva

        productos = buscar_en_catalogo(sucursal_id=data.sucursal_id, codigo=data.codigo)
        if productos:
            p = productos[0]
            product_id = p.get("product_id")
            alicuota_id = p.get("alicuota_id")

            if product_id:
                session = _make_session(data.sucursal_id)
                # Obtener producto completo
                r = session.get(f"{_API_BASE}/Product/FindById/{product_id}", timeout=15)
                r.raise_for_status()
                producto_full = r.json()

                tasa = {1: 1.21, 2: 1.105, 3: 1.0}.get(alicuota_id, 1.21)
                precio_sin_iva = round(data.precio / tasa, 5)

                if producto_full.get("PriceListProducts"):
                    producto_full["PriceListProducts"][0]["Price"] = data.precio
                    producto_full["PriceListProducts"][0]["PriceNoTax"] = precio_sin_iva

                    r2 = session.post(f"{_API_BASE}/Product/SaveProduct", json=producto_full, timeout=15)
                    r2.raise_for_status()
                    resp = r2.json()

                    if resp.get("Product"):
                        logger.info(f"Precio actualizado (caché): {data.codigo} → ${data.precio:,.0f}")
                        return ApiResponse(
                            success=True,
                            message=f"Precio actualizado: {data.codigo} → ${data.precio:,.2f}",
                        )

        # Fallback a servicio con Playwright
        service = get_service()
        resultado = await service.actualizar_precio_individual(
            codigo=data.codigo, precio=data.precio, sucursal_id=data.sucursal_id,
        )
        if resultado.get("success"):
            return ApiResponse(
                success=True,
                message=f"Precio actualizado: {data.codigo} → ${data.precio:,.2f}",
                data=resultado,
            )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=resultado.get("error"))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error actualizando precio: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ─── ACTUALIZAR DESDE SHEET ───────────────────────────────────────────────────

@router.post("/actualizar-desde-sheet", response_model=ActualizacionResultado)
async def actualizar_desde_sheet(
    data: ActualizarDesdeSheetRequest = ActualizarDesdeSheetRequest(),
    service: ProductoService = Depends(get_service),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Actualiza precios masivamente desde Google Sheets."""
    try:
        resultado = await service.actualizar_desde_sheet(
            sucursal_id=data.sucursal_id,
            modo_prueba=data.modo_prueba,
            username=current_user.sub,
        )
        return ActualizacionResultado(
            exitosos=resultado.get("exitosos", 0),
            fallidos=resultado.get("fallidos", 0),
            detalles_fallidos=resultado.get("detalles_fallidos", []),
        )
    except Exception as e:
        logger.error(f"Error actualizando desde sheet: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ─── OBTENER POR ID ───────────────────────────────────────────────────────────

@router.get("/{producto_id}", response_model=Producto)
async def obtener_producto(
    producto_id: int,
    sucursal_id: str = Query("1"),
    service: ProductoService = Depends(get_service),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Obtiene detalles de un producto por ID."""
    try:
        producto = await service.obtener_producto(producto_id=producto_id, sucursal_id=sucursal_id)
        if not producto:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
        return Producto(
            id=producto.get("Id"),
            codigo=producto.get("Code") or "",
            nombre=producto.get("Name") or "",
            precio=producto.get("PriceListProducts", [{}])[0].get("Price") if producto.get("PriceListProducts") else None,
            categoria=producto.get("CategoryName"),
            subcategoria=producto.get("SubCategoryName"),
            activo=producto.get("IsActive", True),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo producto: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

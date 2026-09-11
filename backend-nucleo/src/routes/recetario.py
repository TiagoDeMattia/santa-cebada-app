"""
Rutas para gestión de recetario (linkeo de productos).
"""
from fastapi import APIRouter, Query, Body
from typing import Optional

from ..controllers import recetario_controller

router = APIRouter(prefix="/recetario", tags=["recetario"])


@router.post("/generar-linkeos")
def generar_linkeos_automaticos(
    sucursal: str = Query("recoleta", description="Sucursal: 'recoleta' o 'palermo'")
):
    """
    Genera linkeos automáticos entre productos Nucleo y Stock.
    
    **Parámetros:**
    - sucursal: Sucursal para obtener productos (default: 'recoleta')
    
    **Retorna:**
    - Resumen de linkeos generados
    - Lista de primeros 20 linkeos para preview
    
    **Categorías incluidas:**
    - Alcoholes (fernet, vodka, gin, whisky, ron, tequila, etc.)
    - Vinos (vino, espumante, champagne)
    - Gaseosas (coca, sprite, fanta, schweppes, tónica, soda)
    - Cervezas sin TACC
    
    **Conversiones por defecto:**
    - Alcoholes: 75ml por trago
    - Vinos: 150ml por copa
    - Gaseosas: 250ml por vaso
    - Cervezas sin TACC: 330ml por botella
    
    **Ejemplo:**
    - `POST /recetario/generar-linkeos?sucursal=recoleta`
    """
    return recetario_controller.generar_linkeos_automaticos(sucursal)


@router.get("/linkeos")
def get_linkeos(
    activo_solo: bool = Query(False, description="Solo linkeos activos")
):
    """
    Obtiene todos los linkeos entre productos Nucleo y Stock.
    
    **Parámetros:**
    - activo_solo: Si True, solo retorna linkeos activos
    
    **Retorna:**
    - Lista de linkeos con:
      - producto_nucleo_id: ID del producto en Nucleo
      - producto_nucleo_nombre: Nombre del producto en Nucleo
      - producto_stock_codigo: Código del producto en Stock
      - producto_stock_nombre: Nombre del producto en Stock
      - categoria: Categoría (alcoholes, vinos, gaseosas, cervezas_sin_tacc)
      - conversion_ml: Conversión en ml
      - conversion_unidades: Conversión en unidades
      - activo: Si el linkeo está activo
      - auto_generado: Si fue generado automáticamente
    
    **Ejemplo:**
    - `/recetario/linkeos`
    - `/recetario/linkeos?activo_solo=true`
    """
    from fastapi.responses import JSONResponse
    data = recetario_controller.get_linkeos(activo_solo)
    return JSONResponse(
        content=data,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.put("/linkeos/{linkeo_id}")
def actualizar_linkeo(
    linkeo_id: int,
    unidad_medida_stock: Optional[str] = Body(None, description="Nueva unidad de medida del producto de stock"),
    cantidad_stock: Optional[float] = Body(None, description="Nueva cantidad del producto de stock"),
    unidad_medida_nucleo: Optional[str] = Body(None, description="Nueva unidad de medida del producto nucleo"),
    cantidad_nucleo: Optional[float] = Body(None, description="Nueva cantidad del producto nucleo"),
    activo: Optional[bool] = Body(None, description="Nuevo estado activo")
):
    """
    Actualiza un linkeo existente.
    
    **Parámetros:**
    - linkeo_id: ID del linkeo a actualizar
    - unidad_medida_stock: (Opcional) Nueva unidad de medida del producto de stock
    - cantidad_stock: (Opcional) Nueva cantidad del producto de stock
    - unidad_medida_nucleo: (Opcional) Nueva unidad de medida del producto nucleo
    - cantidad_nucleo: (Opcional) Nueva cantidad del producto nucleo
    - activo: (Opcional) Nuevo estado activo
    
    **Retorna:**
    - Linkeo actualizado
    
    **Ejemplo:**
    ```json
    PUT /recetario/linkeos/1
    {
      "unidad_medida_stock": "L",
      "cantidad_stock": 1.0,
      "unidad_medida_nucleo": "ml",
      "cantidad_nucleo": 75.0,
      "activo": true
    }
    ```
    """
    return recetario_controller.actualizar_linkeo(
        linkeo_id=linkeo_id,
        unidad_medida_stock=unidad_medida_stock,
        cantidad_stock=cantidad_stock,
        unidad_medida_nucleo=unidad_medida_nucleo,
        cantidad_nucleo=cantidad_nucleo,
        activo=activo
    )


@router.delete("/linkeos/{linkeo_id}")
def eliminar_linkeo(linkeo_id: int):
    """
    Elimina un linkeo.
    
    **Parámetros:**
    - linkeo_id: ID del linkeo a eliminar
    
    **Retorna:**
    - Confirmación de eliminación
    
    **Ejemplo:**
    - `DELETE /recetario/linkeos/1`
    """
    return recetario_controller.eliminar_linkeo(linkeo_id)


@router.post("/linkeos")
def crear_linkeo_manual(
    producto_nucleo_id: int = Body(..., description="ID del producto en Nucleo"),
    producto_nucleo_codigo: str = Body(..., description="Código del producto en Nucleo"),
    producto_nucleo_nombre: str = Body(..., description="Nombre del producto en Nucleo"),
    producto_stock_codigo: str = Body(..., description="Código del producto en Stock"),
    producto_stock_nombre: str = Body(..., description="Nombre del producto en Stock"),
    categoria: str = Body(..., description="Categoría (alcoholes, vinos, gaseosas, cervezas_sin_tacc)"),
    unidad_medida_stock: str = Body("L", description="Unidad de medida del producto de stock"),
    cantidad_stock: float = Body(1.0, description="Cantidad del producto de stock"),
    unidad_medida_nucleo: str = Body("ml", description="Unidad de medida del producto nucleo"),
    cantidad_nucleo: float = Body(75.0, description="Cantidad del producto nucleo")
):
    """
    Crea un linkeo manual entre producto Nucleo y Stock.
    
    **Parámetros:**
    - producto_nucleo_id: ID del producto en Nucleo
    - producto_nucleo_codigo: Código del producto en Nucleo
    - producto_nucleo_nombre: Nombre del producto en Nucleo
    - producto_stock_codigo: Código del producto en Stock
    - producto_stock_nombre: Nombre del producto en Stock
    - categoria: Categoría del producto
    - unidad_medida_stock: Unidad de medida del producto de stock (default: "L")
    - cantidad_stock: Cantidad del producto de stock (default: 1.0)
    - unidad_medida_nucleo: Unidad de medida del producto nucleo (default: "ml")
    - cantidad_nucleo: Cantidad del producto nucleo (default: 75.0)
    
    **Retorna:**
    - Confirmación de creación con ID del linkeo
    
    **Ejemplo:**
    ```json
    POST /recetario/linkeos
    {
      "producto_nucleo_id": 123,
      "producto_nucleo_codigo": "FERNET001",
      "producto_nucleo_nombre": "Fernet con Coca",
      "producto_stock_codigo": "S001",
      "producto_stock_nombre": "Fernet Branca 1L",
      "categoria": "alcoholes",
      "unidad_medida_stock": "L",
      "cantidad_stock": 1.0,
      "unidad_medida_nucleo": "ml",
      "cantidad_nucleo": 75.0
    }
    ```
    """
    return recetario_controller.crear_linkeo_manual(
        producto_nucleo_id=producto_nucleo_id,
        producto_nucleo_codigo=producto_nucleo_codigo,
        producto_nucleo_nombre=producto_nucleo_nombre,
        producto_stock_codigo=producto_stock_codigo,
        producto_stock_nombre=producto_stock_nombre,
        categoria=categoria,
        unidad_medida_stock=unidad_medida_stock,
        cantidad_stock=cantidad_stock,
        unidad_medida_nucleo=unidad_medida_nucleo,
        cantidad_nucleo=cantidad_nucleo
    )


@router.get("/unidades-medida")
def get_unidades_medida():
    """
    Obtiene todas las unidades de medida disponibles.
    
    **Retorna:**
    - Lista de unidades de medida con:
      - id: ID de la unidad
      - nombre: Nombre completo (ej: "Litro")
      - abreviatura: Abreviatura (ej: "L")
      - tipo: Tipo de unidad (volumen, peso, cantidad)
      - conversion_a_base: Factor de conversión a unidad base
      - unidad_base: Unidad base (ml, gr, unidad)
    
    **Unidades predefinidas:**
    - Litro (L) → 1000 ml
    - Mililitro (ml) → 1 ml
    - Kilogramo (Kg) → 1000 gr
    - Gramo (gr) → 1 gr
    - SixPack → 6 unidades
    - Pack de 8 → 8 unidades
    - Unidad → 1 unidad
    - Caja → 1 unidad (configurable)
    
    **Ejemplo:**
    - `/recetario/unidades-medida`
    """
    return recetario_controller.get_unidades_medida()


@router.post("/unidades-medida")
def crear_unidad_medida(
    nombre: str = Body(..., description="Nombre de la unidad (ej: 'Pack de 12')"),
    abreviatura: str = Body(..., description="Abreviatura (ej: 'pack12')"),
    tipo: str = Body(..., description="Tipo: volumen, peso, cantidad"),
    conversion_a_base: float = Body(..., description="Factor de conversión a unidad base"),
    unidad_base: str = Body(..., description="Unidad base: ml, gr, unidad")
):
    """
    Crea una nueva unidad de medida.
    
    **Parámetros:**
    - nombre: Nombre completo de la unidad
    - abreviatura: Abreviatura corta
    - tipo: Tipo de unidad (volumen, peso, cantidad)
    - conversion_a_base: Factor de conversión a unidad base
    - unidad_base: Unidad base (ml para volumen, gr para peso, unidad para cantidad)
    
    **Retorna:**
    - Confirmación de creación con ID de la unidad
    
    **Ejemplo:**
    ```json
    POST /recetario/unidades-medida
    {
      "nombre": "Pack de 12",
      "abreviatura": "pack12",
      "tipo": "cantidad",
      "conversion_a_base": 12.0,
      "unidad_base": "unidad"
    }
    ```
    """
    return recetario_controller.crear_unidad_medida(
        nombre=nombre,
        abreviatura=abreviatura,
        tipo=tipo,
        conversion_a_base=conversion_a_base,
        unidad_base=unidad_base
    )


@router.get("/productos-stock")
def get_productos_stock(
    sucursal: str = Query("recoleta", description="Sucursal: 'recoleta' o 'palermo'")
):
    """
    Obtiene lista de productos de Stock disponibles.
    
    **Parámetros:**
    - sucursal: Sucursal (default: 'recoleta')
    
    **Retorna:**
    - Lista de productos de Stock (solo salón)
    
    **Ejemplo:**
    - `/recetario/productos-stock?sucursal=recoleta`
    """
    return recetario_controller.get_productos_stock(sucursal)


@router.get("/productos-nucleo")
def get_productos_nucleo(
    sucursal: str = Query("recoleta", description="Sucursal: 'recoleta' o 'palermo'")
):
    """
    Obtiene lista de productos de Nucleo disponibles.
    
    **Parámetros:**
    - sucursal: Sucursal (default: 'recoleta')
    
    **Retorna:**
    - Lista de productos de Nucleo (sistema de ventas)
    
    **Ejemplo:**
    - `/recetario/productos-nucleo?sucursal=recoleta`
    """
    return recetario_controller.get_productos_nucleo(sucursal)



@router.post("/tomar-snapshot")
def tomar_snapshot(
    sucursal: str = Query("recoleta", description="Sucursal: 'recoleta' o 'palermo'")
):
    """
    Toma un snapshot del stock actual (stock + pedido) de productos con linkeos activos.
    
    Este snapshot sirve como punto de partida para calcular el stock aproximado.
    Se guarda el stock inicial + pedido de cada producto.
    
    **Parámetros:**
    - sucursal: Sucursal para obtener stocks (default: 'recoleta')
    
    **Retorna:**
    - Cantidad de productos nuevos
    - Cantidad de productos actualizados
    - Fecha del snapshot
    
    **Nota:** Al tomar un nuevo snapshot, se limpian las ventas procesadas anteriormente.
    
    **Ejemplo:**
    - `POST /recetario/tomar-snapshot?sucursal=recoleta`
    """
    return recetario_controller.tomar_snapshot(sucursal)


@router.post("/procesar-ventas")
def procesar_ventas(
    sucursal: str = Query("recoleta", description="Sucursal: 'recoleta' o 'palermo'")
):
    """
    Procesa las ventas desde el último snapshot y calcula el consumo de stock.
    
    Obtiene las ventas de Nucleo desde la fecha del último snapshot,
    calcula el consumo usando los linkeos activos, y actualiza el stock aproximado.
    
    **Parámetros:**
    - sucursal: Sucursal para obtener ventas (default: 'recoleta')
    
    **Retorna:**
    - Total de ventas obtenidas
    - Ventas procesadas (con linkeo)
    - Ventas sin linkeo (ignoradas)
    - Productos actualizados
    - Consumos por producto
    
    **Requisito:** Debe existir un snapshot previo (usar /tomar-snapshot primero)
    
    **Ejemplo:**
    - `POST /recetario/procesar-ventas?sucursal=recoleta`
    """
    return recetario_controller.procesar_ventas(sucursal)


@router.get("/stock-aproximado")
def get_stock_aproximado(
    categoria: Optional[str] = Query(None, description="Filtrar por categoría: 'alcoholes', 'vinos', 'gaseosas', 'cervezas_sin_tacc'")
):
    """
    Obtiene el stock aproximado de todos los productos.
    
    Muestra el stock base (inicial + pedido), el consumo calculado,
    y el stock aproximado restante para cada producto.
    
    **Parámetros:**
    - categoria: Filtrar por categoría (opcional)
    
    **Retorna:**
    - Lista de productos con:
      - Stock inicial
      - Pedido
      - Stock base (inicial + pedido)
      - Consumido (calculado desde ventas)
      - Stock actual (base - consumido)
      - Porcentaje consumido
      - Unidad de medida
      - Fecha del snapshot
      - Fecha de última actualización
      - Categoría
    
    **Ejemplo:**
    - `/recetario/stock-aproximado`
    - `/recetario/stock-aproximado?categoria=alcoholes`
    """
    return recetario_controller.get_stock_aproximado(categoria)

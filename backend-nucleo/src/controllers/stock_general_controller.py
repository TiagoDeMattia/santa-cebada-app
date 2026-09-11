"""
Stock General: endpoints REST para rubros, productos, proveedores y planillas.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..services import stock_general_service as svc

router = APIRouter(prefix="/stock-general", tags=["stock-general"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RubroCreate(BaseModel):
    codigo: str
    nombre: str
    descripcion: str = ""
    orden: int = 0

class RubroUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None

class ProductoCreate(BaseModel):
    codigo: str
    nombre: str
    nombre_proveedor: Optional[str] = None
    descripcion: str = ""
    proveedor_id: Optional[int] = None
    unidad_stock: str = "unidad"
    unidad_pedido: str = "unidad"

class ProductoUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    nombre_proveedor: Optional[str] = None
    descripcion: Optional[str] = None
    proveedor_id: Optional[int] = None
    unidad_stock: Optional[str] = None
    unidad_pedido: Optional[str] = None
    activo: Optional[bool] = None

class ProveedorCreate(BaseModel):
    nombre: str
    categoria: Optional[str] = None
    nombre_remitente: Optional[str] = None
    info_reco: Optional[str] = None

class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    nombre_remitente: Optional[str] = None
    info_reco: Optional[str] = None
    activo: Optional[bool] = None

class PlanillaEntry(BaseModel):
    producto_id: int
    stock: Optional[float] = None
    pedido: Optional[float] = None
    notas: str = ""

class PlanillaSave(BaseModel):
    fecha: str
    area: str
    entries: List[PlanillaEntry]
    creado_por: str = ""
    es_modificacion: bool = False
    nota_edicion: str = ""

class PlanillaItemAdd(BaseModel):
    area: str
    producto_id: int
    rubro_id: Optional[int] = None

class PlanillaItemUpdate(BaseModel):
    rubro_id: Optional[int] = None
    orden: Optional[int] = None

class OtroRow(BaseModel):
    fila: int
    nombre: Optional[str] = None
    u_stock: Optional[str] = None
    u_pedido: Optional[str] = None
    stock: Optional[float] = None
    pedido: Optional[float] = None
    notas: Optional[str] = None

class OtrosSave(BaseModel):
    fecha: str
    area: str
    rows: List[OtroRow]

class CanillaUpdate(BaseModel):
    sucursal_id: str = "1"
    estilo_actual: Optional[str] = None
    estilo_proximo: Optional[str] = None
    stock_camara: Optional[int] = None
    stock_camara_proximo: Optional[int] = None

class CanillaSwap(BaseModel):
    sucursal_id: str = "1"
    canilla_a: int
    canilla_b: int
    estilo_a: Optional[str] = None  # estilo resuelto (incl. barril) de canilla_a antes del swap
    estilo_b: Optional[str] = None  # estilo resuelto (incl. barril) de canilla_b antes del swap

class CervezasHistorialEntry(BaseModel):
    canilla_num: int
    estilo_actual: Optional[str] = None
    tipo_actual: Optional[str] = None
    proveedor_actual: Optional[str] = None
    stock_camara: int = 0
    aprox_litros: int = 0
    dias_pinchado: Optional[str] = None
    estilo_proximo: Optional[str] = None
    tipo_proximo: Optional[str] = None
    proveedor_proximo: Optional[str] = None
    stock_camara_proximo: int = 0
    aprox_litros_proximo: int = 0

class CervezasHistorialSave(BaseModel):
    fecha: str
    sucursal_id: str = "1"
    rows: List[CervezasHistorialEntry]


# ── Rubros ────────────────────────────────────────────────────────────────────

@router.get("/rubros")
def list_rubros(incluir_inactivos: bool = Query(False)):
    return svc.get_rubros(incluir_inactivos)

@router.post("/rubros", status_code=201)
def create_rubro(body: RubroCreate):
    try:
        return svc.create_rubro(body.codigo, body.nombre, body.descripcion, body.orden)
    except Exception as e:
        raise HTTPException(400, str(e))

@router.put("/rubros/{rubro_id}")
def update_rubro(rubro_id: int, body: RubroUpdate):
    try:
        return svc.update_rubro(rubro_id, body.codigo, body.nombre, body.descripcion, body.orden, body.activo)
    except Exception as e:
        raise HTTPException(400, str(e))

@router.delete("/rubros/{rubro_id}")
def delete_rubro(rubro_id: int):
    svc.delete_rubro(rubro_id)
    return {"ok": True}


# ── Productos ─────────────────────────────────────────────────────────────────

@router.get("/productos")
def list_productos(
    rubro_id: Optional[int] = Query(None),
    incluir_inactivos: bool = Query(False),
    busqueda: Optional[str] = Query(None),
):
    return svc.get_productos(rubro_id, incluir_inactivos, busqueda)

@router.post("/productos", status_code=201)
def create_producto(body: ProductoCreate):
    try:
        return svc.create_producto(
            body.codigo, body.nombre, body.nombre_proveedor, body.descripcion,
            body.proveedor_id, body.unidad_stock, body.unidad_pedido
        )
    except Exception as e:
        raise HTTPException(400, str(e))

@router.put("/productos/{producto_id}")
def update_producto(producto_id: int, body: ProductoUpdate):
    try:
        return svc.update_producto(
            producto_id, body.codigo, body.nombre, body.nombre_proveedor, body.descripcion,
            body.proveedor_id, body.unidad_stock, body.unidad_pedido, body.activo
        )
    except Exception as e:
        raise HTTPException(400, str(e))

@router.delete("/productos/{producto_id}")
def delete_producto(producto_id: int):
    svc.delete_producto(producto_id)
    return {"ok": True}


# ── Planilla Items ─────────────────────────────────────────────────────────────

@router.get("/planilla-items")
def get_planilla_items(area: str = Query(...)):
    if area not in ("salon", "cocina"):
        raise HTTPException(400, "area debe ser 'salon' o 'cocina'")
    return svc.get_planilla_items(area)

@router.post("/planilla-items", status_code=201)
def add_planilla_item(body: PlanillaItemAdd):
    if body.area not in ("salon", "cocina"):
        raise HTTPException(400, "area debe ser 'salon' o 'cocina'")
    return svc.add_planilla_item(body.area, body.producto_id, body.rubro_id)

@router.put("/planilla-items/{item_id}")
def update_planilla_item(item_id: int, body: PlanillaItemUpdate):
    try:
        return svc.update_planilla_item(item_id, body.rubro_id, body.orden)
    except Exception as e:
        raise HTTPException(400, str(e))

@router.delete("/planilla-items/{item_id}")
def remove_planilla_item(item_id: int):
    svc.remove_planilla_item(item_id)
    return {"ok": True}


# ── Planilla ──────────────────────────────────────────────────────────────────

@router.get("/planilla")
def get_planilla(fecha: str = Query(...), area: str = Query(...)):
    if area not in ("salon", "cocina"):
        raise HTTPException(400, "area debe ser 'salon' o 'cocina'")
    return svc.get_planilla(fecha, area)

@router.post("/planilla")
def save_planilla(body: PlanillaSave):
    if body.area not in ("salon", "cocina"):
        raise HTTPException(400, "area debe ser 'salon' o 'cocina'")
    entries = [e.model_dump() for e in body.entries]
    saved = svc.save_planilla(body.fecha, body.area, entries, body.creado_por, body.es_modificacion, body.nota_edicion)
    return {"saved": saved, "fecha": body.fecha, "area": body.area}


# ── Otros ─────────────────────────────────────────────────────────────────────

@router.get("/otros")
def get_otros(fecha: str = Query(...), area: str = Query(...)):
    if area not in ("salon", "cocina"):
        raise HTTPException(400, "area debe ser 'salon' o 'cocina'")
    return svc.get_otros(fecha, area)

@router.post("/otros")
def save_otros(body: OtrosSave):
    if body.area not in ("salon", "cocina"):
        raise HTTPException(400, "area debe ser 'salon' o 'cocina'")
    rows = [r.model_dump() for r in body.rows]
    saved = svc.save_otros(body.fecha, body.area, rows)
    return {"saved": saved}


# ── Períodos ──────────────────────────────────────────────────────────────────

@router.get("/periodos")
def get_periodos():
    return svc.get_periodos()


# ── Umbrales de cervezas ───────────────────────────────────────────────────────

class UmbralUpdate(BaseModel):
    umbral: str

@router.get("/umbrales")
def get_umbrales():
    return svc.get_umbrales()

@router.put("/umbrales/{estilo}")
def save_umbral(estilo: str, body: UmbralUpdate):
    return svc.save_umbral(estilo, body.umbral)


# ── Pedidos del Dia ────────────────────────────────────────────────────────────

@router.get("/pedidos/ultimo")
def get_pedidos_ultimo():
    return svc.get_pedidos_ultimo()

@router.get("/pedidos")
def get_pedidos_del_dia(fecha: str = Query(...)):
    return svc.get_pedidos_del_dia(fecha)


# ── Asignaciones de Pedidos ───────────────────────────────────────────────────

class PedidoAsignacion(BaseModel):
    fecha: str
    producto_id: int
    proveedor_id: Optional[int] = None

class PedidoConfirmacion(BaseModel):
    fecha: str
    proveedor_id: int
    enviado: bool

@router.get("/pedido-asignaciones")
def get_pedido_asignaciones(fecha: str = Query(...)):
    return svc.get_pedido_asignaciones(fecha)

@router.put("/pedido-asignaciones")
def save_pedido_asignacion(body: PedidoAsignacion):
    svc.save_pedido_asignacion(body.fecha, body.producto_id, body.proveedor_id)
    return {"ok": True}

@router.get("/pedido-confirmaciones")
def get_pedido_confirmaciones(fecha: str = Query(...)):
    return svc.get_pedido_confirmaciones(fecha)

@router.put("/pedido-confirmaciones")
def save_pedido_confirmacion(body: PedidoConfirmacion):
    svc.save_pedido_confirmacion(body.fecha, body.proveedor_id, body.enviado)
    return {"ok": True}


# ── Proveedores ───────────────────────────────────────────────────────────────

@router.get("/proveedores")
def list_proveedores(
    incluir_inactivos: bool = Query(False),
    busqueda: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
):
    return svc.get_proveedores(incluir_inactivos, busqueda, categoria)

@router.post("/proveedores", status_code=201)
def create_proveedor(body: ProveedorCreate):
    try:
        return svc.create_proveedor(body.nombre, body.categoria, body.nombre_remitente, body.info_reco)
    except Exception as e:
        raise HTTPException(400, str(e))

@router.put("/proveedores/{proveedor_id}")
def update_proveedor(proveedor_id: int, body: ProveedorUpdate):
    try:
        return svc.update_proveedor(
            proveedor_id, body.nombre, body.categoria, body.nombre_remitente, body.info_reco, body.activo
        )
    except Exception as e:
        raise HTTPException(400, str(e))

@router.delete("/proveedores/{proveedor_id}")
def delete_proveedor(proveedor_id: int):
    svc.delete_proveedor(proveedor_id)
    return {"ok": True}


# ── Stock Cervezas ────────────────────────────────────────────────────────────

@router.get("/canillas")
def get_canillas(sucursal_id: str = Query("1")):
    return svc.get_canillas_config(sucursal_id)

@router.put("/canillas/{canilla_num}")
def update_canilla(canilla_num: int, body: CanillaUpdate):
    return svc.update_canilla_config(
        body.sucursal_id, canilla_num,
        body.estilo_actual, body.estilo_proximo,
        body.stock_camara, body.stock_camara_proximo,
    )

@router.post("/canillas/swap")
def swap_canillas(body: CanillaSwap):
    svc.swap_canillas(body.sucursal_id, body.canilla_a, body.canilla_b, body.estilo_a, body.estilo_b)
    return {"ok": True}

@router.post("/cervezas/historial", status_code=201)
def save_cervezas_historial(body: CervezasHistorialSave):
    svc.save_cervezas_historial(body.sucursal_id, body.fecha, [r.dict() for r in body.rows])
    return {"ok": True}

@router.get("/cervezas/historial")
def get_cervezas_historial(fecha: str = Query(...), sucursal_id: str = Query("1")):
    return svc.get_cervezas_historial(sucursal_id, fecha)


# ── Historial ─────────────────────────────────────────────────────────────────

@router.get("/historial")
def get_historial(
    area: Optional[str] = Query(None),
    producto_id: Optional[int] = Query(None),
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    limit: int = Query(200),
):
    return svc.get_historial(area, producto_id, desde, hasta, limit)


@router.get("/estadisticas/producto-serie")
def get_producto_serie(producto_id: int = Query(...)):
    return svc.get_producto_serie(producto_id)


@router.get("/estadisticas")
def get_estadisticas(
    modo: str = Query("historico"),
    exclude_rubros: str = Query(""),
    exclude_productos: str = Query(""),
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
):
    rubros_list = [r.strip() for r in exclude_rubros.split(",") if r.strip()] if exclude_rubros else []
    prods_list = [int(p) for p in exclude_productos.split(",") if p.strip().isdigit()] if exclude_productos else []
    return svc.get_estadisticas(modo, rubros_list, prods_list, desde, hasta)

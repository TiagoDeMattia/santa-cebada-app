"""
Servicio para gestión de stocks y pedidos.
Lee datos desde Google Sheets de Recoleta y Palermo.

Estructura de sheets:
- CENTRAL DE PRODUCTOS: Catálogo maestro de productos
- RECOLETA/PALERMO:
  - COCINA: Stock y pedidos de cocina
  - SALON: Stock y pedidos de salón
  - STOCK BIRRAS: Stock de cervezas
  - PEDIDOS: Filtro de productos con pedido > 0
"""
from typing import Optional, List, Dict, Any
import gspread
from google.oauth2.service_account import Credentials

from ..config import settings
from ..utils.logger import logger
from .rate_limiter import rate_limited

# Configuración de sheets
SHEETS_CONFIG = {
    "central": {
        "sheet_id": "1TDMYt3lG-PnBl3xhuwLNU2oxjNZRKD1jtXuk5RGSS2w",
        "sheet_name": "CENTRAL DE PRODUCTOS",
    },
    "recoleta": {
        "sheet_id": "1CGUhk1Vf-2z1Td3ynWiPfmx7rC7C7djPY84ClwXeHQ0",
        "sheets": {
            "cocina": "COCINA",
            "salon": "SALON",
            "birras": "STOCK BIRRAS",
            "pedidos": "PEDIDOS",
        }
    },
}


def _get_client() -> gspread.Client:
    """Obtiene cliente de gspread."""
    creds = Credentials.from_service_account_file(
        settings.credentials_json_path,
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    return gspread.authorize(creds)


def _parse_numero(valor: str) -> float:
    """Convierte un string a número, manejando casos especiales."""
    if not valor or valor.strip() == "":
        return 0.0
    try:
        # Remover espacios y convertir
        return float(valor.strip().replace(",", "."))
    except:
        return 0.0


@rate_limited
def get_productos_central() -> List[Dict[str, Any]]:
    """
    Obtiene el catálogo completo de productos desde CENTRAL DE PRODUCTOS.
    
    Returns:
        Lista de productos con estructura:
        {
            "codigo_grupo": "1",
            "codigo_producto": "C001",
            "nombre_local": "Repollo blanco",
            "nombre_proveedor": "Repollo blanco",
            "tipo": "cocina" | "salon"
        }
    """
    config = SHEETS_CONFIG["central"]
    gc = _get_client()
    sh = gc.open_by_key(config["sheet_id"])
    ws = sh.worksheet(config["sheet_name"])
    
    all_rows = ws.get_all_values()
    productos = []
    
    # Saltar las primeras 2 filas (título y headers)
    for i, row in enumerate(all_rows[2:], start=3):
        if len(row) < 4:
            continue
        
        codigo_grupo = row[0].strip()
        codigo_producto = row[1].strip()
        nombre_local = row[2].strip()
        nombre_proveedor = row[3].strip()
        
        # Saltar filas vacías o de grupo
        if not codigo_producto or not nombre_local:
            continue
        
        # Determinar tipo según código
        tipo = "cocina" if codigo_producto.startswith("C") else "salon"
        
        productos.append({
            "codigo_grupo": codigo_grupo,
            "codigo_producto": codigo_producto,
            "nombre_local": nombre_local,
            "nombre_proveedor": nombre_proveedor,
            "tipo": tipo,
        })
    
    logger.info(f"Productos centrales cargados: {len(productos)}")
    return productos


@rate_limited
def get_stocks_cocina(sucursal: str = "recoleta") -> List[Dict[str, Any]]:
    """
    Obtiene stocks y pedidos de cocina de una sucursal.
    
    Args:
        sucursal: "recoleta" o "palermo"
    
    Returns:
        Lista de productos con stock y pedido:
        {
            "codigo_grupo": "1",
            "codigo_producto": "C001",
            "producto": "Repollo blanco",
            "nombre_proveedor": "Repollo blanco",
            "stock_unidad": "Kg",
            "stock_cantidad": 1.0,
            "pedido_unidad": "Kg",
            "pedido_cantidad": 0.0,
            "tiene_pedido": False
        }
    """
    config = SHEETS_CONFIG.get(sucursal.lower())
    if not config:
        raise ValueError(f"Sucursal inválida: {sucursal}")
    
    gc = _get_client()
    sh = gc.open_by_key(config["sheet_id"])
    ws = sh.worksheet(config["sheets"]["cocina"])
    
    all_rows = ws.get_all_values()
    productos = []
    
    # Saltar las primeras 2 filas (título y headers)
    for i, row in enumerate(all_rows[2:], start=3):
        if len(row) < 8:
            continue
        
        codigo_grupo = row[0].strip()
        codigo_producto = row[1].strip()
        producto = row[2].strip()
        nombre_proveedor = row[3].strip()
        stock_unidad = row[4].strip()
        stock_cantidad = _parse_numero(row[5])
        pedido_unidad = row[6].strip()
        pedido_cantidad = _parse_numero(row[7])
        
        # Saltar filas vacías o de grupo
        if not codigo_producto or not producto:
            continue
        
        productos.append({
            "codigo_grupo": codigo_grupo,
            "codigo_producto": codigo_producto,
            "producto": producto,
            "nombre_proveedor": nombre_proveedor,
            "stock_unidad": stock_unidad,
            "stock_cantidad": stock_cantidad,
            "pedido_unidad": pedido_unidad,
            "pedido_cantidad": pedido_cantidad,
            "tiene_pedido": pedido_cantidad > 0,
        })
    
    logger.info(f"Stocks cocina {sucursal}: {len(productos)} productos")
    return productos


@rate_limited
def get_stocks_salon(sucursal: str = "recoleta") -> List[Dict[str, Any]]:
    """
    Obtiene stocks y pedidos de salón de una sucursal.
    
    Args:
        sucursal: "recoleta" o "palermo"
    
    Returns:
        Lista de productos con stock y pedido (misma estructura que cocina)
    """
    config = SHEETS_CONFIG.get(sucursal.lower())
    if not config:
        raise ValueError(f"Sucursal inválida: {sucursal}")
    
    gc = _get_client()
    sh = gc.open_by_key(config["sheet_id"])
    ws = sh.worksheet(config["sheets"]["salon"])
    
    all_rows = ws.get_all_values()
    productos = []
    
    # Saltar las primeras 2 filas (título y headers)
    for i, row in enumerate(all_rows[2:], start=3):
        if len(row) < 8:
            continue
        
        codigo_grupo = row[0].strip()
        codigo_producto = row[1].strip()
        producto = row[2].strip()
        nombre_proveedor = row[3].strip()
        stock_unidad = row[4].strip()
        stock_cantidad = _parse_numero(row[5])
        pedido_unidad = row[6].strip()
        pedido_cantidad = _parse_numero(row[7])
        observacion = row[8].strip() if len(row) > 8 else ""
        
        # Saltar filas vacías o de grupo
        if not codigo_producto or not producto:
            continue
        
        productos.append({
            "codigo_grupo": codigo_grupo,
            "codigo_producto": codigo_producto,
            "producto": producto,
            "nombre_proveedor": nombre_proveedor,
            "stock_unidad": stock_unidad,
            "stock_cantidad": stock_cantidad,
            "pedido_unidad": pedido_unidad,
            "pedido_cantidad": pedido_cantidad,
            "tiene_pedido": pedido_cantidad > 0,
            "observacion": observacion,
        })
    
    logger.info(f"Stocks salón {sucursal}: {len(productos)} productos")
    return productos


@rate_limited
def get_pedidos(sucursal: str = "recoleta") -> List[Dict[str, Any]]:
    """
    Obtiene solo los productos con pedido > 0 de una sucursal.
    
    Args:
        sucursal: "recoleta" o "palermo"
    
    Returns:
        Lista de productos con pedido activo
    """
    # Obtener todos los stocks
    cocina = get_stocks_cocina(sucursal)
    salon = get_stocks_salon(sucursal)
    
    # Filtrar solo los que tienen pedido
    pedidos = [p for p in cocina + salon if p["tiene_pedido"]]
    
    logger.info(f"Pedidos {sucursal}: {len(pedidos)} productos")
    return pedidos


def get_stocks_completos(sucursal: str = "recoleta") -> Dict[str, Any]:
    """
    Obtiene todos los stocks de una sucursal (cocina + salón).
    
    Args:
        sucursal: "recoleta" o "palermo"
    
    Returns:
        {
            "sucursal": "recoleta",
            "cocina": [...],
            "salon": [...],
            "total_productos": 300,
            "total_con_pedido": 50
        }
    """
    cocina = get_stocks_cocina(sucursal)
    salon = get_stocks_salon(sucursal)
    
    total_con_pedido = sum(1 for p in cocina + salon if p["tiene_pedido"])
    
    return {
        "sucursal": sucursal,
        "cocina": cocina,
        "salon": salon,
        "total_productos": len(cocina) + len(salon),
        "total_con_pedido": total_con_pedido,
    }


def buscar_productos(
    query: str,
    sucursal: Optional[str] = None,
    tipo: Optional[str] = None,
    solo_con_pedido: bool = False
) -> List[Dict[str, Any]]:
    """
    Busca productos por nombre, código o proveedor.
    
    Args:
        query: Texto a buscar
        sucursal: Filtrar por sucursal ("recoleta", "palermo", o None para ambas)
        tipo: Filtrar por tipo ("cocina", "salon", o None para ambos)
        solo_con_pedido: Si True, solo devuelve productos con pedido > 0
    
    Returns:
        Lista de productos que coinciden con la búsqueda
    """
    query_lower = query.lower()
    resultados = []
    
    # Determinar sucursales a buscar
    sucursales = [sucursal] if sucursal else ["recoleta"]
    
    for suc in sucursales:
        # Determinar tipos a buscar
        tipos = [tipo] if tipo else ["cocina", "salon"]
        
        for t in tipos:
            if t == "cocina":
                productos = get_stocks_cocina(suc)
            else:
                productos = get_stocks_salon(suc)
            
            for p in productos:
                # Filtrar por pedido si es necesario
                if solo_con_pedido and not p["tiene_pedido"]:
                    continue
                
                # Buscar en nombre, código o proveedor
                if (query_lower in p["producto"].lower() or
                    query_lower in p["codigo_producto"].lower() or
                    query_lower in p["nombre_proveedor"].lower()):
                    
                    # Agregar info de sucursal y tipo
                    p["sucursal"] = suc
                    p["tipo"] = t
                    resultados.append(p)
    
    logger.info(f"Búsqueda '{query}': {len(resultados)} resultados")
    return resultados

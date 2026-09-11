"""
Servicio principal para gestión de productos y precios
Combina NucleoService y SheetService
"""
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from .nucleo_service import NucleoService
from .sheet_service import SheetService
from ..utils.logger import logger
from ..utils.helpers import (
    texto_visible,
    normalizar_texto_comparacion,
    clave_codigo,
)


class ProductoService:
    """
    Servicio de alto nivel para operaciones con productos
    """

    def __init__(self):
        self.nucleo = NucleoService()
        self.sheet = SheetService()

    # ─── ACTUALIZACIÓN DE PRECIOS ────────────────────────────────────────────────

    async def actualizar_desde_sheet(
        self,
        sucursal_id: str,
        modo_prueba: bool = False,
        headless: bool = True,
        username: str = "sistema"
    ) -> Dict[str, Any]:
        """
        Actualiza precios desde Google Sheets
        """
        from .audit_service import log_change
        
        logger.info(f"Iniciando actualización desde Sheet - Sucursal: {sucursal_id}, Modo prueba: {modo_prueba}")

        # Leer productos del Sheet
        productos_sheet = self.sheet.leer_productos()
        if not productos_sheet:
            return {"success": False, "error": "No hay productos en el Sheet"}

        if modo_prueba:
            logger.info("MODO PRUEBA: procesando solo el primer producto")
            productos_sheet = productos_sheet[:1]

        logger.info(f"{len(productos_sheet)} productos a procesar")

        # Obtener sesión
        session = await self.nucleo.get_session(sucursal_id, headless=headless)
        logger.info("Sesión API lista")

        # Obtener índice de productos
        indice = self.nucleo.obtener_indice_productos(session)
        logger.info(f"{len(indice)} códigos indexados")

        # Procesar actualizaciones
        exitosos = 0
        fallidos = []
        detalles_exitosos = []

        total = len(productos_sheet)
        for idx, prod in enumerate(productos_sheet):
            try:
                resultado = self.nucleo.actualizar_precio(
                    session,
                    prod["codigo"],
                    prod["precio"],
                    indice
                )
                if resultado.get("success"):
                    exitosos += 1
                    # Registrar en auditoría
                    try:
                        log_change(
                            username=username,
                            action="update",
                            entity_type="producto",
                            entity_id=prod["codigo"],
                            changes={"precio": prod["precio"], "modo_prueba": modo_prueba},
                            sucursal_id=sucursal_id,
                        )
                        logger.info(f"Auditoría registrada para {prod['codigo']}")
                    except Exception as audit_err:
                        logger.error(f"Error registrando auditoría para {prod['codigo']}: {audit_err}")
                    
                    # Guardar detalle del cambio exitoso
                    detalles_exitosos.append({
                        "codigo": prod["codigo"],
                        "precio_nuevo": prod["precio"],
                        "nombre": resultado.get("nombre", ""),
                    })
                else:
                    fallidos.append({
                        "codigo": prod["codigo"],
                        "error": resultado.get("error"),
                    })
            except Exception as e:
                logger.error(f"Error en {prod['codigo']}: {e}")
                fallidos.append({
                    "codigo": prod["codigo"],
                    "error": str(e),
                })

        logger.info(f"Actualización completada: {exitosos} exitosos, {len(fallidos)} fallidos")

        return {
            "success": True,
            "exitosos": exitosos,
            "fallidos": len(fallidos),
            "detalles_fallidos": fallidos,
            "detalles_exitosos": detalles_exitosos,
            "total_procesados": len(productos_sheet),
        }

    def _calcular_vacantes(
        self,
        mapa_productos: Dict[str, Dict],
        codigos_excluidos: set
    ) -> List[int]:
        """
        Calcula códigos vacantes (huecos en la numeración)
        """
        codigos_numericos = {
            int(codigo)
            for codigo in mapa_productos.keys()
            if codigo.isdigit() and int(codigo) not in codigos_excluidos
        }

        if not codigos_numericos:
            return []

        maximo = max(codigos_numericos)
        esperados = set(range(1, maximo + 1)) - codigos_excluidos
        vacantes = sorted(esperados - codigos_numericos)

        return vacantes

    # ─── OPERACIONES INDIVIDUALES ────────────────────────────────────────────────

    async def obtener_producto(
        self,
        producto_id: int,
        sucursal_id: str = "1"
    ) -> Optional[Dict]:
        """
        Obtiene un producto por ID
        """
        session = await self.nucleo.get_session(sucursal_id)
        return self.nucleo.obtener_producto_por_id(session, producto_id)

    async def buscar_productos(
        self,
        codigo: Optional[str] = None,
        nombre: Optional[str] = None,
        sucursal_id: str = "1"
    ) -> List[Dict]:
        """
        Busca productos por código o nombre
        """
        session = await self.nucleo.get_session(sucursal_id)
        return self.nucleo.buscar_productos(session, codigo=codigo, nombre=nombre)

    async def actualizar_precio_individual(
        self,
        codigo: str,
        precio: float,
        sucursal_id: str = "1"
    ) -> Dict[str, Any]:
        """
        Actualiza el precio de un producto individual
        """
        session = await self.nucleo.get_session(sucursal_id)
        indice = self.nucleo.obtener_indice_productos(session)
        return self.nucleo.actualizar_precio(session, codigo, precio, indice)

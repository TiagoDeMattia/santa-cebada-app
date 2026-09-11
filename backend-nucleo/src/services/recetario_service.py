"""
Servicio para gestión de recetario (linkeo de productos Nucleo con Stock).
"""
from typing import List, Dict, Any, Optional
import sqlite3
import os
from datetime import datetime

from ..utils.logger import logger
from .nucleo_service import NucleoService
from .stocks_service import get_stocks_salon


class RecetarioService:
    """Servicio para gestionar el recetario de productos."""
    
    def __init__(self):
        # ~/.pm2/ es ReadWritePaths en pm2-tiago.service (ProtectHome=read-only)
        pm2_home = os.environ.get("PM2_HOME", os.path.join(os.path.expanduser("~"), ".pm2"))
        self.db_path = os.path.join(pm2_home, "recetario.db")
        self._init_db()
    
    def _get_connection(self):
        """Obtiene conexión a la base de datos."""
        return sqlite3.connect(self.db_path)
    
    def _init_db(self):
        """Inicializa las tablas de la base de datos."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Tabla de unidades de medida
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS unidades_medida (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL UNIQUE,
                    abreviatura TEXT NOT NULL,
                    tipo TEXT NOT NULL,
                    conversion_a_base REAL NOT NULL,
                    unidad_base TEXT NOT NULL,
                    fecha_creacion TEXT NOT NULL
                )
            """)
            
            # Insertar unidades predefinidas si no existen
            unidades_predefinidas = [
                ('Litro', 'L', 'volumen', 1000.0, 'ml'),
                ('Mililitro', 'ml', 'volumen', 1.0, 'ml'),
                ('Kilogramo', 'Kg', 'peso', 1000.0, 'gr'),
                ('Gramo', 'gr', 'peso', 1.0, 'gr'),
                ('SixPack', 'sixpack', 'cantidad', 6.0, 'unidad'),
                ('Pack de 8', 'pack8', 'cantidad', 8.0, 'unidad'),
                ('Unidad', 'unidad', 'cantidad', 1.0, 'unidad'),
                ('Caja', 'caja', 'cantidad', 1.0, 'unidad'),
            ]
            
            fecha_actual = datetime.now().isoformat()
            for nombre, abrev, tipo, conv, base in unidades_predefinidas:
                try:
                    cursor.execute("""
                        INSERT INTO unidades_medida (nombre, abreviatura, tipo, conversion_a_base, unidad_base, fecha_creacion)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (nombre, abrev, tipo, conv, base, fecha_actual))
                except sqlite3.IntegrityError:
                    pass  # Ya existe
            
            # Tabla de linkeos entre productos Nucleo y Stock
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS linkeos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    producto_nucleo_id INTEGER NOT NULL,
                    producto_nucleo_codigo TEXT NOT NULL,
                    producto_nucleo_nombre TEXT NOT NULL,
                    producto_stock_codigo TEXT NOT NULL,
                    producto_stock_nombre TEXT NOT NULL,
                    categoria TEXT NOT NULL,
                    unidad_medida_stock TEXT NOT NULL DEFAULT 'L',
                    cantidad_stock REAL NOT NULL DEFAULT 1.0,
                    unidad_medida_nucleo TEXT NOT NULL DEFAULT 'ml',
                    cantidad_nucleo REAL NOT NULL DEFAULT 75.0,
                    activo BOOLEAN NOT NULL DEFAULT 1,
                    auto_generado BOOLEAN NOT NULL DEFAULT 0,
                    fecha_creacion TEXT NOT NULL,
                    fecha_modificacion TEXT NOT NULL,
                    UNIQUE(producto_nucleo_id, producto_stock_codigo)
                )
            """)
            
            # Tabla de stock base (snapshot inicial + pedido)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS stock_base (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    producto_stock_codigo TEXT NOT NULL UNIQUE,
                    producto_stock_nombre TEXT NOT NULL,
                    stock_inicial REAL NOT NULL,
                    pedido REAL NOT NULL,
                    stock_total REAL NOT NULL,
                    consumido REAL NOT NULL DEFAULT 0.0,
                    unidad TEXT NOT NULL,
                    fecha_snapshot TEXT NOT NULL,
                    fecha_actualizacion TEXT NOT NULL
                )
            """)
            
            # Migración: agregar columna consumido si no existe (bases de datos antiguas)
            try:
                cursor.execute("ALTER TABLE stock_base ADD COLUMN consumido REAL NOT NULL DEFAULT 0.0")
            except Exception:
                pass  # Ya existe
            
            # Tabla de ventas procesadas (para no contar dos veces)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ventas_procesadas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    venta_id TEXT NOT NULL UNIQUE,
                    fecha_venta TEXT NOT NULL,
                    fecha_procesamiento TEXT NOT NULL
                )
            """)
            
            # Índices para mejorar rendimiento
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_linkeos_nucleo ON linkeos(producto_nucleo_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_linkeos_stock ON linkeos(producto_stock_codigo)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_linkeos_activo ON linkeos(activo)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_base_codigo ON stock_base(producto_stock_codigo)")
            
            conn.commit()
            logger.info("✓ Base de datos de recetario inicializada")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error inicializando base de datos de recetario: {str(e)}")
            raise
        finally:
            conn.close()
    
    def generar_linkeos_automaticos(self, sucursal: str = "recoleta") -> Dict[str, Any]:
        """
        Genera linkeos automáticos entre productos Nucleo y Stock.
        
        Args:
            sucursal: Sucursal para obtener productos
        
        Returns:
            Resumen de linkeos generados
        """
        logger.info("Generando linkeos automáticos...")
        
        # Obtener productos de Stock (solo salón)
        productos_stock = get_stocks_salon(sucursal)
        
        # Filtrar solo las categorías que nos interesan
        categorias_interes = {
            "alcoholes": ["fernet", "vodka", "gin", "whisky", "ron", "tequila", "aperol", "campari"],
            "vinos": ["vino", "espumante", "champagne"],
            "gaseosas": ["coca", "sprite", "fanta", "schweppes", "tonica", "soda"],
            "cervezas_sin_tacc": ["sin tacc", "gluten free", "celiaco"]
        }
        
        # Crear mapa de productos de stock por palabras clave
        stock_map = {}
        for producto in productos_stock:
            nombre_lower = producto["producto"].lower()
            codigo = producto["codigo_producto"]
            
            # Determinar categoría
            categoria = None
            for cat, keywords in categorias_interes.items():
                if any(kw in nombre_lower for kw in keywords):
                    categoria = cat
                    break
            
            if categoria:
                stock_map[codigo] = {
                    "codigo": codigo,
                    "nombre": producto["producto"],
                    "categoria": categoria,
                    "keywords": self._extraer_keywords(nombre_lower)
                }
        
        logger.info(f"Productos de stock encontrados: {len(stock_map)}")
        
        # Obtener productos de Nucleo
        nucleo_service = NucleoService()
        try:
            import asyncio
            session = asyncio.run(nucleo_service.get_session("1" if sucursal == "recoleta" else "2"))
            productos_nucleo = nucleo_service.obtener_todos_productos(session)
        except Exception as e:
            logger.error(f"Error obteniendo productos de Nucleo: {str(e)}")
            return {"error": str(e), "linkeos_generados": 0}
        
        logger.info(f"Productos de Nucleo encontrados: {len(productos_nucleo)}")
        
        # Generar linkeos
        linkeos_generados = []
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            for producto_nucleo in productos_nucleo:
                nombre_nucleo = producto_nucleo.get("Name", "").lower()
                id_nucleo = producto_nucleo.get("Id")
                codigo_nucleo = producto_nucleo.get("Code", "")
                
                # Buscar match con productos de stock
                mejor_match = None
                mejor_score = 0
                
                for codigo_stock, info_stock in stock_map.items():
                    score = self._calcular_match_score(nombre_nucleo, info_stock["keywords"])
                    if score > mejor_score and score >= 0.5:  # Umbral de confianza
                        mejor_score = score
                        mejor_match = (codigo_stock, info_stock)
                
                if mejor_match:
                    codigo_stock, info_stock = mejor_match
                    
                    # Determinar conversión por defecto según categoría
                    cantidad_nucleo, unidad_nucleo = self._get_conversion_default(info_stock["categoria"])
                    
                    # Detectar unidad y cantidad del producto de stock
                    cantidad_stock, unidad_stock = self._detectar_unidad_y_cantidad_stock(info_stock["nombre"])
                    
                    # Insertar linkeo
                    fecha_actual = datetime.now().isoformat()
                    try:
                        cursor.execute("""
                            INSERT INTO linkeos (
                                producto_nucleo_id, producto_nucleo_codigo, producto_nucleo_nombre,
                                producto_stock_codigo, producto_stock_nombre, categoria,
                                unidad_medida_stock, cantidad_stock,
                                unidad_medida_nucleo, cantidad_nucleo,
                                activo, auto_generado,
                                fecha_creacion, fecha_modificacion
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            id_nucleo, codigo_nucleo, producto_nucleo.get("Name", ""),
                            codigo_stock, info_stock["nombre"], info_stock["categoria"],
                            unidad_stock, cantidad_stock,
                            unidad_nucleo, cantidad_nucleo,
                            1, 1,
                            fecha_actual, fecha_actual
                        ))
                        
                        linkeos_generados.append({
                            "nucleo": producto_nucleo.get("Name", ""),
                            "stock": info_stock["nombre"],
                            "categoria": info_stock["categoria"],
                            "unidad_stock": unidad_stock,
                            "cantidad_stock": cantidad_stock,
                            "unidad_nucleo": unidad_nucleo,
                            "cantidad_nucleo": cantidad_nucleo,
                            "score": mejor_score
                        })
                    except sqlite3.IntegrityError:
                        # Ya existe, skip
                        pass
            
            conn.commit()
            logger.info(f"✓ Linkeos generados: {len(linkeos_generados)}")
            
            return {
                "success": True,
                "linkeos_generados": len(linkeos_generados),
                "productos_nucleo_total": len(productos_nucleo),
                "productos_stock_total": len(stock_map),
                "linkeos": linkeos_generados[:20]  # Primeros 20 para preview
            }
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error generando linkeos: {str(e)}")
            raise
        finally:
            conn.close()
    
    def _extraer_keywords(self, texto: str) -> List[str]:
        """Extrae palabras clave de un texto."""
        # Palabras comunes a ignorar
        stopwords = {"de", "con", "y", "o", "la", "el", "los", "las", "un", "una", "para"}
        palabras = texto.lower().split()
        return [p for p in palabras if p not in stopwords and len(p) > 2]
    
    def _calcular_match_score(self, nombre_nucleo: str, keywords_stock: List[str]) -> float:
        """Calcula score de match entre producto Nucleo y Stock."""
        palabras_nucleo = set(self._extraer_keywords(nombre_nucleo))
        keywords_stock_set = set(keywords_stock)
        
        if not palabras_nucleo or not keywords_stock_set:
            return 0.0
        
        # Intersección de palabras
        interseccion = palabras_nucleo.intersection(keywords_stock_set)
        
        # Score basado en proporción de palabras coincidentes
        score = len(interseccion) / max(len(palabras_nucleo), len(keywords_stock_set))
        
        return score
    
    def _get_conversion_default(self, categoria: str) -> tuple:
        """Obtiene conversión por defecto según categoría (cantidad, unidad)."""
        conversiones = {
            "alcoholes": (75.0, "ml"),  # 75ml por trago
            "vinos": (150.0, "ml"),     # 150ml por copa
            "gaseosas": (250.0, "ml"),  # 250ml por vaso
            "cervezas_sin_tacc": (330.0, "ml")  # 330ml por botella
        }
        return conversiones.get(categoria, (0.0, "ml"))
    
    def _detectar_unidad_y_cantidad_stock(self, nombre_producto: str) -> tuple:
        """
        Detecta la unidad y cantidad del producto de stock basándose en su nombre.
        
        Retorna: (cantidad, unidad)
        Busca patrones como: 1L, 750ml, 2.25L, etc.
        """
        import re
        
        nombre_lower = nombre_producto.lower()
        
        # Buscar litros (1L, 1.5L, 2L, etc.)
        match_litros = re.search(r'(\d+\.?\d*)\s*l(?:itro)?s?(?:\s|$)', nombre_lower)
        if match_litros:
            litros = float(match_litros.group(1))
            return (litros, "L")
        
        # Buscar mililitros (750ml, 500ml, etc.)
        match_ml = re.search(r'(\d+)\s*ml(?:\s|$)', nombre_lower)
        if match_ml:
            return (float(match_ml.group(1)), "ml")
        
        # Buscar kilogramos
        match_kg = re.search(r'(\d+\.?\d*)\s*kg(?:\s|$)', nombre_lower)
        if match_kg:
            return (float(match_kg.group(1)), "Kg")
        
        # Buscar gramos
        match_gr = re.search(r'(\d+)\s*gr(?:amos)?(?:\s|$)', nombre_lower)
        if match_gr:
            return (float(match_gr.group(1)), "gr")
        
        # Buscar sixpack
        if 'sixpack' in nombre_lower or 'six pack' in nombre_lower or '6 pack' in nombre_lower:
            return (1.0, "sixpack")
        
        # Buscar pack de 8
        if 'pack de 8' in nombre_lower or 'pack 8' in nombre_lower:
            return (1.0, "pack8")
        
        # Buscar caja
        if 'caja' in nombre_lower:
            return (1.0, "caja")
        
        # Valores por defecto según palabras clave
        if 'botella' in nombre_lower or 'botellón' in nombre_lower:
            if 'grande' in nombre_lower or 'familiar' in nombre_lower:
                return (2.0, "L")  # 2L
            return (1.0, "L")  # 1L por defecto
        
        if 'lata' in nombre_lower:
            return (330.0, "ml")  # Lata estándar
        
        if 'copa' in nombre_lower or 'vaso' in nombre_lower:
            return (250.0, "ml")
        
        # Por defecto: 1 unidad
        return (1.0, "unidad")
    
    def get_linkeos(self, activo_solo: bool = False) -> List[Dict[str, Any]]:
        """
        Obtiene todos los linkeos agrupados por producto de stock.
        
        Args:
            activo_solo: Si True, solo retorna linkeos activos
        
        Returns:
            Lista de linkeos agrupados por producto de stock
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            query = """
                SELECT 
                    id, producto_nucleo_id, producto_nucleo_codigo, producto_nucleo_nombre,
                    producto_stock_codigo, producto_stock_nombre, categoria,
                    unidad_medida_stock, cantidad_stock,
                    unidad_medida_nucleo, cantidad_nucleo,
                    activo, auto_generado,
                    fecha_creacion, fecha_modificacion
                FROM linkeos
            """
            
            if activo_solo:
                query += " WHERE activo = 1"
            
            query += " ORDER BY producto_stock_codigo, categoria, producto_nucleo_nombre"
            
            cursor.execute(query)
            rows = cursor.fetchall()
            
            # Agrupar por producto de stock
            linkeos_agrupados = {}
            for row in rows:
                codigo_stock = row[4]
                
                if codigo_stock not in linkeos_agrupados:
                    linkeos_agrupados[codigo_stock] = {
                        "producto_stock_codigo": row[4],
                        "producto_stock_nombre": row[5],
                        "unidad_medida_stock": row[7],
                        "cantidad_stock": row[8],
                        "afiliaciones": []
                    }
                
                linkeos_agrupados[codigo_stock]["afiliaciones"].append({
                    "id": row[0],
                    "producto_nucleo_id": row[1],
                    "producto_nucleo_codigo": row[2],
                    "producto_nucleo_nombre": row[3],
                    "categoria": row[6],
                    "unidad_medida_nucleo": row[9],
                    "cantidad_nucleo": row[10],
                    "activo": bool(row[11]),
                    "auto_generado": bool(row[12]),
                    "fecha_creacion": row[13],
                    "fecha_modificacion": row[14]
                })
            
            return list(linkeos_agrupados.values())
            
        finally:
            conn.close()
    
    def actualizar_linkeo(
        self,
        linkeo_id: int,
        unidad_medida_stock: Optional[str] = None,
        cantidad_stock: Optional[float] = None,
        unidad_medida_nucleo: Optional[str] = None,
        cantidad_nucleo: Optional[float] = None,
        activo: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Actualiza un linkeo existente.
        
        Args:
            linkeo_id: ID del linkeo
            unidad_medida_stock: Nueva unidad de medida del producto de stock
            cantidad_stock: Nueva cantidad del producto de stock
            unidad_medida_nucleo: Nueva unidad de medida del producto nucleo
            cantidad_nucleo: Nueva cantidad del producto nucleo
            activo: Nuevo estado activo
        
        Returns:
            Linkeo actualizado
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            updates = []
            params = []
            
            if unidad_medida_stock is not None:
                updates.append("unidad_medida_stock = ?")
                params.append(unidad_medida_stock)
            
            if cantidad_stock is not None:
                updates.append("cantidad_stock = ?")
                params.append(cantidad_stock)
            
            if unidad_medida_nucleo is not None:
                updates.append("unidad_medida_nucleo = ?")
                params.append(unidad_medida_nucleo)
            
            if cantidad_nucleo is not None:
                updates.append("cantidad_nucleo = ?")
                params.append(cantidad_nucleo)
            
            if activo is not None:
                updates.append("activo = ?")
                params.append(1 if activo else 0)
            
            if not updates:
                raise ValueError("No hay campos para actualizar")
            
            updates.append("fecha_modificacion = ?")
            params.append(datetime.now().isoformat())
            
            params.append(linkeo_id)
            
            query = f"UPDATE linkeos SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(query, params)
            conn.commit()
            
            # Obtener linkeo actualizado
            cursor.execute("SELECT * FROM linkeos WHERE id = ?", (linkeo_id,))
            row = cursor.fetchone()
            
            if not row:
                raise ValueError(f"Linkeo {linkeo_id} no encontrado")
            
            return {
                "success": True,
                "linkeo": {
                    "id": row[0],
                    "producto_nucleo_id": row[1],
                    "producto_nucleo_codigo": row[2],
                    "producto_nucleo_nombre": row[3],
                    "producto_stock_codigo": row[4],
                    "producto_stock_nombre": row[5],
                    "categoria": row[6],
                    "unidad_medida_stock": row[7],
                    "cantidad_stock": row[8],
                    "unidad_medida_nucleo": row[9],
                    "cantidad_nucleo": row[10],
                    "activo": bool(row[11]),
                    "auto_generado": bool(row[12]),
                    "fecha_creacion": row[13],
                    "fecha_modificacion": row[14]
                }
            }
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error actualizando linkeo: {str(e)}")
            raise
        finally:
            conn.close()
    
    def eliminar_linkeo(self, linkeo_id: int) -> Dict[str, Any]:
        """Elimina un linkeo."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("DELETE FROM linkeos WHERE id = ?", (linkeo_id,))
            conn.commit()
            
            return {
                "success": True,
                "message": f"Linkeo {linkeo_id} eliminado"
            }
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error eliminando linkeo: {str(e)}")
            raise
        finally:
            conn.close()
    
    def crear_linkeo_manual(
        self,
        producto_nucleo_id: int,
        producto_nucleo_codigo: str,
        producto_nucleo_nombre: str,
        producto_stock_codigo: str,
        producto_stock_nombre: str,
        categoria: str,
        unidad_medida_stock: str = "L",
        cantidad_stock: float = 1.0,
        unidad_medida_nucleo: str = "ml",
        cantidad_nucleo: float = 75.0
    ) -> Dict[str, Any]:
        """Crea un linkeo manual."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            fecha_actual = datetime.now().isoformat()
            
            cursor.execute("""
                INSERT INTO linkeos (
                    producto_nucleo_id, producto_nucleo_codigo, producto_nucleo_nombre,
                    producto_stock_codigo, producto_stock_nombre, categoria,
                    unidad_medida_stock, cantidad_stock,
                    unidad_medida_nucleo, cantidad_nucleo,
                    activo, auto_generado,
                    fecha_creacion, fecha_modificacion
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                producto_nucleo_id, producto_nucleo_codigo, producto_nucleo_nombre,
                producto_stock_codigo, producto_stock_nombre, categoria,
                unidad_medida_stock, cantidad_stock,
                unidad_medida_nucleo, cantidad_nucleo,
                1, 0,
                fecha_actual, fecha_actual
            ))
            
            linkeo_id = cursor.lastrowid
            conn.commit()
            
            return {
                "success": True,
                "linkeo_id": linkeo_id,
                "message": "Linkeo creado exitosamente"
            }
            
        except sqlite3.IntegrityError:
            conn.rollback()
            return {
                "success": False,
                "error": "Ya existe un linkeo entre estos productos"
            }
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creando linkeo: {str(e)}")
            raise
        finally:
            conn.close()
    
    def get_unidades_medida(self) -> List[Dict[str, Any]]:
        """Obtiene todas las unidades de medida disponibles."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT id, nombre, abreviatura, tipo, conversion_a_base, unidad_base, fecha_creacion
                FROM unidades_medida
                ORDER BY tipo, nombre
            """)
            rows = cursor.fetchall()
            
            unidades = []
            for row in rows:
                unidades.append({
                    "id": row[0],
                    "nombre": row[1],
                    "abreviatura": row[2],
                    "tipo": row[3],
                    "conversion_a_base": row[4],
                    "unidad_base": row[5],
                    "fecha_creacion": row[6]
                })
            
            return unidades
            
        finally:
            conn.close()
    
    def crear_unidad_medida(
        self,
        nombre: str,
        abreviatura: str,
        tipo: str,
        conversion_a_base: float,
        unidad_base: str
    ) -> Dict[str, Any]:
        """Crea una nueva unidad de medida."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            fecha_actual = datetime.now().isoformat()
            
            cursor.execute("""
                INSERT INTO unidades_medida (nombre, abreviatura, tipo, conversion_a_base, unidad_base, fecha_creacion)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (nombre, abreviatura, tipo, conversion_a_base, unidad_base, fecha_actual))
            
            unidad_id = cursor.lastrowid
            conn.commit()
            
            return {
                "success": True,
                "unidad_id": unidad_id,
                "message": "Unidad de medida creada exitosamente"
            }
            
        except sqlite3.IntegrityError:
            conn.rollback()
            return {
                "success": False,
                "error": "Ya existe una unidad de medida con ese nombre"
            }
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creando unidad de medida: {str(e)}")
            raise
        finally:
            conn.close()
    
    def tomar_snapshot_stock(self, sucursal: str = "recoleta") -> Dict[str, Any]:
        """
        Toma un snapshot del stock actual (stock + pedido) de productos con linkeos activos.
        
        Args:
            sucursal: Sucursal para obtener stocks
        
        Returns:
            Resumen del snapshot tomado
        """
        logger.info(f"Tomando snapshot de stock para {sucursal}...")
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Obtener productos de stock que tienen linkeos activos
            cursor.execute("""
                SELECT DISTINCT producto_stock_codigo, producto_stock_nombre, 
                       unidad_medida_stock, cantidad_stock
                FROM linkeos
                WHERE activo = 1
            """)
            productos_linkeados = cursor.fetchall()
            
            if not productos_linkeados:
                return {
                    "success": False,
                    "error": "No hay productos con linkeos activos"
                }
            
            # Obtener stocks actuales de Google Sheets
            productos_stock = get_stocks_salon(sucursal)
            stock_map = {p["codigo_producto"]: p for p in productos_stock}
            
            fecha_actual = datetime.now().isoformat()
            productos_actualizados = 0
            productos_nuevos = 0
            
            for row in productos_linkeados:
                codigo_stock = row[0]
                nombre_stock = row[1]
                unidad_stock = row[2]
                
                # Buscar el producto en el stock actual
                producto_actual = stock_map.get(codigo_stock)
                
                if not producto_actual:
                    logger.warning(f"Producto {codigo_stock} no encontrado en stock actual")
                    continue
                
                stock_cantidad = producto_actual["stock_cantidad"]
                pedido_cantidad = producto_actual["pedido_cantidad"]
                stock_total = stock_cantidad + pedido_cantidad
                
                # Verificar si ya existe un snapshot
                cursor.execute("""
                    SELECT id FROM stock_base WHERE producto_stock_codigo = ?
                """, (codigo_stock,))
                existe = cursor.fetchone()
                
                if existe:
                    # Actualizar snapshot existente — resetear consumido a 0
                    cursor.execute("""
                        UPDATE stock_base
                        SET stock_inicial = ?,
                            pedido = ?,
                            stock_total = ?,
                            consumido = 0.0,
                            unidad = ?,
                            fecha_snapshot = ?,
                            fecha_actualizacion = ?
                        WHERE producto_stock_codigo = ?
                    """, (stock_cantidad, pedido_cantidad, stock_total, unidad_stock, 
                          fecha_actual, fecha_actual, codigo_stock))
                    productos_actualizados += 1
                else:
                    # Crear nuevo snapshot
                    cursor.execute("""
                        INSERT INTO stock_base (
                            producto_stock_codigo, producto_stock_nombre,
                            stock_inicial, pedido, stock_total, consumido, unidad,
                            fecha_snapshot, fecha_actualizacion
                        ) VALUES (?, ?, ?, ?, ?, 0.0, ?, ?, ?)
                    """, (codigo_stock, nombre_stock, stock_cantidad, pedido_cantidad,
                          stock_total, unidad_stock, fecha_actual, fecha_actual))
                    productos_nuevos += 1
            
            # Limpiar ventas procesadas (nuevo snapshot = nuevo inicio)
            cursor.execute("DELETE FROM ventas_procesadas")
            
            conn.commit()
            
            logger.info(f"✓ Snapshot tomado: {productos_nuevos} nuevos, {productos_actualizados} actualizados")
            
            return {
                "success": True,
                "sucursal": sucursal,
                "productos_nuevos": productos_nuevos,
                "productos_actualizados": productos_actualizados,
                "total_productos": productos_nuevos + productos_actualizados,
                "fecha_snapshot": fecha_actual
            }
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error tomando snapshot: {str(e)}")
            raise
        finally:
            conn.close()

    
    def procesar_ventas(self, sucursal: str = "recoleta") -> Dict[str, Any]:
        """
        Procesa las ventas desde el último snapshot y calcula el consumo de stock.
        Cada llamada recalcula el consumo TOTAL desde el snapshot (no acumula).
        
        Args:
            sucursal: Sucursal para obtener ventas
        
        Returns:
            Resumen del procesamiento de ventas
        """
        logger.info(f"Procesando ventas para {sucursal}...")
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Verificar que existe un snapshot
            cursor.execute("SELECT COUNT(*) FROM stock_base")
            count = cursor.fetchone()[0]
            
            if count == 0:
                return {
                    "success": False,
                    "error": "No hay snapshot de stock base. Toma un snapshot primero."
                }
            
            # Obtener fecha del último snapshot
            cursor.execute("SELECT MAX(fecha_snapshot) FROM stock_base")
            fecha_snapshot = cursor.fetchone()[0]
            
            if not fecha_snapshot:
                return {
                    "success": False,
                    "error": "No se pudo obtener fecha del snapshot"
                }
            
            # Obtener linkeos activos
            cursor.execute("""
                SELECT 
                    producto_nucleo_id,
                    producto_stock_codigo,
                    unidad_medida_nucleo,
                    cantidad_nucleo,
                    unidad_medida_stock
                FROM linkeos
                WHERE activo = 1
            """)
            linkeos = cursor.fetchall()
            
            if not linkeos:
                return {
                    "success": False,
                    "error": "No hay linkeos activos"
                }
            
            # Crear mapa de linkeos por producto_nucleo_id
            linkeos_map = {}
            for row in linkeos:
                producto_nucleo_id = row[0]
                if producto_nucleo_id not in linkeos_map:
                    linkeos_map[producto_nucleo_id] = []
                linkeos_map[producto_nucleo_id].append({
                    "producto_stock_codigo": row[1],
                    "unidad_medida_nucleo": row[2],
                    "cantidad_nucleo": row[3],
                    "unidad_medida_stock": row[4]
                })
            
            # Obtener ventas desde Nucleo
            # Usar nest_asyncio para compatibilidad con event loop del scheduler
            nucleo_service = NucleoService()
            try:
                import nest_asyncio
                nest_asyncio.apply()
            except ImportError:
                pass
            
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                # Estamos dentro de un event loop (scheduler) — usar run_coroutine_threadsafe
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(asyncio.run, nucleo_service.get_session("1" if sucursal == "recoleta" else "2"))
                    session = future.result(timeout=60)
            except RuntimeError:
                session = asyncio.run(nucleo_service.get_session("1" if sucursal == "recoleta" else "2"))
            
            # Fecha actual
            fecha_actual = datetime.now().isoformat()
            
            # Obtener TODAS las ventas desde el snapshot hasta ahora
            ventas = nucleo_service.obtener_ventas_por_producto(
                session,
                fecha_snapshot,
                fecha_actual
            )
            
            logger.info(f"Ventas obtenidas: {len(ventas)} productos")
            
            # Calcular consumo total por producto de stock (desde cero, no acumulativo)
            consumos_por_producto = {}
            ventas_procesadas_count = 0
            ventas_sin_linkeo = 0
            
            for venta in ventas:
                producto_id = venta["producto_id"]
                cantidad_vendida = venta["cantidad_vendida"]
                
                if producto_id not in linkeos_map:
                    ventas_sin_linkeo += 1
                    continue
                
                for linkeo in linkeos_map[producto_id]:
                    producto_stock_codigo = linkeo["producto_stock_codigo"]
                    cantidad_nucleo = linkeo["cantidad_nucleo"]
                    unidad_nucleo = linkeo["unidad_medida_nucleo"]
                    unidad_stock = linkeo["unidad_medida_stock"]
                    
                    consumo_nucleo = cantidad_vendida * cantidad_nucleo
                    consumo_stock = self._convertir_unidades(consumo_nucleo, unidad_nucleo, unidad_stock)
                    
                    if producto_stock_codigo not in consumos_por_producto:
                        consumos_por_producto[producto_stock_codigo] = 0.0
                    
                    consumos_por_producto[producto_stock_codigo] += consumo_stock
                    ventas_procesadas_count += 1
            
            # Actualizar stock_base: guardar consumido y recalcular stock_total
            # stock_total = stock_inicial + pedido - consumido  (siempre desde el snapshot)
            fecha_actualizacion = datetime.now().isoformat()
            productos_actualizados = 0
            
            for producto_stock_codigo, consumo_total in consumos_por_producto.items():
                cursor.execute("""
                    UPDATE stock_base
                    SET consumido = ?,
                        stock_total = stock_inicial + pedido - ?,
                        fecha_actualizacion = ?
                    WHERE producto_stock_codigo = ?
                """, (consumo_total, consumo_total, fecha_actualizacion, producto_stock_codigo))
                productos_actualizados += 1
            
            conn.commit()
            
            logger.info(f"✓ Ventas procesadas: {ventas_procesadas_count} ventas, {productos_actualizados} productos actualizados")
            
            return {
                "success": True,
                "sucursal": sucursal,
                "fecha_snapshot": fecha_snapshot,
                "fecha_procesamiento": fecha_actualizacion,
                "total_ventas": len(ventas),
                "ventas_procesadas": ventas_procesadas_count,
                "ventas_sin_linkeo": ventas_sin_linkeo,
                "productos_actualizados": productos_actualizados,
                "consumos": consumos_por_producto
            }
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error procesando ventas: {str(e)}")
            raise
        finally:
            conn.close()
    
    def _convertir_unidades(self, cantidad: float, unidad_origen: str, unidad_destino: str) -> float:
        """
        Convierte cantidad de una unidad a otra.
        
        Args:
            cantidad: Cantidad a convertir
            unidad_origen: Unidad de origen (ej: "ml")
            unidad_destino: Unidad de destino (ej: "L")
        
        Returns:
            Cantidad convertida
        """
        # Si son iguales, no convertir
        if unidad_origen == unidad_destino:
            return cantidad
        
        # Conversiones de volumen
        if unidad_origen == "ml" and unidad_destino == "L":
            return cantidad / 1000.0
        elif unidad_origen == "L" and unidad_destino == "ml":
            return cantidad * 1000.0
        
        # Conversiones de peso
        elif unidad_origen == "gr" and unidad_destino == "Kg":
            return cantidad / 1000.0
        elif unidad_origen == "Kg" and unidad_destino == "gr":
            return cantidad * 1000.0
        
        # Si no hay conversión conocida, retornar la cantidad original
        logger.warning(f"No se pudo convertir de {unidad_origen} a {unidad_destino}")
        return cantidad
    
    def get_stock_aproximado(self, categoria: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Obtiene el stock aproximado de todos los productos.
        
        Args:
            categoria: Filtrar por categoría (opcional)
        
        Returns:
            Lista de productos con stock aproximado
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            query = """
                SELECT 
                    sb.producto_stock_codigo,
                    sb.producto_stock_nombre,
                    sb.stock_inicial,
                    sb.pedido,
                    sb.stock_total,
                    sb.consumido,
                    sb.unidad,
                    sb.fecha_snapshot,
                    sb.fecha_actualizacion,
                    l.categoria
                FROM stock_base sb
                LEFT JOIN linkeos l ON sb.producto_stock_codigo = l.producto_stock_codigo
                    AND l.activo = 1
                WHERE l.id IS NOT NULL
            """
            
            params = []
            if categoria:
                query += " AND l.categoria = ?"
                params.append(categoria)
            
            query += " GROUP BY sb.producto_stock_codigo ORDER BY sb.producto_stock_nombre"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            productos = []
            for row in rows:
                stock_base_total = row[2] + row[3]  # stock_inicial + pedido
                consumido = row[5]                   # consumido guardado
                stock_actual = row[4]                # stock_total = base - consumido
                porcentaje_consumido = (consumido / stock_base_total * 100) if stock_base_total > 0 else 0
                
                productos.append({
                    "codigo": row[0],
                    "nombre": row[1],
                    "stock_inicial": row[2],
                    "pedido": row[3],
                    "stock_base": stock_base_total,
                    "consumido": round(consumido, 3),
                    "stock_actual": round(stock_actual, 3),
                    "unidad": row[6],
                    "porcentaje_consumido": round(porcentaje_consumido, 2),
                    "fecha_snapshot": row[7],
                    "fecha_actualizacion": row[8],
                    "categoria": row[9]
                })
            
            return productos
            
        finally:
            conn.close()

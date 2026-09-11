"""
Script para obtener los nombres de productos de Nucleo y actualizar la base de datos.
"""
import sqlite3
import os
import sys
import asyncio
from datetime import datetime

# Agregar el directorio src al path
sys.path.insert(0, os.path.dirname(__file__))

from src.services.nucleo_service import NucleoService

# Ruta de la base de datos
db_path = os.path.join(os.path.dirname(__file__), "src", "services", "recetario.db")

async def obtener_productos_nucleo():
    """Obtiene todos los productos de Nucleo."""
    try:
        nucleo_service = NucleoService()
        
        # Obtener sesión para Recoleta (sucursal 1)
        session = await nucleo_service.get_session("1")
        productos = nucleo_service.obtener_todos_productos(session)
        
        # Crear diccionario de ID -> Nombre
        productos_map = {}
        for prod in productos:
            prod_id = prod.get('Id')
            prod_name = prod.get('Name', '')
            if prod_id:
                productos_map[prod_id] = prod_name
        
        return productos_map
    except Exception as e:
        print(f"❌ Error obteniendo productos de Nucleo: {str(e)}")
        return {}

def actualizar_nombres_en_db(productos_map):
    """Actualiza los nombres de productos en la base de datos."""
    
    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Obtener todos los linkeos
        cursor.execute("SELECT id, producto_nucleo_id FROM linkeos")
        linkeos = cursor.fetchall()
        
        print(f"\n📝 Actualizando {len(linkeos)} linkeos con nombres de Nucleo...")
        
        actualizados = 0
        sin_nombre = 0
        
        for linkeo_id, producto_nucleo_id in linkeos:
            nombre = productos_map.get(producto_nucleo_id, "")
            
            if nombre:
                cursor.execute("""
                    UPDATE linkeos 
                    SET producto_nucleo_nombre = ?, fecha_modificacion = ?
                    WHERE id = ?
                """, (nombre, datetime.now().isoformat(), linkeo_id))
                actualizados += 1
                print(f"✓ Linkeo {linkeo_id}: Nucleo {producto_nucleo_id} → {nombre}")
            else:
                sin_nombre += 1
                print(f"⚠️  Linkeo {linkeo_id}: No se encontró nombre para Nucleo {producto_nucleo_id}")
        
        conn.commit()
        
        print("\n" + "=" * 60)
        print("📊 RESUMEN DE ACTUALIZACIÓN")
        print("=" * 60)
        print(f"✓ Linkeos actualizados: {actualizados}")
        print(f"⚠️  Linkeos sin nombre: {sin_nombre}")
        print("=" * 60)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {str(e)}")
    finally:
        conn.close()

async def main():
    """Función principal."""
    print("🔄 Obteniendo productos de Nucleo...")
    productos_map = await obtener_productos_nucleo()
    
    if productos_map:
        print(f"✓ Se obtuvieron {len(productos_map)} productos de Nucleo")
        actualizar_nombres_en_db(productos_map)
    else:
        print("❌ No se pudieron obtener los productos de Nucleo")

if __name__ == "__main__":
    # Windows requiere ProactorEventLoop
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    asyncio.run(main())

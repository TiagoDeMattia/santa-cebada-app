"""
Script para corregir nombres de productos de Nucleo que fueron obtenidos incorrectamente.
Permite actualizar manualmente los nombres que no coinciden.
"""
import sqlite3
import os
from datetime import datetime

# Ruta de la base de datos
db_path = os.path.join(os.path.dirname(__file__), "src", "services", "recetario.db")

# Mapeo manual de correcciones
# Formato: codigo_nucleo -> nombre_correcto
CORRECCIONES = {
    707: "SHOT VODKA - SMIRNOFF",
    # Agrega más correcciones aquí si es necesario
}

def corregir_nombres():
    """Corrige los nombres de productos en la base de datos."""
    
    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("📝 Corrigiendo nombres de productos de Nucleo...")
        
        corregidos = 0
        
        for codigo_nucleo, nombre_correcto in CORRECCIONES.items():
            # Obtener los linkeos con este código
            cursor.execute("""
                SELECT id, producto_nucleo_nombre FROM linkeos 
                WHERE producto_nucleo_id = ?
            """, (codigo_nucleo,))
            
            linkeos = cursor.fetchall()
            
            for linkeo_id, nombre_actual in linkeos:
                if nombre_actual != nombre_correcto:
                    cursor.execute("""
                        UPDATE linkeos 
                        SET producto_nucleo_nombre = ?, fecha_modificacion = ?
                        WHERE id = ?
                    """, (nombre_correcto, datetime.now().isoformat(), linkeo_id))
                    
                    corregidos += 1
                    print(f"✓ Linkeo {linkeo_id}: {nombre_actual} → {nombre_correcto}")
        
        conn.commit()
        
        print("\n" + "=" * 60)
        print("📊 RESUMEN DE CORRECCIONES")
        print("=" * 60)
        print(f"✓ Nombres corregidos: {corregidos}")
        print("=" * 60)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {str(e)}")
    finally:
        conn.close()

if __name__ == "__main__":
    corregir_nombres()

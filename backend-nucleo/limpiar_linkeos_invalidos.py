"""
Script para eliminar linkeos que no son bebidas/tragos.
Estos códigos son comidas o items que no deberían estar en el recetario.
"""
import sqlite3
import os

# Ruta de la base de datos
db_path = os.path.join(os.path.dirname(__file__), "src", "services", "recetario.db")

# Códigos de Nucleo que NO son bebidas/tragos (son comidas u otros items)
CODIGOS_INVALIDOS = [
    138,   # DELIVERY 2
    448,   # ADICIONAL CEBOLLA CRISPY
    602,   # TACOS VEGGIE
    603,   # TACOS VEGGIE - D
    604,   # PANQUEQUES DDL
    614,   # PIZZA MUZZA
    615,   # PIZZA FUGAZZETA
    616,   # PIZZA NAPOLITANA
    621,   # MILANESA - A CABALLO
    623,   # EMPANADAS DE JYQ
    706,   # CROISSANT
]

def limpiar_linkeos():
    """Elimina los linkeos que no son bebidas."""
    
    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("🗑️  Eliminando linkeos que no son bebidas...")
        
        for codigo in CODIGOS_INVALIDOS:
            cursor.execute("""
                SELECT id, producto_nucleo_nombre FROM linkeos 
                WHERE producto_nucleo_id = ?
            """, (codigo,))
            
            linkeos = cursor.fetchall()
            
            for linkeo_id, nombre in linkeos:
                cursor.execute("DELETE FROM linkeos WHERE id = ?", (linkeo_id,))
                print(f"✓ Eliminado linkeo {linkeo_id}: {nombre}")
        
        conn.commit()
        
        # Contar linkeos restantes
        cursor.execute("SELECT COUNT(*) FROM linkeos")
        total = cursor.fetchone()[0]
        
        print("\n" + "=" * 60)
        print("📊 RESUMEN DE LIMPIEZA")
        print("=" * 60)
        print(f"✓ Linkeos eliminados: {len(CODIGOS_INVALIDOS)}")
        print(f"✓ Linkeos restantes: {total}")
        print("=" * 60)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {str(e)}")
    finally:
        conn.close()

if __name__ == "__main__":
    limpiar_linkeos()

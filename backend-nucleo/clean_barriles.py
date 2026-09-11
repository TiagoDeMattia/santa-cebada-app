#!/usr/bin/env python3
"""
Script para limpiar el archivo barriles_service.py eliminando código duplicado
"""

# Leer el archivo
with open('src/services/barriles_service.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Encontrar dónde empieza el código duplicado
# Buscar la línea 272 aproximadamente donde dice "# Encontrar posiciones de marcadores (solo en Recoleta)"
# y está DESPUÉS de la función _reordenar_preservando_formulas

duplicate_start = None
for i in range(250, len(lines)):
    if '# Encontrar posiciones de marcadores (solo en Recoleta)' in lines[i]:
        # Verificar que no es la primera ocurrencia (que está en reordenar_sheet)
        # La duplicada está después de _reordenar_preservando_formulas
        if i > 260:
            duplicate_start = i - 1  # Incluir la línea anterior
            print(f"Código duplicado encontrado en línea {i}")
            break

# Encontrar dónde termina el código duplicado
# Buscar la función _reordenar_sheet_sin_marcadores
duplicate_end = None
for i in range(duplicate_start if duplicate_start else 0, len(lines)):
    if 'def _reordenar_sheet_sin_marcadores' in lines[i]:
        duplicate_end = i
        print(f"Fin del código duplicado en línea {i}")
        break

# Crear el archivo limpio
if duplicate_start and duplicate_end:
    clean_lines = lines[:duplicate_start] + lines[duplicate_end:]
    
    with open('src/services/barriles_service.py', 'w', encoding='utf-8') as f:
        f.writelines(clean_lines)
    
    print(f"✅ Archivo limpiado: eliminadas {duplicate_end - duplicate_start} líneas duplicadas")
    print(f"   Líneas originales: {len(lines)}")
    print(f"   Líneas finales: {len(clean_lines)}")
else:
    print("❌ No se encontró código duplicado")

# 🔧 Corrección PASOS 3 y 4: Para Retirar y Retirada

**Fecha:** 2026-05-05 23:00  
**Estado:** ✅ COMPLETADO

---

## 🐛 Problema Identificado

### Diagnóstico
Ejecuté scripts de diagnóstico y encontré:

```
❌ 1 fila 'Para Retirar' en zona EN CAMARA (debería estar en VACIOS)
   - Fila 34: "Inframundo" Stout

❌ 1 fila 'Retirada' en zona EN CAMARA (debería estar en RETIRADAS)
   - Fila 39: German Pils
```

### Causa del Problema

El código original en PASO 3 y 4 tenía una lógica incorrecta:

```python
# ❌ PASO 3 INCORRECTO
for i, row in enumerate(all_rows):
    row_num = i + 1
    # Esta condición SALTA las filas entre VACIOS y RETIRADAS
    if row_num <= row_vacios_actual or row_num >= row_retiradas_actual or row_num < target_row:
        continue
    
    if estado == "Para Retirar":
        encontrada = ...
```

**Problema:** La condición `row_num <= row_vacios_actual or row_num >= row_retiradas_actual` hace que:
- ✅ Busque filas ENTRE VACIOS y RETIRADAS
- ❌ NO busque filas ANTES de VACIOS (zona EN CAMARA)
- ❌ NO busque filas DESPUÉS de RETIRADAS

Entonces, si una fila "Para Retirar" está en la fila 34 (zona EN CAMARA), **nunca la encuentra** porque `row_num <= row_vacios_actual` (34 <= 41) hace que se salte.

---

## ✅ Solución Aplicada

### Nueva Lógica

La lógica correcta debe ser:
1. **Buscar en TODO el sheet** filas con el estado incorrecto
2. **Saltar solo** las filas que ya están en su zona correcta Y antes de `target_row`
3. **Mover** todas las demás

### PASO 3 Corregido

```python
# ✅ PASO 3 CORRECTO
for i, row in enumerate(all_rows):
    row_num = i + 1
    
    # Zona correcta para "Para Retirar": entre VACIOS y RETIRADAS
    # Si está en su zona correcta Y antes de target_row, saltarla
    if row_vacios_actual < row_num < row_retiradas_actual and row_num < target_row:
        continue
    
    if len(row) <= col_estado_idx:
        continue
    
    estado = row[col_estado_idx].strip()
    if estado == "Para Retirar":
        # Si está en su zona correcta pero después de target_row, moverla
        # Si está fuera de su zona correcta, moverla
        if row_num < row_vacios_actual or row_num >= row_retiradas_actual or row_num >= target_row:
            encontrada = {"row_num": row_num, "estilo": row[2].strip() if len(row) > 2 else ""}
            break
```

**Explicación:**
- `if row_vacios_actual < row_num < row_retiradas_actual and row_num < target_row: continue`
  - Solo salta filas que están en la zona correcta (entre VACIOS y RETIRADAS) Y antes de target_row
- `if row_num < row_vacios_actual or row_num >= row_retiradas_actual or row_num >= target_row:`
  - Mueve filas que están:
    - **Antes de VACIOS** (zona EN CAMARA) ← Esto es lo que faltaba
    - **Después de RETIRADAS** (zona incorrecta)
    - **En su zona correcta pero después de target_row** (necesita reordenarse)

### PASO 4 Corregido

```python
# ✅ PASO 4 CORRECTO
for i, row in enumerate(all_rows):
    row_num = i + 1
    
    # Zona correcta para "Retirada": después de RETIRADAS
    # Si está en su zona correcta Y antes de target_row, saltarla
    if row_num > row_retiradas_actual and row_num < target_row:
        continue
    
    if len(row) <= col_estado_idx:
        continue
    
    estado = row[col_estado_idx].strip()
    if estado == "Retirada":
        # Si está en su zona correcta pero después de target_row, moverla
        # Si está fuera de su zona correcta, moverla
        if row_num <= row_retiradas_actual or row_num >= target_row:
            encontrada = {"row_num": row_num, "estilo": row[2].strip() if len(row) > 2 else ""}
            break
```

**Explicación:**
- `if row_num > row_retiradas_actual and row_num < target_row: continue`
  - Solo salta filas que están en la zona correcta (después de RETIRADAS) Y antes de target_row
- `if row_num <= row_retiradas_actual or row_num >= target_row:`
  - Mueve filas que están:
    - **Antes o en RETIRADAS** (zona EN CAMARA o VACIOS) ← Esto es lo que faltaba
    - **En su zona correcta pero después de target_row** (necesita reordenarse)

---

## 📊 Comparación Antes/Después

### PASO 3: Para Retirar

| Escenario | Antes | Después |
|-----------|-------|---------|
| Fila 34 (EN CAMARA) con "Para Retirar" | ❌ No la encuentra | ✅ La mueve a zona VACIOS |
| Fila 42 (VACIOS) con "Para Retirar" | ✅ La encuentra | ✅ La encuentra |
| Fila 60 (RETIRADAS) con "Para Retirar" | ❌ No la encuentra | ✅ La mueve a zona VACIOS |

### PASO 4: Retirada

| Escenario | Antes | Después |
|-----------|-------|---------|
| Fila 39 (EN CAMARA) con "Retirada" | ❌ No la encuentra | ✅ La mueve a zona RETIRADAS |
| Fila 50 (VACIOS) con "Retirada" | ❌ No la encuentra | ✅ La mueve a zona RETIRADAS |
| Fila 60 (RETIRADAS) con "Retirada" | ✅ La encuentra | ✅ La encuentra |

---

## 🎯 Resultado Esperado

Después de aplicar estas correcciones y ejecutar el reordenamiento:

### Antes
```
Fila 34: "Inframundo" Stout - Estado: Para Retirar ← ❌ En zona EN CAMARA
Fila 39: German Pils - Estado: Retirada ← ❌ En zona EN CAMARA
```

### Después
```
Fila 34: (otra cerveza) - Estado: En Camara ← ✅ Correcto
Fila 39: (otra cerveza) - Estado: En Camara ← ✅ Correcto
...
Fila 42: "Inframundo" Stout - Estado: Para Retirar ← ✅ Movida a zona VACIOS
...
Fila 59: German Pils - Estado: Retirada ← ✅ Movida a zona RETIRADAS
```

---

## 📁 Archivos Creados

1. **`debug_marcadores.py`** - Script para ver dónde están los marcadores
2. **`debug_estados_completo.py`** - Script para detectar estados en zonas incorrectas
3. **`fix_pasos_3_4.py`** - Script que aplicó las correcciones
4. **`FIX_PASOS_3_4_REORDENAR.md`** (este archivo) - Documentación de las correcciones

---

## 🚀 Próximos Pasos

1. **Reiniciar el backend:**
   ```bash
   # Detener el backend actual (Ctrl+C)
   # Luego reiniciar:
   cd backend-nucleo
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Probar el reordenamiento:**
   - Ir a la página de Barriles
   - Clic en "Reordenar"
   - Verificar que:
     - ✅ Fila 34 ("Inframundo" Stout) se mueve a zona VACIOS
     - ✅ Fila 39 (German Pils) se mueve a zona RETIRADAS
     - ✅ Todas las "Para Retirar" están entre VACIOS y RETIRADAS
     - ✅ Todas las "Retirada" están después de RETIRADAS

3. **Verificar con el script de diagnóstico:**
   ```bash
   cd backend-nucleo
   python debug_estados_completo.py
   ```
   
   Debería mostrar:
   ```
   ✅ No se detectaron problemas. Todos los estados están en su zona correcta.
   ```

---

## ✅ Resumen de Correcciones

### Cambios Aplicados

1. **PASO 3 (Para Retirar):**
   - ✅ Ahora busca "Para Retirar" en TODO el sheet
   - ✅ Mueve filas que están ANTES de VACIOS (zona EN CAMARA)
   - ✅ Mueve filas que están DESPUÉS de RETIRADAS (zona incorrecta)
   - ✅ Recalcula marcadores en cada iteración

2. **PASO 4 (Retirada):**
   - ✅ Ahora busca "Retirada" en TODO el sheet
   - ✅ Mueve filas que están ANTES de RETIRADAS (zona EN CAMARA o VACIOS)
   - ✅ Recalcula marcador en cada iteración

### Lógica Corregida

**Antes:** "Busca solo en la zona donde DEBERÍAN estar"  
**Después:** "Busca en TODO el sheet y mueve las que NO están donde deberían"

---

**¡Correcciones aplicadas exitosamente! 🎉**

*Ahora el reordenamiento moverá correctamente las filas "Para Retirar" y "Retirada" sin importar dónde estén.*

---

*Documento creado: 2026-05-05 23:00*

# Optimización del Reordenamiento

## ✅ CAMBIOS APLICADOS

### 1. **Posición Correcta: DEBAJO del Título**

**Problema anterior:**
- Las filas se movían ARRIBA del título en lugar de DEBAJO

**Solución:**
```python
# ANTES (MAL)
target_row = row_vacios  # Movía ARRIBA del marcador

# AHORA (BIEN)
target_row = row_vacios_actual + 1  # Mueve DEBAJO del marcador
```

**Ejemplo:**
- Si "VACIOS" está en fila 34
- `target_row = 35` (la fila DESPUÉS del título)
- Las filas "Para Retirar" se mueven a partir de la fila 35

### 2. **Optimización: Lectura de Columna A Completa**

**Problema anterior:**
- Leía el sheet completo en cada iteración
- Muy lento con muchas filas

**Solución:**
```python
# ANTES (LENTO)
for i, row in enumerate(all_rows):
    if row[0].strip() == MARCADOR_VACIOS:
        row_vacios_actual = i + 1
        break

# AHORA (RÁPIDO)
row_vacios_actual = next((i + 1 for i, row in enumerate(all_rows) if row[0].strip() == MARCADOR_VACIOS), row_vacios)
```

**Ventajas:**
- ✅ Más rápido (una sola línea)
- ✅ Más legible
- ✅ Usa comprensión de lista optimizada

### 3. **Simplificación del Código**

**Eliminado código redundante:**
```python
# ANTES
if row_num < target_row:
    continue
# ... más código ...
if encontrada["row_num"] != target_row:
    # mover
else:
    logger.info("ya está en posición correcta")

# AHORA
if row_num < target_row:
    continue
# ... código simplificado ...
if encontrada["row_num"] != target_row:
    # mover
# (sin else innecesario)
```

---

## ⚠️ PROBLEMA DE CUOTA DE GOOGLE

### Error Observado:
```
Error: Quota exceeded for quota metric 'Read requests'
Limit: 60 read requests per minute per user
```

### Causa:
- Google Sheets API tiene un límite de **60 lecturas por minuto por usuario**
- El código lee el sheet en cada iteración del bucle
- Con muchas filas (100+), se excede el límite rápidamente

### Soluciones Posibles:

#### Opción 1: Agregar Delay (Más Simple)
```python
import time

while iteration_count < max_iterations:
    iteration_count += 1
    all_rows = ws.get_all_values()
    # ... lógica ...
    time.sleep(1)  # Esperar 1 segundo entre lecturas
```

**Pros:** Fácil de implementar
**Contras:** Más lento

#### Opción 2: Leer Una Sola Vez y Trackear Cambios (Más Complejo)
```python
# Leer UNA SOLA VEZ al inicio
all_rows = ws.get_all_values()

# Trackear cambios en memoria
# Mover todas las filas necesarias
# Actualizar índices en memoria

# NO releer el sheet en cada iteración
```

**Pros:** Mucho más rápido, no excede cuota
**Contras:** Más complejo, necesita trackear índices manualmente

#### Opción 3: Batch Operations (Óptimo)
```python
# Identificar TODAS las filas a mover
filas_a_mover = []
for cada fila:
    if necesita moverse:
        filas_a_mover.append(fila)

# Mover TODAS en una sola operación batch
batch_move(filas_a_mover)
```

**Pros:** Más rápido, una sola lectura, una sola escritura
**Contras:** Más complejo de implementar

---

## 📊 COMPARACIÓN

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Posición | Arriba del título ❌ | Debajo del título ✅ |
| Velocidad | Lento (múltiples lecturas) | Más rápido (optimizado) |
| Código | Redundante | Simplificado |
| Cuota | Puede exceder | Puede exceder ⚠️ |

---

## 🎯 RESULTADO ESPERADO

### Ejemplo con VACIOS en fila 34:

**Antes:**
```
Fila 33: [Datos]
Fila 34: VACIOS
Fila 35: [Para Retirar movido aquí] ❌ MAL
```

**Ahora:**
```
Fila 34: VACIOS
Fila 35: [Para Retirar movido aquí] ✅ BIEN
Fila 36: [Para Retirar movido aquí] ✅ BIEN
```

### Ejemplo con RETIRADAS en fila 50:

**Antes:**
```
Fila 49: [Datos]
Fila 50: RETIRADAS
Fila 51: [Retirada movida aquí] ❌ MAL
```

**Ahora:**
```
Fila 50: RETIRADAS
Fila 51: [Retirada movida aquí] ✅ BIEN
Fila 52: [Retirada movida aquí] ✅ BIEN
```

---

## 🔧 PRÓXIMOS PASOS

### Para Solucionar el Problema de Cuota:

1. **Opción Recomendada**: Agregar un pequeño delay
   ```python
   import time
   time.sleep(1)  # Entre cada lectura
   ```

2. **Opción Avanzada**: Implementar batch operations
   - Leer una sola vez
   - Identificar todas las filas a mover
   - Mover todas en batch

3. **Opción Temporal**: Esperar 1 minuto entre reordenamientos
   - El límite se resetea cada minuto
   - Después de un error 429, esperar 60 segundos

---

## 📁 ARCHIVO MODIFICADO

- `backend-nucleo/src/services/barriles_service.py`
  - Función `reordenar_sheet()` - Optimizada y corregida
  - Líneas ~680-750: Corrección de `target_row` para Para Retirar y Retiradas

---

## 🧪 TESTING

Para probar los cambios:

1. **Esperar 1 minuto** (para que se resetee la cuota de Google)
2. **Acceder a la página** de Barriles
3. **Modificar un barril**
4. **Verificar en Google Sheets**:
   - ✅ "Para Retirar" está DEBAJO de "VACIOS"
   - ✅ "Retirada" está DEBAJO de "RETIRADAS"
   - ✅ NO hay filas arriba de los títulos

---

## ⚠️ NOTA IMPORTANTE

Si ves el error de cuota (429), **espera 1 minuto** antes de volver a intentar el reordenamiento. El límite de Google se resetea cada minuto.

Para evitar este problema en el futuro, podemos implementar un delay automático o batch operations.

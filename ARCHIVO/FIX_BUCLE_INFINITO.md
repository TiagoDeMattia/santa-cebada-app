# Fix: Bucle Infinito en Reordenamiento

## 🔴 PROBLEMA IDENTIFICADO

El código estaba entrando en **bucle infinito** y borrando datos por las siguientes razones:

### 1. **Posiciones de marcadores no se recalculaban**
```python
# ANTES (MAL)
row_vacios = calcular_una_vez()  # Se calcula al inicio
while True:
    if row_num >= row_vacios:  # ❌ Usa posición vieja
        continue
```

Después de mover filas, la posición de "VACIOS" y "RETIRADAS" cambia, pero el código seguía usando las posiciones originales.

### 2. **No verificaba si la fila ya estaba en posición correcta**
```python
# ANTES (MAL)
while True:
    encontrada = buscar_pinchada()
    if encontrada["row_num"] != target_row:
        mover()
    target_row += 1  # ❌ Siempre incrementa, incluso si no movió nada
```

Si una fila ya estaba en su posición, el código la "movía" a sí misma y seguía buscando, causando bucle infinito.

### 3. **No saltaba filas ya procesadas**
```python
# ANTES (MAL)
for i, row in enumerate(all_rows):
    if estado == "Pinchada":  # ❌ Encuentra la misma pinchada una y otra vez
        return row
```

El código no verificaba si la fila ya estaba antes de `target_row`, por lo que seguía encontrando las mismas filas ya procesadas.

### 4. **Sin protección contra bucles infinitos**
No había contador de iteraciones, por lo que si algo salía mal, el bucle corría infinitamente.

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. **Recalcular posiciones de marcadores en cada iteración**
```python
# AHORA (BIEN)
while iteration_count < max_iterations:
    all_rows = ws.get_all_values()
    
    # Recalcular posición de VACIOS
    row_vacios_actual = None
    for i, row in enumerate(all_rows):
        if row[0].strip() == MARCADOR_VACIOS:
            row_vacios_actual = i + 1
            break
    
    if row_num >= row_vacios_actual:  # ✅ Usa posición actualizada
        continue
```

### 2. **Saltar filas ya procesadas**
```python
# AHORA (BIEN)
for i, row in enumerate(all_rows):
    row_num = i + 1
    
    # Si esta fila ya está antes de target_row, saltarla
    if row_num < target_row:  # ✅ Ignora filas ya procesadas
        continue
    
    if estado == "Pinchada":
        return row
```

### 3. **Verificar si la fila ya está en posición correcta**
```python
# AHORA (BIEN)
if encontrada["row_num"] != target_row:
    logger.info(f"Moviendo fila {encontrada['row_num']} a {target_row}")
    _move_rows_physically(...)
else:
    logger.info(f"Fila {encontrada['row_num']} ya está en posición correcta")

target_row += 1  # ✅ Siempre incrementa después de procesar
```

### 4. **Contador de seguridad**
```python
# AHORA (BIEN)
max_iterations = 100  # Límite de seguridad
iteration_count = 0

while iteration_count < max_iterations:
    iteration_count += 1
    # ... lógica ...
    
    if encontrada is None:
        logger.info(f"No hay más para mover (iteraciones: {iteration_count})")
        break
```

### 5. **Logging detallado**
Ahora el código registra:
- Cuántas iteraciones tomó cada paso
- Qué filas se movieron y a dónde
- Cuándo una fila ya está en posición correcta
- Cuándo no hay más filas para mover

---

## 📊 CAMBIOS APLICADOS

### Ambas funciones actualizadas:
1. ✅ `reordenar_sheet()` - Recoleta (con marcadores)
2. ✅ `_reordenar_sheet_sin_marcadores_moviendo()` - Palermo (sin marcadores)

### Mejoras en cada PASO:
- **PASO 1 (Pinchadas)**: Recalcula VACIOS, salta filas procesadas, ordena por canilla
- **PASO 2 (En Camara)**: Recalcula VACIOS, salta filas procesadas
- **PASO 3 (Para Retirar)**: Recalcula VACIOS y RETIRADAS, salta filas procesadas
- **PASO 4 (Retiradas)**: Recalcula RETIRADAS, salta filas procesadas

---

## 🎯 RESULTADO ESPERADO

Ahora el reordenamiento debería:

1. ✅ **NO entrar en bucle infinito** - Máximo 100 iteraciones por paso
2. ✅ **NO borrar datos** - Solo mueve filas que necesitan moverse
3. ✅ **Terminar rápidamente** - Solo procesa cada fila una vez
4. ✅ **Logging claro** - Muestra exactamente qué está haciendo

### Ejemplo de log esperado:
```
=== PASO 1: Ordenando Pinchadas ===
Moviendo Pinchada fila 8 (canilla 1, IPA) a posición 4
Moviendo Pinchada fila 6 (canilla 2, Stout) a posición 5
Pinchada en fila 6 ya está en posición correcta
No hay más pinchadas para mover (iteraciones: 3)

=== PASO 2: Moviendo En Camara ===
Moviendo En Camara fila 10 (Lager) a posición 7
No hay más En Camara para mover (iteraciones: 1)

=== PASO 3: Moviendo Para Retirar ===
No hay más Para Retirar para mover (iteraciones: 1)

=== PASO 4: Moviendo Retiradas ===
Moviendo Retirada fila 15 (Pale Ale) a posición 12
No hay más Retiradas para mover (iteraciones: 1)

Reordenamiento completo - Pinchadas: 2, En Cámara: 3, Para Retirar: 0, Retiradas: 1
```

---

## 🧪 TESTING

Para probar que funciona correctamente:

1. **Ir a la página de Barriles**
2. **Modificar un barril** (pinchar, despinchar, etc.)
3. **Observar los logs del backend** (Terminal 1)
4. **Verificar que:**
   - ✅ El reordenamiento termina rápidamente (segundos, no minutos)
   - ✅ Los logs muestran iteraciones razonables (< 100)
   - ✅ NO se borran datos
   - ✅ Las filas quedan en el orden correcto

---

## 📁 ARCHIVO MODIFICADO

- `backend-nucleo/src/services/barriles_service.py`
  - Función `reordenar_sheet()` - Líneas ~490-650
  - Función `_reordenar_sheet_sin_marcadores_moviendo()` - Líneas ~680-850

---

## ⚠️ NOTA IMPORTANTE

La fórmula de estado:
```excel
=SI(D12="","",SI(Y(D12<>"",F12=""),"En Camara",SI(Y(F12<>"",I12=""),"Pinchada",SI(Y(I12<>"",L12=""),"Para Retirar","Retirada"))))
```

**SÍ funciona correctamente con `cutPaste`** porque usa referencias relativas (D12, F12, I12, L12). Google Sheets ajusta automáticamente estas referencias cuando mueve la fila.

El problema NO era la fórmula, sino la lógica del bucle que no manejaba correctamente las posiciones cambiantes.

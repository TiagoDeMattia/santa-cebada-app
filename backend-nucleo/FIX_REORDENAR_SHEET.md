# 🔧 Correcciones para reordenar_sheet

**Fecha:** 2026-05-05  
**Problemas identificados:**

1. ❌ **Error 500** - Falta manejo de excepciones y validaciones
2. ❌ **Filas encima del título** - `target_row = DATA_START_ROW` (fila 4) en vez de `row_en_camara + 1`
3. ❌ **Sin ordenamiento por tipo** - "En Cámara" no se ordena por tipo (A-E, luego especiales)

---

## 🐛 Problema 1: Error 500

### Causa
- Falta try-catch en la función principal
- No valida si `len(row) > col_estado_idx` antes de acceder
- No valida si `row_en_camara` existe

### Solución
```python
def reordenar_sheet(sucursal_id: str = "1") -> Dict[str, Any]:
    try:
        # ... código existente ...
        
        # Validar que encontramos EN CAMARA
        if not row_en_camara:
            logger.warning("No se encontró el marcador EN CAMARA, usando DATA_START_ROW")
            row_en_camara = DATA_START_ROW - 1
        
        # Validar longitud de row antes de acceder
        for i, row in enumerate(all_rows):
            if len(row) <= col_estado_idx:
                continue  # Saltar filas sin suficientes columnas
            estado = row[col_estado_idx].strip()
            
    except Exception as e:
        logger.error(f"Error en reordenar_sheet: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al reordenar: {str(e)}")
```

---

## 🐛 Problema 2: Filas encima del título "EN CAMARA"

### Causa
```python
# ❌ INCORRECTO
target_row = DATA_START_ROW  # Fila 4
```

Esto hace que las pinchadas se muevan a la fila 4, que está ENCIMA del marcador "EN CAMARA" (fila 3).

### Solución
```python
# ✅ CORRECTO
target_row = row_en_camara + 1  # Si EN CAMARA está en fila 3, target_row = 4
```

### Cambios necesarios

**LÍNEA ~507:**
```python
# ANTES
# PASO 1: Mover todas las "Pinchadas" debajo de EN CAMARA, ordenadas por canilla
logger.info("=== PASO 1: Ordenando Pinchadas ===")
target_row = DATA_START_ROW  # ❌ INCORRECTO

# DESPUÉS
# PASO 1: Mover todas las "Pinchadas" debajo de EN CAMARA, ordenadas por canilla
logger.info("=== PASO 1: Ordenando Pinchadas ===")
target_row = row_en_camara + 1  # ✅ CORRECTO - Empieza DESPUÉS del marcador
```

**LÍNEA ~520:**
```python
# ANTES
if row_num < DATA_START_ROW or row_num >= row_vacios_actual or row_num < target_row:
    continue

# DESPUÉS
if row_num <= row_en_camara or row_num >= row_vacios_actual or row_num < target_row:
    continue
```

---

## 🐛 Problema 3: Sin ordenamiento por tipo en "En Cámara"

### Causa
El PASO 2 actual mueve "En Cámara" sin ordenar por tipo:
```python
# ❌ INCORRECTO - No ordena por tipo
while iteration_count < max_iterations:
    # Busca cualquier "En Camara" sin importar el tipo
    if estado == "En Camara":
        encontrada = {"row_num": row_num, "estilo": row[2].strip()}
        break
```

### Solución
Ordenar por tipo: A, B, C, D, E, luego GIN, T, etc.

```python
# ✅ CORRECTO - Ordena por tipo
# PASO 2: Mover todas las "En Camara" después de las pinchadas, ORDENADAS POR TIPO
logger.info("=== PASO 2: Moviendo En Camara (ordenadas por tipo) ===")

col_tp_idx = config["col_tp"]  # Columna T.P. (0-indexed)
tipos_orden = ["A", "B", "C", "D", "E"]

# Primero mover los tipos A-E en orden
for tipo_buscado in tipos_orden:
    iteration_count = 0
    while iteration_count < max_iterations:
        iteration_count += 1
        all_rows = ws.get_all_values()
        row_vacios_actual = next((i + 1 for i, row in enumerate(all_rows) if row[0].strip() == MARCADOR_VACIOS), row_vacios)
        
        encontrada = None
        for i, row in enumerate(all_rows):
            row_num = i + 1
            if row_num <= row_en_camara or row_num >= row_vacios_actual or row_num < target_row:
                continue
            
            if len(row) <= col_estado_idx or len(row) <= col_tp_idx:
                continue
            
            estado = row[col_estado_idx].strip()
            tp = row[col_tp_idx].strip()
            
            # Solo mover si es "En Camara" Y es el tipo que buscamos
            if estado == "En Camara" and tp == tipo_buscado:
                encontrada = {
                    "row_num": row_num,
                    "estilo": row[2].strip() if len(row) > 2 else "",
                    "tp": tp
                }
                break
        
        if encontrada is None:
            logger.info(f"No hay más En Camara tipo {tipo_buscado} para mover")
            break
        
        if encontrada["row_num"] != target_row:
            logger.info(f"Moviendo En Camara fila {encontrada['row_num']} (tipo {encontrada['tp']}, {encontrada['estilo']}) a posición {target_row}")
            _move_rows_physically(sheet_id, gid, encontrada["row_num"] - 1, target_row - 1, 1)
        
        target_row += 1

# Luego mover los tipos especiales (GIN, T, etc.)
iteration_count = 0
while iteration_count < max_iterations:
    iteration_count += 1
    all_rows = ws.get_all_values()
    row_vacios_actual = next((i + 1 for i, row in enumerate(all_rows) if row[0].strip() == MARCADOR_VACIOS), row_vacios)
    
    encontrada = None
    for i, row in enumerate(all_rows):
        row_num = i + 1
        if row_num <= row_en_camara or row_num >= row_vacios_actual or row_num < target_row:
            continue
        
        if len(row) <= col_estado_idx:
            continue
        
        estado = row[col_estado_idx].strip()
        tp = row[col_tp_idx].strip() if len(row) > col_tp_idx else ""
        
        # Solo mover si es "En Camara" y NO es tipo A-E
        if estado == "En Camara" and tp not in tipos_orden:
            encontrada = {
                "row_num": row_num,
                "estilo": row[2].strip() if len(row) > 2 else "",
                "tp": tp
            }
            break
    
    if encontrada is None:
        logger.info(f"No hay más En Camara (tipos especiales) para mover")
        break
    
    if encontrada["row_num"] != target_row:
        logger.info(f"Moviendo En Camara fila {encontrada['row_num']} (tipo {encontrada['tp']}, {encontrada['estilo']}) a posición {target_row}")
        _move_rows_physically(sheet_id, gid, encontrada["row_num"] - 1, target_row - 1, 1)
    
    target_row += 1
```

---

## 📝 Resumen de Cambios

### Archivo: `backend-nucleo/src/services/barriles_service.py`

#### Cambio 1: Agregar try-catch (línea ~451)
```python
def reordenar_sheet(sucursal_id: str = "1") -> Dict[str, Any]:
    try:
        # ... todo el código existente ...
    except Exception as e:
        logger.error(f"Error en reordenar_sheet: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al reordenar: {str(e)}")
```

#### Cambio 2: Validar row_en_camara (línea ~490)
```python
if not row_en_camara:
    logger.warning("No se encontró el marcador EN CAMARA, usando DATA_START_ROW")
    row_en_camara = DATA_START_ROW - 1
```

#### Cambio 3: Corregir target_row inicial (línea ~507)
```python
# ANTES
target_row = DATA_START_ROW

# DESPUÉS
target_row = row_en_camara + 1
```

#### Cambio 4: Corregir condición de búsqueda (línea ~520)
```python
# ANTES
if row_num < DATA_START_ROW or row_num >= row_vacios_actual or row_num < target_row:

# DESPUÉS
if row_num <= row_en_camara or row_num >= row_vacios_actual or row_num < target_row:
```

#### Cambio 5: Agregar validación de longitud (línea ~525)
```python
# AGREGAR ANTES DE ACCEDER A col_estado_idx
if len(row) <= col_estado_idx:
    continue
```

#### Cambio 6: Reemplazar PASO 2 completo (línea ~555)
Reemplazar todo el bloque del PASO 2 con el código de ordenamiento por tipo mostrado arriba.

#### Cambio 7: Agregar col_tp_idx (línea ~500)
```python
col_estado_idx = config["col_estado"]  # 0-indexed
col_canilla_idx = config["col_canilla"]  # 0-indexed
col_tp_idx = config["col_tp"]  # 0-indexed - AGREGAR ESTA LÍNEA
```

---

## ✅ Resultado Esperado

Después de aplicar estos cambios:

1. ✅ **No más error 500** - Manejo robusto de excepciones
2. ✅ **Filas en posición correcta** - Debajo de "EN CAMARA", no encima
3. ✅ **Ordenamiento por tipo** - A, B, C, D, E, luego GIN, T, etc.

### Orden final esperado:
```
Fila 1: BARRILES RECOLETA
Fila 2: Headers
Fila 3: EN CAMARA
Fila 4: Pinchada canilla 1
Fila 5: Pinchada canilla 2
...
Fila X: En Camara tipo A
Fila X+1: En Camara tipo A
Fila X+2: En Camara tipo B
...
Fila Y: En Camara tipo E
Fila Y+1: En Camara tipo GIN
Fila Y+2: En Camara tipo T
...
Fila Z: N/A
...
Fila W: VACIOS
Fila W+1: Para Retirar
...
Fila V: RETIRADAS
Fila V+1: Retirada
...
```

---

## 🚀 Próximos Pasos

1. Aplicar los cambios manualmente al archivo `barriles_service.py`
2. Reiniciar el backend
3. Probar el reordenamiento
4. Verificar los logs para confirmar el orden correcto

---

*Documento creado: 2026-05-05 22:00*

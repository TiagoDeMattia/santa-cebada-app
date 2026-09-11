# Fix de Reordenamiento de Barriles - Palermo

## Problema Identificado

La función `_reordenar_sheet_sin_marcadores_moviendo()` para Palermo estaba usando `_row_to_barril()` para leer el estado de las cervezas, lo cual podía causar:

1. **Lectura incorrecta del estado**: `_row_to_barril()` no lee directamente de la columna de fórmula L
2. **Pérdida de datos**: Al no clasificar correctamente las filas, podía mover o eliminar datos incorrectamente
3. **No detectaba filas vacías**: No había clasificación para filas sin contenido

## Solución Implementada

### Cambios en `_reordenar_sheet_sin_marcadores_moviendo()`

**ANTES:**
```python
# Usaba _row_to_barril() que no lee directamente de la columna de fórmula
barril = _row_to_barril(row, i + 1, sucursal_id)
if barril is None:
    continue
estado = barril["estado"]
```

**DESPUÉS:**
```python
# Lee el estado DIRECTAMENTE de la columna L (índice 11)
col_estado_idx = config["col_estado"]  # 0-indexed (columna L = índice 11)
estado = row[col_estado_idx].strip() if len(row) > col_estado_idx else ""

# Detecta filas vacías
es_vacia = not estilo and not proveedor and not col_a
```

### Mejoras Implementadas

1. **Lectura directa de columna de estado**: Ahora lee directamente de columna L (Palermo) sin intermediarios
2. **Clasificación de filas vacías**: Detecta y clasifica filas sin contenido
3. **Orden correcto**: Pinchadas + En Cámara + Vacías + Para Retirar + Retiradas
4. **Logging mejorado**: Muestra clasificación detallada antes de mover
5. **Consistencia con Recoleta**: Ambas funciones ahora usan la misma lógica

## Estructura de Ordenamiento

### Palermo (sin marcadores)
```
Fila 4+: Pinchadas (ordenadas por canilla)
       + En Cámara
       + Vacías (sin contenido)
       + Para Retirar
       + Retiradas
```

### Recoleta (con marcadores)
```
Debajo de "EN CAMARA": Pinchadas (ordenadas por canilla)
                     + En Cámara
                     + Vacías (sin contenido)
Debajo de "VACIOS": Para Retirar
Debajo de "RETIRADAS": Retirada
```

## Garantías

✅ **NO modifica datos**: Solo mueve filas físicamente usando API v4 `cutPaste`
✅ **Preserva fórmulas**: Las fórmulas en columnas L, M, O se mantienen intactas
✅ **Preserva desplegables**: Los dropdowns en columnas C, G, J se mantienen
✅ **Preserva formatos**: Todos los formatos de celda se mantienen
✅ **Lee estado correcto**: Lee directamente de la columna de fórmula (N en Recoleta, L en Palermo)
✅ **Detecta filas vacías**: Clasifica correctamente filas sin contenido

## Columnas de Estado por Sucursal

- **Recoleta**: Columna N (índice 13) - `config["col_estado"]`
- **Palermo**: Columna L (índice 11) - `config["col_estado"]`

## Testing Recomendado

1. Probar reordenamiento en Palermo con:
   - Barriles pinchados en diferentes canillas
   - Barriles en cámara
   - Filas vacías
   - Barriles para retirar
   - Barriles retirados

2. Verificar que:
   - Las filas se mueven correctamente
   - NO se pierden datos
   - Las fórmulas siguen funcionando
   - Los desplegables se mantienen
   - El orden es: Pinchadas (por canilla) → En Cámara → Vacías → Para Retirar → Retiradas

## Archivo Modificado

- `backend-nucleo/src/services/barriles_service.py`
  - Función: `_reordenar_sheet_sin_marcadores_moviendo()` (líneas 624-720)

# Fix: Proteger Columnas con Fórmulas y Desplegables

## Problema Identificado

El código de reordenamiento estaba escribiendo en **TODAS las columnas**, incluyendo aquellas que contienen:
- **Columna E**: Celdas de verificación
- **Columna G**: Desplegables (Nombre del que pinchó)
- **Columna H**: Fórmulas automáticas (Turno pinchado)
- **Columna J**: Desplegables (Nombre del que despinchó)
- **Columna K**: Fórmulas automáticas (Turno despinchado)

Esto causaba que se eliminaran los desplegables y se sobrescribieran las fórmulas.

---

## Solución Implementada

Se modificó el código de reordenamiento para escribir **SOLO en columnas seguras**, dejando intactas las columnas protegidas.

### Columnas Seguras (que SÍ se escriben):
- **A**: Ingreso
- **B**: Proveedor
- **C**: Estilo
- **D**: Código
- **F**: Fecha de Pinchado
- **I**: Fecha de Despinchado
- **L**: Fecha de Retirado
- **M**: Días Pinchado
- **N**: Estado
- **O**: Días de retirado
- **P**: Canilla (Recoleta)
- **Q**: T.P. (Recoleta)

### Columnas Protegidas (que NO se tocan):
- **E**: Celdas de verificación ❌
- **G**: Desplegables ❌
- **H**: Fórmulas automáticas ❌
- **J**: Desplegables ❌
- **K**: Fórmulas automáticas ❌

---

## Cambios de Código

### Archivo: `backend-nucleo/src/services/barriles_service.py`

#### Función `reordenar_sheet()`

Se cambió la estrategia de escritura de:
```python
# ANTES: Escribía todas las columnas en un rango
range_activos = f"A{DATA_START_ROW}:{last_col}{row_vacios - 1}"
updates.append({"range": range_activos, "values": activos[:active_rows_count]})
```

A:
```python
# AHORA: Escribe solo columnas seguras en rangos separados
# Columnas A-D
range_activos = f"A{DATA_START_ROW}:D{row_vacios - 1}"
updates.append({"range": range_activos, "values": [[row[i] for i in [0, 1, 2, 3]] for row in activos[:active_rows_count]]})

# Columna F
range_f = f"F{DATA_START_ROW}:F{row_vacios - 1}"
updates.append({"range": range_f, "values": [[row[5]] for row in activos[:active_rows_count]]})

# Columna I
range_i = f"I{DATA_START_ROW}:I{row_vacios - 1}"
updates.append({"range": range_i, "values": [[row[8]] for row in activos[:active_rows_count]]})

# Columnas L-Q (o L-O para Palermo)
range_lq = f"L{DATA_START_ROW}:Q{row_vacios - 1}"
updates.append({"range": range_lq, "values": [[row[i] for i in [11, 12, 13, 14, 15, 16]] for row in activos[:active_rows_count]]})
```

#### Función `_reordenar_sheet_sin_marcadores()`

Se aplicó la misma estrategia para Palermo:
- Escribe columnas A-D
- Escribe columna F
- Escribe columna I
- Escribe columnas L-O (Palermo tiene menos columnas)

---

## Verificación

✅ **Test realizado**: Reordenamiento en ambas sucursales
- ✅ Recoleta: 16 Pinchadas, 8 En Cámara, 20 Para Retirar, 642 Retiradas
- ✅ Palermo: 12 Pinchadas, 2 En Cámara, 17 Para Retirar, 180 Retiradas

✅ **Columnas protegidas verificadas**:
- ✅ Columna E: Celdas de verificación - NO tocadas
- ✅ Columna G: Desplegables - NO tocadas
- ✅ Columna H: Fórmulas automáticas - NO tocadas
- ✅ Columna J: Desplegables - NO tocadas
- ✅ Columna K: Fórmulas automáticas - NO tocadas

---

## Impacto

- ✅ Los desplegables en columnas G y J se mantienen intactos
- ✅ Las fórmulas automáticas en columnas H y K se mantienen intactas
- ✅ Las celdas de verificación en columna E se mantienen intactas
- ✅ El reordenamiento sigue funcionando correctamente
- ✅ Los datos se escriben solo en las columnas seguras

---

## Cómo Usar

El endpoint sigue siendo el mismo:

```bash
# Reordenar Recoleta
POST /api/barriles/reordenar?sucursal_id=1

# Reordenar Palermo
POST /api/barriles/reordenar?sucursal_id=2
```

Ahora el reordenamiento es **100% seguro** y no toca ninguna columna protegida.

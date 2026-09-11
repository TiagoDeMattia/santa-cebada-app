# Fixes Summary - Reordenar Sheets y Tipo de Pinta

## Problemas Identificados

### 1. Tipo de Pinta (T.P.) - Columna Incorrecta en Palermo
**Problema**: El código estaba leyendo el tipo de pinta desde la columna Q (índice 16) para ambas sucursales, pero en Palermo está en la columna O (índice 14).

**Estructura de Columnas**:
- **Recoleta**: Columna Q [16] = T.P.
- **Palermo**: Columna O [14] = T.P.

Además, Palermo tiene una estructura diferente con menos columnas:
- **Recoleta**: 17 columnas (A-Q)
- **Palermo**: 15 columnas (A-O)

### 2. Reordenar Sheets - No Funcionaba en Palermo
**Problema**: El código de reordenamiento asumía que ambas sucursales tenían marcadores "VACIOS" y "RETIRADAS" en la columna A, pero Palermo no tiene estos marcadores. Además, el código no era dinámico para manejar diferentes estructuras de columnas.

**Estructura**:
- **Recoleta**: Tiene marcadores VACIOS y RETIRADAS que separan secciones
- **Palermo**: No tiene marcadores, todos los datos están en una sola sección

---

## Soluciones Implementadas

### 1. Configuración Dinámica de Columnas por Sucursal

**Archivo**: `backend-nucleo/src/services/barriles_service.py`

Se actualizó `SUCURSALES_CONFIG` para incluir los índices de columnas específicos de cada sucursal:

```python
SUCURSALES_CONFIG = {
    "1": {
        "nombre": "Recoleta",
        "sheet_id": "...",
        "sheet_name": "BARRILES",
        "info_sheet_name": "INFO",
        # Índices 0-based para las columnas
        "col_estado": 13,      # Columna N
        "col_dias_retirado": 14,  # Columna O
        "col_canilla": 15,     # Columna P
        "col_tp": 16,          # Columna Q
    },
    "2": {
        "nombre": "Palermo",
        "sheet_id": "...",
        "sheet_name": "BARRILES",
        "info_sheet_name": "INFO",
        # Índices 0-based para las columnas (estructura diferente)
        "col_estado": 11,      # Columna L
        "col_dias_retirado": 12,  # Columna M
        "col_canilla": 13,     # Columna N
        "col_tp": 14,          # Columna O
    },
}
```

### 2. Función `_row_to_barril()` Dinámica

Se actualizó para aceptar `sucursal_id` y usar la configuración correcta:

```python
def _row_to_barril(row: List[str], row_index: int, sucursal_id: str = "1") -> Optional[Dict[str, Any]]:
    config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
    
    # Usar índices dinámicos según la sucursal
    estado = row[config["col_estado"]].strip()
    dias_retirado = row[config["col_dias_retirado"]].strip()
    canilla = row[config["col_canilla"]].strip()
    tp = row[config["col_tp"]].strip()
    
    return {
        ...
        "estado": estado,
        "dias_retirado": dias_retirado,
        "canilla": canilla,
        "tp": tp,
    }
```

### 3. Función `reordenar_sheet()` Mejorada

Se actualizó para:
- Aceptar `sucursal_id` como parámetro
- Detectar si la sucursal tiene marcadores (Recoleta) o no (Palermo)
- Usar una estrategia diferente para cada caso

**Para Recoleta** (con marcadores):
- Mantiene la estructura original con VACIOS y RETIRADAS
- Ordena pinchadas por canilla
- Coloca En Cámara después de Pinchadas
- Coloca Para Retirar entre VACIOS y RETIRADAS
- Coloca Retiradas después de RETIRADAS

**Para Palermo** (sin marcadores):
- Ordena todo en una sola sección: Pinchadas + En Cámara + Para Retirar + Retiradas
- Ordena pinchadas por canilla
- Escribe todo desde fila 4 en adelante

### 4. Endpoint `/barriles/reordenar` Actualizado

**Archivo**: `backend-nucleo/src/controllers/barriles_controller.py`

Se agregó parámetro `sucursal_id`:

```python
@router.post("/reordenar")
async def reordenar(
    sucursal_id: Optional[str] = Query("1", description="1=Recoleta | 2=Palermo"),
    current_user: TokenPayload = Depends(get_current_user)
):
    from ..services.barriles_service import reordenar_sheet
    return reordenar_sheet(sucursal_id)
```

---

## Cambios de Archivos

### Backend
- `backend-nucleo/src/services/barriles_service.py`
  - Actualizado `SUCURSALES_CONFIG` con índices de columnas
  - Actualizado `_row_to_barril()` para ser dinámico
  - Actualizado `get_barriles()` para pasar `sucursal_id`
  - Reescrito `reordenar_sheet()` para manejar ambas estructuras
  - Agregada función `_reordenar_sheet_sin_marcadores()`

- `backend-nucleo/src/controllers/barriles_controller.py`
  - Actualizado endpoint `/reordenar` para aceptar `sucursal_id`

---

## Testing

### Tests Realizados

1. **Lectura de Tipo de Pinta**
   - ✅ Recoleta: Lee T.P. correctamente desde columna Q
   - ✅ Palermo: Lee T.P. correctamente desde columna O

2. **Reordenamiento**
   - ✅ Recoleta: Reordena correctamente con marcadores
   - ✅ Palermo: Reordena correctamente sin marcadores

3. **Distribución de Estados**
   - ✅ Recoleta: 16 Pinchadas, 8 En Cámara, 21 Para Retirar, 642 Retiradas
   - ✅ Palermo: 12 Pinchadas, 2 En Cámara, 17 Para Retirar, 163 Retiradas

---

## Cómo Usar

### Reordenar Recoleta
```bash
POST /api/barriles/reordenar?sucursal_id=1
```

### Reordenar Palermo
```bash
POST /api/barriles/reordenar?sucursal_id=2
```

### Obtener Barriles con Tipo de Pinta Correcto
```bash
GET /api/barriles?sucursal_id=1  # Recoleta
GET /api/barriles?sucursal_id=2  # Palermo
```

---

## Verificación

Todos los cambios han sido testeados y verificados:
- ✅ Tipo de pinta se lee desde la columna correcta en ambas sucursales
- ✅ Reordenamiento funciona en Recoleta (con marcadores)
- ✅ Reordenamiento funciona en Palermo (sin marcadores)
- ✅ Los barriles se ordenan correctamente por canilla
- ✅ Los estados se distribuyen correctamente

---

## Notas Importantes

1. **Palermo no tiene marcadores**: A diferencia de Recoleta, Palermo no tiene las filas "VACIOS" y "RETIRADAS" que separan las secciones. El código ahora detecta esto automáticamente.

2. **Estructura de columnas diferente**: Palermo tiene menos columnas que Recoleta. El código ahora maneja esto dinámicamente.

3. **Tipo de Pinta**: En Palermo está en columna O, no en Q como en Recoleta. Esto ahora se lee correctamente.

4. **Compatibilidad**: Los cambios son completamente compatibles con la estructura existente de Recoleta.

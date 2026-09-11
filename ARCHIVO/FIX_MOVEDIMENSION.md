# Fix CRÍTICO: cutPaste → moveDimension

## 🔴 PROBLEMA IDENTIFICADO

El código estaba usando **`cutPaste`** que **COPIA Y PEGA DATOS**, no mueve la fila físicamente.

### ❌ Código Anterior (MAL):
```python
request = {
    "cutPaste": {
        "source": {
            "sheetId": gid,
            "startRowIndex": source_row_index,
            "endRowIndex": source_row_index + num_rows,
        },
        "destination": {
            "sheetId": gid,
            "rowIndex": destination_row_index,
        },
        "pasteType": "PASTE_NORMAL",
    }
}
```

### Por qué estaba mal:
1. **`cutPaste` copia los VALORES** de las celdas, no mueve la fila
2. **Las fórmulas se rompen** porque se copian como valores
3. **Los desplegables se pierden** porque se copian como texto
4. **Los formatos pueden cambiar** porque se pegan como valores
5. **NO es como mover una fila manualmente** en Google Sheets

---

## ✅ SOLUCIÓN: moveDimension

### ✅ Código Nuevo (CORRECTO):
```python
request = {
    "moveDimension": {
        "source": {
            "sheetId": gid,
            "dimension": "ROWS",
            "startIndex": source_row_index,
            "endIndex": source_row_index + num_rows,
        },
        "destinationIndex": destination_row_index
    }
}
```

### Por qué está bien:
1. ✅ **`moveDimension` mueve la FILA COMPLETA** como lo haría una persona
2. ✅ **Las fórmulas se mantienen** y sus referencias se ajustan automáticamente
3. ✅ **Los desplegables se preservan** porque la fila se mueve entera
4. ✅ **Los formatos se mantienen** porque no se copia nada
5. ✅ **Es EXACTAMENTE como arrastrar una fila** en Google Sheets manualmente

---

## 📊 DIFERENCIA VISUAL

### cutPaste (MAL):
```
Antes:
Fila 5: [Datos con fórmula =D5+E5] [Desplegable] [Formato]
Fila 6: [Otros datos]

Después de cutPaste a fila 4:
Fila 4: [Datos como VALORES] [Texto sin desplegable] [Formato perdido]
Fila 5: [Otros datos]
Fila 6: [VACÍA o con basura]
```

### moveDimension (BIEN):
```
Antes:
Fila 5: [Datos con fórmula =D5+E5] [Desplegable] [Formato]
Fila 6: [Otros datos]

Después de moveDimension a fila 4:
Fila 4: [Datos con fórmula =D4+E4] [Desplegable] [Formato]
Fila 5: [Otros datos]
```

**La fila se MUEVE físicamente, no se copia.**

---

## 🎯 GARANTÍAS CON moveDimension

### ✅ Lo que se PRESERVA:
1. **Fórmulas** - Se ajustan automáticamente (D5 → D4)
2. **Desplegables** - Se mantienen intactos
3. **Validaciones de datos** - Se mantienen
4. **Formatos de celda** - Se mantienen
5. **Comentarios** - Se mantienen
6. **Protecciones** - Se mantienen
7. **TODO el contenido de la fila**

### ✅ Lo que se AJUSTA automáticamente:
1. **Referencias relativas en fórmulas** - Se actualizan a la nueva posición
2. **Índices de fila** - Google Sheets los ajusta automáticamente

### ❌ Lo que NO se modifica:
1. **Datos de las celdas** - NO se tocan
2. **Otras filas** - Solo se desplazan, no se modifican

---

## 🔍 COMPARACIÓN TÉCNICA

| Característica | cutPaste | moveDimension |
|----------------|----------|---------------|
| Mueve fila física | ❌ No | ✅ Sí |
| Preserva fórmulas | ❌ No | ✅ Sí |
| Preserva desplegables | ❌ No | ✅ Sí |
| Preserva formatos | ⚠️ Parcial | ✅ Sí |
| Ajusta referencias | ❌ No | ✅ Sí |
| Como mover manualmente | ❌ No | ✅ Sí |
| Modifica datos | ⚠️ Sí (copia) | ❌ No |

---

## 📝 DOCUMENTACIÓN DE GOOGLE

Según la documentación oficial de Google Sheets API v4:

### cutPaste:
> "Cuts data from a source and pastes it to a destination."
> - Copia los **valores** de las celdas
> - Puede perder fórmulas y formatos

### moveDimension:
> "Moves one or more rows or columns."
> - Mueve la **dimensión completa** (fila o columna)
> - Preserva todo el contenido y formato
> - **Es la operación correcta para reordenar filas**

---

## ⚠️ PROBLEMA DE CUOTA

El log muestra un error de cuota:
```
Error: Quota exceeded for quota metric 'Read requests'
Limit: 60 read requests per minute per user
```

Esto es porque el código lee el sheet en cada iteración del bucle. Con muchas filas, puede exceder el límite.

### Solución futura (si es necesario):
1. Agregar un pequeño delay entre lecturas: `time.sleep(0.1)`
2. Reducir el número de relecturas (leer solo cuando sea necesario)
3. Usar batch operations para mover múltiples filas a la vez

Por ahora, con `moveDimension`, el reordenamiento debería ser más rápido y eficiente.

---

## 🧪 TESTING

Ahora que usamos `moveDimension`, probá:

1. **Pinchar un barril**
2. **Observar el reordenamiento**
3. **Verificar en Google Sheets que:**
   - ✅ Las fórmulas siguen funcionando
   - ✅ Los desplegables están intactos
   - ✅ Los formatos se mantienen
   - ✅ NO hay datos modificados
   - ✅ Las filas se movieron físicamente

---

## 📁 ARCHIVO MODIFICADO

- `backend-nucleo/src/services/barriles_service.py`
  - Función `_move_rows_physically()` - Líneas ~400-440
  - Cambio: `cutPaste` → `moveDimension`

---

## 🎉 RESULTADO ESPERADO

Con este cambio, el reordenamiento debería funcionar **EXACTAMENTE** como si una persona moviera las filas manualmente en Google Sheets:

1. ✅ Selecciona la fila
2. ✅ La arrastra a la nueva posición
3. ✅ Todo se mueve junto (datos, fórmulas, formatos)
4. ✅ Las referencias se ajustan automáticamente
5. ✅ NO se modifica ningún dato

**Este es el cambio más importante de todos.**

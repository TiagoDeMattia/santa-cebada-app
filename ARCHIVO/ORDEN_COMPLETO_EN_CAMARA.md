# Orden Completo dentro de "EN CAMARA"

## ✅ CAMBIO APLICADO

Agregado soporte para el estado **"N/A"** y actualizado el orden de reordenamiento.

---

## 📊 ORDEN DENTRO DE "EN CAMARA"

### Recoleta (con marcadores):
```
Fila 3: EN CAMARA
Fila 4+: 
  1. Pinchadas (ordenadas por número de canilla: 1, 2, 3, ...)
  2. En Camara
  3. N/A
  
Fila X: VACIOS
Fila X+1+:
  4. Para Retirar
  
Fila Y: RETIRADAS
Fila Y+1+:
  5. Retirada
```

### Palermo (sin marcadores):
```
Fila 3: EN CAMARA
Fila 4+:
  1. Pinchadas (ordenadas por número de canilla: 1, 2, 3, ...)
  2. En Camara
  3. N/A
  4. Para Retirar
  5. Retirada
```

---

## 🔄 PASOS DE REORDENAMIENTO

### Recoleta:
1. **PASO 1**: Mover Pinchadas (ordenadas por canilla) → debajo de "EN CAMARA"
2. **PASO 2**: Mover En Camara → después de Pinchadas
3. **PASO 2.5**: Mover N/A → después de En Camara ✅ NUEVO
4. **PASO 3**: Mover Para Retirar → debajo de "VACIOS"
5. **PASO 4**: Mover Retiradas → debajo de "RETIRADAS"

### Palermo:
1. **PASO 1**: Mover Pinchadas (ordenadas por canilla) → al inicio
2. **PASO 2**: Mover En Camara → después de Pinchadas
3. **PASO 2.5**: Mover N/A → después de En Camara ✅ NUEVO
4. **PASO 3**: Mover Para Retirar → después de N/A
5. **PASO 4**: Mover Retiradas → al final

---

## 🎯 ESTADOS RECONOCIDOS

| Estado | Descripción | Posición |
|--------|-------------|----------|
| **Pinchada** | Barril pinchado en canilla | 1° (ordenado por canilla) |
| **En Camara** | Barril en cámara sin pinchar | 2° |
| **N/A** | Estado no aplicable | 3° ✅ NUEVO |
| **Para Retirar** | Barril listo para retirar | 4° |
| **Retirada** | Barril retirado | 5° |

---

## 📝 LOGGING

El sistema ahora registra:

```
=== PASO 1: Ordenando Pinchadas ===
Moviendo Pinchada fila X (canilla 1, IPA) a posición Y
No hay más pinchadas para mover (iteraciones: 3)

=== PASO 2: Moviendo En Camara ===
Moviendo En Camara fila X (Lager) a posición Y
No hay más En Camara para mover (iteraciones: 2)

=== PASO 2.5: Moviendo N/A ===
Moviendo N/A fila X (Stout) a posición Y
No hay más N/A para mover (iteraciones: 1)

=== PASO 3: Moviendo Para Retirar ===
...

=== PASO 4: Moviendo Retiradas ===
...

Reordenamiento completo - Pinchadas: 5, En Cámara: 3, N/A: 2, Para Retirar: 1, Retiradas: 10
```

---

## 🔍 EJEMPLO VISUAL

### Antes del reordenamiento:
```
Fila 4: Cerveza A - Para Retirar
Fila 5: Cerveza B - Pinchada (canilla 3)
Fila 6: Cerveza C - N/A
Fila 7: Cerveza D - En Camara
Fila 8: Cerveza E - Pinchada (canilla 1)
Fila 9: Cerveza F - Retirada
```

### Después del reordenamiento:
```
Fila 4: Cerveza E - Pinchada (canilla 1)  ← Pinchadas ordenadas
Fila 5: Cerveza B - Pinchada (canilla 3)
Fila 6: Cerveza D - En Camara             ← En Camara
Fila 7: Cerveza C - N/A                   ← N/A
--- VACIOS ---
Fila 8: Cerveza A - Para Retirar          ← Para Retirar
--- RETIRADAS ---
Fila 9: Cerveza F - Retirada              ← Retiradas
```

---

## ✅ GARANTÍAS

1. ✅ **Orden correcto**: Pinchadas → En Camara → N/A → Para Retirar → Retiradas
2. ✅ **Pinchadas ordenadas**: Por número de canilla (1, 2, 3, ...)
3. ✅ **NO modifica datos**: Usa `moveDimension` para mover filas físicamente
4. ✅ **Preserva fórmulas**: Las referencias se ajustan automáticamente
5. ✅ **Preserva desplegables**: Se mantienen intactos
6. ✅ **Logging detallado**: Muestra cada movimiento

---

## 🧪 TESTING

Para probar el nuevo orden:

1. **Crear barriles con diferentes estados**:
   - Algunos "Pinchada" con diferentes canillas
   - Algunos "En Camara"
   - Algunos "N/A"
   - Algunos "Para Retirar"
   - Algunos "Retirada"

2. **Ejecutar reordenamiento**

3. **Verificar el orden**:
   - ✅ Pinchadas primero (ordenadas por canilla)
   - ✅ En Camara después
   - ✅ N/A después de En Camara
   - ✅ Para Retirar debajo de VACIOS (Recoleta) o después de N/A (Palermo)
   - ✅ Retiradas al final

---

## 📁 ARCHIVOS MODIFICADOS

- `backend-nucleo/src/services/barriles_service.py`
  - Función `reordenar_sheet()` - Agregado PASO 2.5 para N/A
  - Función `_reordenar_sheet_sin_marcadores_moviendo()` - Agregado PASO 2.5 para N/A
  - Conteo final actualizado para incluir N/A

---

## 🎉 RESULTADO

Ahora el sistema maneja correctamente el estado "N/A" y lo coloca en la posición correcta dentro del orden:

**Pinchadas (por canilla) → En Camara → N/A → Para Retirar → Retiradas**

Todo usando `moveDimension` para mover filas físicamente sin modificar datos. 🚀

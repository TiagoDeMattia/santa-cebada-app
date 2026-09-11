# Configuración: Hoja de Pruebas

## ✅ CAMBIO APLICADO

El sistema ahora está configurado para usar la hoja **"PRUEBA WEB APP"** como entorno de pruebas en lugar de "BARRILES".

---

## 📊 CONFIGURACIÓN ACTUAL

### Recoleta (Sucursal ID: "1")
- **Spreadsheet ID**: `1Sw-TqlevrqHUt4krNOjzqY0qRQfW3Odm7ZJrp2ZhEsI`
- **Hoja**: `PRUEBA WEB APP` ✅ (antes: BARRILES)
- **GID**: `1554434469` ✅ (antes: 1085849685)
- **Hoja INFO**: `INFO` (sin cambios)

### Palermo (Sucursal ID: "2")
- **Spreadsheet ID**: `1QNDaWPj-_tp75moQa-dgwwVwGkFphgMaXQ0p2yHNrYw`
- **Hoja**: `BARRILES` (sin cambios)
- **GID**: `1891271008` (sin cambios)
- **Hoja INFO**: `INFO` (sin cambios)

---

## 🎯 IMPACTO

### ✅ Operaciones que ahora usan "PRUEBA WEB APP":

1. **Lectura de barriles** - `get_barriles()`
2. **Actualización de barriles** - `update_barril_completo()`
3. **Reordenamiento** - `reordenar_sheet()`
4. **Todas las operaciones de Recoleta**

### ⚠️ Operaciones que NO cambiaron:

1. **Lectura de personal** - Sigue usando hoja "INFO"
2. **Catálogo de birras** - Sigue usando hoja "INFO"
3. **Operaciones de Palermo** - Siguen usando "BARRILES"

---

## 🔄 CÓMO VOLVER A PRODUCCIÓN

Cuando termines las pruebas y quieras volver a usar la hoja "BARRILES" original:

### Opción 1: Editar manualmente
Editar `backend-nucleo/src/services/barriles_service.py`:

```python
"1": {
    "nombre": "Recoleta",
    "sheet_id": "1Sw-TqlevrqHUt4krNOjzqY0qRQfW3Odm7ZJrp2ZhEsI",
    "sheet_name": "BARRILES",  # ← Cambiar de "PRUEBA WEB APP" a "BARRILES"
    "info_sheet_name": "INFO",
    "gid": 1085849685,  # ← Cambiar de 1554434469 a 1085849685
    # ... resto de la configuración
},
```

### Opción 2: Usar variable de entorno (recomendado para el futuro)
Podrías agregar una variable de entorno para cambiar entre pruebas y producción sin modificar código.

---

## 📋 HOJAS DISPONIBLES EN EL SPREADSHEET

```
📊 Hojas en 'BIRRAS PINCHADAS RECOLETA':
  - INFO                           | GID: 1084027951
  - BARRILES                       | GID: 1085849685  ← Producción
  - PRUEBA WEB APP                 | GID: 1554434469  ← Pruebas (ACTIVA)
  - CONFIG                         | GID: 1060703377
  - Stock Automatico               | GID: 674969125
  - Hoja Impresion                 | GID: 1015325222
```

---

## 🧪 TESTING

Ahora podés probar el reordenamiento sin afectar los datos reales:

1. **Accede a la página**: http://localhost:5173/
2. **Selecciona Recoleta**
3. **Modifica barriles** en "PRUEBA WEB APP"
4. **Observa el reordenamiento**
5. **Verifica los logs** del backend

### Ventajas de usar hoja de pruebas:
- ✅ No afecta datos de producción
- ✅ Podés experimentar libremente
- ✅ Fácil de resetear (copiar de nuevo desde BARRILES)
- ✅ Mismo comportamiento que producción

---

## 📁 ARCHIVO MODIFICADO

- `backend-nucleo/src/services/barriles_service.py`
  - Línea ~66: `"sheet_name": "PRUEBA WEB APP"`
  - Línea ~69: `"gid": 1554434469`

---

## ⚠️ IMPORTANTE

**Recordá volver a cambiar a "BARRILES" cuando termines las pruebas** para que el sistema vuelva a usar los datos de producción.

Mientras tanto, todos los cambios que hagas en la página web se aplicarán a "PRUEBA WEB APP" en lugar de "BARRILES".

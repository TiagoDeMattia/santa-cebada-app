# ✅ FASE 2: Historial de Stocks - COMPLETADA

**Fecha:** 2026-05-06 19:50  
**Estado:** ✅ IMPLEMENTADO Y FUNCIONANDO

---

## 🎉 LO QUE SE IMPLEMENTÓ

### 1. Base de Datos de Historial

**Archivo:** `stocks_historial.db` (SQLite)

**Tablas creadas:**

#### `snapshots_stocks`
Almacena capturas completas del estado de stocks.
```sql
- id: INTEGER PRIMARY KEY
- fecha_hora: DATETIME
- sucursal: VARCHAR(20) - 'recoleta' o 'palermo'
- tipo: VARCHAR(20) - 'cocina' o 'salon'
- total_productos: INTEGER
- total_con_pedido: INTEGER
- datos_json: TEXT - JSON con todos los productos
- created_at: DATETIME
```

#### `cambios_stocks`
Almacena cambios individuales detectados.
```sql
- id: INTEGER PRIMARY KEY
- fecha_hora: DATETIME
- sucursal: VARCHAR(20)
- tipo: VARCHAR(20)
- codigo_producto: VARCHAR(10)
- nombre_producto: VARCHAR(200)
- codigo_grupo: VARCHAR(10)
- stock_anterior: DECIMAL(10,2)
- stock_nuevo: DECIMAL(10,2)
- unidad_stock: VARCHAR(50)
- pedido_anterior: DECIMAL(10,2)
- pedido_nuevo: DECIMAL(10,2)
- unidad_pedido: VARCHAR(50)
- tipo_cambio: VARCHAR(20) - 'stock', 'pedido', 'nuevo', 'eliminado'
- created_at: DATETIME
```

**Índices optimizados** para consultas rápidas por fecha, sucursal y producto.

---

### 2. Servicio de Historial (`historial_service.py`)

**Funciones implementadas:**

#### Captura de Snapshots
- ✅ `capturar_snapshot(sucursal, tipo)` - Captura un snapshot
- ✅ `capturar_snapshot_completo(sucursal)` - Captura cocina + salón
- ✅ `capturar_todas_las_sucursales()` - Captura todo (Recoleta + Palermo)

#### Detección de Cambios
- ✅ `detectar_cambios(sucursal, tipo)` - Compara con último snapshot
  - Detecta cambios en stock
  - Detecta cambios en pedido
  - Detecta productos nuevos
  - Detecta productos eliminados

#### Consultas de Historial
- ✅ `get_snapshots(filtros)` - Lista snapshots con filtros
- ✅ `get_snapshot_detalle(id)` - Obtiene snapshot completo
- ✅ `get_cambios(filtros)` - Lista cambios con filtros

---

### 3. Scheduler Automático (`scheduler_service.py`)

**Características:**
- ✅ Captura automática los **LUNES a las 9 AM** (horario Argentina - UTC-3)
- ✅ Usa `pytz` para manejo correcto de zona horaria
- ✅ Calcula automáticamente el próximo lunes
- ✅ Se inicia automáticamente con el backend
- ✅ Se detiene limpiamente al apagar el backend
- ✅ Logging detallado de cada captura

**Próxima ejecución programada:**
```
2026-05-11 09:00:00 -03 (Lunes 11 de Mayo a las 9 AM)
Esperando 109.2 horas...
```

---

### 4. Endpoints API (`/api/historial/*`)

#### Captura de Snapshots
```
POST /api/historial/snapshot?sucursal=recoleta&tipo=cocina
POST /api/historial/snapshot/completo?sucursal=recoleta
POST /api/historial/snapshot/todas
```

#### Detección de Cambios
```
GET /api/historial/cambios/detectar?sucursal=recoleta&tipo=cocina
```

#### Consultas de Historial
```
GET /api/historial/snapshots?sucursal=recoleta&fecha_desde=2026-05-01&limit=50
GET /api/historial/snapshots/{id}
GET /api/historial/cambios?codigo_producto=C001&tipo_cambio=stock
```

---

## 🧪 PRUEBAS REALIZADAS

### Test 1: Captura Manual de Snapshots
```bash
POST /api/historial/snapshot/todas
```

**Resultado:**
```
✅ Success: True
✅ Recoleta Cocina: 114 productos (48 con pedido)
✅ Recoleta Salón: 146 productos (37 con pedido)
✅ Palermo Cocina: 108 productos (26 con pedido)
✅ Palermo Salón: 129 productos (32 con pedido)
```

### Test 2: Consulta de Snapshots
```bash
GET /api/historial/snapshots
```

**Resultado:**
```
✅ Total snapshots: 4
✅ Snapshots guardados correctamente con:
   - ID único
   - Fecha/hora
   - Sucursal y tipo
   - Total de productos
   - Total con pedido
```

---

## 📊 ESTRUCTURA DE DATOS

### Snapshot (Response)
```json
{
  "id": 1,
  "fecha_hora": "2026-05-06 19:48:44.609689",
  "sucursal": "recoleta",
  "tipo": "cocina",
  "total_productos": 114,
  "total_con_pedido": 48
}
```

### Cambio Detectado
```json
{
  "codigo_producto": "C001",
  "nombre_producto": "Repollo blanco",
  "tipo_cambio": "stock",
  "stock_anterior": 1.0,
  "stock_nuevo": 3.0,
  "unidad_stock": "Kg",
  "pedido_anterior": 0.0,
  "pedido_nuevo": 2.0,
  "unidad_pedido": "Kg"
}
```

---

## 🔧 CONFIGURACIÓN

### Zona Horaria
```python
ARGENTINA_TZ = pytz.timezone('America/Argentina/Buenos_Aires')
```

### Programación de Capturas
```python
SNAPSHOT_DAY = 0  # 0 = Lunes
SNAPSHOT_HOUR = 9  # 9 AM
SNAPSHOT_MINUTE = 0
```

### Base de Datos
```python
HISTORIAL_DB_PATH = "backend-nucleo/src/services/stocks_historial.db"
```

---

## 📁 ARCHIVOS CREADOS

```
backend-nucleo/
├── src/
│   ├── services/
│   │   ├── historial_service.py       ✅ NUEVO
│   │   ├── scheduler_service.py       ✅ NUEVO
│   │   └── stocks_historial.db        ✅ NUEVO (BD)
│   ├── controllers/
│   │   └── historial_controller.py    ✅ NUEVO
│   └── routes/
│       ├── historial.py               ✅ NUEVO
│       └── __init__.py                ✅ MODIFICADO
├── main.py                            ✅ MODIFICADO
└── requirements.txt                   ✅ MODIFICADO (+ pytz)
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Base de datos SQLite para historial
- [x] Tabla de snapshots completos
- [x] Tabla de cambios individuales
- [x] Índices optimizados
- [x] Servicio de captura de snapshots
- [x] Detección automática de cambios
- [x] Scheduler con zona horaria Argentina
- [x] Captura automática los lunes a las 9 AM
- [x] Endpoints de captura manual
- [x] Endpoints de consulta de historial
- [x] Endpoints de consulta de cambios
- [x] Logging detallado
- [x] Manejo de errores
- [x] Validaciones
- [x] Documentación API
- [x] Backend reiniciado y funcionando

---

## 🎯 FUNCIONALIDADES

### Captura Automática
- ✅ Scheduler corriendo en background
- ✅ Próxima captura: Lunes 11/05/2026 a las 9 AM
- ✅ Captura de las 4 hojas (Recoleta Cocina/Salón + Palermo Cocina/Salón)
- ✅ Almacenamiento en base de datos

### Captura Manual
- ✅ Endpoint para capturar cuando quieras
- ✅ Captura individual (una hoja)
- ✅ Captura completa (una sucursal)
- ✅ Captura total (todas las sucursales)

### Detección de Cambios
- ✅ Compara con último snapshot
- ✅ Detecta cambios en stock
- ✅ Detecta cambios en pedido
- ✅ Detecta productos nuevos
- ✅ Detecta productos eliminados
- ✅ Guarda cambios en BD para análisis

### Consultas
- ✅ Listar snapshots con filtros
- ✅ Ver detalle completo de un snapshot
- ✅ Listar cambios con filtros
- ✅ Filtrar por sucursal, tipo, producto, fecha

---

## 🚀 PRÓXIMO PASO

**FASE 3: Estadísticas**

Ahora que tenemos historial, podemos implementar:
- Productos más pedidos
- Tendencias de consumo
- Predicción de stocks
- Comparación entre sucursales
- Alertas de stock bajo
- Recomendaciones automáticas

¿Continuamos? 🎯


# 📊 Análisis del Sistema de Stocks y Pedidos

**Fecha:** 2026-05-06  
**Objetivo:** Diseñar e implementar sistema de historial y estadísticas de stocks/pedidos

---

## 🔍 ESTRUCTURA ACTUAL

### 1. CENTRAL DE PRODUCTOS (Sheet compartido)
**ID:** `1TDMYt3lG-PnBl3xhuwLNU2oxjNZRKD1jtXuk5RGSS2w`  
**Hoja:** `CENTRAL DE PRODUCTOS`

**Estructura:**
```
Columna A: CODIGO DE GRUPO (1-17)
Columna B: CODIGO DE PRODUCTO (C001-C177 para Cocina, S001-S194 para Salón)
Columna C: NOMBRE DE LOCAL (nombre que se usa en el local)
Columna D: NOMBRE DE PROVEEDOR (nombre del proveedor)
```

**Estadísticas:**
- Total productos: 371
- Productos COCINA (C): 177
- Productos SALON (S): 194
- Grupos: 17

**Grupos identificados:**
- Grupo 1: VERDULERIA
- Grupo 2: ACEITE
- Grupo 3: CARNICERIA
- Grupo 4: ALMACEN
- Grupo 5: PANADERIA
- Grupo 6: GASES
- Grupo 7: INSUMOS
- Grupo 8: ALCOHOLES
- Grupo 9-17: (otros grupos)

---

### 2. SHEETS DE STOCKS POR SUCURSAL

#### RECOLETA
**ID:** `1CGUhk1Vf-2z1Td3ynWiPfmx7rC7C7djPY84ClwXeHQ0`

**Hojas:**
1. **COCINA** (124 filas)
   - Columna A: CODIGO DE GRUPO
   - Columna B: COD PRODUCTO
   - Columna C: PRODUCTO
   - Columna D: NOMBRE DE PROVEEDOR
   - Columna E: STOCK (unidad)
   - Columna F: STOCK (cantidad)
   - Columna G: PEDIDO (unidad)
   - Columna H: PEDIDO (cantidad)

2. **SALON** (166 filas)
   - Columna A: CODIGO DE GRUPO
   - Columna B: COD PRODUCTO
   - Columna C: PRODUCTO
   - Columna D: NOMBRE PROVEEDOR
   - Columna E: STOCK (unidad)
   - Columna F: STOCK (cantidad)
   - Columna G: PEDIDO (unidad)
   - Columna H: PEDIDO (cantidad)
   - Columna I: OBSERVACION

3. **STOCK BIRRAS**
   - Stock de cervezas/barriles

4. **PEDIDOS** (421 filas)
   - Hoja que filtra SOLO los productos con pedido > 0
   - Columna A: CODIGO
   - Columna B: PRODUCTO
   - Columna C: NOMBRE DE PROVEEDOR
   - Columna D: U DE PEDIDO
   - Columna E: PEDIDO
   - Columna F: OBSERVACION

5. **HISTORIAL**
   - (Existe pero necesitamos analizar su estructura)

#### PALERMO
**ID:** `1p-cMCGEd6LoGHEiVHPt6RJDbmKV5EvGlFMy1IO_U78I`

**Hojas:** (misma estructura que Recoleta)
- COCINA
- SALON
- STOCK BIRRAS
- PEDIDOS
- HISTORIAL

---

## 🎯 FUNCIONALIDADES A IMPLEMENTAR

### 1. HISTORIAL DE STOCKS Y PEDIDOS

**Objetivo:** Registrar automáticamente los cambios en stocks y pedidos para análisis histórico.

**Datos a capturar:**
- Fecha y hora del registro
- Sucursal (Recoleta/Palermo)
- Tipo (Cocina/Salón/Birras)
- Código de producto
- Nombre del producto
- Grupo
- Stock anterior
- Stock nuevo
- Pedido anterior
- Pedido nuevo
- Usuario que realizó el cambio (si aplica)

**Frecuencia de captura:**
- Opción 1: Snapshot diario (todos los días a las 00:00)
- Opción 2: Snapshot semanal (todos los lunes)
- Opción 3: Captura en tiempo real (cada vez que cambia un valor)

**Almacenamiento:**
- Base de datos SQLite local (backend)
- Tabla: `historial_stocks`

---

### 2. ESTADÍSTICAS DE PEDIDOS

**Objetivo:** Analizar patrones de consumo y optimizar pedidos.

**Métricas a calcular:**

#### A. Por Producto
- Frecuencia de pedido (veces pedido / período)
- Cantidad promedio pedida
- Cantidad mínima/máxima pedida
- Días promedio entre pedidos
- Tendencia (aumentando/disminuyendo/estable)

#### B. Por Grupo
- Productos más pedidos del grupo
- Gasto total por grupo
- Rotación de stock por grupo

#### C. Por Sucursal
- Comparación Recoleta vs Palermo
- Productos exclusivos de cada sucursal
- Diferencias en consumo

#### D. Por Período
- Consumo diario/semanal/mensual
- Estacionalidad (si hay patrones)
- Picos de consumo

#### E. Alertas y Recomendaciones
- Productos con stock bajo frecuente
- Productos con sobre-stock
- Sugerencias de cantidad óptima de pedido
- Productos que no rotan (candidatos a eliminar)

---

## 🏗️ ARQUITECTURA PROPUESTA

### Backend (Python/FastAPI)

```
backend-nucleo/
├── src/
│   ├── services/
│   │   ├── stocks_service.py          # Lectura de stocks desde sheets
│   │   ├── historial_service.py       # Gestión de historial
│   │   └── estadisticas_service.py    # Cálculo de estadísticas
│   ├── controllers/
│   │   ├── stocks_controller.py       # Endpoints de stocks
│   │   └── estadisticas_controller.py # Endpoints de estadísticas
│   ├── models/
│   │   └── schemas.py                 # Modelos de datos
│   └── repositories/
│       └── historial_repository.py    # Acceso a BD
└── stocks.db                          # Base de datos SQLite
```

### Base de Datos

```sql
-- Tabla de historial de stocks
CREATE TABLE historial_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_hora DATETIME NOT NULL,
    sucursal VARCHAR(20) NOT NULL,  -- 'recoleta' o 'palermo'
    tipo VARCHAR(20) NOT NULL,      -- 'cocina', 'salon', 'birras'
    codigo_producto VARCHAR(10) NOT NULL,
    nombre_producto VARCHAR(200),
    codigo_grupo VARCHAR(10),
    nombre_grupo VARCHAR(100),
    stock_anterior DECIMAL(10,2),
    stock_nuevo DECIMAL(10,2),
    unidad_stock VARCHAR(50),
    pedido_anterior DECIMAL(10,2),
    pedido_nuevo DECIMAL(10,2),
    unidad_pedido VARCHAR(50),
    usuario VARCHAR(100),
    observaciones TEXT
);

-- Índices para optimizar consultas
CREATE INDEX idx_fecha ON historial_stocks(fecha_hora);
CREATE INDEX idx_sucursal ON historial_stocks(sucursal);
CREATE INDEX idx_producto ON historial_stocks(codigo_producto);
CREATE INDEX idx_tipo ON historial_stocks(tipo);

-- Tabla de snapshots (capturas completas del estado)
CREATE TABLE snapshots_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_hora DATETIME NOT NULL,
    sucursal VARCHAR(20) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    datos_json TEXT NOT NULL  -- JSON con todos los productos
);

-- Tabla de estadísticas pre-calculadas (cache)
CREATE TABLE estadisticas_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_estadistica VARCHAR(50) NOT NULL,
    periodo VARCHAR(20) NOT NULL,  -- 'diario', 'semanal', 'mensual'
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NOT NULL,
    datos_json TEXT NOT NULL,
    fecha_calculo DATETIME NOT NULL
);
```

### Frontend (React)

```
frontend/src/
├── pages/
│   ├── Stocks.tsx              # Página principal de stocks
│   ├── HistorialStocks.tsx     # Visualización de historial
│   └── EstadisticasStocks.tsx  # Dashboard de estadísticas
├── components/
│   ├── StockCard.tsx           # Tarjeta de producto
│   ├── StockTable.tsx          # Tabla de stocks
│   ├── GraficoConsumo.tsx      # Gráfico de consumo
│   └── AlertasStock.tsx        # Alertas de stock bajo
└── services/
    └── stocksApi.ts            # API calls
```

---

## 📋 ENDPOINTS API PROPUESTOS

### Stocks
```
GET  /api/stocks/cocina?sucursal=recoleta
GET  /api/stocks/salon?sucursal=recoleta
GET  /api/stocks/birras?sucursal=recoleta
GET  /api/stocks/productos?sucursal=recoleta&tipo=cocina
POST /api/stocks/snapshot  # Capturar snapshot manual
```

### Historial
```
GET  /api/historial/stocks?sucursal=recoleta&desde=2026-01-01&hasta=2026-12-31
GET  /api/historial/producto/{codigo}?sucursal=recoleta
GET  /api/historial/cambios?sucursal=recoleta&tipo=cocina
```

### Estadísticas
```
GET  /api/estadisticas/productos?sucursal=recoleta&periodo=mensual
GET  /api/estadisticas/grupos?sucursal=recoleta
GET  /api/estadisticas/comparacion  # Recoleta vs Palermo
GET  /api/estadisticas/tendencias/{codigo}
GET  /api/estadisticas/alertas?sucursal=recoleta
GET  /api/estadisticas/recomendaciones?sucursal=recoleta
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### FASE 1: Lectura de Stocks (Base)
1. ✅ Configurar acceso a los 3 sheets (Central + Recoleta + Palermo)
2. ✅ Crear servicio de lectura de stocks
3. ✅ Crear endpoints básicos de consulta
4. ✅ Crear página de visualización de stocks

### FASE 2: Historial
1. Crear base de datos SQLite
2. Implementar captura de snapshots
3. Crear servicio de historial
4. Implementar endpoints de historial
5. Crear página de visualización de historial

### FASE 3: Estadísticas Básicas
1. Implementar cálculo de estadísticas por producto
2. Implementar cálculo de estadísticas por grupo
3. Crear endpoints de estadísticas
4. Crear dashboard de estadísticas

### FASE 4: Estadísticas Avanzadas
1. Implementar análisis de tendencias
2. Implementar sistema de alertas
3. Implementar recomendaciones automáticas
4. Crear visualizaciones avanzadas (gráficos)

### FASE 5: Optimizaciones
1. Implementar cache de estadísticas
2. Optimizar consultas
3. Agregar filtros avanzados
4. Exportación de reportes (PDF/Excel)

---

## 🤔 PREGUNTAS PARA EL USUARIO

1. **Frecuencia de captura de historial:**
   - ¿Prefieres snapshots diarios, semanales o captura en tiempo real?
   - ¿Cuánto historial quieres mantener? (3 meses, 6 meses, 1 año, ilimitado)

2. **Prioridades:**
   - ¿Qué es más importante: historial o estadísticas?
   - ¿Qué métricas son las más importantes para ti?

3. **Integración:**
   - ¿Los cambios en stocks se hacen solo desde los sheets o también desde la web app?
   - ¿Necesitas notificaciones cuando el stock está bajo?

4. **Visualización:**
   - ¿Prefieres tablas, gráficos o ambos?
   - ¿Qué tipo de gráficos te gustaría ver? (líneas, barras, tortas)

5. **Permisos:**
   - ¿Quién puede ver las estadísticas? (todos, solo admin)
   - ¿Necesitas diferentes niveles de acceso?

---

## 💡 PRÓXIMOS PASOS

1. **Confirmar estructura:** Verificar que entendí correctamente la estructura de los sheets
2. **Definir prioridades:** Decidir qué implementar primero
3. **Empezar con FASE 1:** Crear servicio de lectura de stocks
4. **Iterar:** Ir agregando funcionalidades según necesidad

---

**¿Por dónde empezamos?** 🚀


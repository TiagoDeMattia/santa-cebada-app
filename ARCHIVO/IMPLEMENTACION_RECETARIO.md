# Implementación del Sistema de Recetario

**Fecha**: 7 de Mayo de 2026  
**Estado**: ✅ Fase 1 Completada

---

## 📋 Resumen

Sistema de linkeo inteligente entre productos de Nucleo (sistema de ventas) y productos de Stock (inventario) para calcular stock aproximado basado en ventas.

---

## 🎯 Objetivo

Calcular automáticamente el stock aproximado de productos de salón restando las ventas del sistema Nucleo del stock base (stock inicial + pedido).

---

## 🏗️ Arquitectura

### Backend

#### 1. Base de Datos (`recetario.db`)

**Tabla: `linkeos`**
- Linkeo entre productos Nucleo y Stock
- Conversiones (ml, unidades)
- Estado activo/inactivo
- Auto-generado o manual

**Tabla: `stock_base`** (Próxima fase)
- Stock inicial + pedido
- Fecha de snapshot
- Unidad de medida

**Tabla: `ventas_procesadas`** (Próxima fase)
- Control de ventas ya procesadas
- Evita contar dos veces

#### 2. Servicio (`recetario_service.py`)

**Funciones Principales:**
- `generar_linkeos_automaticos()` - Genera linkeos automáticos con IA
- `get_linkeos()` - Obtiene todos los linkeos
- `actualizar_linkeo()` - Actualiza conversiones y estado
- `eliminar_linkeo()` - Elimina un linkeo
- `crear_linkeo_manual()` - Crea linkeo manual

**Algoritmo de Matching:**
1. Extrae palabras clave de productos Stock
2. Obtiene productos de Nucleo via API
3. Calcula score de similitud (intersección de palabras)
4. Linkea si score >= 0.5 (50% de confianza)
5. Asigna conversión por defecto según categoría

#### 3. Controlador (`recetario_controller.py`)

Maneja requests HTTP y validaciones.

#### 4. Rutas (`recetario.py`)

**Endpoints:**
- `POST /api/recetario/generar-linkeos` - Genera linkeos automáticos
- `GET /api/recetario/linkeos` - Lista linkeos
- `PUT /api/recetario/linkeos/{id}` - Actualiza linkeo
- `DELETE /api/recetario/linkeos/{id}` - Elimina linkeo
- `POST /api/recetario/linkeos` - Crea linkeo manual

### Frontend

#### Página: `Recetario.tsx`

**Características:**
- Tabla editable de linkeos
- Generación automática con un clic
- Filtros por categoría y estado
- Edición inline de conversiones
- Activar/desactivar linkeos
- Eliminar linkeos

**Métricas:**
- Total de linkeos
- Linkeos activos
- Categorías disponibles

---

## 📊 Categorías Soportadas

### 1. Alcoholes
**Palabras clave**: fernet, vodka, gin, whisky, ron, tequila, aperol, campari  
**Conversión por defecto**: 75ml por trago

### 2. Vinos
**Palabras clave**: vino, espumante, champagne  
**Conversión por defecto**: 150ml por copa

### 3. Gaseosas
**Palabras clave**: coca, sprite, fanta, schweppes, tonica, soda  
**Conversión por defecto**: 250ml por vaso

### 4. Cervezas sin TACC
**Palabras clave**: sin tacc, gluten free, celiaco  
**Conversión por defecto**: 330ml por botella

---

## 🔄 Flujo de Trabajo

### Fase 1: Linkeo (✅ Completada)

1. **Generar Linkeos Automáticos**
   - Click en "Generar Automático"
   - Sistema obtiene productos de Stock (salón)
   - Sistema obtiene productos de Nucleo (ventas)
   - Algoritmo de matching genera linkeos
   - Conversiones por defecto asignadas

2. **Revisar y Ajustar**
   - Ver linkeos generados en tabla
   - Editar conversiones (ml, unidades)
   - Activar/desactivar linkeos
   - Eliminar linkeos incorrectos
   - Crear linkeos manuales si es necesario

### Fase 2: Stock Base (Próxima)

1. **Tomar Snapshot Inicial**
   - Obtener stock actual de Google Sheets
   - Sumar pedido
   - Guardar en `stock_base`
   - Fecha de snapshot

2. **Actualizar Stock Base**
   - Botón "Actualizar Stock Base"
   - Toma nuevo snapshot
   - Reemplaza valores anteriores

### Fase 3: Cálculo de Stock Aproximado (Próxima)

1. **Procesar Ventas**
   - Obtener ventas de Nucleo desde última actualización
   - Filtrar solo productos linkeados y activos
   - Convertir cantidades (ventas × conversion_ml)
   - Restar del stock base
   - Marcar ventas como procesadas

2. **Mostrar Stock Aproximado**
   - Nueva página "Stock Aproximado"
   - Tabla con: Producto, Stock Base, Ventas, Stock Aproximado
   - Alertas de stock bajo
   - Gráficos de tendencias

---

## 🎨 Interfaz de Usuario

### Página Recetario

**Header:**
- Título y descripción
- Botón "Actualizar"
- Botón "Generar Automático"

**Métricas:**
- Total Linkeos
- Activos
- Categorías

**Filtros:**
- Por categoría
- Solo activos

**Tabla:**
- Producto Nucleo (nombre, código)
- Producto Stock (nombre, código)
- Categoría
- Conversión (ml)
- Unidades
- Activo (Sí/No)
- Acciones (Editar, Eliminar)

**Edición Inline:**
- Click en "Editar"
- Inputs para conversión ml y unidades
- Checkbox para activo
- Botones "Guardar" y "Cancelar"

---

## 📝 Ejemplos de Linkeos

### Ejemplo 1: Fernet
- **Nucleo**: "Fernet con Coca" (ID: 123)
- **Stock**: "Fernet Branca 1L" (S001)
- **Categoría**: alcoholes
- **Conversión**: 75ml por trago
- **Cálculo**: 1 venta = 75ml = 0.075L

### Ejemplo 2: Vino
- **Nucleo**: "Copa de Vino Tinto" (ID: 456)
- **Stock**: "Vino Malbec 750ml" (S015)
- **Categoría**: vinos
- **Conversión**: 150ml por copa
- **Cálculo**: 1 venta = 150ml = 0.15L

### Ejemplo 3: Gaseosa
- **Nucleo**: "Coca Cola" (ID: 789)
- **Stock**: "Coca Cola 2.25L" (S030)
- **Categoría**: gaseosas
- **Conversión**: 250ml por vaso
- **Cálculo**: 1 venta = 250ml = 0.25L

---

## 🔧 Configuración

### Conversiones por Defecto

Modificables en `recetario_service.py`:

```python
def _get_conversion_default(self, categoria: str) -> float:
    conversiones = {
        "alcoholes": 75.0,  # 75ml por trago
        "vinos": 150.0,     # 150ml por copa
        "gaseosas": 250.0,  # 250ml por vaso
        "cervezas_sin_tacc": 330.0  # 330ml por botella
    }
    return conversiones.get(categoria, 0.0)
```

### Umbral de Matching

Modificable en `recetario_service.py`:

```python
if score > mejor_score and score >= 0.5:  # Umbral de confianza
```

---

## 🚀 Cómo Usar

### 1. Generar Linkeos Automáticos

1. Ir a "Recetario" en el menú
2. Click en "Generar Automático"
3. Confirmar acción
4. Esperar unos segundos
5. Ver linkeos generados

### 2. Revisar Linkeos

1. Ver tabla de linkeos
2. Filtrar por categoría si es necesario
3. Verificar que los linkeos sean correctos

### 3. Editar Conversiones

1. Click en botón "Editar" (lápiz)
2. Modificar conversión ml
3. Modificar unidades si es necesario
4. Activar/desactivar linkeo
5. Click en "Guardar" (check)

### 4. Eliminar Linkeo Incorrecto

1. Click en botón "Eliminar" (basura)
2. Confirmar eliminación

### 5. Crear Linkeo Manual

(Próxima fase - formulario de creación)

---

## ✅ Estado Actual

### Completado ✅

- [x] Base de datos de recetario
- [x] Servicio de linkeo automático
- [x] Algoritmo de matching inteligente
- [x] Endpoints de API
- [x] Página de Recetario
- [x] Generación automática
- [x] Edición de linkeos
- [x] Filtros y búsqueda
- [x] Conversiones por defecto

### Próximos Pasos 🔄

- [ ] Tabla de stock base
- [ ] Endpoint para tomar snapshot inicial
- [ ] Endpoint para procesar ventas
- [ ] Página de Stock Aproximado
- [ ] Gráficos de tendencias
- [ ] Alertas de stock bajo
- [ ] Formulario de linkeo manual
- [ ] Exportar linkeos a CSV

---

## 🧪 Testing

### Probar Generación Automática

```bash
curl -X POST "http://localhost:8000/api/recetario/generar-linkeos?sucursal=recoleta"
```

### Listar Linkeos

```bash
curl "http://localhost:8000/api/recetario/linkeos"
```

### Actualizar Linkeo

```bash
curl -X PUT "http://localhost:8000/api/recetario/linkeos/1" \
  -H "Content-Type: application/json" \
  -d '{"conversion_ml": 100.0, "activo": true}'
```

---

## 📊 Métricas Esperadas

- **Productos de Stock**: ~150 (solo salón)
- **Productos de Nucleo**: ~500-1000
- **Linkeos generados**: ~50-100 (según matching)
- **Precisión del matching**: ~70-80%
- **Tiempo de generación**: ~10-20 segundos

---

## 🎯 Beneficios

1. **Automatización**: Linkeo automático con IA
2. **Precisión**: Conversiones ajustables por producto
3. **Control**: Activar/desactivar linkeos
4. **Flexibilidad**: Edición inline rápida
5. **Escalabilidad**: Fácil agregar nuevas categorías
6. **Trazabilidad**: Historial de modificaciones

---

**Nota**: Esta es la Fase 1 del sistema. Las fases 2 y 3 (Stock Base y Cálculo Aproximado) se implementarán próximamente.

# Recetario - Funcionalidades Completadas

**Fecha**: 7 de Mayo de 2026  
**Estado**: ✅ Completado

---

## ✅ Funcionalidades Implementadas

### 1. Edición de Linkeos Automáticos ✅

**Características:**
- Click en botón "Editar" (lápiz) en cualquier linkeo
- Edición inline en la misma tabla
- Campos editables:
  - **Capacidad Stock (ml)**: Cuántos ml tiene el producto de stock
  - **Conversión (ml)**: Cuántos ml consume cada venta
  - **Unidades**: Factor de conversión
  - **Activo**: Activar/desactivar linkeo
- Botones "Guardar" (check) y "Cancelar" (X)
- Actualización en tiempo real

**Flujo:**
1. Click en "Editar" en un linkeo
2. Modificar valores en los inputs
3. Click en "Guardar" para aplicar cambios
4. O click en "Cancelar" para descartar

---

### 2. Creación Manual de Linkeos ✅

**Características:**
- Botón "Crear Linkeo" en el header
- Modal completo con búsqueda de productos
- Selección de productos de ambos sistemas:
  - **Producto Nucleo**: Sistema de ventas
  - **Producto Stock**: Inventario
- Búsqueda en tiempo real con autocompletado
- Configuración completa:
  - Categoría (alcoholes, vinos, gaseosas, cervezas sin TACC)
  - Capacidad del stock en ml
  - Conversión en ml
  - Unidades

**Flujo:**
1. Click en "Crear Linkeo"
2. Modal se abre y carga productos (puede tardar unos segundos)
3. Buscar producto de Nucleo escribiendo su nombre
4. Seleccionar de la lista desplegable
5. Buscar producto de Stock escribiendo su nombre
6. Seleccionar de la lista desplegable
7. Elegir categoría
8. Configurar capacidad y conversión
9. Click en "Crear Linkeo"

---

## 🎯 Campos del Linkeo

### Producto Nucleo (Sistema de Ventas)
- **ID**: Identificador único en Nucleo
- **Código**: Código del producto
- **Nombre**: Nombre del producto

### Producto Stock (Inventario)
- **Código**: Código del producto (ej: S001)
- **Nombre**: Nombre del producto

### Configuración
- **Categoría**: alcoholes, vinos, gaseosas, cervezas_sin_tacc
- **Capacidad Stock (ml)**: Cuántos ml tiene el producto de stock
  - Ejemplo: Fernet 1L = 1000ml
- **Conversión (ml)**: Cuántos ml consume cada venta
  - Ejemplo: 1 Fernet con Coca = 75ml
- **Unidades**: Factor de conversión (normalmente 1)
- **Activo**: Si el linkeo está activo o no

---

## 📊 Ejemplo de Uso

### Crear Linkeo Manual: Fernet con Coca

1. **Click en "Crear Linkeo"**
2. **Buscar Producto Nucleo**: "Fernet"
   - Aparece: "Fernet con Coca" (ID: 123, Code: FERNET001)
   - Click para seleccionar
3. **Buscar Producto Stock**: "Fernet"
   - Aparece: "Fernet Branca 1L" (S001)
   - Click para seleccionar
4. **Configurar**:
   - Categoría: Alcoholes
   - Capacidad Stock: 1000 ml (1 litro)
   - Conversión: 75 ml (por trago)
   - Unidades: 1
5. **Click en "Crear Linkeo"**
6. **Resultado**: Linkeo creado y visible en la tabla

### Editar Linkeo Existente

1. **Encontrar linkeo** en la tabla
2. **Click en botón "Editar"** (lápiz)
3. **Modificar valores**:
   - Cambiar conversión de 75ml a 100ml
   - Cambiar capacidad de 1000ml a 750ml
4. **Click en "Guardar"** (check)
5. **Resultado**: Linkeo actualizado

---

## 🔧 Backend - Nuevos Endpoints

### `GET /api/recetario/productos-stock`
Obtiene lista de productos de Stock (inventario).

**Parámetros:**
- `sucursal`: 'recoleta' o 'palermo' (default: 'recoleta')

**Retorna:**
```json
{
  "success": true,
  "total": 150,
  "productos": [
    {
      "codigo_producto": "S001",
      "producto": "Fernet Branca 1L",
      "codigo_grupo": "1",
      "stock_cantidad": 5,
      "stock_unidad": "L",
      "pedido_cantidad": 3,
      "pedido_unidad": "L",
      "tiene_pedido": true
    }
  ]
}
```

### `GET /api/recetario/productos-nucleo`
Obtiene lista de productos de Nucleo (sistema de ventas).

**Parámetros:**
- `sucursal`: 'recoleta' o 'palermo' (default: 'recoleta')

**Retorna:**
```json
{
  "success": true,
  "total": 500,
  "productos": [
    {
      "Id": 123,
      "Code": "FERNET001",
      "Name": "Fernet con Coca",
      "Price": 2500
    }
  ]
}
```

### `POST /api/recetario/linkeos`
Crea un linkeo manual.

**Body:**
```json
{
  "producto_nucleo_id": 123,
  "producto_nucleo_codigo": "FERNET001",
  "producto_nucleo_nombre": "Fernet con Coca",
  "producto_stock_codigo": "S001",
  "producto_stock_nombre": "Fernet Branca 1L",
  "categoria": "alcoholes",
  "capacidad_stock_ml": 1000.0,
  "conversion_ml": 75.0,
  "conversion_unidades": 1.0
}
```

**Retorna:**
```json
{
  "success": true,
  "linkeo_id": 5,
  "message": "Linkeo creado exitosamente"
}
```

---

## 🎨 Interfaz de Usuario

### Modal de Creación

**Secciones:**
1. **Producto Nucleo**
   - Input de búsqueda con icono de lupa
   - Desplegable con resultados (máximo 50)
   - Muestra nombre y código
   - Selección con click

2. **Producto Stock**
   - Input de búsqueda con icono de lupa
   - Desplegable con resultados (máximo 50)
   - Muestra nombre y código
   - Selección con click

3. **Configuración**
   - Select de categoría
   - Input de capacidad (ml)
   - Input de conversión (ml)
   - Input de unidades

4. **Botones**
   - "Crear Linkeo" (verde, con spinner al guardar)
   - "Cancelar" (gris)

### Tabla de Linkeos

**Columnas:**
1. Producto Nucleo (nombre + código)
2. Producto Stock (nombre + código)
3. Categoría (badge)
4. Capacidad Stock (ml)
5. Conversión (ml)
6. Unidades
7. Activo (Sí/No)
8. Acciones (Editar, Eliminar)

**Modo Edición:**
- Fila con fondo azul claro
- Inputs editables
- Botones Guardar/Cancelar

---

## ✅ Validaciones

### Creación de Linkeo
- ✅ Ambos productos deben estar seleccionados
- ✅ Capacidad debe ser mayor a 0
- ✅ Conversión debe ser mayor o igual a 0
- ✅ No se puede crear linkeo duplicado (mismo producto Nucleo + Stock)

### Edición de Linkeo
- ✅ Al menos un campo debe cambiar
- ✅ Valores numéricos válidos
- ✅ Actualización en tiempo real

---

## 🚀 Mejoras Implementadas

1. **Búsqueda Inteligente**
   - Búsqueda por nombre o código
   - Insensible a mayúsculas
   - Resultados limitados a 50 para rendimiento

2. **Detección Automática de Capacidad**
   - Detecta "1L", "750ml", "2.25L", etc.
   - Convierte automáticamente a ml
   - Valores por defecto inteligentes

3. **Interfaz Intuitiva**
   - Modal limpio y organizado
   - Búsqueda con autocompletado
   - Feedback visual al seleccionar
   - Spinner al guardar

4. **Edición Inline**
   - No necesita modal separado
   - Edición rápida en la tabla
   - Cancelación fácil

---

## 📝 Notas Importantes

1. **Carga de Productos**: Al abrir el modal de creación, se cargan todos los productos de Nucleo y Stock. Esto puede tardar unos segundos la primera vez.

2. **Límite de Resultados**: La búsqueda muestra máximo 50 resultados para mantener el rendimiento. Si no encuentras un producto, refina tu búsqueda.

3. **Linkeos Duplicados**: No se pueden crear linkeos duplicados entre el mismo producto de Nucleo y Stock.

4. **Capacidad Automática**: Al generar linkeos automáticos, la capacidad se detecta del nombre del producto. Puedes editarla manualmente si es incorrecta.

---

## ✅ Estado Actual

- ✅ Edición de linkeos automáticos
- ✅ Creación manual de linkeos
- ✅ Búsqueda de productos Nucleo
- ✅ Búsqueda de productos Stock
- ✅ Validaciones completas
- ✅ Interfaz intuitiva
- ✅ Detección automática de capacidad

---

**Todo está listo y funcionando. Puedes crear y editar linkeos libremente.**

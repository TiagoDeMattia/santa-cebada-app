# Reestructuración Recetario - Santa Cebada 🍺

**Fecha**: 10 de Junio de 2026, 01:13
**Status**: ✅ COMPLETADO

## Cambios Realizados

### 1. Frontend - Recetario.tsx

#### Eliminación de Selector de Sucursal
- ✅ Removido estado `sucursal` que permitía seleccionar entre Recoleta y Palermo
- ✅ Removido selector dropdown del header
- ✅ Eliminado código condicional innecesario

#### Fijación a Santa Cebada - Recoleta
```typescript
// Santa Cebada - Sucursal: Recoleta
const SUCURSAL = 'recoleta'
```
- Constante global ahora fija la sucursal a Recoleta
- Todas las funciones API usan esta constante
- No hay fallbacks ni parámetros variables

#### Funciones API Actualizadas
```typescript
// Antes
async function fetchProductosStock(sucursal: string = 'recoleta')
async function fetchProductosNucleo(sucursal: string = 'recoleta')
async function generarLinkeosAutomaticos(sucursal: string = 'recoleta')

// Después
async function fetchProductosStock()
async function fetchProductosNucleo()
async function generarLinkeosAutomaticos()
```
- Parámetro `sucursal` eliminado de todas las funciones
- Usan la constante `SUCURSAL` internamente
- Llamadas simplificadas

#### Actualización del Header
**Antes:**
```
Título: "Recetario"
Subtítulo: "Afiliación de productos Nucleo con Stock..."
UI: Selector de sucursal (Recoleta/Palermo)
```

**Después:**
```
Título: "Santa Cebada - Recetario" ✨
Subtítulo: "Afiliación de productos Nucleo con Stock... · Recoleta"
UI: Sin selector (información consolidada)
```

#### Handlers de Eventos Actualizados
- `handleGenerarAutomatico()`: Llamada a `generarLinkeosAutomaticos()` sin parámetro
- `handleOpenModal()`: Llamadas a `fetchProductosStock()` y `fetchProductosNucleo()` sin parámetro

## Funcionalidades Preservadas ✅

| Feature | Status |
|---------|--------|
| Crear afiliaciones manuales | ✅ Funcionando |
| Generar afiliaciones automáticas | ✅ Funcionando |
| Filtrar por categoría | ✅ Funcionando |
| Filtrar por estado (Activos) | ✅ Funcionando |
| Editar afiliaciones | ✅ Funcionando |
| Eliminar afiliaciones | ✅ Funcionando |
| Gestionar unidades de medida | ✅ Funcionando |
| Búsqueda de productos | ✅ Funcionando |
| Cache-busting en fetch | ✅ Mantiene timestamp |

## Datos Disponibles

- **Sucursal**: Santa Cebada - Recoleta (sucursal_id: 1)
- **Afiliaciones**: 44 productos activos
- **Categorías**: Alcoholes, Vinos, Gaseosas, Cervezas sin TACC

## Impacto en Otras Páginas

| Página | Impacto | Status |
|--------|--------|--------|
| Barriles.tsx | No afectada (tiene su propio selector) | ✅ OK |
| Actualizar.tsx | No afectada (tiene su propio selector) | ✅ OK |
| StockAproximado.tsx | No afectada (no UI selector) | ✅ OK |
| EstadisticasStocks.tsx | No afectada | ✅ OK |
| Comparar.tsx | Sigue mostrando ambas sucursales | ✅ OK |

## Hot Reload ✨

- Frontend actualizado automáticamente vía Vite HMR
- Los cambios están visibles en localhost:5173 sin reiniciar

## Próximos Pasos

1. ✅ Revisar la página en http://localhost:5173/recetario
2. ✅ Verificar que todas las funcionalidades funcionan
3. ⏳ Desplegar cambios a VPS cuando sea necesario

## Notas Técnicas

- Constante `SUCURSAL = 'recoleta'` permite cambios futuros rápidamente
- Backend aún soporta múltiples sucursales en otras páginas
- Recetario ahora es 100% exclusivo de Santa Cebada - Recoleta
- Código más limpio y sin duplicaciones innecesarias

# 🎯 Solución Definitiva: Grid con Columnas Lado a Lado

**Fecha:** 2026-05-05 20:15  
**Estado:** ✅ IMPLEMENTADO

---

## 🔍 Análisis Profundo del Problema

### Causa Raíz Identificada

**El problema NO era el breakpoint ni el viewport, era que Tailwind CSS NO soporta valores arbitrarios complejos con `minmax()` en `grid-template-columns`.**

```tsx
// ❌ ESTO NO FUNCIONA EN TAILWIND
<div className="lg:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)]">
```

**Por qué no funciona:**
1. Tailwind solo soporta valores arbitrarios simples como `[200px]` o `[1fr]`
2. `minmax()` es una función CSS que Tailwind no puede procesar en clases arbitrarias
3. La clase se ignora silenciosamente y el grid queda en `grid-cols-1`

---

## ✅ Solución Implementada

### 1. Hook Personalizado para Detectar Desktop

```tsx
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) {
      setMatches(media.matches)
    }
    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [matches, query])

  return matches
}
```

**Ventajas:**
- ✅ Reactivo a cambios de tamaño de ventana
- ✅ No causa hydration mismatch
- ✅ Performance optimizado con event listener

### 2. Uso del Hook en el Componente

```tsx
export function Barriles() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  // ... resto del código
}
```

### 3. CSS Inline con Lógica Condicional

```tsx
<div 
  className="grid gap-0 items-start"
  style={{
    display: 'grid',
    gridTemplateColumns: isDesktop 
      ? 'minmax(0, 1fr) 100px minmax(0, 1fr)' 
      : '1fr',
    gap: 0
  }}
>
```

**Por qué funciona:**
- ✅ CSS inline tiene máxima especificidad
- ✅ `minmax()` funciona perfectamente en CSS puro
- ✅ Condicional basado en hook reactivo
- ✅ Se actualiza automáticamente en resize

### 4. Separador Condicional

```tsx
{isDesktop && (
  <div className="flex items-center justify-center w-full min-h-[400px] relative px-10">
    <div className="w-px h-full bg-gradient-to-b from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/10 to-transparent blur-md"></div>
  </div>
)}
```

**Por qué:**
- ✅ Solo se renderiza en desktop
- ✅ Ocupa la columna central del grid (100px)
- ✅ Evita problemas de `hidden lg:flex`

---

## 📊 Estructura del Grid

### Desktop (≥1024px)

```
┌─────────────────────────────────────────────────────────┐
│                                                           │
│  minmax(0, 1fr)    │    100px    │    minmax(0, 1fr)    │
│                    │             │                       │
│  [PINCHADAS]       │  Separador  │  [EN CAMARA]          │
│                    │             │                       │
│  ● Barril 1        │      │      │  ● Barril A           │
│  ● Barril 2   ╭────┼──────┼───╮  │  ● Barril B           │
│  ● Barril 3   │    │      │   │  │  ● Barril C           │
│               ╰────┼──────┼───╯  │                       │
│                    │             │                       │
└─────────────────────────────────────────────────────────┘
```

### Móvil (<1024px)

```
┌─────────────────────┐
│                     │
│  [PINCHADAS]        │
│  ● Barril 1         │
│  ● Barril 2         │
│  ● Barril 3         │
│                     │
│  [EN CAMARA]        │
│  ● Barril A         │
│  ● Barril B         │
│  ● Barril C         │
│                     │
└─────────────────────┘
```

---

## 🔧 Detalles Técnicos

### Por qué `minmax(0, 1fr)`

**Problema:** `1fr` por defecto tiene `min-width: auto`, lo que puede causar overflow.

**Solución:** `minmax(0, 1fr)` fuerza `min-width: 0`, permitiendo que la columna se comprima si es necesario.

### Por qué 100px para el Separador

**Razones:**
1. Espacio suficiente para hilos ondulados
2. Padding interno de 40px (20px cada lado)
3. Línea central de 1px
4. Proporcional al diseño general

### Por qué Hook en Lugar de CSS Puro

**Alternativas consideradas:**

**Opción A: Media Query CSS**
```css
@media (min-width: 1024px) {
  .grid-custom {
    grid-template-columns: minmax(0, 1fr) 100px minmax(0, 1fr);
  }
}
```
❌ Requiere archivo CSS adicional  
❌ Menos mantenible con Tailwind

**Opción B: Tailwind Plugin**
```js
// tailwind.config.js
plugins: [
  function({ addUtilities }) {
    addUtilities({
      '.grid-barriles': {
        'grid-template-columns': 'minmax(0, 1fr) 100px minmax(0, 1fr)'
      }
    })
  }
]
```
❌ Más complejo  
❌ No es responsive por defecto

**Opción C: CSS Inline + Hook** ✅
```tsx
style={{
  gridTemplateColumns: isDesktop ? '...' : '1fr'
}}
```
✅ Simple y directo  
✅ Reactivo automáticamente  
✅ Fácil de mantener

---

## 🎨 Hilos Ondulados

### Curva en S Mejorada

```tsx
const dx = line.x2 - line.x1
const dy = line.y2 - line.y1

// Puntos de control asimétricos
const controlPoint1X = line.x1 + dx * 0.3
const controlPoint1Y = line.y1 + dy * 0.1  // Desplazamiento vertical
const controlPoint2X = line.x1 + dx * 0.7
const controlPoint2Y = line.y2 - dy * 0.1  // Desplazamiento opuesto

const path = `M ${line.x1} ${line.y1} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${line.x2} ${line.y2}`
```

**Resultado:**
- Curva suave en forma de S
- Desplazamiento vertical del 10% crea efecto de onda
- Puntos de control al 30% y 70% para asimetría natural

---

## ✅ Verificación

### Checklist de Implementación

- [x] Hook `useMediaQuery` implementado
- [x] Grid con CSS inline condicional
- [x] Separador renderizado condicionalmente
- [x] Hilos con curvas onduladas
- [x] Responsive (apilado en móvil)
- [x] Sin errores de compilación
- [x] Hot reload funcionando

### Cómo Verificar en el Navegador

1. **Abrir DevTools** (F12)
2. **Ir a Elements/Elementos**
3. **Buscar el div con `id="barriles-container"`**
4. **Inspeccionar el div hijo con `style="..."`**
5. **Verificar que `grid-template-columns` tenga el valor correcto:**
   - Desktop: `minmax(0, 1fr) 100px minmax(0, 1fr)`
   - Móvil: `1fr`

### Comandos de Verificación

```bash
# En DevTools Console
document.getElementById('barriles-container')
  .querySelector('[style*="grid"]')
  .style.gridTemplateColumns

# Debe retornar:
# Desktop: "minmax(0, 1fr) 100px minmax(0, 1fr)"
# Móvil: "1fr"
```

---

## 🚀 Resultado Final

### Características Implementadas

✅ **Columnas lado a lado** en desktop (≥1024px)  
✅ **Separador visible** de 100px con gradiente  
✅ **Hilos ondulados** con curvas en S  
✅ **Efecto luminoso** con múltiples capas de glow  
✅ **Responsive** (apilado en móvil)  
✅ **Reactivo** a cambios de tamaño de ventana  
✅ **Performance optimizado** con hook personalizado  

### Breakpoints

| Tamaño | Ancho | Layout |
|--------|-------|--------|
| Móvil | <1024px | Apilado (1 columna) |
| Desktop | ≥1024px | Lado a lado (3 columnas) |

---

## 📝 Lecciones Aprendidas

### 1. Limitaciones de Tailwind

**Tailwind NO soporta:**
- Funciones CSS complejas en valores arbitrarios (`minmax`, `calc`, etc.)
- Valores arbitrarios en pseudo-elementos
- Algunas propiedades CSS avanzadas

**Solución:** Usar CSS inline o clases personalizadas.

### 2. Importancia de Hooks Personalizados

Los hooks personalizados son ideales para:
- Lógica de UI responsive
- Detección de características del navegador
- Estado derivado de eventos del DOM

### 3. CSS Inline vs Clases

**Cuándo usar CSS inline:**
- Valores dinámicos basados en estado
- Funciones CSS complejas
- Lógica condicional compleja

**Cuándo usar clases:**
- Estilos estáticos
- Valores predefinidos
- Reutilización en múltiples componentes

---

## 🔄 Mantenimiento Futuro

### Si Necesitas Cambiar el Ancho del Separador

```tsx
// Cambiar 100px por el valor deseado
gridTemplateColumns: isDesktop 
  ? 'minmax(0, 1fr) 120px minmax(0, 1fr)'  // ← Aquí
  : '1fr'
```

### Si Necesitas Cambiar el Breakpoint

```tsx
// Cambiar 1024px por el valor deseado
const isDesktop = useMediaQuery('(min-width: 1280px)')  // ← Aquí
```

### Si Necesitas Agregar Más Columnas

```tsx
gridTemplateColumns: isDesktop 
  ? 'minmax(0, 1fr) 100px minmax(0, 1fr) 100px minmax(0, 1fr)'
  : '1fr'
```

---

**¡Grid funcionando correctamente con columnas lado a lado! 🎨✨**

*La solución usa CSS inline con hook personalizado para máxima compatibilidad y flexibilidad.*

---

*Documento creado: 2026-05-05 20:15*

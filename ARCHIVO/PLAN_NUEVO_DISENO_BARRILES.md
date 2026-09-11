# Plan: Nuevo Diseño de Barriles con Dos Columnas e Hilos

## ✅ Backup Creado
- `frontend/src/pages/Barriles.tsx.backup2` - Diseño de tarjetas actual

## 🎯 Objetivos

### 1. Header más compacto
- Reducir tamaño de títulos y botones
- Subir todo un poco

### 2. Campo "Siguiente a"
- Agregar al modal de edición
- Al lado de "Canilla N°"
- Guardar como "Sig X" en columna P (Recoleta) o N (Palermo)

### 3. Dos columnas lado a lado (solo en tab "Activos")
- **Izquierda**: "CARTELERIA ACTUAL - CERVEZAS PINCHADAS"
- **Derecha**: "CERVEZAS EN CAMARA"

### 4. Hilos conectores con efecto neón
- **Verde neón**: Conecta cervezas del mismo estilo exacto
- **Naranja neón**: Conecta canilla con su "Siguiente a"
- Ambos hilos pueden coexistir

### 5. Tabs
- **Activos**: Dos columnas con hilos
- **Historial**: Lista simple (Para Retirar + Retiradas)
- **Todos**: Lista simple (todas las secciones)

## 📝 Cambios Necesarios

### Backend
- ✅ Ya soporta guardar en columna de canilla
- ✅ Solo necesitamos enviar "Sig X" en el campo canilla

### Frontend

#### 1. Modal de Edición
```typescript
// Agregar estado
const [siguienteA, setSiguienteA] = useState('')

// Extraer de barril.canilla si existe "Sig X"
useEffect(() => {
  const match = barril.canilla.match(/Sig\s+(\d+)/)
  setSiguienteA(match ? match[1] : '')
}, [barril])

// Al guardar, construir: "5 Sig 9" si hay siguienteA
const canillaValue = siguienteA ? `${canilla} Sig ${siguienteA}`.trim() : canilla
```

#### 2. Componente BarrilSimpleCard
- Tarjeta más compacta
- Canilla destacada (10x10)
- Solo info esencial
- ID único para conectar hilos

#### 3. Componente ConnectionLines
- SVG absoluto sobre el container
- Calcula posiciones de elementos por ID
- Dibuja líneas con filtro de glow
- Recalcula en resize

#### 4. Layout de Dos Columnas
```tsx
<div id="barriles-container" className="relative">
  <ConnectionLines connections={...} />
  <div className="grid grid-cols-2 gap-6">
    <div>Pinchadas</div>
    <div>En Cámara</div>
  </div>
</div>
```

#### 5. Lógica de Conexiones
```typescript
// Verde: Mismo estilo
pinchadas.forEach(p => {
  enCamara.forEach(c => {
    if (p.estilo === c.estilo) {
      connections.push({ from: `p-${p.row}`, to: `c-${c.row}`, type: 'same-style' })
    }
  })
})

// Naranja: Siguiente a
pinchadas.forEach(p => {
  const canillaNum = p.canilla.split(' ')[0]
  enCamara.forEach(c => {
    const match = c.canilla.match(/Sig\s+(\d+)/)
    if (match && match[1] === canillaNum) {
      connections.push({ from: `p-${p.row}`, to: `c-${c.row}`, type: 'next-canilla' })
    }
  })
})
```

## 🎨 Estilos CSS

### Efecto Neón
```css
/* Verde */
filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.8))

/* Naranja */
filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.8))
```

### SVG Filters
```xml
<filter id="glow-green">
  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
  <feMerge>
    <feMergeNode in="coloredBlur"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>
```

## 📱 Responsive

### Desktop (≥1024px)
- Dos columnas lado a lado
- Hilos visibles

### Tablet/Móvil (<1024px)
- Columnas apiladas verticalmente
- Hilos ocultos o adaptados

## ⚠️ Consideraciones

1. **Performance**: Recalcular hilos solo cuando sea necesario
2. **IDs únicos**: `pinchada-${row}` y `camara-${row}`
3. **Scroll**: Container debe tener posición relativa
4. **Z-index**: SVG debe estar debajo de las tarjetas pero visible

## 🔄 Orden de Implementación

1. ✅ Crear backup
2. ✅ Agregar campo "Siguiente a" al modal
3. ✅ Crear BarrilSimpleCard
4. ✅ Crear ConnectionLines
5. ✅ Implementar layout de dos columnas
6. ✅ Agregar lógica de conexiones
7. ✅ Hacer header más compacto
8. ✅ Probar y ajustar

## 🐛 Problemas Encontrados

1. **Error de sintaxis**: Archivo quedó incompleto al usar strReplace
2. **Solución**: Restaurar backup y usar enfoque más cuidadoso

## 📋 Próximos Pasos

1. Implementar cambios uno por uno
2. Verificar compilación después de cada cambio
3. Probar en navegador
4. Ajustar según feedback

---

*Plan creado: 2026-05-05 18:35*

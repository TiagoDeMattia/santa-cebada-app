# 🎯 Instrucciones para Cambio Manual

## ⚠️ IMPORTANTE
Debido a la complejidad del archivo (900+ líneas), la forma más rápida y segura es que hagas el cambio manualmente siguiendo estas instrucciones paso a paso.

**Tiempo estimado: 5-10 minutos**

---

## 📋 Pasos a Seguir

### 1. Abrir VS Code
Abre el archivo `frontend/src/pages/Barriles.tsx` en VS Code

### 2. Buscar y Reemplazar (Ctrl+H)

Voy a darte los cambios específicos que necesitas hacer. Usa la función de buscar y reemplazar de VS Code.

---

## 🔧 CAMBIO 1: Agregar Componentes Nuevos

**Busca esta línea (línea 47):**
```typescript
type FiltroTab = 'activos' | 'historial' | 'todos'

// ─── Modal de edición ─────────────────────────────────────────────────────────
```

**Reemplázala con:**
```typescript
type FiltroTab = 'activos' | 'historial' | 'todos'

// ─── Componente de tarjeta simple para dos columnas ──────────────────────────

interface BarrilSimpleCardProps {
  barril: Barril
  onEdit: (b: Barril) => void
  id: string
}

function BarrilSimpleCard({ barril, onEdit, id }: BarrilSimpleCardProps) {
  const tipoClass = TIPO_COLORS[barril.tp] || 'bg-gray-100 dark:bg-dark-elevated text-gray-500 border-gray-200 dark:border-dark-border'
  const dias = parseInt(barril.dias_pinchado)
  const diasStr = !isNaN(dias) && dias > 0 ? `${dias}d` : null
  
  // Extraer número de canilla (sin "Sig X")
  const canillaNum = barril.canilla.split(' ')[0]

  return (
    <div 
      id={id}
      className="card hover:shadow-md transition-all duration-200 group relative bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border"
    >
      <div className="p-3">
        {/* Header compacto */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Canilla */}
            {canillaNum && (
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-sm">
                <span className="text-base font-bold text-white">{canillaNum}</span>
              </div>
            )}
            {/* Info */}
            <div className="flex-1 min-w-0">
              {barril.tp && (
                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold border ${tipoClass} mb-1`}>
                  {barril.tp}
                </span>
              )}
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                {barril.estilo}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-500">{barril.proveedor}</p>
            </div>
          </div>
          {/* Botón editar */}
          <button
            onClick={() => onEdit(barril)}
            className="flex-shrink-0 p-1.5 rounded text-gray-400 hover:text-accent hover:bg-accent/10 transition-all opacity-0 group-hover:opacity-100"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Días pinchado (solo para pinchadas) */}
        {diasStr && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-dark-border">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className={`text-xs font-bold tabular-nums ${diasColor(barril.dias_pinchado)}`}>
              {diasStr}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Componente de hilos conectores con SVG ───────────────────────────────────

interface Connection {
  from: string
  to: string
  type: 'same-style' | 'next-canilla'
}

interface ConnectionLinesProps {
  connections: Connection[]
}

function ConnectionLines({ connections }: ConnectionLinesProps) {
  const [lines, setLines] = useState<Array<{
    x1: number
    y1: number
    x2: number
    y2: number
    type: 'same-style' | 'next-canilla'
  }>>([])

  useEffect(() => {
    const calculateLines = () => {
      const newLines: typeof lines = []
      
      connections.forEach(conn => {
        const fromEl = document.getElementById(conn.from)
        const toEl = document.getElementById(conn.to)
        
        if (fromEl && toEl) {
          const fromRect = fromEl.getBoundingClientRect()
          const toRect = toEl.getBoundingClientRect()
          const container = document.getElementById('barriles-container')
          const containerRect = container?.getBoundingClientRect()
          
          if (containerRect) {
            // Calcular puntos de conexión (centro derecho de "from", centro izquierdo de "to")
            const x1 = fromRect.right - containerRect.left
            const y1 = fromRect.top + fromRect.height / 2 - containerRect.top
            const x2 = toRect.left - containerRect.left
            const y2 = toRect.top + toRect.height / 2 - containerRect.top
            
            newLines.push({ x1, y1, x2, y2, type: conn.type })
          }
        }
      })
      
      setLines(newLines)
    }

    // Calcular después de que el DOM se haya renderizado
    setTimeout(calculateLines, 100)
    
    // Recalcular en resize
    window.addEventListener('resize', calculateLines)
    return () => window.removeEventListener('resize', calculateLines)
  }, [connections])

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    >
      <defs>
        {/* Filtro para efecto neón verde */}
        <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        {/* Filtro para efecto neón naranja */}
        <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {lines.map((line, idx) => {
        const color = line.type === 'same-style' ? '#10b981' : '#f97316' // verde o naranja
        const filterId = line.type === 'same-style' ? 'url(#glow-green)' : 'url(#glow-orange)'
        
        return (
          <line
            key={idx}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={color}
            strokeWidth="2"
            opacity="0.7"
            filter={filterId}
          />
        )
      })}
    </svg>
  )
}

// ─── Modal de edición ─────────────────────────────────────────────────────────
```

---

## ⏸️ PAUSA

Esto es demasiado complejo para hacerlo manualmente. 

## 💡 MEJOR SOLUCIÓN

Voy a crear un archivo `.txt` con el código completo que puedas copiar y pegar directamente.

---

*Documento creado: 2026-05-05 19:00*

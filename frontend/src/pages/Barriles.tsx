import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RefreshCw, Beer, Calendar, ChevronDown, Edit2, Check,
  Clock, Package, Truck, Archive, User, ArrowUpDown, Zap, X, AlertTriangle,
} from 'lucide-react'
import { barrilesApi } from '../lib/api'
import type { Barril } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { useToast, ToastContainer } from '../components/ui/Toast'
import { getErrorMessage } from '../lib/utils'
import { Modal } from '../components/ui/Modal'

// ─── Hook para detectar tamaño de pantalla ───────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_COLORS: Record<string, string> = {
  A: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  B: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  C: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  D: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  E: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  GIN: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800',
  T: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
}

function todayDDMMYYYY(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function diasColor(dias: string): string {
  const n = parseInt(dias)
  if (isNaN(n) || n === 0) return 'text-gray-400 dark:text-gray-600'
  if (n <= 31) return 'text-success font-semibold'
  if (n <= 60) return 'text-warning font-semibold'
  return 'text-danger font-semibold'
}

function toInputDate(ddmmyyyy: string): string {
  if (!ddmmyyyy) return ''
  const p = ddmmyyyy.split('/')
  if (p.length !== 3) return ''
  return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
}

function fromInputDate(yyyymmdd: string): string {
  if (!yyyymmdd) return ''
  const p = yyyymmdd.split('-')
  if (p.length !== 3) return ''
  return `${p[2]}/${p[1]}/${p[0]}`
}

type FiltroTab = 'activos' | 'historial' | 'todos'

// ─── Componente de tarjeta simple para dos columnas ──────────────────────────

interface BarrilSimpleCardProps {
  barril: Barril
  onEdit: (b: Barril) => void
  id: string
  tipo: 'pinchada' | 'camara'
  personal: string[]
  sucursalId: string
  onSaved: (row: number, updated: Partial<Barril>) => void
  addToast: (type: 'success' | 'error' | 'warning', msg: string) => void
  connectionBadge?: string
  grouped?: boolean
  barrilesEnCamara?: Barril[]
}

function BarrilSimpleCard({ barril, onEdit, id, tipo, personal, sucursalId, onSaved, addToast, connectionBadge, grouped, barrilesEnCamara }: BarrilSimpleCardProps) {
  const tipoClass = TIPO_COLORS[barril.tp] || 'bg-gray-100 dark:bg-dark-elevated text-gray-500 border-gray-200 dark:border-dark-border'
  const dias = parseInt(barril.dias_pinchado)
  const diasStr = !isNaN(dias) && dias > 0 ? `${dias}d` : null
  const canillaNum = parseInt(barril.canilla.split(/\s+/)[0] || '0', 10) || ''
  const siguienteMatch = barril.canilla.match(/Sig\s+(\d+)/)
  const siguienteA = siguienteMatch ? siguienteMatch[1] : null

  const [showQuick, setShowQuick] = useState(false)
  const [quickPerson, setQuickPerson] = useState('')
  const [quickCanilla, setQuickCanilla] = useState('')
  const [saving, setSaving] = useState(false)
  const [pincharSiguiente, setPincharSiguiente] = useState(true)
  const [siguienteRow, setSiguienteRow] = useState<number | null>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const canillaRef = useRef<HTMLInputElement>(null)

  const openQuick = () => {
    setQuickPerson(personal[0] ?? '')
    setQuickCanilla('')
    setPincharSiguiente(true)
    setSiguienteRow(null)
    setShowQuick(true)
    setTimeout(() => {
      if (tipo === 'camara') canillaRef.current?.focus()
      else selectRef.current?.focus()
    }, 50)
  }

  const handleQuickSave = async () => {
    setSaving(true)
    try {
      const today = todayDDMMYYYY()
      if (tipo === 'camara') {
        await barrilesApi.actualizarBarril({ row: barril.row, sucursal_id: sucursalId, fecha_pinchado: today, nombre_pincho: quickPerson, canilla: quickCanilla, estilo: barril.estilo, reordenar_auto: true })
        onSaved(barril.row, { fecha_pinchado: today, nombre_pincho: quickPerson, canilla: quickCanilla, estado: 'Pinchada' })
        addToast('success', `${barril.estilo} pinchado hoy`)
      } else {
        await barrilesApi.actualizarBarril({ row: barril.row, sucursal_id: sucursalId, fecha_despinchado: today, nombre_despincho: quickPerson, canilla: '', mover_a_vacios: true })
        onSaved(barril.row, { fecha_despinchado: today, nombre_despincho: quickPerson, canilla: '', estado: 'Para Retirar' })
        if (pincharSiguiente && siguienteRow !== null) {
          const siguiente = barrilesEnCamara?.find(b => b.row === siguienteRow)
          if (siguiente) {
            const canilla = String(canillaNum)
            await barrilesApi.actualizarBarril({ row: siguiente.row, sucursal_id: sucursalId, fecha_pinchado: today, nombre_pincho: quickPerson, canilla, estilo: siguiente.estilo, reordenar_auto: true })
            onSaved(siguiente.row, { fecha_pinchado: today, nombre_pincho: quickPerson, canilla, estado: 'Pinchada' })
            addToast('success', `${barril.estilo} despinchado · ${siguiente.estilo} pinchado en C${canilla}`)
          } else {
            addToast('success', `${barril.estilo} despinchado hoy`)
          }
        } else {
          addToast('success', `${barril.estilo} despinchado hoy`)
        }
      }
      setShowQuick(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      addToast('error', msg)
    } finally {
      setSaving(false)
    }
  }

  const accentColor = grouped ? '' : tipo === 'pinchada' ? 'border-l-[3px] border-l-success' : 'border-l-[3px] border-l-accent'

  // Badge de prioridad de venta (solo para pinchadas con muchos días)
  const prioridad = tipo === 'pinchada' && dias > 61
    ? { label: 'Prioridad de venta: Alta', variant: 'danger' as const }
    : tipo === 'pinchada' && dias > 31
    ? { label: 'Prioridad de venta: Media', variant: 'warning' as const }
    : null

  return (
    <div
      id={id}
      className={`relative bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border
        ${grouped ? '' : 'rounded-xl'} ${accentColor} transition-all duration-150
        ${showQuick ? 'shadow-md' : 'hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-700'}`}
    >
      <div className="px-3 py-2 flex items-start gap-2.5">

        {/* Número de canilla */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold leading-none
          ${tipo === 'pinchada'
            ? 'bg-success/10 text-success dark:bg-success/15'
            : canillaNum
              ? 'bg-accent/10 text-accent dark:bg-accent/15'
              : 'bg-gray-100 dark:bg-dark-elevated text-gray-400'}`}>
          {canillaNum || <span className="text-xs">—</span>}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug">
            {barril.estilo}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {barril.tp && (
              <span className={`text-[11px] font-bold px-1.5 rounded border leading-[16px] ${tipoClass}`}>
                {barril.tp}
              </span>
            )}
            {barril.codigo && barril.codigo !== '-' && (
              <code className="text-[11px] font-mono bg-gray-100 dark:bg-dark-elevated text-gray-500 dark:text-gray-400 px-1.5 rounded leading-[16px]">
                {barril.codigo}
              </code>
            )}
            <span className="text-[11px] text-gray-400 dark:text-gray-600 uppercase tracking-wide">
              {barril.proveedor}
            </span>
          </div>

          {/* Badges */}
          {(connectionBadge || siguienteA || prioridad) && (
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {connectionBadge && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  {connectionBadge}
                </span>
              )}
              {siguienteA && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded-full border border-orange-200 dark:border-orange-800/50">
                  → C{siguienteA}
                </span>
              )}
              {prioridad?.variant === 'warning' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded-full border border-warning/30">
                  {prioridad.label}
                </span>
              )}
              {prioridad?.variant === 'danger' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-danger bg-danger/10 px-1.5 py-0.5 rounded-full border border-danger/30">
                  <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                  {prioridad.label}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Columna derecha: días + acciones */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5 self-stretch justify-between">
          {diasStr && tipo === 'pinchada' && (
            <span className={`text-xs font-bold tabular-nums ${diasColor(barril.dias_pinchado)}`}>
              {diasStr}
            </span>
          )}
          {!diasStr && <span />}

          {!showQuick ? (
            <div className="flex items-center gap-1">
              <button
                onClick={openQuick}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all
                  ${tipo === 'camara'
                    ? 'bg-success text-white hover:bg-success/90 shadow-sm'
                    : 'text-warning border border-warning/40 hover:bg-warning/10'}`}
                title={tipo === 'camara' ? 'Pinchar hoy' : 'Despinchar hoy'}
              >
                <Zap className="w-3 h-3" />
                <span className="hidden sm:inline">{tipo === 'camara' ? 'Pinchar' : 'Desp.'}</span>
              </button>
              <button
                onClick={() => onEdit(barril)}
                className="p-1 rounded-lg text-gray-300 dark:text-gray-700 hover:text-accent hover:bg-accent/10 transition-all"
                title="Editar"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowQuick(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-dark-elevated"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Panel acción rápida */}
      {showQuick && (
        <div className={`px-3 pb-3 pt-2 border-t flex flex-col gap-2
          ${tipo === 'camara' ? 'border-success/20 bg-success/5' : 'border-warning/20 bg-warning/5'}`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {tipo === 'camara' ? '⚡ Pinchar —' : '⚡ Despinchar —'} ¿Quién?
            </span>
            <div className="relative flex-1 min-w-[110px]">
              <select
                ref={selectRef}
                value={quickPerson}
                onChange={e => setQuickPerson(e.target.value)}
                className="input text-xs py-1 appearance-none pr-6 w-full"
                disabled={saving}
              >
                <option value="">— Sin asignar —</option>
                {personal.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            {tipo === 'camara' && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Canilla</span>
                <input
                  ref={canillaRef}
                  type="number"
                  min="1"
                  max="20"
                  value={quickCanilla}
                  onChange={e => setQuickCanilla(e.target.value)}
                  placeholder="#"
                  className="input text-xs py-1 w-14 text-center"
                  disabled={saving}
                />
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={handleQuickSave}
                disabled={saving}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-all
                  ${tipo === 'camara' ? 'bg-success hover:bg-success/90' : 'bg-warning hover:bg-warning/90'}
                  ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <Check className="w-3 h-3" />
                {saving ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>

          {/* Toggle + lista "Pinchar siguiente" — solo para despinchar */}
          {tipo === 'pinchada' && (
            <div className="border-t border-warning/10 pt-2 space-y-2">
              <button
                type="button"
                onClick={() => { setPincharSiguiente(v => !v); setSiguienteRow(null) }}
                className={`flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all
                  ${pincharSiguiente
                    ? 'bg-accent/10 border-accent/30 text-accent dark:text-accent'
                    : 'bg-gray-100 dark:bg-dark-elevated border-gray-200 dark:border-dark-border text-gray-400'}`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors
                  ${pincharSiguiente ? 'bg-accent border-accent' : 'border-gray-300 dark:border-gray-600'}`}>
                  {pincharSiguiente && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                Pinchar siguiente{canillaNum ? ` en C${canillaNum}` : ''}
              </button>

              {pincharSiguiente && (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {(!barrilesEnCamara || barrilesEnCamara.length === 0) ? (
                    <p className="text-xs text-gray-400 italic px-1">No hay birras en cámara disponibles.</p>
                  ) : barrilesEnCamara.map(b => {
                    const tc = TIPO_COLORS[b.tp] || 'bg-gray-100 text-gray-500 border-gray-200'
                    const selected = siguienteRow === b.row
                    return (
                      <button
                        key={b.row}
                        type="button"
                        onClick={() => setSiguienteRow(selected ? null : b.row)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs transition-all
                          ${selected
                            ? 'border-accent bg-accent/5 dark:bg-accent/10'
                            : 'border-gray-100 dark:border-dark-border hover:border-gray-200 dark:hover:border-dark-border bg-white dark:bg-dark-surface hover:bg-gray-50 dark:hover:bg-dark-elevated/50'}`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors
                          ${selected ? 'border-accent bg-accent' : 'border-gray-300 dark:border-gray-600'}`}>
                          {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 flex-1 truncate">{b.estilo}</span>
                        {b.tp && <span className={`text-[10px] font-bold px-1 rounded border leading-[14px] ${tc}`}>{b.tp}</span>}
                        {b.proveedor && <span className="text-[10px] text-gray-400 truncate hidden sm:block">{b.proveedor}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
  isDesktop: boolean
}

function ConnectionLines({ connections, isDesktop }: ConnectionLinesProps) {
  const [lines, setLines] = useState<Array<{
    x1: number; y1: number; x2: number; y2: number; type: 'same-style' | 'next-canilla'
  }>>([])

  useEffect(() => {
    // Solo calcular líneas en desktop
    if (!isDesktop) {
      setLines([])
      return
    }

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
            // Calcular puntos de conexión desde el borde derecho de la tarjeta izquierda
            // al borde izquierdo de la tarjeta derecha
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
    
    // Calcular después de que el DOM se haya renderizado y pintado
    let rafId1: number
    let rafId2: number
    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(calculateLines)
    })
    
    // Recalcular en resize con debounce
    let resizeTimer: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(calculateLines, 100)
    }
    
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(rafId1)
      cancelAnimationFrame(rafId2)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', handleResize)
    }
  }, [connections, isDesktop])

  // No renderizar nada en móvil
  if (!isDesktop || lines.length === 0) return null

  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" 
      style={{ zIndex: 10 }}
    >
      <defs>
        {/* Filtro de glow sutil verde */}
        <filter id="glow-green-premium" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur1"/>
          <feMerge>
            <feMergeNode in="blur1"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        {/* Filtro de glow sutil naranja */}
        <filter id="glow-orange-premium" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur1"/>
          <feMerge>
            <feMergeNode in="blur1"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        {/* Gradientes por línea — userSpaceOnUse evita el bounding box degenerado en líneas rectas */}
        {lines.map((line, idx) => {
          const color = line.type === 'same-style' ? '#10b981' : '#f97316'
          return (
            <linearGradient
              key={`grad-${idx}`}
              id={`gradient-line-${idx}`}
              x1={line.x1} y1={line.y1}
              x2={line.x2} y2={line.y2}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%"   stopColor={color} stopOpacity="0.3"/>
              <stop offset="50%"  stopColor={color} stopOpacity="0.9"/>
              <stop offset="100%" stopColor={color} stopOpacity="0.3"/>
            </linearGradient>
          )
        })}
      </defs>

      {lines.map((line, idx) => {
        const isGreen = line.type === 'same-style'
        const color = isGreen ? '#10b981' : '#f97316'
        const filterId = isGreen ? 'url(#glow-green-premium)' : 'url(#glow-orange-premium)'

        const dx = line.x2 - line.x1
        const dy = line.y2 - line.y1
        const controlPoint1X = line.x1 + dx * 0.3
        const controlPoint1Y = line.y1 + dy * 0.1
        const controlPoint2X = line.x1 + dx * 0.7
        const controlPoint2Y = line.y2 - dy * 0.1
        const path = `M ${line.x1} ${line.y1} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${line.x2} ${line.y2}`

        return (
          <g key={idx}>
            <path d={path} stroke={color} strokeWidth="2" fill="none" opacity="0.2" filter={filterId} />
            <path d={path} stroke={`url(#gradient-line-${idx})`} strokeWidth="2" fill="none" opacity="0.8" strokeLinecap="round" />
            <circle cx={line.x1} cy={line.y1} r="3.5" fill={color} opacity="0.7" filter={filterId} />
            <circle cx={line.x2} cy={line.y2} r="3.5" fill={color} opacity="0.7" filter={filterId} />
          </g>
        )
      })}
    </svg>
  )
}

// ─── Modal de edición ─────────────────────────────────────────────────────────

interface EditModalProps {
  barril: Barril
  personal: string[]
  sucursalId: string
  open: boolean
  onClose: () => void
  onSaved: (updated: Partial<Barril>) => void
}

function EditModal({ barril, personal, sucursalId, open, onClose, onSaved }: EditModalProps) {
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)

  const [fechaPinchado, setFechaPinchado] = useState(barril.fecha_pinchado)
  const [nombrePincho, setNombrePincho] = useState(barril.nombre_pincho)
  const [fechaDespinchado, setFechaDespinchado] = useState(barril.fecha_despinchado)
  const [nombreDespincho, setNombreDespincho] = useState(barril.nombre_despincho)
  const [fechaRetirado, setFechaRetirado] = useState(barril.fecha_retirado)
  const [canilla, setCanilla] = useState(barril.canilla)
  const [siguienteA, setSiguienteA] = useState('')

  useEffect(() => {
    setFechaPinchado(barril.fecha_pinchado)
    setNombrePincho(barril.nombre_pincho)
    setFechaDespinchado(barril.fecha_despinchado)
    setNombreDespincho(barril.nombre_despincho)
    setFechaRetirado(barril.fecha_retirado)
    const canillaBase = barril.canilla.split(' Sig ')[0]
    setCanilla(canillaBase)
    const match = barril.canilla.match(/Sig\s+(\d+)/)
    setSiguienteA(match ? match[1] : '')
  }, [barril])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Construir valor de canilla con "Sig X" si existe
      const canillaValue = siguienteA ? `${canilla} Sig ${siguienteA}`.trim() : canilla
      
      const payload: Parameters<typeof barrilesApi.actualizarBarril>[0] = { 
        row: barril.row,
        sucursal_id: sucursalId
      }
      if (fechaPinchado !== barril.fecha_pinchado) payload.fecha_pinchado = fechaPinchado || ''
      if (nombrePincho !== barril.nombre_pincho) payload.nombre_pincho = nombrePincho || ''
      if (fechaDespinchado !== barril.fecha_despinchado) payload.fecha_despinchado = fechaDespinchado || ''
      if (nombreDespincho !== barril.nombre_despincho) payload.nombre_despincho = nombreDespincho || ''
      if (fechaRetirado !== barril.fecha_retirado) payload.fecha_retirado = fechaRetirado || ''
      if (canillaValue !== barril.canilla) payload.canilla = canillaValue || ''

      await barrilesApi.actualizarBarril(payload)
      onSaved({ fechaPinchado, nombre_pincho: nombrePincho, fecha_despinchado: fechaDespinchado, nombre_despincho: nombreDespincho, fecha_retirado: fechaRetirado, canilla: canillaValue } as Partial<Barril>)
      addToast('success', `${barril.estilo} actualizado`)
      onClose()
    } catch (err) {
      addToast('error', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const tipoClass = TIPO_COLORS[barril.tp] || ''

  return (
    <Modal open={open} onClose={onClose} title="" size="md">
      <div className="space-y-5">
        {/* Header del barril */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {barril.tp && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${tipoClass}`}>
                  {barril.tp}
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-500">{barril.proveedor}</span>
              {barril.codigo && barril.codigo !== '-' && (
                <span className="font-mono text-xs bg-gray-100 dark:bg-dark-elevated px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                  {barril.codigo}
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{barril.estilo}</h2>
          </div>
        </div>

        {/* Estado (solo lectura) + Canilla + Siguiente a */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Estado</label>
            <div className="input text-sm bg-gray-50 dark:bg-dark-elevated text-gray-500 dark:text-gray-500 cursor-not-allowed">
              {barril.estado}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-600">Calculado automáticamente</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Canilla N°</label>
            <input
              type="text"
              value={canilla}
              onChange={e => setCanilla(e.target.value)}
              placeholder="ej: 5"
              className="input text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Siguiente a</label>
            <input
              type="text"
              value={siguienteA}
              onChange={e => setSiguienteA(e.target.value)}
              placeholder="ej: 9"
              className="input text-sm"
            />
            <p className="text-xs text-gray-400 dark:text-gray-600">Canilla destino</p>
          </div>
        </div>

        {/* Fechas */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Fechas</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Pinchado
              </label>
              <input type="date" value={toInputDate(fechaPinchado)} onChange={e => setFechaPinchado(fromInputDate(e.target.value))} className="input text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Despinchado
              </label>
              <input type="date" value={toInputDate(fechaDespinchado)} onChange={e => setFechaDespinchado(fromInputDate(e.target.value))} className="input text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Retirado
              </label>
              <input type="date" value={toInputDate(fechaRetirado)} onChange={e => setFechaRetirado(fromInputDate(e.target.value))} className="input text-sm" />
            </div>
          </div>
        </div>

        {/* Personal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Quién pinchó */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <User className="w-3 h-3" /> Quién pinchó
            </label>
            <div className="relative">
              <select value={nombrePincho} onChange={e => setNombrePincho(e.target.value)} className="input appearance-none pr-8 text-sm">
                <option value="">— Sin asignar —</option>
                {personal.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Quién despinchó */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <User className="w-3 h-3" /> Quién despinchó
            </label>
            <div className="relative">
              <select value={nombreDespincho} onChange={e => setNombreDespincho(e.target.value)} className="input appearance-none pr-8 text-sm">
                <option value="">— Sin asignar —</option>
                {personal.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-dark-border">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <><Spinner size="sm" className="text-white" /> Guardando...</> : <><Check className="w-4 h-4" /> Guardar</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Tarjeta de barril ───────────────────────────────────────────────────────

function BarrilCard({ barril, onEdit }: { barril: Barril; onEdit: (b: Barril) => void }) {
  const tipoClass = TIPO_COLORS[barril.tp] || 'bg-gray-100 dark:bg-dark-elevated text-gray-500 border-gray-200 dark:border-dark-border'
  const dias = parseInt(barril.dias_pinchado)
  const diasStr = !isNaN(dias) && dias > 0 ? `${dias}d` : null

  // Determinar el color del borde según el estado
  const borderColor = barril.estado === 'Pinchada' 
    ? 'border-l-4 border-l-success' 
    : 'border-l-4 border-l-accent'

  return (
    <div className={`card hover:shadow-lg transition-all duration-200 group ${borderColor} overflow-hidden`}>
      {/* Header con canilla destacada */}
      <div className="flex items-start justify-between p-4 pb-3 bg-gradient-to-br from-surface-secondary/30 to-transparent dark:from-dark-elevated/30">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Canilla grande y destacada */}
          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent/80 dark:from-accent/90 dark:to-accent/70 flex items-center justify-center shadow-md">
            {barril.canilla ? (
              <span className="text-xl font-bold text-white">{barril.canilla}</span>
            ) : (
              <span className="text-sm text-white/60">—</span>
            )}
          </div>

          {/* Info principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {barril.tp && (
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${tipoClass} shadow-sm`}>
                  {barril.tp}
                </span>
              )}
              <span className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wide">
                {barril.proveedor}
              </span>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
              {barril.estilo}
            </h3>
            {barril.codigo && barril.codigo !== '-' && (
              <span className="inline-block mt-1 font-mono text-xs bg-gray-100 dark:bg-dark-elevated px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                {barril.codigo}
              </span>
            )}
          </div>
        </div>

        {/* Botón editar */}
        <button
          onClick={() => onEdit(barril)}
          className="flex-shrink-0 p-2 rounded-lg text-gray-400 dark:text-gray-600 hover:text-accent hover:bg-accent/10 transition-all opacity-0 group-hover:opacity-100"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      {/* Contenido */}
      <div className="p-4 pt-3 space-y-3">
        {/* Estado y días */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              barril.estado === 'Pinchada' ? 'bg-success animate-pulse' : 'bg-accent'
            }`} />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {barril.estado}
            </span>
          </div>
          {diasStr && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className={`text-sm font-bold tabular-nums ${diasColor(barril.dias_pinchado)}`}>
                {diasStr}
              </span>
            </div>
          )}
        </div>

        {/* Fechas e información */}
        <div className="space-y-2 text-sm">
          {/* Pinchado */}
          {barril.fecha_pinchado ? (
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-surface-secondary/50 dark:bg-dark-elevated/50">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-success" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Pinchado</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {barril.fecha_pinchado}
                </div>
                {barril.nombre_pincho && (
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {barril.nombre_pincho}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-50 dark:bg-dark-elevated/30">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-300 dark:text-gray-700" />
                <span className="text-xs font-medium text-gray-400 dark:text-gray-600">Sin pinchar</span>
              </div>
            </div>
          )}

          {/* Despinchado */}
          {barril.fecha_despinchado && (
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-surface-secondary/50 dark:bg-dark-elevated/50">
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Despinchado</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {barril.fecha_despinchado}
                </div>
                {barril.nombre_despincho && (
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {barril.nombre_despincho}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Retirado */}
          {barril.fecha_retirado && (
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-surface-secondary/50 dark:bg-dark-elevated/50">
              <div className="flex items-center gap-2">
                <Archive className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Retirado</span>
              </div>
              <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                {barril.fecha_retirado}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sección con grid de tarjetas ────────────────────────────────────────────

function BarrilSection({
  title, icon: Icon, color, barriles, onEdit, defaultOpen = true, description
}: {
  title: string; icon: React.ElementType; color: string
  barriles: Barril[]; onEdit: (b: Barril) => void; defaultOpen?: boolean; description?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (barriles.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Header de sección */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shadow-md`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {title}
              <span className="text-sm px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-dark-elevated text-gray-600 dark:text-gray-400 font-semibold">
                {barriles.length}
              </span>
            </h2>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Grid de tarjetas */}
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {barriles.map(b => <BarrilCard key={b.row} barril={b} onEdit={onEdit} />)}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function Barriles() {
  const { toasts, addToast, removeToast } = useToast()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const [barriles, setBarriles] = useState<Barril[]>([])
  const [personal, setPersonal] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [reordenando, setReordenando] = useState(false)
  const [tab, setTab] = useState<FiltroTab>('activos')
  const [editBarril, setEditBarril] = useState<Barril | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async (filtro: FiltroTab) => {
    setLoading(true)
    try {
      const apiFilter = filtro === 'todos' ? undefined : filtro
      const sucursal_id = '1'
      const [data, pers] = await Promise.all([
        barrilesApi.listar(apiFilter, sucursal_id),
        personal.length === 0 ? barrilesApi.personal(sucursal_id) : Promise.resolve(personal),
      ])
      setBarriles(data)
      if (personal.length === 0) setPersonal(pers)
    } catch (err) {
      addToast('error', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [addToast, personal])

  useEffect(() => { cargar(tab) }, [tab]) // eslint-disable-line

  const handleReordenar = async () => {
    setReordenando(true)
    try {
      await barrilesApi.reordenar()
      addToast('success', `Sheet reordenado correctamente`)
      await cargar(tab)
    } catch (err) {
      addToast('error', getErrorMessage(err))
    } finally {
      setReordenando(false)
    }
  }

  const handleSaved = (updated: Partial<Barril>) => {
    setBarriles(prev => prev.map(b => b.row === editBarril?.row ? { ...b, ...updated } : b))
    setEditBarril(null)
  }

  const handleQuickSaved = (row: number, updated: Partial<Barril>) => {
    setBarriles(prev => prev.map(b => b.row === row ? { ...b, ...updated } : b))
    cargar(tab)
  }

  const filtrados = barriles.filter(b => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      b.estilo.toLowerCase().includes(q) ||
      b.proveedor.toLowerCase().includes(q) ||
      b.codigo.toLowerCase().includes(q) ||
      (b.canilla ?? '').toLowerCase().includes(q)
    )
  })

  const pinchadas = filtrados.filter(b => b.estado === 'Pinchada')
    .sort((a, b) => {
      const ca = parseInt(a.canilla) || 999
      const cb = parseInt(b.canilla) || 999
      return ca - cb
    })
  const enCamara = barriles.filter(b => b.estado === 'En Camara')
  const paraRetirar = filtrados.filter(b => b.estado === 'Para Retirar')
  const retiradas = filtrados.filter(b => b.estado === 'Retirada')

  const TABS = [
    { key: 'activos' as FiltroTab, label: 'Activos', icon: Beer, count: barriles.filter(b => ['Pinchada','En Camara'].includes(b.estado)).length },
    { key: 'historial' as FiltroTab, label: 'Historial', icon: Archive, count: barriles.filter(b => ['Para Retirar','Retirada'].includes(b.estado)).length },
    { key: 'todos' as FiltroTab, label: 'Todos', icon: Package, count: barriles.length },
  ]

  const sucursalNombre = 'Recoleta'
  const sucursalId = '1'

  // Calcular conexiones para hilos
  const connections: Connection[] = []
  if (tab === 'activos') {
    // Verde: Mismo estilo exacto
    pinchadas.forEach(p => {
      enCamara.forEach(c => {
        if (p.estilo === c.estilo) {
          connections.push({ from: `pinchada-${p.row}`, to: `camara-${c.row}`, type: 'same-style' })
        }
      })
    })
    
    // Naranja: Siguiente a
    pinchadas.forEach(p => {
      const canillaNum = parseInt(p.canilla.split(/\s+/)[0] || '0', 10).toString()
      enCamara.forEach(c => {
        const match = c.canilla.match(/Sig\s+(\d+)/)
        if (match && match[1] === canillaNum) {
          connections.push({ from: `pinchada-${p.row}`, to: `camara-${c.row}`, type: 'next-canilla' })
        }
      })
    })
  }

  return (
    <div className="min-h-screen w-full animate-fade-in">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {/* Container con máximo aprovechamiento horizontal */}
      <div className="w-full px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="max-w-[2000px] mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Barriles</h1>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Gestión de barriles · {sucursalNombre}</p>
        </div>
        <div className="flex items-center gap-2">

          <button onClick={handleReordenar} disabled={reordenando || loading} className="btn-secondary text-xs gap-1.5 py-1.5 px-3">
            {reordenando ? <Spinner size="sm" /> : <ArrowUpDown className="w-3.5 h-3.5" />}
            Reordenar
          </button>
          <button onClick={() => cargar(tab)} disabled={loading} className="btn-ghost text-xs gap-1.5 py-1.5 px-3">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabs + búsqueda */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-surface-secondary dark:bg-dark-elevated p-1 rounded-xl">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                tab === key
                  ? 'bg-white dark:bg-dark-surface shadow-soft text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
              {!loading && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  tab === key ? 'bg-accent/10 text-accent' : 'bg-gray-200 dark:bg-dark-border text-gray-500'
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar estilo, proveedor, canilla..."
          className="input text-xs w-full sm:w-60 py-1.5"
        />
      </div>

      {/* Leyenda días */}
      <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-600">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Días pinchado:</span>
        <span className="text-success font-semibold">≤31 días</span>
        <span className="text-warning font-semibold">32–60 días</span>
        <span className="text-danger font-semibold">+61 días</span>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500 dark:text-gray-500">Cargando desde Google Sheets...</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Tab Activos */}
          {tab === 'activos' && (() => {
            // Calcular badges de conexión inline (reemplazan los hilos SVG)
            const estilosPinchados = new Set(pinchadas.map(p => p.estilo))
            const estilosEnCamara = new Set(enCamara.map(c => c.estilo))
            const pinichadasConBackup = new Set(
              pinchadas.filter(p => estilosEnCamara.has(p.estilo)).map(p => p.row)
            )
            const camaraConPinchada = new Set(
              enCamara.filter(c => estilosPinchados.has(c.estilo)).map(c => c.row)
            )

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 items-start">

                {/* Columna izquierda: Pinchadas */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-dark-border">
                    <div className="w-2 h-6 rounded-full bg-success" />
                    <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      En canilla
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold">
                      {pinchadas.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pinchadas.map(b => (
                      <BarrilSimpleCard
                        key={b.row}
                        barril={b}
                        onEdit={setEditBarril}
                        id={`pinchada-${b.row}`}
                        tipo="pinchada"
                        personal={personal}
                        sucursalId={sucursalId}
                        onSaved={handleQuickSaved}
                        addToast={addToast}
                        connectionBadge={pinichadasConBackup.has(b.row) ? 'backup en cámara' : undefined}
                        barrilesEnCamara={enCamara}
                      />
                    ))}
                    {pinchadas.length === 0 && (
                      <div className="text-center py-10 text-sm text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-100 dark:border-dark-border rounded-xl">
                        No hay barriles en canilla
                      </div>
                    )}
                  </div>
                </div>

                {/* Columna derecha: En Cámara */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-dark-border">
                    <div className="w-2 h-6 rounded-full bg-accent" />
                    <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      En cámara
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
                      {enCamara.length}
                    </span>
                  </div>
                  {/* Agrupado por estilo */}
                  {(() => {
                    // Agrupar por estilo, ordenar: grupos con más barriles primero, luego alfabético
                    const grupos = Object.entries(
                      enCamara.reduce<Record<string, Barril[]>>((acc, b) => {
                        ;(acc[b.estilo] ??= []).push(b)
                        return acc
                      }, {})
                    ).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

                    if (grupos.length === 0) return (
                      <div className="text-center py-10 text-sm text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-100 dark:border-dark-border rounded-xl">
                        No hay barriles en cámara
                      </div>
                    )

                    return (
                      <div className="space-y-3">
                        {grupos.map(([estilo, barriles]) => {
                          const esGrupo = barriles.length > 1
                          return (
                            <div key={estilo}>
                              {esGrupo && (
                                <div className="flex items-center gap-2 mb-1.5 px-1">
                                  <span className="text-[10px] font-bold text-accent/70 dark:text-accent/60 uppercase tracking-widest truncate">
                                    {estilo}
                                  </span>
                                  <span className="flex-shrink-0 text-[10px] font-semibold text-white bg-accent/70 dark:bg-accent/60 px-1.5 py-0 rounded-full leading-4">
                                    ×{barriles.length}
                                  </span>
                                  <div className="flex-1 h-px bg-accent/20 dark:bg-accent/15" />
                                </div>
                              )}
                              <div className={esGrupo
                                ? 'rounded-xl overflow-hidden border border-emerald-200/60 dark:border-emerald-800/30 border-l-[3px] border-l-emerald-400/50 dark:border-l-emerald-500/40 divide-y divide-emerald-100/60 dark:divide-emerald-900/20'
                                : ''
                              }>
                                {barriles.map(b => (
                                  <BarrilSimpleCard
                                    key={b.row}
                                    barril={b}
                                    onEdit={setEditBarril}
                                    id={`camara-${b.row}`}
                                    tipo="camara"
                                    personal={personal}
                                    sucursalId={sucursalId}
                                    onSaved={handleQuickSaved}
                                    addToast={addToast}
                                    connectionBadge={camaraConPinchada.has(b.row) ? 'Estilo en Cartelería' : undefined}
                                    grouped={esGrupo}
                                  />
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>

              </div>
            )
          })()}

          {/* Tab Historial: Lista simple */}
          {tab === 'historial' && (
            <>
              <BarrilSection 
                title="Para Retirar" 
                icon={Truck} 
                color="bg-gradient-to-br from-warning to-warning/80" 
                barriles={paraRetirar} 
                onEdit={setEditBarril} 
                defaultOpen 
                description="Barriles listos para retirar"
              />
              <BarrilSection 
                title="Retiradas" 
                icon={Archive} 
                color="bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700" 
                barriles={retiradas} 
                onEdit={setEditBarril} 
                defaultOpen={false} 
                description="Historial de barriles retirados"
              />
            </>
          )}

          {/* Tab Todos: Lista simple con todas las secciones */}
          {tab === 'todos' && (
            <>
              <BarrilSection 
                title="Pinchadas" 
                icon={Beer} 
                color="bg-gradient-to-br from-success to-success/80" 
                barriles={pinchadas} 
                onEdit={setEditBarril} 
                defaultOpen 
                description="Barriles actualmente en canilla"
              />
              <BarrilSection 
                title="En Cámara" 
                icon={Package} 
                color="bg-gradient-to-br from-accent to-accent/80" 
                barriles={enCamara} 
                onEdit={setEditBarril} 
                defaultOpen 
                description="Barriles disponibles sin pinchar"
              />
              <BarrilSection 
                title="Para Retirar" 
                icon={Truck} 
                color="bg-gradient-to-br from-warning to-warning/80" 
                barriles={paraRetirar} 
                onEdit={setEditBarril} 
                defaultOpen={false} 
                description="Barriles listos para retirar"
              />
              <BarrilSection 
                title="Retiradas" 
                icon={Archive} 
                color="bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700" 
                barriles={retiradas} 
                onEdit={setEditBarril} 
                defaultOpen={false} 
                description="Historial de barriles retirados"
              />
            </>
          )}

          {filtrados.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-dark-elevated flex items-center justify-center">
                <Beer className="w-8 h-8 text-gray-300 dark:text-gray-700" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sin barriles para mostrar</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Intenta cambiar los filtros o la búsqueda</p>
              </div>
            </div>
          )}
        </div>
      )}

      {editBarril && (
        <EditModal
          barril={editBarril}
          personal={personal}
          sucursalId="1"
          open={!!editBarril}
          onClose={() => setEditBarril(null)}
          onSaved={handleSaved}
        />
      )}
        </div>
      </div>
    </div>
  )
}

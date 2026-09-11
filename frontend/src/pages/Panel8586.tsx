import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  AlertTriangle, PackageX, Package2, Search,
  RefreshCw, X, AlertCircle, Clock, CheckCircle2, Pencil, Star,
} from 'lucide-react'
import { panel8586Api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

interface ProductoAlerta {
  id: number | null
  nombre: string
  codigo: string
  unidad_stock: string | null
  rubro_nombre: string | null
  rubro_id: number | null
  tipo: number | null
  updated_at: string | null
  updated_by: string | null
  nota: string | null
  priorizado?: boolean
  source: 'stock' | 'nucleo'
}

function pKey(p: ProductoAlerta): string {
  return p.source === 'nucleo' ? `nucleo-${p.codigo}` : `stock-${p.id}`
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const dt = new Date(dateStr.replace(' ', 'T') + 'Z')
  const diff = Date.now() - dt.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

// ─── Alert card (top sections) ───────────────────────────────────────────────

function AlertCardBig({ p, onClear, onEditNota, onPriorizar }: {
  p: ProductoAlerta
  onClear: (p: ProductoAlerta) => void
  onEditNota: (p: ProductoAlerta) => void
  onPriorizar: (p: ProductoAlerta) => void
}) {
  const is86 = p.tipo === 86
  return (
    <div className={`relative flex flex-col gap-1.5 p-4 rounded-xl border-2 shadow-sm transition-all ${
      p.priorizado
        ? 'ring-2 ring-purple-400 dark:ring-purple-500 ring-offset-1'
        : ''
    } ${
      is86
        ? 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-700/50'
        : 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700/50'
    }`}>
      <button
        onClick={() => onClear(p)}
        title="Marcar como OK"
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-1.5">
        <span className={`w-fit text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
          is86 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
        }`}>
          {is86 ? '86' : '85'}
        </span>
        {p.priorizado && (
          <span className="text-[9px] font-black px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 uppercase tracking-wide flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5" fill="currentColor" /> PRIORIZADO
          </span>
        )}
        {p.source === 'nucleo' && (
          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            NC
          </span>
        )}
      </div>

      <p className="font-bold text-sm text-gray-800 dark:text-gray-100 pr-5 leading-tight">{p.nombre}</p>

      {p.rubro_nombre && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{p.rubro_nombre}</span>
      )}

      {/* Nota de stock */}
      <button
        onClick={() => onEditNota(p)}
        className={`group flex items-start gap-1.5 text-left w-full mt-0.5 rounded-lg px-2 py-1.5 transition-colors ${
          p.nota
            ? is86
              ? 'bg-red-100/60 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
              : 'bg-amber-100/60 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
            : is86
              ? 'hover:bg-red-100/40 dark:hover:bg-red-900/10'
              : 'hover:bg-amber-100/40 dark:hover:bg-amber-900/10'
        }`}
        title="Editar nota"
      >
        <Pencil className={`w-3 h-3 mt-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity ${is86 ? 'text-red-500' : 'text-amber-500'}`} />
        <span className={`text-xs leading-snug ${
          p.nota
            ? is86
              ? 'text-red-800 dark:text-red-300 font-medium'
              : 'text-amber-800 dark:text-amber-300 font-medium'
            : is86
              ? 'text-red-400 dark:text-red-600 italic'
              : 'text-amber-400 dark:text-amber-600 italic'
        }`}>
          {p.nota || 'Agregar nota...'}
        </span>
      </button>

      <div className="flex items-center gap-2 mt-0.5">
        {p.updated_at && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(p.updated_at)}
          </span>
        )}
        {p.updated_by && (
          <span className="text-xs text-gray-400 truncate ml-1">· {p.updated_by}</span>
        )}
      </div>

      {/* Priorizar venta */}
      <button
        onClick={() => onPriorizar(p)}
        className={`mt-0.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
          p.priorizado
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50'
            : 'bg-white/60 dark:bg-dark-elevated text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 border border-gray-200 dark:border-dark-border'
        }`}
      >
        <Star className="w-3 h-3" fill={p.priorizado ? 'currentColor' : 'none'} />
        {p.priorizado ? 'Priorizado' : 'Priorizar venta'}
      </button>
    </div>
  )
}

// ─── Nota modal ───────────────────────────────────────────────────────────────

function NotaModal({ p, targetTipo, onConfirm, onClose }: {
  p: ProductoAlerta
  targetTipo: number
  onConfirm: (nota: string | null) => void
  onClose: () => void
}) {
  const is86 = targetTipo === 86
  const [nota, setNota] = useState(p.nota ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onConfirm(nota.trim() || null) }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[11px] font-black px-1.5 py-0.5 rounded text-white uppercase tracking-wider ${is86 ? 'bg-red-500' : 'bg-amber-500'}`}>
            {is86 ? '86' : '85'}
          </span>
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Nota de stock</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">{p.nombre}</p>

        <textarea
          ref={textareaRef}
          className="input w-full resize-none text-sm"
          rows={3}
          placeholder="ej: no hay más hasta el jueves..."
          value={nota}
          onChange={e => setNota(e.target.value)}
          onKeyDown={handleKey}
        />

        <div className="flex gap-2 mt-3">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-lg bg-gray-100 dark:bg-dark-elevated text-sm font-semibold text-gray-600 dark:text-gray-400 hover:opacity-80 transition-opacity"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(nota.trim() || null)}
            className={`flex-1 h-9 rounded-lg text-white text-sm font-bold transition-colors ${is86 ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Product row (full list) ──────────────────────────────────────────────────

function ProductRow({ p, onSet, onOpenNota, onPriorizar, isPending }: {
  p: ProductoAlerta
  onSet: (p: ProductoAlerta, tipo: number | null) => void
  onOpenNota: (p: ProductoAlerta, targetTipo: number) => void
  onPriorizar: (p: ProductoAlerta) => void
  isPending: boolean
}) {
  const isOk = !p.tipo
  const is85 = p.tipo === 85
  const is86 = p.tipo === 86

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
      isPending ? 'opacity-50' : ''
    } ${
      p.priorizado
        ? 'ring-1 ring-purple-300 dark:ring-purple-700'
        : ''
    } ${
      is86 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30' :
      is85 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30' :
      'bg-white dark:bg-dark-surface border-gray-100 dark:border-dark-border'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{p.nombre}</p>
          {p.source === 'nucleo' && (
            <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              NC
            </span>
          )}
          {p.priorizado && (
            <Star className="shrink-0 w-3 h-3 text-purple-500" fill="currentColor" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {p.rubro_nombre && (
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{p.rubro_nombre}</span>
          )}
          {(is85 || is86) && p.nota && (
            <span className={`text-xs truncate italic ${is86 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>"{p.nota}"</span>
          )}
          {!isOk && p.updated_at && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5 shrink-0">
              <Clock className="w-3 h-3" />{timeAgo(p.updated_at)}
            </span>
          )}
          {!isOk && p.updated_by && (
            <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">· {p.updated_by}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          disabled={isPending || isOk}
          onClick={() => !isOk && onSet(p, null)}
          className={`w-12 h-9 rounded-lg text-xs font-bold transition-all ${
            isOk
              ? 'bg-green-500 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400 cursor-pointer'
          }`}
        >OK</button>

        <button
          disabled={isPending}
          onClick={() => is85 ? onSet(p, null) : onOpenNota(p, 85)}
          className={`w-12 h-9 rounded-lg text-xs font-bold transition-all ${
            is85
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 hover:bg-amber-100 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-400 cursor-pointer'
          }`}
        >85</button>

        <button
          disabled={isPending}
          onClick={() => is86 ? onSet(p, null) : onOpenNota(p, 86)}
          className={`w-12 h-9 rounded-lg text-xs font-bold transition-all ${
            is86
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-400 cursor-pointer'
          }`}
        >86</button>

        <button
          disabled={isPending}
          onClick={() => onPriorizar(p)}
          title={p.priorizado ? 'Quitar prioridad' : 'Priorizar venta'}
          className={`w-9 h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
            p.priorizado
              ? 'bg-purple-500 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 hover:bg-purple-100 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer'
          }`}
        >
          <Star className="w-3.5 h-3.5" fill={p.priorizado ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'ok' | '85' | '86' | 'priorizado'

export default function Panel8586() {
  const { user } = useAuth()
  const [productos, setProductos] = useState<ProductoAlerta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [filterRubro, setFilterRubro] = useState<string>('all')
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [notaModal, setNotaModal] = useState<{ p: ProductoAlerta; targetTipo: number } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await panel8586Api.getAlertas()
      setProductos(data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Refresh when the user returns to this tab/panel
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const rubros = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const p of productos) {
      const r = p.rubro_nombre ?? 'Sin Rubro'
      if (!seen.has(r)) { seen.add(r); list.push(r) }
    }
    return list.sort()
  }, [productos])

  const items86 = useMemo(() => productos.filter(p => p.tipo === 86), [productos])
  const items85 = useMemo(() => productos.filter(p => p.tipo === 85), [productos])
  const itemsOk = useMemo(() => productos.filter(p => !p.tipo), [productos])
  const itemsPriorizado = useMemo(() => productos.filter(p => p.priorizado), [productos])

  const filtered = useMemo(() => {
    return productos.filter(p => {
      if (filterStatus === 'ok'         && p.tipo !== null)  return false
      if (filterStatus === '85'         && p.tipo !== 85)    return false
      if (filterStatus === '86'         && p.tipo !== 86)    return false
      if (filterStatus === 'priorizado' && !p.priorizado)    return false
      if (filterRubro !== 'all'  && (p.rubro_nombre ?? 'Sin Rubro') !== filterRubro) return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.nombre.toLowerCase().includes(q) && !(p.rubro_nombre ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [productos, filterStatus, filterRubro, search])

  const handleSet = useCallback(async (p: ProductoAlerta, tipo: number | null, nota?: string | null) => {
    const key = pKey(p)
    setPendingIds(prev => new Set(prev).add(key))
    try {
      const displayName = user?.nombre || user?.username
      if (p.source === 'nucleo') {
        await panel8586Api.setAlertaNucleo(p.codigo, p.nombre, tipo, displayName, nota)
      } else {
        await panel8586Api.setAlerta(p.id!, tipo, displayName, nota)
      }
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
      setProductos(prev => prev.map(prod =>
        pKey(prod) === key
          ? { ...prod, tipo, updated_at: tipo ? now : null, updated_by: tipo ? (displayName ?? null) : null, nota: tipo ? (nota ?? prod.nota) : null }
          : prod
      ))
    } catch {}
    setPendingIds(prev => { const n = new Set(prev); n.delete(key); return n })
  }, [user])

  const handlePriorizar = useCallback(async (p: ProductoAlerta) => {
    const key = pKey(p)
    const newVal = !p.priorizado
    setPendingIds(prev => new Set(prev).add(key))
    try {
      const displayName = user?.nombre || user?.username
      if (p.source === 'nucleo') {
        await panel8586Api.setPriorizadoNucleo(p.codigo, p.nombre, newVal, displayName)
      } else {
        await panel8586Api.setPriorizado(p.id!, newVal, displayName)
      }
      setProductos(prev => prev.map(prod =>
        pKey(prod) === key ? { ...prod, priorizado: newVal } : prod
      ))
    } catch {}
    setPendingIds(prev => { const n = new Set(prev); n.delete(key); return n })
  }, [user])

  const handleNota = useCallback((nota: string | null) => {
    if (!notaModal) return
    const { p, targetTipo } = notaModal
    setNotaModal(null)
    handleSet(p, targetTipo, nota)
  }, [notaModal, handleSet])

  const STATUS_FILTERS: { val: StatusFilter; label: string; count?: number; activeClass: string }[] = [
    { val: 'all',        label: 'Todos',           activeClass: 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900' },
    { val: '86',         label: '86 — Sin stock',  count: items86.length,        activeClass: 'bg-red-500 text-white' },
    { val: '85',         label: '85 — Bajo stock', count: items85.length,        activeClass: 'bg-amber-500 text-white' },
    { val: 'ok',         label: 'OK',              count: itemsOk.length,        activeClass: 'bg-green-500 text-white' },
    { val: 'priorizado', label: '★ Priorizado',    count: itemsPriorizado.length, activeClass: 'bg-purple-500 text-white' },
  ]

  return (
    <div className="space-y-6 pb-8">

      {notaModal && (
        <NotaModal
          p={notaModal.p}
          targetTipo={notaModal.targetTipo}
          onConfirm={handleNota}
          onClose={() => setNotaModal(null)}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Panel 85 & 86
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Alertas de stock en tiempo real
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2.5 rounded-xl border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-elevated text-gray-400 transition-all"
          title="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className={`p-4 rounded-2xl text-white relative overflow-hidden transition-all ${
          items86.length > 0 ? 'bg-red-500 shadow-lg shadow-red-500/25' : 'bg-red-300 dark:bg-red-900/40'
        }`}>
          {items86.length > 0 && (
            <div className="absolute inset-0 bg-gradient-to-br from-red-400/30 to-transparent animate-pulse pointer-events-none" />
          )}
          <div className="relative flex items-start justify-between mb-3">
            <PackageX className="w-5 h-5 opacity-80" />
            <span className="text-4xl font-black leading-none tabular-nums">{items86.length}</span>
          </div>
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-75">Sin stock</p>
            <p className="text-2xl font-black leading-none">86</p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl text-white transition-all ${
          items85.length > 0 ? 'bg-amber-500 shadow-lg shadow-amber-500/25' : 'bg-amber-300 dark:bg-amber-900/40'
        }`}>
          <div className="flex items-start justify-between mb-3">
            <AlertCircle className="w-5 h-5 opacity-80" />
            <span className="text-4xl font-black leading-none tabular-nums">{items85.length}</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-75">Bajo stock</p>
            <p className="text-2xl font-black leading-none">85</p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl text-white transition-all ${
          items86.length === 0 && items85.length === 0 && !loading
            ? 'bg-green-500 shadow-lg shadow-green-500/25'
            : 'bg-green-400/70 dark:bg-green-900/40'
        }`}>
          <div className="flex items-start justify-between mb-3">
            <Package2 className="w-5 h-5 opacity-80" />
            <span className="text-4xl font-black leading-none tabular-nums">{itemsOk.length}</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-75">Disponible</p>
            <p className="text-2xl font-black leading-none">OK</p>
          </div>
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-dark-elevated animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {/* ── All clear ──────────────────────────────────────────────── */}
          {items86.length === 0 && items85.length === 0 && (
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-green-50 dark:bg-green-900/10 border-2 border-green-200 dark:border-green-800/30">
              <div className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center shrink-0 shadow-md shadow-green-500/30">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-black text-green-800 dark:text-green-300 text-lg">Todo en orden</p>
                <p className="text-sm text-green-600 dark:text-green-500 mt-0.5">
                  No hay alertas de stock activas
                </p>
              </div>
            </div>
          )}

          {/* ── 86 Critical ────────────────────────────────────────────── */}
          {items86.length > 0 && (
            <section>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">
                  Crítico — Sin Stock (86)
                </h2>
                <span className="ml-auto text-xs font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                  {items86.length} {items86.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {items86.map(p => (
                  <AlertCardBig
                    key={pKey(p)} p={p}
                    onClear={prod => handleSet(prod, null)}
                    onEditNota={prod => setNotaModal({ p: prod, targetTipo: 86 })}
                    onPriorizar={handlePriorizar}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── 85 Warning ─────────────────────────────────────────────── */}
          {items85.length > 0 && (
            <section>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h2 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                  Atención — Bajo Stock (85)
                </h2>
                <span className="ml-auto text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                  {items85.length} {items85.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {items85.map(p => (
                  <AlertCardBig
                    key={pKey(p)} p={p}
                    onClear={prod => handleSet(prod, null)}
                    onEditNota={prod => setNotaModal({ p: prod, targetTipo: 85 })}
                    onPriorizar={handlePriorizar}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Full product list ───────────────────────────────────────── */}
          <section className="pt-2 border-t border-gray-100 dark:border-dark-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                Todos los productos
              </h2>
              <span className="text-xs text-gray-400">{productos.length} en total</span>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  className="input pl-8 text-sm h-9 w-full"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex gap-1 flex-wrap">
                {STATUS_FILTERS.map(f => (
                  <button
                    key={f.val}
                    onClick={() => setFilterStatus(f.val)}
                    className={`px-3 h-9 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      filterStatus === f.val
                        ? f.activeClass
                        : 'bg-gray-100 dark:bg-dark-elevated text-gray-500 dark:text-gray-400 hover:opacity-80'
                    }`}
                  >
                    {f.label}
                    {f.count !== undefined && f.count > 0 && (
                      <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black ${
                        filterStatus === f.val ? 'bg-white/30 text-white' : 'bg-gray-300 dark:bg-dark-border text-gray-600 dark:text-gray-400'
                      }`}>{f.count}</span>
                    )}
                  </button>
                ))}
              </div>

              <select
                className="input text-xs h-9 shrink-0"
                value={filterRubro}
                onChange={e => setFilterRubro(e.target.value)}
              >
                <option value="all">Todos los rubros</option>
                {rubros.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400 dark:text-gray-600">
                <Package2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Sin resultados
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(p => (
                  <ProductRow
                    key={pKey(p)}
                    p={p}
                    onSet={handleSet}
                    onOpenNota={(prod, tipo) => setNotaModal({ p: prod, targetTipo: tipo })}
                    onPriorizar={handlePriorizar}
                    isPending={pendingIds.has(pKey(p))}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

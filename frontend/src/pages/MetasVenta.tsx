import { useState, useEffect, useRef, useMemo } from 'react'
import api from '../lib/api'
import {
  Target, Plus, RefreshCw, ChevronDown, ChevronUp,
  Check, X, Trash2, Edit2, Minus, Archive,
  Search, ShoppingBag, Type,
} from 'lucide-react'
import { Spinner } from '../components/ui/Spinner'
import { ToastContainer, useToast } from '../components/ui/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Meta {
  id: number
  persona: string
  producto_tipo: 'nucleo' | 'texto'
  producto_codigo: string | null
  producto_nombre: string
  meta_cantidad: number
  cantidad_actual: number
  base_periodo: string | null
  base_cantidad: number | null
  fecha_inicio: string
  fecha_fin: string
  activa: number
  alcanzada: number | null
  creado_en: string
  actualizado_en: string
  ultimo_trackeo: string | null
}

interface ProductoNucleo {
  codigo: string
  nombre: string
}

// ─── API ──────────────────────────────────────────────────────────────────────

const metasApi = {
  getMetas: (): Promise<Meta[]> => api.get('/metas-venta/').then(r => r.data),
  createMeta: (body: object) => api.post('/metas-venta/', body).then(r => r.data),
  updateMeta: (id: number, body: object) => api.patch(`/metas-venta/${id}`, body).then(r => r.data),
  deleteMeta: (id: number) => api.delete(`/metas-venta/${id}`).then(r => r.data),
  trackear: (id: number) => api.post(`/metas-venta/${id}/trackear`).then(r => r.data),
  ajustar: (id: number, delta: number) => api.post(`/metas-venta/${id}/ajustar`, { delta }).then(r => r.data),
  completar: (id: number) => api.post(`/metas-venta/${id}/completar`).then(r => r.data),
  getProductosNucleo: (): Promise<ProductoNucleo[]> => api.get('/metas-venta/productos-nucleo').then(r => r.data),
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function daysLeft(fechaFin: string) {
  const fin = new Date(fechaFin + 'T23:59:59')
  const hoy = new Date()
  return Math.ceil((fin.getTime() - hoy.getTime()) / 86400000)
}

function progressColor(pct: number) {
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 70)  return 'bg-primary'
  if (pct >= 40)  return 'bg-amber-500'
  return 'bg-red-400'
}

function textProgressColor(pct: number) {
  if (pct >= 100) return 'text-green-600 dark:text-green-400'
  if (pct >= 70)  return 'text-primary'
  if (pct >= 40)  return 'text-amber-500'
  return 'text-red-500'
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ actual, meta }: { actual: number; meta: number }) {
  const pct = meta > 0 ? Math.min(100, (actual / meta) * 100) : 0
  return (
    <div>
      <div className="flex justify-between items-end mb-1">
        <span className={`text-sm font-semibold ${textProgressColor(pct)}`}>
          {actual.toLocaleString('es-AR', { maximumFractionDigits: 1 })} / {meta.toLocaleString('es-AR', { maximumFractionDigits: 1 })}
        </span>
        <span className={`text-xs font-medium ${textProgressColor(pct)}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-dark-elevated rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${progressColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Meta Card ────────────────────────────────────────────────────────────────

function MetaCard({
  meta, onRefresh, onUpdate, onDelete, onCompletar, addToast,
}: {
  meta: Meta
  onRefresh: () => void
  onUpdate: (m: Meta) => void
  onDelete: () => void
  onCompletar: () => void
  addToast: (type: 'success' | 'error' | 'warning', msg: string) => void
}) {
  const [tracking, setTracking] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [editando, setEditando] = useState(false)
  const [delInput, setDelInput] = useState('')

  const dias = daysLeft(meta.fecha_fin)
  const vencida = dias < 0 && meta.activa === 1

  async function handleTrackear() {
    setTracking(true)
    try {
      const updated = await metasApi.trackear(meta.id)
      onUpdate(updated)
      addToast('success', 'Meta actualizada desde Nucleo')
    } catch (e: any) {
      addToast('error', e.message)
    } finally {
      setTracking(false)
    }
  }

  async function handleAjustar(delta: number) {
    setAdjusting(true)
    try {
      const updated = await metasApi.ajustar(meta.id, delta)
      onUpdate(updated)
    } catch (e: any) {
      addToast('error', e.message)
    } finally {
      setAdjusting(false)
    }
  }

  async function handleAjustarInput() {
    const val = parseFloat(delInput)
    if (isNaN(val) || val <= 0) return
    setAdjusting(true)
    try {
      const updated = await metasApi.ajustar(meta.id, val)
      onUpdate(updated)
      setDelInput('')
      setEditando(false)
    } catch (e: any) {
      addToast('error', e.message)
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <div className={`bg-white dark:bg-dark-surface rounded-xl border ${
      vencida ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-dark-border'
    } p-4 space-y-3 flex flex-col`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {meta.persona}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              meta.producto_tipo === 'nucleo'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-gray-50 dark:bg-dark-elevated text-gray-500 dark:text-gray-400 border-gray-200 dark:border-dark-border'
            }`}>
              {meta.producto_tipo === 'nucleo' ? <ShoppingBag className="inline w-3 h-3 mr-0.5" /> : <Type className="inline w-3 h-3 mr-0.5" />}
              {meta.producto_tipo === 'nucleo' ? 'Nucleo' : 'Manual'}
            </span>
          </div>
          <p className="font-medium text-gray-800 dark:text-gray-100 text-sm leading-tight">
            {meta.producto_nombre}
          </p>
          {meta.producto_codigo && (
            <p className="text-xs text-gray-400 font-mono">{meta.producto_codigo}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onDelete}
            className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <ProgressBar actual={meta.cantidad_actual || 0} meta={meta.meta_cantidad} />

      {/* Controls */}
      {meta.producto_tipo === 'nucleo' ? (
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {meta.ultimo_trackeo ? `Actualizado: ${meta.ultimo_trackeo}` : 'Sin trackeo aún'}
          </div>
          <button
            onClick={handleTrackear}
            disabled={tracking}
            className="flex items-center gap-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-medium disabled:opacity-50">
            {tracking ? <Spinner size="sm" /> : <RefreshCw className="w-3 h-3" />}
            Actualizar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAjustar(-1)}
              disabled={adjusting || (meta.cantidad_actual || 0) <= 0}
              className="flex-none w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-dark-border text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors disabled:opacity-40">
              <Minus className="w-4 h-4" />
            </button>
            <span className="flex-1 text-center font-semibold text-gray-800 dark:text-gray-100">
              {(meta.cantidad_actual || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })}
            </span>
            <button
              onClick={() => handleAjustar(1)}
              disabled={adjusting}
              className="flex-none w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-dark-border text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors disabled:opacity-40">
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditando(v => !v)}
              className={`flex-none text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                editando
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-gray-50 dark:bg-dark-elevated text-gray-500 border-gray-200 dark:border-dark-border hover:bg-gray-100'
              }`}>
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
          {editando && (
            <div className="flex gap-2">
              <input
                type="number" min="0" step="0.5" value={delInput}
                onChange={e => setDelInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAjustarInput()}
                placeholder="Cantidad a agregar"
                className="input flex-1 text-sm" />
              <button onClick={handleAjustarInput} disabled={adjusting}
                className="btn-primary text-xs px-3">
                {adjusting ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-dark-border">
        <div className="text-xs text-gray-400">
          Vence: {formatDate(meta.fecha_fin)}
          {meta.activa === 1 && (
            <span className={`ml-1.5 font-medium ${
              dias < 0 ? 'text-red-500' : dias <= 3 ? 'text-amber-500' : 'text-gray-400'
            }`}>
              {dias < 0 ? `(vencida hace ${-dias}d)` : dias === 0 ? '(hoy)' : `(${dias}d restantes)`}
            </span>
          )}
        </div>
        <button
          onClick={onCompletar}
          className="text-xs flex items-center gap-1 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-green-200 dark:hover:border-green-800">
          <Archive className="w-3 h-3" />
          Archivar
        </button>
      </div>
    </div>
  )
}

// ─── Historial Card ───────────────────────────────────────────────────────────

function HistorialCard({ meta }: { meta: Meta }) {
  const alcanzada = meta.alcanzada === 1
  const pct = meta.meta_cantidad > 0
    ? Math.min(100, ((meta.cantidad_actual || 0) / meta.meta_cantidad) * 100)
    : 0

  return (
    <div className={`bg-white dark:bg-dark-surface rounded-xl border p-4 ${
      alcanzada
        ? 'border-green-200 dark:border-green-800'
        : 'border-gray-200 dark:border-dark-border opacity-75'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`flex-none w-8 h-8 rounded-full flex items-center justify-center ${
          alcanzada ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/20'
        }`}>
          {alcanzada
            ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            : <X className="w-4 h-4 text-red-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{meta.persona}</span>
            <span className={`text-xs font-medium ${alcanzada ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {alcanzada ? 'Alcanzada ✓' : 'No alcanzada'}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{meta.producto_nombre}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            <span>{(meta.cantidad_actual || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} / {meta.meta_cantidad.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ({pct.toFixed(0)}%)</span>
            <span>Venció: {formatDate(meta.fecha_fin)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Nueva Meta ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      {children}
    </div>
  )
}

function NuevaMetaModal({
  onClose,
  onCreated,
  addToast,
}: {
  onClose: () => void
  onCreated: (m: Meta) => void
  addToast: (type: 'success' | 'error' | 'warning', msg: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [loadingProds, setLoadingProds] = useState(false)
  const [productos, setProductos] = useState<ProductoNucleo[]>([])
  const [query, setQuery] = useState('')
  const [prodOpen, setProdOpen] = useState(false)
  const prodRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    persona: '',
    fecha_fin: '',
    producto_tipo: 'nucleo' as 'nucleo' | 'texto',
    producto_codigo: '',
    producto_nombre: '',
    meta_cantidad: '',
  })

  const filtrados = useMemo(() => {
    if (!query.trim()) return productos.slice(0, 50)
    const q = query.toLowerCase()
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
    ).slice(0, 150)
  }, [productos, query])

  useEffect(() => {
    if (form.producto_tipo !== 'nucleo') return
    setLoadingProds(true)
    metasApi.getProductosNucleo()
      .then(data => { setProductos(data); setProdOpen(true) })
      .catch(() => { addToast('error', 'No se pudieron cargar los productos NucleoCheck') })
      .finally(() => setLoadingProds(false))
  }, [form.producto_tipo])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (prodRef.current && !prodRef.current.contains(e.target as Node)) {
        setProdOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectProducto(p: ProductoNucleo) {
    setForm(f => ({ ...f, producto_codigo: p.codigo, producto_nombre: p.nombre }))
    setQuery(p.nombre)
    setProdOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.persona.trim()) { addToast('warning', 'Ingresá el nombre de la persona'); return }
    if (!form.fecha_fin) { addToast('warning', 'Ingresá la fecha límite'); return }
    if (!form.producto_nombre.trim()) { addToast('warning', 'Seleccioná o ingresá el producto'); return }
    const meta_cantidad = parseFloat(form.meta_cantidad)
    if (!meta_cantidad || meta_cantidad <= 0) { addToast('warning', 'La meta debe ser mayor a 0'); return }
    if (form.producto_tipo === 'nucleo' && !form.producto_codigo) {
      addToast('warning', 'Seleccioná un producto de Nucleo de la lista')
      return
    }

    setSaving(true)
    try {
      const nueva = await metasApi.createMeta({
        persona: form.persona.trim(),
        fecha_fin: form.fecha_fin,
        producto_tipo: form.producto_tipo,
        producto_nombre: form.producto_nombre.trim(),
        meta_cantidad,
        producto_codigo: form.producto_tipo === 'nucleo' ? form.producto_codigo : null,
      })
      addToast('success', 'Meta creada')
      onCreated(nueva)
    } catch (e: any) {
      addToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-border">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Nueva meta de venta
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Persona responsable *">
            <input
              type="text" value={form.persona}
              onChange={e => setForm(f => ({ ...f, persona: e.target.value }))}
              placeholder="Ej: Juan García"
              className="input w-full" />
          </Field>

          <Field label="Fecha límite *">
            <input
              type="date" value={form.fecha_fin}
              onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
              className="input w-full" />
          </Field>

          <Field label="Tipo de producto *">
            <div className="flex gap-2">
              {(['nucleo', 'texto'] as const).map(tipo => (
                <button
                  key={tipo} type="button"
                  onClick={() => setForm(f => ({ ...f, producto_tipo: tipo, producto_codigo: '', producto_nombre: '' }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    form.producto_tipo === tipo
                      ? 'bg-primary text-white border-primary'
                      : 'bg-gray-50 dark:bg-dark-elevated text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-border hover:border-primary/50'
                  }`}>
                  {tipo === 'nucleo'
                    ? <><ShoppingBag className="w-4 h-4" /> Producto Nucleo</>
                    : <><Type className="w-4 h-4" /> Texto libre</>}
                </button>
              ))}
            </div>
          </Field>

          {form.producto_tipo === 'nucleo' ? (
            <Field label="Producto de Nucleo *">
              <div className="relative" ref={prodRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setProdOpen(true); setForm(f => ({ ...f, producto_codigo: '', producto_nombre: '' })) }}
                    onFocus={() => setProdOpen(true)}
                    placeholder={loadingProds ? 'Cargando productos…' : 'Buscar producto…'}
                    className="input w-full pl-9"
                    disabled={loadingProds} />
                </div>
                {prodOpen && filtrados.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {filtrados.map(p => (
                      <button
                        key={p.codigo} type="button"
                        onClick={() => selectProducto(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors">
                        <p className="text-sm text-gray-800 dark:text-gray-100 font-medium">{p.nombre}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.codigo}</p>
                      </button>
                    ))}
                  </div>
                )}
                {form.producto_codigo && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> {form.producto_nombre}
                  </p>
                )}
              </div>
            </Field>
          ) : (
            <Field label="Nombre del producto *">
              <input
                type="text" value={form.producto_nombre}
                onChange={e => setForm(f => ({ ...f, producto_nombre: e.target.value }))}
                placeholder="Ej: Empanadas, Hamburguesas…"
                className="input w-full" />
            </Field>
          )}

          <Field label="Meta (cantidad objetivo) *">
            <input
              type="number" min="0.1" step="0.1" value={form.meta_cantidad}
              onChange={e => setForm(f => ({ ...f, meta_cantidad: e.target.value }))}
              placeholder="Ej: 100"
              className="input w-full" />
            {form.producto_tipo === 'nucleo' && (
              <p className="text-xs text-gray-400 mt-1">Unidades vendidas según NucleoCheck</p>
            )}
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? <Spinner size="sm" /> : 'Crear meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MetasVenta() {
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  const activas   = metas.filter(m => m.activa === 1)
  const historial = metas.filter(m => m.activa === 0)

  async function loadAll() {
    try {
      const data = await metasApi.getMetas()
      setMetas(data)
    } catch (e: any) {
      addToast('error', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  function handleUpdate(updated: Meta) {
    setMetas(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar esta meta?')) return
    try {
      await metasApi.deleteMeta(id)
      setMetas(prev => prev.filter(m => m.id !== id))
      addToast('success', 'Meta eliminada')
    } catch (e: any) {
      addToast('error', e.message)
    }
  }

  async function handleCompletar(id: number) {
    if (!window.confirm('¿Archivar esta meta y registrar si fue alcanzada?')) return
    try {
      const updated = await metasApi.completar(id)
      setMetas(prev => prev.map(m => m.id === updated.id ? updated : m))
      addToast('success', updated.alcanzada === 1 ? '¡Meta alcanzada! 🎉' : 'Meta archivada')
    } catch (e: any) {
      addToast('error', e.message)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Metas de Venta
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Seguimiento de objetivos de venta por persona y producto
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nueva meta
        </button>
      </div>

      {/* Metas activas */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : activas.length === 0 ? (
        <div className="text-center py-16">
          <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-500 font-medium">No hay metas activas</p>
          <p className="text-sm text-gray-300 dark:text-gray-600 mt-1">
            Creá una nueva meta para empezar a trackear ventas
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4">
            <Plus className="w-4 h-4 mr-2" /> Crear primera meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activas.map(meta => (
            <MetaCard
              key={meta.id}
              meta={meta}
              onRefresh={loadAll}
              onUpdate={handleUpdate}
              onDelete={() => handleDelete(meta.id)}
              onCompletar={() => handleCompletar(meta.id)}
              addToast={addToast}
            />
          ))}
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <section>
          <button
            onClick={() => setShowHistorial(v => !v)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mb-3">
            {showHistorial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <Archive className="w-4 h-4" />
            <span className="font-medium text-sm">
              Historial de metas ({historial.length})
            </span>
            <span className="text-xs text-green-600 dark:text-green-400 ml-1">
              {historial.filter(m => m.alcanzada === 1).length} alcanzadas
            </span>
          </button>
          {showHistorial && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {historial.map(meta => (
                <HistorialCard key={meta.id} meta={meta} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modal */}
      {showModal && (
        <NuevaMetaModal
          onClose={() => setShowModal(false)}
          onCreated={m => {
            setMetas(prev => [m, ...prev])
            setShowModal(false)
          }}
          addToast={addToast}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

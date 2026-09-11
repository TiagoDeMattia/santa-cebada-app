import { useState, useEffect, useCallback, useRef } from 'react'
import {
  TrendingUp, TrendingDown, RefreshCw, AlertTriangle,
  Info, CheckCircle, ChevronDown, BarChart3, Minus, DollarSign,
  Award, Activity, Calendar, Search, X,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, BarChart, Bar, Cell,
} from 'recharts'
import api from '../lib/api'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface HistoricoPoint { fecha: string; valor: number; pedidos: number }
interface PrediccionPoint { fecha: string; valor: number; lower: number; upper: number }
interface ModelResult { nombre: string; mae: number; rmse: number; mape: number; r2: number; seleccionado: boolean }
interface Alert { tipo: string; titulo: string; mensaje: string }
interface TrendData {
  slope_diario: number; tendencia: string; crecimiento_periodo_pct: number
  dow_pattern: Record<string, number>; mejor_dia: string; peor_dia: string
  mensual: { mes: string; avg: number }[]
  domingos_abiertos: number; domingo_tipicamente_cerrado: boolean
}

interface ProductTrendLifecycle {
  nombre: string; qty_total: number; rev_total: number; cambio_pct: number | null
  tendencia: 'subiendo' | 'bajando' | 'estable' | 'nuevo' | 'retirado'
  primera_venta?: string; ultima_venta?: string; qty_reciente?: number
}

interface ProdListItem { nombre: string; qty_total: number; rev_total: number }
interface ProdEvoSeries { fecha: string; qty: number; revenue: number }
interface ProdEvoInsights {
  tendencia: 'subiendo' | 'bajando' | 'estable' | 'sin_datos'
  slope_pct_periodo: number
  cambio_pct: number | null
  ranking_pos: number | null
  total_productos: number
  qty_total_alltime: number
  qty_periodo: number
  rev_periodo: number
  active_days: number
  avg_active: number
  mejor_mes: string | null
}
interface ProdEvoData {
  nombre: string
  series: ProdEvoSeries[]
  insights: ProdEvoInsights
  error?: string
}

interface PrediccionData {
  meta: {
    segment: string; horizon: string; n_days: number; metric_label: string
    modelo_usado: string; generado_en: string
    datos_desde: string; datos_hasta: string; dias_historico_total: number
  }
  historico: HistoricoPoint[]
  prediccion: PrediccionPoint[]
  kpis: { total_proyectado: number; promedio_diario: number; crecimiento_vs_anterior_pct: number; ticket_promedio: number; pedidos_diarios_esperados: number }
  modelos: ModelResult[]
  tendencia: TrendData
  outliers: { fecha: string; revenue: number; z_score: number; tipo: string }[]
  productos: {
    crecimiento: ProductTrendLifecycle[]; caida: ProductTrendLifecycle[]
    nuevos: ProductTrendLifecycle[]; retirados: ProductTrendLifecycle[]
    top_revenue: ProductTrendLifecycle[]; top_cantidad: ProductTrendLifecycle[]
    ventana_semanas: number; ventana_reciente_desde: string; ventana_anterior_desde: string
  }
  alertas: Alert[]
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const HORIZONS = [
  { value: 'day',     label: 'Próximo día' },
  { value: 'week',    label: 'Próxima semana' },
  { value: 'month',   label: 'Próximo mes' },
  { value: 'quarter', label: 'Próximos 3 meses' },
  { value: 'year',    label: 'Próximo año' },
]

const MODELS = ['WeightedDOW', 'HoltWinters', 'SARIMA', 'RandomForest', 'XGBoost', 'LightGBM']

const ACCENT = '#F5A623'
const PURPLE = '#6730BF'
const GREEN  = '#10b981'
const RED    = '#ef4444'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function fmtN(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toFixed(0)
}

function pct(n: number) {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

function shortDate(d: string) {
  const parts = d.split('-')
  return `${parts[2]}/${parts[1]}`
}

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
function fmtMes(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${MES_CORTO[parseInt(m, 10) - 1]} '${y.slice(2)}`
}

// ── Componentes ────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, delta, icon: Icon, color = ACCENT }: {
  label: string; value: string; sub?: string; delta?: number; icon: any; color?: string
}) {
  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <div className="p-2 rounded-xl" style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {delta !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {pct(delta)} vs período anterior
        </div>
      )}
    </div>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const configs = {
    positivo:    { bg: 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/20', icon: CheckCircle, iconColor: 'text-green-500' },
    advertencia: { bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/20',  icon: AlertTriangle, iconColor: 'text-amber-500' },
    info:        { bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/20',    icon: Info, iconColor: 'text-blue-500' },
  }
  const cfg = configs[alert.tipo as keyof typeof configs] ?? configs.info
  const Icon = cfg.icon
  return (
    <div className={`rounded-xl border p-4 ${cfg.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.iconColor}`} />
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{alert.titulo}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{alert.mensaje}</p>
        </div>
      </div>
    </div>
  )
}

function Select({ value, onChange, options, className = '' }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none w-full bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-xl px-4 py-2.5 pr-9 text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ── Custom Tooltip para Recharts ───────────────────────────────────────────────

function CustomTooltip({ active, payload, label, metricLabel }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800 dark:text-gray-200">
            {p.dataKey === 'valor' || p.dataKey === 'lower' || p.dataKey === 'upper'
              ? fmt(p.value) : fmtN(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Buscador de productos ─────────────────────────────────────────────────────

function ProdSearch({ lista, value, onChange }: {
  lista: ProdListItem[]
  value: string
  onChange: (v: string) => void
}) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const wrapRef             = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? lista.filter(p => p.nombre.toLowerCase().includes(query.toLowerCase())).slice(0, 30)
    : lista.slice(0, 30)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function select(nombre: string) {
    onChange(nombre)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-56">
      {/* Input visible */}
      <div className="flex items-center bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2.5 gap-2 focus-within:ring-2 focus-within:ring-accent/30">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={open ? query : value}
          placeholder={open ? 'Buscar producto…' : (value || 'Seleccionar producto…')}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none placeholder:text-gray-400 placeholder:font-normal"
        />
        {open
          ? <X className="w-4 h-4 text-gray-400 cursor-pointer flex-shrink-0" onClick={() => { setOpen(false); setQuery('') }} />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl shadow-xl overflow-hidden">
          {query.trim() && (
            <p className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-50 dark:border-dark-border">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">Sin resultados</p>
            )}
            {filtered.map(p => (
              <button
                key={p.nombre}
                onMouseDown={() => select(p.nombre)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors ${
                  p.nombre === value ? 'bg-accent/5 text-accent font-semibold' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {p.nombre}
              </button>
            ))}
            {!query.trim() && lista.length > 30 && (
              <p className="px-4 py-2 text-[10px] text-gray-400 text-center border-t border-gray-50 dark:border-dark-border">
                Escribí para buscar entre los {lista.length} productos
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export function Prediccion() {
  const [horizon, setHorizon]       = useState('week')
  const [forceModel, setForceModel] = useState('')
  const [activeTab, setActiveTab]   = useState<'overview' | 'productos' | 'modelos' | 'dow'>('overview')
  const [data, setData]             = useState<PrediccionData | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [ajustarInflacion, setAjustarInflacion] = useState(false)
  const [inflacionIndices, setInflacionIndices] = useState<Record<string, number>>({})
  const [inflacionBase, setInflacionBase]       = useState<string | null>(null)

  // ── Product evolution state ───────────────────────────────────────────
  const [prodLista, setProdLista]       = useState<ProdListItem[]>([])
  const [selectedProd, setSelectedProd] = useState<string>('')
  const [prodStart, setProdStart]       = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0]
  })
  const [prodEnd, setProdEnd]           = useState<string>(() => new Date().toISOString().split('T')[0])
  const [prodEvo, setProdEvo]           = useState<ProdEvoData | null>(null)
  const [prodLoading, setProdLoading]   = useState(false)

  useEffect(() => {
    api.get('/estadistica/inflation').then(res => {
      setInflacionIndices(res.data.indices ?? {})
      setInflacionBase(res.data.base_month ?? null)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    api.get('/prediccion/productos-lista', { params: { sucursal_id: '1' } })
      .then(res => {
        const lista: ProdListItem[] = res.data ?? []
        setProdLista(lista)
        if (lista.length > 0 && !selectedProd) setSelectedProd(lista[0].nombre)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedProd) return
    setProdLoading(true)
    const params: Record<string, string> = { nombre: selectedProd, sucursal_id: '1' }
    if (prodStart) params.start_date = prodStart
    if (prodEnd)   params.end_date   = prodEnd
    api.get('/prediccion/producto-evolucion', { params })
      .then(res => setProdEvo(res.data))
      .catch(() => setProdEvo(null))
      .finally(() => setProdLoading(false))
  }, [selectedProd, prodStart, prodEnd])

  const ajustar = useCallback((valor: number, mesYYYYMM: string): number => {
    if (!ajustarInflacion || Object.keys(inflacionIndices).length === 0) return valor
    return valor * (inflacionIndices[mesYYYYMM] ?? 1)
  }, [ajustarInflacion, inflacionIndices])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { horizon, sucursal_id: '1' }
      if (forceModel) params.model = forceModel
      const res = await api.get('/prediccion', { params })
      setData(res.data)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error cargando predicción')
    } finally {
      setLoading(false)
    }
  }, [horizon, forceModel])

  useEffect(() => { cargar() }, [cargar])

  // ── Preparar datos para los gráficos ──────────────────────────────────────

  const chartData = data ? [
    ...data.historico.slice(-60)
      .filter(p => !(new Date(p.fecha + 'T12:00:00').getDay() === 0 && p.valor === 0))
      .map(p => ({
        fecha: shortDate(p.fecha),
        historico: ajustar(p.valor, p.fecha.slice(0, 7)),
        tipo: 'historico',
      })),
    ...data.prediccion.map(p => ({
      fecha: shortDate(p.fecha),
      prediccion: p.valor,
      lower: p.lower,
      upper: p.upper,
      tipo: 'prediccion',
    })),
  ] : []

  const dowData = data ? Object.entries(data.tendencia.dow_pattern).map(([dia, avg]) => ({
    dia, avg,
  })) : []

  const mensualData = (data?.tendencia.mensual ?? []).map(m => ({
    ...m,
    avg: ajustar(m.avg, m.mes),
  }))

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'overview',  label: 'Resumen' },
    { id: 'productos', label: 'Productos' },
    { id: 'modelos',   label: 'Modelos' },
    { id: 'dow',       label: 'Patrones' },
  ] as const

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Predicción de Ventas</h1>
          {data && (
            <p className="text-xs text-gray-400 mt-1">
              Historial {data.meta.datos_desde} → {data.meta.datos_hasta} · {data.meta.dias_historico_total} días ·
              Modelo: <span className="font-semibold" style={{ color: ACCENT }}>{data.meta.modelo_usado}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={horizon}
            onChange={setHorizon}
            options={HORIZONS}
            className="w-44"
          />
          <Select
            value={forceModel}
            onChange={setForceModel}
            options={[{ value: '', label: 'Auto (mejor modelo)' }, ...MODELS.map(m => ({ value: m, label: m }))]}
            className="w-48"
          />
          <button
            onClick={() => setAjustarInflacion(v => !v)}
            title={ajustarInflacion ? `Mostrando en pesos de ${inflacionBase ?? '…'}` : 'Ajustar valores históricos por inflación (IPC INDEC)'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
              ajustarInflacion
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                : 'bg-white dark:bg-dark-elevated text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-border hover:border-gray-300'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            {ajustarInflacion ? `$ ${inflacionBase ?? '…'}` : '± Inflación'}
          </button>
          <button
            onClick={cargar}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Calculando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-red-100 dark:border-red-800/20 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 dark:bg-dark-elevated rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Facturación proyectada"
              value={fmt(data.kpis.total_proyectado)}
              sub={`${data.meta.n_days} día${data.meta.n_days > 1 ? 's' : ''}`}
              delta={data.kpis.crecimiento_vs_anterior_pct}
              icon={TrendingUp}
              color={ACCENT}
            />
            <KPICard
              label="Promedio diario"
              value={fmt(data.kpis.promedio_diario)}
              sub="Estimado"
              icon={BarChart3}
              color={PURPLE}
            />
            <KPICard
              label="Ticket promedio"
              value={fmt(data.kpis.ticket_promedio)}
              sub="Últimas 4 semanas"
              icon={TrendingUp}
              color={GREEN}
            />
            <KPICard
              label="Pedidos/día esperados"
              value={data.kpis.pedidos_diarios_esperados.toFixed(0)}
              sub="Promedio histórico reciente"
              icon={BarChart3}
              color={data.tendencia.tendencia === 'positiva' ? GREEN : RED}
            />
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 border-b border-gray-100 dark:border-dark-border">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === t.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Resumen ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* Gráfico principal */}
              <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Histórico + Proyección</p>
                    <p className="text-xs text-gray-400 mt-0.5">Área sombreada = intervalo de confianza 90%</p>
                    {ajustarInflacion && inflacionBase && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        Histórico ajustado a pesos de {inflacionBase} · Proyección en pesos nominales
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-1.5 rounded" style={{ background: ACCENT }} /> Histórico
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-1.5 rounded" style={{ background: PURPLE }} /> Proyección
                    </span>
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={ACCENT} stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={PURPLE} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={PURPLE} stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={PURPLE} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={PURPLE} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} width={60} />
                      <Tooltip content={<CustomTooltip />} />
                      {/* CI bands */}
                      <Area dataKey="upper" fill="url(#ciGrad)" stroke="none" name="IC Superior" />
                      <Area dataKey="lower" fill="white" stroke="none" name="IC Inferior" />
                      {/* Histórico */}
                      <Area dataKey="historico" stroke={ACCENT} strokeWidth={2} fill="url(#histGrad)" name="Histórico" dot={false} />
                      {/* Proyección */}
                      <Area dataKey="prediccion" stroke={PURPLE} strokeWidth={2} strokeDasharray="5 3" fill="url(#predGrad)" name="Proyección" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabla de predicción + Alertas */}
              <div className="grid lg:grid-cols-2 gap-6">

                {/* Tabla */}
                <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 dark:border-dark-border">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Predicción detallada</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-dark-elevated">
                          <th className="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Fecha</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Valor</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Mínimo</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Máximo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-dark-border/50">
                        {data.prediccion.map(p => (
                          <tr key={p.fecha} className="hover:bg-gray-50/50 dark:hover:bg-dark-elevated/30">
                            <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300">{p.fecha}</td>
                            <td className="px-4 py-2.5 text-right font-bold" style={{ color: PURPLE }}>{fmt(p.valor)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-400">{fmt(p.lower)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-400">{fmt(p.upper)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Alertas */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 px-1">Alertas automáticas</p>
                  {data.alertas.map((a, i) => <AlertCard key={i} alert={a} />)}
                  {data.outliers.length > 0 && (
                    <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-100 dark:border-dark-border p-4">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Eventos atípicos detectados</p>
                      {data.outliers.slice(0, 4).map((o, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-dark-border/40 last:border-0">
                          <span className="text-xs text-gray-500">{o.fecha}</span>
                          <span className={`text-xs font-semibold ${o.tipo === 'alto' ? 'text-green-500' : 'text-red-500'}`}>
                            {o.tipo === 'alto' ? '↑' : '↓'} {fmt(o.revenue)} (z={o.z_score})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Productos ── */}
          {activeTab === 'productos' && (
            <div className="space-y-6">

              {/* ── Evolución diaria por producto ── */}
              <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 dark:border-dark-border">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Evolución diaria por producto</p>
                  <p className="text-xs text-gray-400 mt-0.5">Unidades vendidas por día · seleccioná producto y rango</p>
                </div>
                <div className="p-5 space-y-4">

                  {/* Controles: producto + fechas */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <ProdSearch
                      lista={prodLista}
                      value={selectedProd}
                      onChange={setSelectedProd}
                    />
                    <input
                      type="date"
                      value={prodStart}
                      onChange={e => setProdStart(e.target.value)}
                      className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <span className="text-xs text-gray-400">—</span>
                    <input
                      type="date"
                      value={prodEnd}
                      onChange={e => setProdEnd(e.target.value)}
                      className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  {/* Gráfico */}
                  {prodLoading && (
                    <div className="h-52 bg-gray-100 dark:bg-dark-elevated rounded-xl animate-pulse" />
                  )}
                  {!prodLoading && prodEvo && !prodEvo.error && prodEvo.series.length > 0 && (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={prodEvo.series} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                          <XAxis
                            dataKey="fecha"
                            tickFormatter={d => { const p = d.split('-'); return `${p[2]}/${p[1]}` }}
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            tickLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}K` : String(v)}
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            tickLine={false}
                            width={45}
                          />
                          <Tooltip
                            content={({ active, payload, label }: any) => {
                              if (!active || !payload?.length) return null
                              const p = String(label).split('-')
                              const fechaLabel = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : label
                              const rev = payload[0]?.payload?.revenue
                              return (
                                <div className="bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl shadow-lg p-3 text-xs">
                                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{fechaLabel}</p>
                                  <p className="text-gray-500">
                                    Unidades: <span className="font-bold" style={{ color: ACCENT }}>{Number(payload[0]?.value ?? 0).toFixed(1)}</span>
                                  </p>
                                  {rev > 0 && (
                                    <p className="text-gray-500 mt-0.5">
                                      Facturación: <span className="font-bold text-gray-700 dark:text-gray-300">{fmt(Number(rev))}</span>
                                    </p>
                                  )}
                                </div>
                              )
                            }}
                          />
                          <Area dataKey="qty" stroke={ACCENT} strokeWidth={2} fill="url(#prodGrad)" name="Unidades" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {!prodLoading && prodEvo?.error && (
                    <p className="text-sm text-gray-400 text-center py-8">{prodEvo.error}</p>
                  )}
                  {!prodLoading && prodEvo && !prodEvo.error && prodEvo.series.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">Sin ventas en el rango seleccionado</p>
                  )}

                  {/* Insight cards */}
                  {!prodLoading && prodEvo && !prodEvo.error && prodEvo.insights && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                      {/* Card 1: Tendencia */}
                      <div className="bg-gray-50 dark:bg-dark-elevated rounded-xl p-4 flex items-start gap-3">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          prodEvo.insights.tendencia === 'subiendo' ? 'bg-green-100 dark:bg-green-900/20' :
                          prodEvo.insights.tendencia === 'bajando'  ? 'bg-red-100 dark:bg-red-900/20' :
                          'bg-gray-100 dark:bg-dark-border'
                        }`}>
                          {prodEvo.insights.tendencia === 'subiendo' && <TrendingUp className="w-4 h-4 text-green-500" />}
                          {prodEvo.insights.tendencia === 'bajando'  && <TrendingDown className="w-4 h-4 text-red-500" />}
                          {(prodEvo.insights.tendencia === 'estable' || prodEvo.insights.tendencia === 'sin_datos') && <Activity className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Tendencia</p>
                          <p className={`text-sm font-black mt-0.5 ${
                            prodEvo.insights.tendencia === 'subiendo' ? 'text-green-500' :
                            prodEvo.insights.tendencia === 'bajando'  ? 'text-red-500'   : 'text-gray-500'
                          }`}>
                            {prodEvo.insights.tendencia === 'subiendo' ? '↑ Subiendo' :
                             prodEvo.insights.tendencia === 'bajando'  ? '↓ Bajando'  :
                             prodEvo.insights.tendencia === 'estable'  ? '→ Estable'  : 'Sin datos'}
                          </p>
                          {prodEvo.insights.cambio_pct !== null && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {prodEvo.insights.cambio_pct >= 0 ? '+' : ''}{prodEvo.insights.cambio_pct.toFixed(1)}% 2ª mitad vs 1ª
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card 2: Ranking */}
                      <div className="bg-gray-50 dark:bg-dark-elevated rounded-xl p-4 flex items-start gap-3">
                        <div className="p-2 rounded-lg flex-shrink-0 bg-amber-100 dark:bg-amber-900/20">
                          <Award className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Ranking histórico</p>
                          {prodEvo.insights.ranking_pos !== null ? (
                            <>
                              <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-0.5">
                                #{prodEvo.insights.ranking_pos}
                                <span className="text-[10px] font-normal text-gray-400 ml-1">de {prodEvo.insights.total_productos}</span>
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {fmtN(prodEvo.insights.qty_total_alltime)} uds totales
                              </p>
                            </>
                          ) : (
                            <p className="text-sm font-semibold text-gray-400 mt-0.5">—</p>
                          )}
                        </div>
                      </div>

                      {/* Card 3: Actividad del período */}
                      <div className="bg-gray-50 dark:bg-dark-elevated rounded-xl p-4 flex items-start gap-3">
                        <div className="p-2 rounded-lg flex-shrink-0 bg-purple-100 dark:bg-purple-900/20">
                          <Calendar className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">En el período</p>
                          <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-0.5">
                            {fmtN(prodEvo.insights.qty_periodo)} uds
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {prodEvo.insights.avg_active.toFixed(1)} uds/día activo · {prodEvo.insights.active_days} días
                            {prodEvo.insights.mejor_mes && ` · pico ${fmtMes(prodEvo.insights.mejor_mes)}`}
                          </p>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>

              {/* Leyenda de ventana de comparación */}
              {data.productos.ventana_semanas && (
                <p className="text-xs text-gray-400 px-1">
                  Comparación de tasa de venta: ventana reciente ({data.productos.ventana_reciente_desde} → hoy)
                  vs ventana anterior ({data.productos.ventana_anterior_desde} → {data.productos.ventana_reciente_desde})
                </p>
              )}

              <div className="grid lg:grid-cols-2 gap-6">

                {/* Productos nuevos en carta */}
                {data.productos.nuevos.length > 0 && (
                  <div className="bg-white dark:bg-dark-surface rounded-2xl border border-blue-100 dark:border-blue-800/20 overflow-hidden">
                    <div className="px-5 py-4 border-b border-blue-50 dark:border-blue-800/10 flex items-center gap-2 bg-blue-50/40 dark:bg-blue-900/5">
                      <span className="text-base">✨</span>
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Productos nuevos en carta</p>
                      <span className="ml-auto text-xs text-blue-400">sin historial prev.</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-dark-border/40">
                      {data.productos.nuevos.map((p, i) => (
                        <div key={i} className="px-5 py-3 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{p.nombre}</p>
                            <p className="text-[10px] text-gray-400">
                              desde {p.primera_venta} · {fmtN(p.qty_reciente ?? p.qty_total)} uds recientes
                            </p>
                          </div>
                          <span className="ml-3 text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">NUEVO</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Productos retirados */}
                {data.productos.retirados.length > 0 && (
                  <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-dark-border flex items-center gap-2 bg-gray-50/60 dark:bg-dark-elevated/40">
                      <span className="text-base">📦</span>
                      <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Productos fuera de carta</p>
                      <span className="ml-auto text-xs text-gray-400">sin ventas recientes</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-dark-border/40">
                      {data.productos.retirados.map((p, i) => (
                        <div key={i} className="px-5 py-3 flex items-center justify-between opacity-60">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate line-through">{p.nombre}</p>
                            <p className="text-[10px] text-gray-400">última venta {p.ultima_venta} · {fmtN(p.qty_total)} uds total</p>
                          </div>
                          <span className="ml-3 text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-dark-border px-2 py-1 rounded-full">RETIRADO</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Crecimiento */}
                <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 dark:border-dark-border flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tendencia al alza</p>
                    <span className="ml-auto text-xs text-gray-400">tasa/día +12%</span>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-dark-border/40">
                    {data.productos.crecimiento.length === 0 && (
                      <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin productos con tendencia clara al alza</p>
                    )}
                    {data.productos.crecimiento.map((p, i) => (
                      <div key={i} className="px-5 py-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{p.nombre}</p>
                          <p className="text-[10px] text-gray-400">{fmtN(p.qty_total)} uds · {fmt(p.rev_total)}</p>
                        </div>
                        <span className="ml-3 text-xs font-bold text-green-500 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-full">
                          +{(p.cambio_pct ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Caída */}
                <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 dark:border-dark-border flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tendencia a la baja</p>
                    <span className="ml-auto text-xs text-gray-400">tasa/día −12%</span>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-dark-border/40">
                    {data.productos.caida.length === 0 && (
                      <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin caídas significativas</p>
                    )}
                    {data.productos.caida.map((p, i) => (
                      <div key={i} className="px-5 py-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{p.nombre}</p>
                          <p className="text-[10px] text-gray-400">{fmtN(p.qty_total)} uds · {fmt(p.rev_total)}</p>
                        </div>
                        <span className="ml-3 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded-full">
                          {(p.cambio_pct ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top por revenue */}
                <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden lg:col-span-2">
                  <div className="px-5 py-4 border-b border-gray-50 dark:border-dark-border">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top productos por facturación</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-dark-elevated">
                          <th className="px-4 py-2.5 text-left font-semibold text-gray-500">#</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Producto</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-500">Facturación</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-500">Unidades</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-500">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-dark-border/40">
                        {data.productos.top_revenue.map((p, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-dark-elevated/30">
                            <td className="px-4 py-2.5 text-gray-400 font-medium">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300 max-w-xs truncate">{p.nombre}</td>
                            <td className="px-4 py-2.5 text-right font-semibold" style={{ color: ACCENT }}>{fmt(p.rev_total)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{fmtN(p.qty_total)}</td>
                            <td className="px-4 py-2.5 text-right">
                              {p.tendencia === 'subiendo' && <TrendingUp className="w-4 h-4 text-green-500 ml-auto" />}
                              {p.tendencia === 'bajando'  && <TrendingDown className="w-4 h-4 text-red-500 ml-auto" />}
                              {p.tendencia === 'estable'  && <Minus className="w-4 h-4 text-gray-400 ml-auto" />}
                              {p.tendencia === 'nuevo'    && <span className="text-[10px] font-bold text-blue-500">NUEVO</span>}
                              {p.tendencia === 'retirado' && <span className="text-[10px] font-bold text-gray-400">RETIRADO</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Modelos ── */}
          {activeTab === 'modelos' && (
            <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 dark:border-dark-border">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Comparación de modelos</p>
                <p className="text-xs text-gray-400 mt-0.5">Evaluación walk-forward con los últimos 14 días como test</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-dark-elevated">
                      <th className="px-5 py-3 text-left font-semibold text-gray-500">Modelo</th>
                      <th className="px-5 py-3 text-right font-semibold text-gray-500">MAE</th>
                      <th className="px-5 py-3 text-right font-semibold text-gray-500">RMSE</th>
                      <th className="px-5 py-3 text-right font-semibold text-gray-500">MAPE %</th>
                      <th className="px-5 py-3 text-right font-semibold text-gray-500">R²</th>
                      <th className="px-5 py-3 text-center font-semibold text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-dark-border/40">
                    {data.modelos.map(m => (
                      <tr key={m.nombre} className={`hover:bg-gray-50/50 dark:hover:bg-dark-elevated/30 ${m.seleccionado ? 'bg-amber-50/40 dark:bg-amber-900/5' : ''}`}>
                        <td className="px-5 py-3 font-semibold text-gray-800 dark:text-gray-200">
                          {m.nombre}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400 font-mono">{fmt(m.mae)}</td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400 font-mono">{fmt(m.rmse)}</td>
                        <td className={`px-5 py-3 text-right font-bold font-mono ${m.mape < 15 ? 'text-green-500' : m.mape < 30 ? 'text-amber-500' : 'text-red-500'}`}>
                          {m.mape.toFixed(1)}%
                        </td>
                        <td className={`px-5 py-3 text-right font-mono ${m.r2 > 0.7 ? 'text-green-500' : m.r2 > 0.4 ? 'text-amber-500' : 'text-red-500'}`}>
                          {m.r2.toFixed(3)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {m.seleccionado
                            ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,166,35,0.15)', color: ACCENT }}>✓ Seleccionado</span>
                            : <span className="text-gray-300 dark:text-gray-600">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-dark-elevated text-[10px] text-gray-400">
                MAE = Error Absoluto Medio · RMSE = Raíz del Error Cuadrático Medio · MAPE = Error Porcentual Absoluto · R² = Coeficiente de determinación
              </div>
            </div>
          )}

          {/* ── Tab: Patrones ── */}
          {activeTab === 'dow' && (
            <div className="space-y-6">
              {/* DOW chart */}
              <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border p-5">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Facturación por día de semana</p>
                <p className="text-xs text-gray-400 mb-1">
                  Promedio histórico · mejor día: <strong>{data.tendencia.mejor_dia}</strong> · peor: <strong>{data.tendencia.peor_dia}</strong>
                </p>
                {data.tendencia.domingo_tipicamente_cerrado && (
                  <p className="text-xs text-gray-400 mb-4">
                    Domingo: habitualmente cerrado
                    {data.tendencia.domingos_abiertos > 0 && ` (abierto ${data.tendencia.domingos_abiertos} veces en el período)`}
                  </p>
                )}
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dowData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} />
                      <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} width={60} />
                      <Tooltip
                        formatter={(v: any, _name: any, props: any) => {
                          const label = props?.payload?.dia === 'Domingo' ? 'Promedio (cerrado)' : 'Promedio'
                          return [fmt(Number(v)), label]
                        }}
                      />
                      <Bar dataKey="avg" name="Promedio" radius={[6, 6, 0, 0]}>
                        {dowData.map((entry, index) => (
                          <Cell key={index} fill={entry.dia === 'Domingo' ? '#d1d5db' : ACCENT} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {data.tendencia.domingo_tipicamente_cerrado && (
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: ACCENT }} /> Días abiertos</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-gray-200" /> Domingo (cerrado)</span>
                  </div>
                )}
              </div>

              {/* Mensual */}
              {mensualData.length > 0 && (
                <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Evolución mensual (promedio diario)</p>
                    {ajustarInflacion && inflacionBase && (
                      <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
                        Pesos de {inflacionBase}
                      </span>
                    )}
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mensualData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                        <defs>
                          <linearGradient id="menGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={PURPLE} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={PURPLE} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                        <XAxis
                          dataKey="mes"
                          tickFormatter={fmtMes}
                          tick={{ fontSize: 10, fill: '#9ca3af', angle: -45, textAnchor: 'end' }}
                          tickLine={false}
                          interval={1}
                        />
                        <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} width={60} />
                        <Tooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null
                            return (
                              <div className="bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl shadow-lg p-3 text-xs">
                                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{fmtMes(String(label))}</p>
                                <p className="text-gray-500">
                                  Promedio diario:{' '}
                                  <span className="font-bold" style={{ color: PURPLE }}>{fmt(Number(payload[0].value))}</span>
                                </p>
                              </div>
                            )
                          }}
                        />
                        <Area dataKey="avg" stroke={PURPLE} strokeWidth={2.5} fill="url(#menGrad)" name="Promedio diario" dot={{ fill: PURPLE, r: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Tendencia general */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Tendencia general', value: data.tendencia.tendencia === 'positiva' ? '↑ Positiva' : '↓ Negativa', color: data.tendencia.tendencia === 'positiva' ? GREEN : RED },
                  { label: 'Crecimiento del período', value: pct(data.tendencia.crecimiento_periodo_pct), color: data.tendencia.crecimiento_periodo_pct >= 0 ? GREEN : RED },
                  { label: 'Variación diaria', value: `${data.tendencia.slope_diario >= 0 ? '+' : ''}${fmt(data.tendencia.slope_diario)}/día`, color: data.tendencia.slope_diario >= 0 ? GREEN : RED },
                ].map((item, i) => (
                  <div key={i} className="bg-white dark:bg-dark-surface rounded-xl border border-gray-100 dark:border-dark-border p-4 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">{item.label}</p>
                    <p className="text-lg font-black" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

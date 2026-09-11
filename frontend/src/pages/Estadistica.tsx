import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw, DollarSign, ShoppingBag, Receipt,
  BarChart2, PieChart, ChevronDown, Clock,
  AlertCircle, CheckCircle, Sun, Moon, TrendingDown, Layers, TrendingUp,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { estadisticaApi } from '../lib/api'
import type { StatsCompletas, ActualizarStatsResult, MetaEstadistica, InflationData, TurnoDiario } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { useToast, ToastContainer } from '../components/ui/Toast'
import { formatCurrency, formatDate, getErrorMessage } from '../lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_COLORS: Record<string, string> = {
  Efectivo:        '#D97A2B',
  'Mercado Pago':  '#009EE3',
  Vales:           '#7A8A3A',
  Debito:          '#1F5D50',
  Credito:         '#6B4EFF',
  Transferencia:   '#8E5E3B',
  Otros:           '#6C757D',
}

const RUBRO_COLORS = ['#C8860A', '#10b981', '#6366F1', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#a855f7']

const ACCENT  = '#C8860A'
const M_COLOR = '#F59E0B'
const N_COLOR = '#6366F1'
const P_COLOR = '#a855f7'

// ─── Utils ────────────────────────────────────────────────────────────────────

function pct(v: number) { return `${(v * 100).toFixed(1)}%` }

function resolveInflKey(label: string): string {
  if (/^\d{2}\/\d{4}$/.test(label)) {
    const [mm, yy] = label.split('/')
    return `${yy}-${mm}`
  }
  if (/^\d{4}-\d{2}/.test(label)) return label.substring(0, 7)
  return label
}

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtPeriodLabel(label: string): string {
  // "06/2026" → "Jun '26"
  if (/^\d{2}\/\d{4}$/.test(label)) {
    const [mm, yyyy] = label.split('/')
    return `${MES_CORTO[parseInt(mm, 10) - 1]} '${yyyy.slice(2)}`
  }
  // "2026-06" → "Jun '26"
  if (/^\d{4}-\d{2}/.test(label)) {
    const [yyyy, mm] = label.split('-')
    return `${MES_CORTO[parseInt(mm, 10) - 1]} '${yyyy.slice(2)}`
  }
  return label
}

function fmtDayLabel(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`
  return isoDate
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

type HeatmapPayload = { index: string[]; columns: string[]; values: number[][] }

// ─── UI primitives ────────────────────────────────────────────────────────────

function MiniBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="h-1.5 bg-gray-100 dark:bg-dark-border rounded-full overflow-hidden flex-1">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${w}%`, backgroundColor: color || ACCENT }}
      />
    </div>
  )
}

function Section({
  title, icon: Icon, children, defaultOpen = true, badge,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode
  defaultOpen?: boolean; badge?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-secondary dark:hover:bg-dark-elevated/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</span>
          {badge && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-elevated text-gray-500 dark:text-gray-400 font-medium">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-gray-100 dark:border-dark-border">{children}</div>}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, icon: Icon, color = ACCENT, isAdj = false, nominal,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType
  color?: string; isAdj?: boolean; nominal?: string
}) {
  return (
    <div className={`card p-5 transition-colors ${isAdj ? 'border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20' : ''}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${isAdj ? 'bg-purple-100 dark:bg-purple-900/50' : ''}`}
        style={!isAdj ? { backgroundColor: `${color}18` } : undefined}>
        <Icon className="w-[18px] h-[18px]" style={{ color: isAdj ? P_COLOR : color }} />
      </div>
      <p className="label-xs mb-1">{label}</p>
      <p className={`font-display text-2xl font-bold tabular-nums tracking-tight ${isAdj ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </p>
      {isAdj && nominal && (
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 tabular-nums">
          <span className="line-through">{nominal}</span>
          <span className="ml-1 text-purple-400 dark:text-purple-600">nominal</span>
        </p>
      )}
      {sub && <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Gráfico de facturación diaria (Recharts AreaChart apilado) ───────────────

// DOW en JS: 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb

function DailyAreaChart({
  data, selectedTurno, inflFactor,
}: {
  data: TurnoDiario[]
  selectedTurno: 'ambos' | 'manana' | 'noche'
  inflFactor: number
}) {
  // Rellenar rango completo de fechas (incluye días con 0 ventas)
  const chartData = useMemo(() => {
    if (data.length === 0) return []

    const byDate: Record<string, TurnoDiario> = {}
    for (const d of data) byDate[d.date] = d

    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
    // Usar T12:00:00 para evitar offset de zona horaria al parsear
    const start = new Date(sorted[0].date + 'T12:00:00')
    const end   = new Date(sorted[sorted.length - 1].date + 'T12:00:00')

    const result = []
    const cur = new Date(start)
    while (cur <= end) {
      const iso = cur.toISOString().split('T')[0]
      const dow = cur.getDay()
      const ex  = byDate[iso]
      const manana = Math.round((ex?.manana_sales ?? 0) * inflFactor)
      const noche  = Math.round((ex?.noche_sales  ?? 0) * inflFactor)
      // Cerrado solo si AMBOS turnos son 0 — lógica puramente por datos, no por día
      const cerrado = manana === 0 && noche === 0
      result.push({
        fecha:          fmtDayLabel(iso),
        dow,
        manana,
        noche,
        total:          manana + noche,
        manana_orders:  ex?.manana_orders ?? 0,
        noche_orders:   ex?.noche_orders  ?? 0,
        manana_cerrado: cerrado,
        noche_cerrado:  cerrado,
        tieneData:      !!ex,
      })
      cur.setDate(cur.getDate() + 1)
    }
    // Excluir días sin datos del backend (días que nunca tuvieron actividad registrada)
    return result.filter(entry => entry.tieneData)
  }, [data, inflFactor])

  const tickInterval = chartData.length > 60 ? Math.ceil(chartData.length / 20) - 1
    : chartData.length > 30 ? 3
    : chartData.length > 14 ? 1
    : 0

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="dManana" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={M_COLOR} stopOpacity={0.35} />
              <stop offset="95%" stopColor={M_COLOR} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="dNoche" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={N_COLOR} stopOpacity={0.35} />
              <stop offset="95%" stopColor={N_COLOR} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            width={60}
          />
          <Tooltip
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              const dowName = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][d.dow] ?? ''
              return (
                <div className="bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl shadow-lg p-3 text-xs space-y-1">
                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label} <span className="font-normal text-gray-400 capitalize">({dowName})</span></p>
                  {(selectedTurno === 'ambos' || selectedTurno === 'manana') && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: M_COLOR }} />
                      <span className="text-gray-500">Mañana:</span>
                      {d.manana_cerrado
                        ? <span className="text-gray-400 italic">cerrado</span>
                        : <>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{fmtK(d.manana)}</span>
                            {d.manana_orders > 0 && <span className="text-gray-400">({d.manana_orders} ped.)</span>}
                          </>
                      }
                    </div>
                  )}
                  {(selectedTurno === 'ambos' || selectedTurno === 'noche') && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: N_COLOR }} />
                      <span className="text-gray-500">Noche:</span>
                      {d.noche_cerrado
                        ? <span className="text-gray-400 italic">cerrado</span>
                        : <>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{fmtK(d.noche)}</span>
                            {d.noche_orders > 0 && <span className="text-gray-400">({d.noche_orders} ped.)</span>}
                          </>
                      }
                    </div>
                  )}
                  {selectedTurno === 'ambos' && d.total > 0 && (
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-dark-border mt-1">
                      <span className="text-gray-500">Total:</span>
                      <span className="font-bold" style={{ color: ACCENT }}>{fmtK(d.total)}</span>
                    </div>
                  )}
                </div>
              )
            }}
          />
          {(selectedTurno === 'ambos' || selectedTurno === 'manana') && (
            <Area
              dataKey="manana"
              stackId="t"
              stroke={M_COLOR}
              strokeWidth={1.5}
              fill="url(#dManana)"
              name="Mañana"
              dot={false}
            />
          )}
          {(selectedTurno === 'ambos' || selectedTurno === 'noche') && (
            <Area
              dataKey="noche"
              stackId="t"
              stroke={N_COLOR}
              strokeWidth={1.5}
              fill="url(#dNoche)"
              name="Noche"
              dot={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Gráfico de tendencia mensual (Recharts AreaChart) ────────────────────────

function MonthlyTrendChart({
  data, inflFactor,
}: {
  data: import('../types').TimeseriesPoint[]
  inflFactor: number
}) {
  const chartData = data.map(d => ({
    mes:   d.period_label,
    value: Math.round(d.sales_total * inflFactor),
    orders: d.orders_count ?? 0,
  }))

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 44 }}>
          <defs>
            <linearGradient id="menGradEst" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.3} />
              <stop offset="95%" stopColor={ACCENT} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
          <XAxis
            dataKey="mes"
            tickFormatter={fmtPeriodLabel}
            tick={{ fontSize: 10, fill: '#9ca3af', angle: -45, textAnchor: 'end' }}
            tickLine={false}
            interval={1}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            width={60}
          />
          <Tooltip
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              return (
                <div className="bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl shadow-lg p-3 text-xs">
                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{fmtPeriodLabel(String(label))}</p>
                  <p className="text-gray-500">
                    Facturación:{' '}
                    <span className="font-bold" style={{ color: ACCENT }}>{fmtK(d.value)}</span>
                  </p>
                  {d.orders > 0 && (
                    <p className="text-gray-400 mt-0.5">{d.orders.toLocaleString('es-AR')} pedidos</p>
                  )}
                </div>
              )
            }}
          />
          <Area
            dataKey="value"
            stroke={ACCENT}
            strokeWidth={2.5}
            fill="url(#menGradEst)"
            name="Facturación"
            dot={{ fill: ACCENT, r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Mapa de calor (día de semana × hora) ─────────────────────────────────────

function WeekdayHourHeatmap({ data }: { data: HeatmapPayload }) {
  const maxVal = Math.max(...data.values.flatMap(row => row), 1)

  const fmtHour = (h: string) => {
    if (h.includes(':')) return h
    const n = parseInt(h, 10)
    return `${String(n).padStart(2, '0')}:00`
  }

  const isManana = (h: string) => {
    const n = parseInt(h, 10)
    return n >= 9 && n < 17
  }

  const allVals = data.values.flatMap(r => r).filter(v => v > 0).sort((a, b) => a - b)
  const p90     = allVals[Math.floor(allVals.length * 0.9)] ?? maxVal
  const normBy  = p90 || maxVal

  const cellStyle = (val: number, h: string): React.CSSProperties => {
    if (val <= 0) {
      return {
        backgroundColor: 'rgba(128,128,128,0.04)',
        border: '1px solid rgba(128,128,128,0.07)',
      }
    }
    const t = Math.sqrt(Math.min(1, val / normBy))
    const [r, g, b] = isManana(h) ? [245, 158, 11] : [99, 102, 241]
    return {
      backgroundColor: `rgba(${r},${g},${b},${0.07 + t * 0.89})`,
      border: `1px solid rgba(${r},${g},${b},${0.1 + t * 0.5})`,
      boxShadow: t > 0.55 ? `inset 0 1px 0 rgba(255,255,255,0.14)` : undefined,
    }
  }

  const MIN_CELL = 28
  const DAY_W   = 60

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: DAY_W + data.columns.length * (MIN_CELL + 4) }}>
        <div className="flex gap-1 mb-2" style={{ paddingLeft: DAY_W }}>
          {data.columns.map(h => (
            <div key={h} className="flex-1 flex items-end justify-center overflow-visible" style={{ height: 44 }}>
              <span
                className="font-mono text-gray-400 dark:text-gray-600 select-none"
                style={{
                  fontSize: 9,
                  display: 'block',
                  transformOrigin: 'center bottom',
                  transform: 'rotate(-55deg) translateX(2px)',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  marginBottom: 2,
                }}
              >
                {fmtHour(h)}
              </span>
            </div>
          ))}
        </div>

        {data.index.map((day, di) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <div className="flex-none text-right pr-3 text-xs font-medium text-gray-600 dark:text-gray-400" style={{ width: DAY_W }}>
              {day}
            </div>
            {data.columns.map((h, hi) => {
              const val = data.values[di]?.[hi] ?? 0
              return (
                <div
                  key={h}
                  className="flex-1 rounded-lg cursor-default transition-opacity hover:opacity-75"
                  style={{ height: 28, ...cellStyle(val, h) }}
                  title={val > 0 ? `${day} ${fmtHour(h)} — ${formatCurrency(val)}` : `${day} ${fmtHour(h)}`}
                />
              )
            })}
          </div>
        ))}

        <div className="flex gap-5 mt-4" style={{ paddingLeft: DAY_W }}>
          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: M_COLOR, opacity: 0.75 }} />
            Mañana 09:00–16:30
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: N_COLOR, opacity: 0.75 }} />
            Noche 16:30–03:00
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Gráfico de barras horizontal simple ─────────────────────────────────────

function HBarChart({ items, color = ACCENT }: {
  items: { label: string; value: number; sub?: string }[]
  color?: string
}) {
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-sm text-gray-700 dark:text-gray-300 w-28 sm:w-36 flex-shrink-0 truncate">{it.label}</span>
          <div className="flex-1 h-2 bg-gray-100 dark:bg-dark-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100 w-24 text-right flex-shrink-0">
            {formatCurrency(it.value)}
          </span>
          {it.sub && (
            <span className="hidden sm:block text-xs text-gray-400 dark:text-gray-600 w-14 text-right flex-shrink-0">{it.sub}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Estadistica() {
  const { toasts, addToast, removeToast } = useToast()

  const [stats, setStats]           = useState<StatsCompletas | null>(null)
  const [meta, setMeta]             = useState<MetaEstadistica | null>(null)
  const [loading, setLoading]       = useState(false)
  const [loadingUpd, setLoadingUpd] = useState(false)
  const [resultado, setResultado]   = useState<ActualizarStatsResult | null>(null)
  const [fromCache, setFromCache]   = useState<boolean | null>(null)
  const [genAt, setGenAt]           = useState<string | null>(null)

  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [inflationData, setInflationData]         = useState<InflationData | null>(null)
  const [inflationAdjusted, setInflationAdjusted] = useState(false)
  const [selectedTurno, setSelectedTurno]         = useState<'ambos' | 'manana' | 'noche'>('ambos')

  // ─── Loaders ──────────────────────────────────────────────────────────────

  const loadMeta = useCallback(async () => {
    try { setMeta(await estadisticaApi.meta()) } catch { /* silencioso */ }
  }, [])

  const loadStats = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const data = await estadisticaApi.completas({
        sucursal_id:   '1',
        start_date:    startDate || undefined,
        end_date:      endDate   || undefined,
        force_refresh: force     || undefined,
        turno:         selectedTurno !== 'ambos' ? selectedTurno : undefined,
      })
      setStats(data)
      setFromCache((data as any)._from_cache ?? null)
      setGenAt((data as any)._generated_at ?? null)
    } catch (err) {
      addToast('error', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedTurno, addToast])

  const loadInflation = useCallback(async () => {
    try { setInflationData(await estadisticaApi.inflation()) } catch { /* silencioso */ }
  }, [])

  const handleUpdate = async () => {
    setLoadingUpd(true)
    setResultado(null)
    try {
      const res = await estadisticaApi.actualizar({ sucursal_id: '1', period: 'historical' })
      setResultado(res)
      addToast('success', 'Base de datos actualizada')
      await loadMeta()
      await loadStats(true)
    } catch (err) {
      addToast('error', getErrorMessage(err))
    } finally {
      setLoadingUpd(false)
    }
  }

  useEffect(() => {
    loadMeta()
    loadStats(false)
    loadInflation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Inflation ────────────────────────────────────────────────────────────

  const blendedFactor = useMemo(() => {
    if (!inflationAdjusted || !inflationData?.indices || !stats) return 1
    const monthly = stats.sales_timeseries_monthly
    if (monthly.length === 0) {
      const now = new Date()
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      return inflationData.indices[key] ?? 1
    }
    const adjSum = monthly.reduce(
      (s, m) => s + m.sales_total * (inflationData.indices[resolveInflKey(m.period_label)] ?? 1), 0
    )
    const nomSum = monthly.reduce((s, m) => s + m.sales_total, 0)
    return nomSum > 0 ? adjSum / nomSum : 1
  }, [inflationAdjusted, inflationData, stats])

  const adj  = (v: number) => formatCurrency(v * blendedFactor)
  const adjK = (v: number) => fmtK(v * blendedFactor)

  // ─── Derived ──────────────────────────────────────────────────────────────

  const ov      = stats?.overview
  const turno   = stats?.turno_breakdown
  const heatmap = (stats as any)?.weekday_hour_heatmap as HeatmapPayload | undefined

  const isAdj = inflationAdjusted && blendedFactor !== 1

  // Pedidos/día promedio
  const diasRango = useMemo(() => {
    if (!stats?.date_range?.start_date || !stats?.date_range?.end_date) return 0
    const a = new Date(stats.date_range.start_date)
    const b = new Date(stats.date_range.end_date)
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1)
  }, [stats])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Métricas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
            Ventas, productos y análisis de Santa Cebada
          </p>
        </div>
        {meta?.ultima_actualizacion && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600 bg-surface-secondary dark:bg-dark-elevated px-3 py-1.5 rounded-xl">
            <Clock className="w-3 h-3" />
            Última actualización: {formatDate(meta.ultima_actualizacion)}
          </div>
        )}
      </div>

      {/* ── Panel Actualizar ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Actualizar base de datos</h2>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Descarga los datos nuevos de NucleoCheck desde la última actualización hacia adelante.
              Los datos existentes nunca se sobreescriben.
            </p>
            {meta?.rango_disponible?.max_date && (
              <p className="text-xs text-gray-400 dark:text-gray-600">
                Última fecha en base: <span className="font-medium text-gray-700 dark:text-gray-300">{meta.rango_disponible.max_date}</span>
              </p>
            )}
          </div>
          <button onClick={handleUpdate} disabled={loadingUpd} className="btn-primary flex-shrink-0">
            {loadingUpd
              ? <><Spinner size="sm" className="text-white" /> Actualizando...</>
              : <><RefreshCw className="w-4 h-4" /> Actualizar</>}
          </button>
        </div>
        {resultado && (
          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-dark-border animate-slide-up">
            {resultado.resultados.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-success/5 dark:bg-success/10 rounded-xl border border-success/20">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.sucursal}</span>
                <span className="text-xs text-gray-500 dark:text-gray-500 ml-1">
                  {r.pedidos} pedidos · {formatCurrency(r.facturacion)}
                  {(r as any).note && <span className="ml-2 text-gray-400">— {(r as any).note}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Panel Consultar ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Consultar estadísticas</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {fromCache !== null && (
              <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg ${
                fromCache ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
              }`}>
                {fromCache
                  ? <><CheckCircle className="w-3 h-3" /> Caché{genAt ? ` · ${formatDate(genAt)}` : ''}</>
                  : <><RefreshCw className="w-3 h-3" /> Procesado ahora</>}
              </span>
            )}
            {inflationData?.base_month && (
              <button
                onClick={() => setInflationAdjusted(v => !v)}
                title={`Fuente: ${inflationData.source}`}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  inflationAdjusted
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                    : 'bg-surface-secondary dark:bg-dark-elevated text-gray-500 dark:text-gray-400 border-gray-200 dark:border-dark-border hover:bg-gray-100 dark:hover:bg-dark-border'
                }`}
              >
                <TrendingDown className="w-3 h-3" />
                {inflationAdjusted ? `$ de ${inflationData.base_month}` : 'Ajustar inflación'}
              </button>
            )}
          </div>
        </div>

        {inflationAdjusted && inflationData?.base_month && (
          <p className="text-xs text-purple-600 dark:text-purple-400 mb-3 bg-purple-500/5 px-3 py-1.5 rounded-lg">
            Valores ajustados a pesos de {inflationData.base_month} · {inflationData.source}
          </p>
        )}

        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-500">Desde</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input text-sm w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-500">Hasta</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input text-sm w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-500">Turno</label>
            <div className="flex rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
              {(['ambos', 'manana', 'noche'] as const).map(val => (
                <button
                  key={val}
                  onClick={() => setSelectedTurno(val)}
                  className={`text-xs px-3 py-1.5 transition-colors ${
                    selectedTurno === val
                      ? val === 'manana' ? 'bg-amber-500 text-white font-medium'
                        : val === 'noche' ? 'bg-indigo-500 text-white font-medium'
                        : 'bg-accent text-white font-medium'
                      : 'bg-surface-secondary dark:bg-dark-elevated text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border'
                  }`}
                >
                  {val === 'ambos' ? 'Ambos' : val === 'manana' ? 'Mañana' : 'Noche'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => loadStats(false)} disabled={loading} className="btn-primary">
            {loading ? <Spinner size="sm" className="text-white" /> : <BarChart2 className="w-4 h-4" />}
            Consultar
          </button>
          <button onClick={() => loadStats(true)} disabled={loading} className="btn-secondary"
            title="Ignorar caché y reprocesar desde la DB">
            <RefreshCw className="w-3.5 h-3.5" /> Forzar
          </button>
        </div>

        {meta?.rango_disponible?.min_date && (
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
            Datos disponibles: {meta.rango_disponible.min_date} → {meta.rango_disponible.max_date}
          </p>
        )}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500 dark:text-gray-500">Cargando estadísticas...</p>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !stats && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-dark-elevated flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Sin datos — actualizá la base de datos primero
          </p>
        </div>
      )}

      {/* ── Data ── */}
      {!loading && stats && ov && (
        <div className="space-y-5 animate-slide-up">

          {/* ── Turno badge ── */}
          {selectedTurno !== 'ambos' && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
              selectedTurno === 'manana'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400'
            }`}>
              {selectedTurno === 'manana' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              Mostrando solo {selectedTurno === 'manana' ? 'Turno Mañana (09:00 – 16:30)' : 'Turno Noche (16:30 – 03:00)'}
            </div>
          )}

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KPICard
              label="Facturación"
              value={isAdj ? adj(ov.sales_total) : formatCurrency(ov.sales_total)}
              nominal={isAdj ? formatCurrency(ov.sales_total) : undefined}
              sub={`${ov.order_count.toLocaleString('es-AR')} pedidos`}
              icon={DollarSign}
              color={ACCENT}
              isAdj={isAdj}
            />
            <KPICard
              label="Margen bruto"
              value={isAdj ? adj(ov.gain_total) : formatCurrency(ov.gain_total)}
              nominal={isAdj ? formatCurrency(ov.gain_total) : undefined}
              sub={ov.sales_total > 0 ? `${((ov.gain_total / ov.sales_total) * 100).toFixed(1)}% sobre ventas` : undefined}
              icon={TrendingUp}
              color="#10b981"
              isAdj={isAdj}
            />
            <KPICard
              label="Ticket promedio"
              value={isAdj ? adj(ov.ticket_average) : formatCurrency(ov.ticket_average)}
              nominal={isAdj ? formatCurrency(ov.ticket_average) : undefined}
              icon={Receipt}
              color="#6366F1"
              isAdj={isAdj}
            />
            <KPICard
              label="Pedidos/día"
              value={diasRango > 0 ? (ov.order_count / diasRango).toFixed(1) : '—'}
              sub={diasRango > 0 ? `en ${diasRango} días` : undefined}
              icon={ShoppingBag}
              color="#14b8a6"
            />
            <KPICard
              label="Gastos"
              value={isAdj ? adj(ov.cost_total) : formatCurrency(ov.cost_total)}
              nominal={isAdj ? formatCurrency(ov.cost_total) : undefined}
              icon={TrendingDown}
              color="#ef4444"
              isAdj={isAdj}
            />
          </div>

          {/* ── Turnos ── */}
          {turno && selectedTurno === 'ambos' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mañana */}
                <div className="card p-5" style={{ borderLeft: `3px solid ${isAdj ? P_COLOR : M_COLOR}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Sun style={{ color: isAdj ? P_COLOR : M_COLOR, width: 16, height: 16 }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: isAdj ? P_COLOR : M_COLOR }}>
                      Turno Mañana · 09:00 – 16:30
                    </span>
                  </div>
                  <p className={`font-display text-2xl font-bold tabular-nums ${isAdj ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-gray-100'}`}>
                    {isAdj ? adj(turno.summary.manana.sales_total) : formatCurrency(turno.summary.manana.sales_total)}
                  </p>
                  {isAdj && (
                    <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
                      <span className="line-through">{formatCurrency(turno.summary.manana.sales_total)}</span>
                      <span className="ml-1 text-purple-400">nominal</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-gray-500">
                    <span>{turno.summary.manana.orders_count} pedidos</span>
                    <span>·</span>
                    <span>Ticket {isAdj ? adj(turno.summary.manana.ticket_average) : formatCurrency(turno.summary.manana.ticket_average)}</span>
                    <span>·</span>
                    <span className="font-semibold" style={{ color: M_COLOR }}>{pct(turno.summary.manana.share_sales)} del total</span>
                  </div>
                </div>

                {/* Noche */}
                <div className="card p-5" style={{ borderLeft: `3px solid ${isAdj ? P_COLOR : N_COLOR}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Moon style={{ color: isAdj ? P_COLOR : N_COLOR, width: 16, height: 16 }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: isAdj ? P_COLOR : N_COLOR }}>
                      Turno Noche · 16:30 – 03:00
                    </span>
                  </div>
                  <p className={`font-display text-2xl font-bold tabular-nums ${isAdj ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-gray-100'}`}>
                    {isAdj ? adj(turno.summary.noche.sales_total) : formatCurrency(turno.summary.noche.sales_total)}
                  </p>
                  {isAdj && (
                    <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
                      <span className="line-through">{formatCurrency(turno.summary.noche.sales_total)}</span>
                      <span className="ml-1 text-purple-400">nominal</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-gray-500">
                    <span>{turno.summary.noche.orders_count} pedidos</span>
                    <span>·</span>
                    <span>Ticket {isAdj ? adj(turno.summary.noche.ticket_average) : formatCurrency(turno.summary.noche.ticket_average)}</span>
                    <span>·</span>
                    <span className="font-semibold" style={{ color: N_COLOR }}>{pct(turno.summary.noche.share_sales)} del total</span>
                  </div>
                </div>
              </div>

              {/* Barra de distribución */}
              <div className="card px-5 py-3">
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div className="transition-all duration-700"
                    style={{ width: `${turno.summary.manana.share_sales * 100}%`, backgroundColor: isAdj ? P_COLOR : M_COLOR, opacity: 0.8 }} />
                  <div className="transition-all duration-700"
                    style={{ width: `${turno.summary.noche.share_sales * 100}%`, backgroundColor: isAdj ? `${P_COLOR}80` : N_COLOR, opacity: 0.8 }} />
                </div>
                <div className="flex gap-5 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: M_COLOR }} />
                    Mañana {pct(turno.summary.manana.share_sales)}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: N_COLOR }} />
                    Noche {pct(turno.summary.noche.share_sales)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Facturación diaria ── */}
          {turno && turno.by_business_date.length > 0 && (
            <Section
              title={selectedTurno === 'ambos' ? 'Facturación diaria por turno'
                : selectedTurno === 'manana' ? 'Facturación diaria · Mañana'
                : 'Facturación diaria · Noche'}
              icon={BarChart2}
              badge={`${turno.by_business_date.length} días`}
              defaultOpen
            >
              <div className="p-5">
                {isAdj && (
                  <p className="text-xs text-purple-500 dark:text-purple-400 mb-3">
                    Valores ajustados · pesos de {inflationData?.base_month}
                  </p>
                )}
                <DailyAreaChart
                  data={turno.by_business_date}
                  selectedTurno={selectedTurno}
                  inflFactor={blendedFactor}
                />
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
                  {selectedTurno !== 'noche' && (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: M_COLOR }} />
                      Mañana <span className="text-gray-400">(cierra sáb. y dom.)</span>
                    </span>
                  )}
                  {selectedTurno !== 'manana' && (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: N_COLOR }} />
                      Noche <span className="text-gray-400">(cierra dom.)</span>
                    </span>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* ── Tendencia mensual ── */}
          {stats.sales_timeseries_monthly.length > 0 && (
            <Section
              title="Tendencia mensual"
              icon={TrendingUp}
              badge={`${stats.sales_timeseries_monthly.length} meses`}
              defaultOpen
            >
              <div className="p-5">
                {isAdj && (
                  <p className="text-xs text-purple-500 dark:text-purple-400 mb-3">
                    Valores ajustados · pesos de {inflationData?.base_month}
                  </p>
                )}
                <MonthlyTrendChart
                  data={stats.sales_timeseries_monthly}
                  inflFactor={blendedFactor}
                />
              </div>
            </Section>
          )}

          {/* ── Mapa de calor ── */}
          {heatmap && heatmap.index.length > 0 && heatmap.columns.length > 0 && (
            <Section title="Actividad por hora y día de semana" icon={Clock} defaultOpen>
              <div className="p-5">
                <WeekdayHourHeatmap data={heatmap} />
              </div>
            </Section>
          )}

          {/* ── Top 10 productos ── */}
          {stats.top_products_by_quantity.length > 0 && (
            <Section title="Top 10 productos más vendidos" icon={ShoppingBag} defaultOpen>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-dark-border">
                      <th className="text-left px-5 py-3 table-header">#</th>
                      <th className="text-left px-5 py-3 table-header">Producto</th>
                      <th className="text-left px-5 py-3 table-header hidden sm:table-cell">Rubro</th>
                      <th className="text-right px-5 py-3 table-header">Unidades</th>
                      <th className="text-right px-5 py-3 table-header hidden md:table-cell">% Rev.</th>
                      <th className="text-right px-5 py-3 table-header">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-dark-border">
                    {stats.top_products_by_quantity.slice(0, 10).map((p, i) => {
                      const maxRev = stats.top_products_by_quantity[0]?.revenue_total || 1
                      return (
                        <tr key={p.codigo_clean} className="hover:bg-surface-secondary dark:hover:bg-dark-elevated/50 transition-colors">
                          <td className="px-5 py-3 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.nombre_clean}</p>
                            <div className="mt-1 h-1.5 bg-gray-100 dark:bg-dark-border rounded-full overflow-hidden w-24">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.max(2, (p.revenue_total / maxRev) * 100)}%`, backgroundColor: RUBRO_COLORS[i % RUBRO_COLORS.length] }}
                              />
                            </div>
                          </td>
                          <td className="px-5 py-3 hidden sm:table-cell">
                            <span className="badge badge-neutral capitalize">{p.rubro}</span>
                          </td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums font-bold text-gray-900 dark:text-gray-100">
                            {p.quantity_total.toLocaleString('es-AR')}
                          </td>
                          <td className="px-5 py-3 text-right text-xs tabular-nums text-gray-400 hidden md:table-cell">
                            {(p.revenue_share * 100).toFixed(1)}%
                          </td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums text-gray-500">
                            {isAdj ? adjK(p.revenue_total) : fmtK(p.revenue_total)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ── Métodos de pago ── */}
          {stats.payment_summary.length > 0 && (
            <Section title="Métodos de pago" icon={PieChart} defaultOpen>
              <div className="p-5 space-y-3.5">
                {(() => {
                  const totalRev = stats.payment_summary.reduce((s, p) => s + p.amount_total, 0)
                  const sorted = [...stats.payment_summary].sort((a, b) => b.amount_total - a.amount_total)
                  const maxAmt = sorted[0]?.amount_total ?? 1
                  return sorted.map(p => {
                    const sharePct = totalRev > 0 ? (p.amount_total / totalRev * 100).toFixed(1) : '0'
                    const avg = p.payment_count > 0 ? p.amount_total / p.payment_count : 0
                    return (
                      <div key={p.payment_category}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: PAYMENT_COLORS[p.payment_category] || '#6C757D' }} />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.payment_category}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="font-semibold" style={{ color: PAYMENT_COLORS[p.payment_category] || '#6C757D' }}>
                              {sharePct}%
                            </span>
                            <span className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                              {isAdj ? adjK(p.amount_total) : fmtK(p.amount_total)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-dark-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(2, (p.amount_total / maxAmt) * 100)}%`, backgroundColor: PAYMENT_COLORS[p.payment_category] || '#6C757D' }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-28 text-right flex-shrink-0">
                            {p.payment_count.toLocaleString('es-AR')} op. · {fmtK(avg)} prom.
                          </span>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </Section>
          )}

          {/* ── Rubros ── */}
          {stats.rubro_summary.length > 0 && (
            <Section title="Ventas por rubro" icon={Layers} defaultOpen>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
                  {stats.rubro_summary.map((r, i) => (
                    <div key={r.rubro}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RUBRO_COLORS[i % RUBRO_COLORS.length] }} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{r.rubro}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400">{(r.revenue_share * 100).toFixed(1)}%</span>
                          <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {isAdj ? adjK(r.revenue_total) : fmtK(r.revenue_total)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-dark-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(2, r.revenue_share * 100)}%`, backgroundColor: RUBRO_COLORS[i % RUBRO_COLORS.length] }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {r.quantity_total.toLocaleString('es-AR')} uds · {r.active_products} productos
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* ── Gastos por tipo ── */}
          {stats.expense_summary.length > 0 && (
            <Section title="Gastos por tipo" icon={TrendingDown} defaultOpen={false}>
              <div className="p-5">
                <HBarChart
                  color="#ef4444"
                  items={stats.expense_summary.map(e => ({
                    label: e.tipo_gasto_clean || 'Sin tipo',
                    value: e.cost_total,
                    sub:   `${(e.share_amount * 100).toFixed(1)}%`,
                  }))}
                />
              </div>
            </Section>
          )}

        </div>
      )}
    </div>
  )
}

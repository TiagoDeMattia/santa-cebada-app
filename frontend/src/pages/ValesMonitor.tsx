import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ChevronUp, Star } from 'lucide-react'
import { valesApi, panel8586Api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

type TurnoData     = Awaited<ReturnType<typeof valesApi.getTurno>>
type ComidaData    = Awaited<ReturnType<typeof valesApi.getComidaTurno>>
type Alerta        = {
  nombre: string
  tipo: number | null
  nota: string | null
  rubro_nombre: string | null
  source: string
  priorizado?: boolean
}

// ─── utils ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return '$' + Math.round(n).toLocaleString('es-AR') }
function pct(n: number) { return n.toFixed(1) + '%' }

function openAsPopup() {
  const w = 380, h = window.screen.availHeight - 20
  window.open(
    window.location.href, 'cajero_monitor',
    `width=${w},height=${h},left=${window.screen.availWidth - w - 10},top=0,resizable=yes,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no`
  )
}

// ─── Section component ────────────────────────────────────────────────────────

function Section({
  id, title, badge, open, onToggle, children,
}: {
  id: string
  title: string
  badge?: number | string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-gray-800 first:border-t-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{title}</span>
          {badge !== undefined && badge !== 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500">
              {badge}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp  className="w-3.5 h-3.5 text-gray-600" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ─── ValesSection ────────────────────────────────────────────────────────────

function ValesSection({ data }: { data: TurnoData | null }) {
  if (!data) return <p className="text-gray-600 text-xs text-center py-3 animate-pulse">Cargando...</p>

  const pctVal   = data.porcentaje_vales ?? 0
  const objetivo = data.objetivo_pct ?? 30
  const barPct   = Math.min((pctVal / objetivo) * 100, 120)
  const enObj    = data.en_objetivo ?? false
  const barColor = enObj ? 'bg-green-500' : pctVal >= objetivo * 0.85 ? 'bg-amber-400' : 'bg-pink-500'
  const numColor = enObj ? 'text-green-400' : pctVal >= objetivo * 0.85 ? 'text-amber-400' : 'text-pink-400'

  return (
    <div className="space-y-3 pt-1">
      <div className="text-center">
        <div className={`text-6xl font-black tabular-nums leading-none ${numColor}`}>
          {pct(pctVal)}
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5 font-medium uppercase tracking-widest">
          de vales sobre total
        </p>
      </div>

      <div className="space-y-1">
        <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${barPct}%` }} />
          <div className="absolute top-0 right-0 bottom-0 w-0.5 bg-white/20" />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 font-medium">
          <span>0%</span>
          <span className="text-gray-500">objetivo {objetivo}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold mb-0.5">Total Vales</p>
          <p className="text-base font-black text-white tabular-nums">{fmt(data.total_vales)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold mb-0.5">Total General</p>
          <p className="text-base font-black text-white tabular-nums">{fmt(data.total_cobrado)}</p>
        </div>
      </div>

      <div className={`flex items-center justify-center gap-2 py-2 rounded-lg font-black text-sm ${
        enObj
          ? 'bg-green-500/15 text-green-400 border border-green-500/20'
          : 'bg-pink-500/15 text-pink-400 border border-pink-500/20'
      }`}>
        {enObj
          ? <><span>✓</span><span>En objetivo · excede {fmt(Math.abs(data.diferencia))}</span></>
          : <><span>↑</span><span>Faltan {fmt(Math.abs(data.diferencia))} para el {objetivo}%</span></>}
      </div>
    </div>
  )
}

// ─── ComidaSection ────────────────────────────────────────────────────────────

function ComidaSection({ data, lastUpdate }: { data: ComidaData | null; lastUpdate: Date | null }) {
  if (!data) return <p className="text-gray-600 text-xs text-center py-3 animate-pulse">Calculando...</p>

  const ratio10  = data.ratio_por_10 ?? 0
  const enObj    = data.en_objetivo ?? false
  const hasError = !!data.error

  const numColor = hasError
    ? 'text-gray-600'
    : enObj
      ? 'text-green-400'
      : ratio10 >= 3.5
        ? 'text-amber-400'
        : 'text-pink-400'

  const bgColor = hasError
    ? 'bg-gray-800/40 border-gray-700/40 text-gray-500'
    : enObj
      ? 'bg-green-500/15 text-green-400 border border-green-500/20'
      : 'bg-pink-500/15 text-pink-400 border border-pink-500/20'

  return (
    <div className="space-y-2.5 pt-1">
      <div className="text-center">
        <div className={`text-5xl font-black tabular-nums leading-none ${numColor}`}>
          {hasError ? '—' : ratio10.toFixed(1)}
        </div>
        <p className="text-[10px] text-gray-500 mt-1 font-medium uppercase tracking-widest">
          platos por cada 10 pedidos
        </p>
      </div>

      {!hasError && (
        <div className="flex justify-center gap-3 text-[10px] text-gray-600 tabular-nums">
          <span>{data.platos_vendidos} platos</span>
          <span className="text-gray-700">·</span>
          <span>{data.pedidos} pedidos</span>
        </div>
      )}

      <div className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black ${bgColor}`}>
        {hasError
          ? 'Sin datos disponibles'
          : enObj
            ? `✓ Objetivo cumplido (≥ 7 c/10)`
            : `↑ Objetivo: 7 platos cada 10 pedidos`}
      </div>

      {lastUpdate && (
        <p className="text-center text-[9px] text-gray-700">
          Actualizado {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

// ─── PrioridadSection ────────────────────────────────────────────────────────

function PrioridadSection({ items }: { items: Alerta[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-3 text-gray-700 text-xs">
        ✓ Sin productos priorizados
      </div>
    )
  }
  return (
    <div className="space-y-1.5 pt-1">
      {items.map((a, i) => (
        <div
          key={i}
          className="flex items-start gap-2 bg-purple-950/30 border border-purple-900/40 rounded-lg px-3 py-2"
        >
          <Star className="shrink-0 w-3 h-3 text-purple-400 mt-0.5" fill="currentColor" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-purple-200 leading-tight truncate">{a.nombre}</p>
            {a.nota && <p className="text-[9px] text-purple-400 mt-0.5 leading-tight italic">{a.nota}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Panel8586Section ────────────────────────────────────────────────────────

function Panel8586Section({ items85, items86 }: { items85: Alerta[]; items86: Alerta[] }) {
  if (items85.length === 0 && items86.length === 0) {
    return (
      <div className="text-center py-3 text-gray-700 text-xs">
        ✓ Sin alertas activas
      </div>
    )
  }
  return (
    <div className="space-y-1.5 pt-1">
      {items86.map((a, i) => (
        <div key={`86-${i}`} className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2.5">
          <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white mt-0.5">86</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-100 leading-tight">{a.nombre}</p>
            {a.nota && <p className="text-[10px] text-red-400 mt-0.5 leading-tight italic">{a.nota}</p>}
            {a.rubro_nombre && <p className="text-[10px] text-gray-600 mt-0.5">{a.rubro_nombre}</p>}
          </div>
        </div>
      ))}
      {items85.map((a, i) => (
        <div key={`85-${i}`} className="flex items-start gap-2.5 bg-amber-950/40 border border-amber-900/40 rounded-lg px-3 py-2.5">
          <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-600 text-white mt-0.5">85</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-100 leading-tight">{a.nombre}</p>
            {a.nota && <p className="text-[10px] text-amber-400 mt-0.5 leading-tight italic">{a.nota}</p>}
            {a.rubro_nombre && <p className="text-[10px] text-gray-600 mt-0.5">{a.rubro_nombre}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

const SECTIONS_KEY = 'vales_monitor_sections'

type SectionState = { vales: boolean; comida: boolean; prioridad: boolean; panel: boolean }

function loadSections(): SectionState {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { vales: true, comida: true, prioridad: true, panel: true }
}

export default function ValesMonitor() {
  const { logout } = useAuth()

  const [valesData,    setValesData]    = useState<TurnoData | null>(null)
  const [comidaData,   setComidaData]   = useState<ComidaData | null>(null)
  const [alertas,      setAlertas]      = useState<Alerta[]>([])
  const [error,        setError]        = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [lastVales,    setLastVales]    = useState<Date | null>(null)
  const [lastComida,   setLastComida]   = useState<Date | null>(null)
  const [countdown,    setCountdown]    = useState(15)
  const [sections,     setSections]     = useState<SectionState>(loadSections)

  const valesRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const comidaRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load vales + alertas every 15s
  const loadVales = useCallback(async () => {
    try {
      const [turno, todos] = await Promise.all([
        valesApi.getTurno(),
        panel8586Api.getAlertas(),
      ])
      setValesData(turno)
      setAlertas(todos as Alerta[])
      setError(null)
      setLastVales(new Date())
      setCountdown(15)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Error de conexión')
    }
    setLoading(false)
  }, [])

  // Load comida every 15min
  const loadComida = useCallback(async () => {
    try {
      const data = await valesApi.getComidaTurno()
      setComidaData(data)
      setLastComida(new Date())
    } catch {}
  }, [])

  useEffect(() => {
    loadVales()
    loadComida()
    valesRef.current  = setInterval(loadVales,  15_000)
    comidaRef.current = setInterval(loadComida, 15 * 60 * 1000)
    countRef.current  = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => {
      clearInterval(valesRef.current!)
      clearInterval(comidaRef.current!)
      clearInterval(countRef.current!)
    }
  }, [loadVales, loadComida])

  function toggleSection(key: keyof SectionState) {
    setSections(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(next))
      return next
    })
  }

  const priorizados = alertas.filter(a => a.priorizado)
  const items86     = alertas.filter(a => a.tipo === 86)
  const items85     = alertas.filter(a => a.tipo === 85)
  const totalAlertas = items85.length + items86.length

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            {valesData?.turno ?? 'Cargando...'}
          </span>
          {valesData && !valesData.is_noche && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400 uppercase tracking-wide">
              mañana
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastVales && (
            <span className="text-[10px] text-gray-600 tabular-nums">
              {lastVales.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {' '}· {countdown}s
            </span>
          )}
          <button
            onClick={openAsPopup}
            title="Abrir como ventana flotante vertical"
            className="text-[10px] font-bold text-gray-600 hover:text-gray-400 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-800"
          >
            ⧉ popup
          </button>
          <button
            onClick={logout}
            className="text-[10px] font-bold text-gray-700 hover:text-gray-400 transition-colors"
          >
            salir
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {loading && (
          <div className="text-center text-gray-600 text-sm animate-pulse py-8">
            Conectando con NucleoCheck...
          </div>
        )}
        {error && !loading && (
          <div className="text-center py-4 px-4">
            <p className="font-bold text-red-400">⚠ Error</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!loading && (
          <div>
            {/* 1. Vales */}
            <Section
              id="vales"
              title="Vales"
              open={sections.vales}
              onToggle={() => toggleSection('vales')}
            >
              <ValesSection data={valesData} />
            </Section>

            {/* 2. Comida × Pedido */}
            <Section
              id="comida"
              title="Comida × Pedido"
              open={sections.comida}
              onToggle={() => toggleSection('comida')}
            >
              <ComidaSection data={comidaData} lastUpdate={lastComida} />
            </Section>

            {/* 3. Prioridad de venta */}
            <Section
              id="prioridad"
              title="Prioridad de Venta"
              badge={priorizados.length || undefined}
              open={sections.prioridad}
              onToggle={() => toggleSection('prioridad')}
            >
              <PrioridadSection items={priorizados} />
            </Section>

            {/* 4. Panel 85 & 86 */}
            <Section
              id="panel"
              title="Panel 85 & 86"
              badge={totalAlertas || undefined}
              open={sections.panel}
              onToggle={() => toggleSection('panel')}
            >
              <Panel8586Section items85={items85} items86={items86} />
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

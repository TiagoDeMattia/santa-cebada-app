import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Beer, Package, Droplets, AlertTriangle, Printer } from 'lucide-react'
import { barrilesV2Api, stockGeneralApi } from '../lib/api'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface BarrilV2 {
  id: number
  estilo: string
  proveedor: string
  litros: number
  canilla: number | null
  estado: string
  codigo: string
  fecha_pinchado: string | null
  dias_pinchado: number | null
}

interface EstiloStock {
  estilo: string
  proveedor: string
  litros_total: number
  barriles_pinchados: number
  barriles_camara: number
  canillas: number[]
  dias_pinchado_max: number | null
}

interface ProveedorStock {
  proveedor: string
  litros_total: number
  barriles_count: number
}

// ── Colores de marca ───────────────────────────────────────────────────────────

const GOLD   = '#F5A623'
const PURPLE = '#6730BF'
const CREAM  = '#EFEBD6'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtL(n: number) {
  return n % 1 === 0 ? `${n}L` : `${n.toFixed(1)}L`
}

function computeStock(barriles: BarrilV2[]) {
  const estiloMap = new Map<string, EstiloStock>()
  const provMap   = new Map<string, ProveedorStock>()

  for (const b of barriles) {
    if (!estiloMap.has(b.estilo)) {
      estiloMap.set(b.estilo, {
        estilo: b.estilo,
        proveedor: b.proveedor || '',
        litros_total: 0,
        barriles_pinchados: 0,
        barriles_camara: 0,
        canillas: [],
        dias_pinchado_max: null,
      })
    }
    const e = estiloMap.get(b.estilo)!
    e.litros_total += b.litros || 0
    if (b.estado === 'Pinchada') {
      e.barriles_pinchados++
      if (b.canilla != null) e.canillas.push(b.canilla)
      if (b.dias_pinchado != null) {
        e.dias_pinchado_max = e.dias_pinchado_max == null ? b.dias_pinchado : Math.max(e.dias_pinchado_max, b.dias_pinchado)
      }
    } else {
      e.barriles_camara++
    }

    const prov = b.proveedor || 'Sin proveedor'
    if (!provMap.has(prov)) {
      provMap.set(prov, { proveedor: prov, litros_total: 0, barriles_count: 0 })
    }
    const p = provMap.get(prov)!
    p.litros_total += b.litros || 0
    p.barriles_count++
  }

  for (const e of estiloMap.values()) {
    e.canillas = [...new Set(e.canillas)].sort((a, b) => a - b)
  }

  return {
    por_estilo:    Array.from(estiloMap.values()),
    por_proveedor: Array.from(provMap.values()),
  }
}

// ── Print ─────────────────────────────────────────────────────────────────────

const CERV_PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 10mm 12mm; }
  body > * { display: none !important; }
  body.print-cervezas > #cerv-print-root { display: block !important; background: white; }
  .cv-pt { font-family: Arial, sans-serif; font-size: 9pt; border-collapse: collapse; width: 100%; }
  .cv-pt th, .cv-pt td { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .cv-pt thead { display: table-row-group; }
}
`

function CervezasPrintTable({ pinchadas, soloCamara }: {
  pinchadas: EstiloStock[]
  soloCamara: EstiloStock[]
}) {
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
  const td  = { border: '1px solid #000', padding: '3px 6px', textAlign: 'center' as const, fontWeight: 'bold' as const, color: '#000' }
  const tdL = { border: '1px solid #000', padding: '3px 6px', color: '#000' }
  const rb  = { border: '1px solid #000', background: '#e0e0e0', fontStyle: 'italic' as const,
                fontWeight: 'bold' as const, textAlign: 'center' as const, color: '#000', padding: '4px 6px' }

  return (
    <table className="cv-pt" style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Arial, sans-serif', fontSize: '9pt' }}>
      <thead>
        <tr>
          <td colSpan={6} style={{ padding: 0, border: '2px solid #000' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', background: 'white', minHeight: 48 }}>
              <div style={{ width: 6, background: '#000', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px' }}>
                <div>
                  <div style={{ fontSize: '14pt', fontWeight: 900, color: '#000', letterSpacing: 1, lineHeight: 1.1 }}>SANTA CEBADA</div>
                  <div style={{ fontSize: '7.5pt', color: '#555', letterSpacing: 3, marginTop: 1 }}>RECOLETA</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13pt', fontWeight: 'bold', color: '#000', lineHeight: 1.1 }}>STOCK DE CERVEZAS</div>
                  <div style={{ fontSize: '7.5pt', color: '#555', marginTop: 2 }}>{today}</div>
                </div>
              </div>
              <div style={{ width: 6, background: '#555', flexShrink: 0 }} />
            </div>
          </td>
        </tr>
        <tr>
          <th style={{ border: '1px solid #000', padding: '5px 6px', color: '#000', textAlign: 'center', background: '#d0d0d0', fontWeight: 'bold' }}>Canilla</th>
          <th style={{ border: '1px solid #000', padding: '5px 6px', color: '#000', textAlign: 'left',   background: '#d0d0d0', fontWeight: 'bold' }}>Cerveza</th>
          <th style={{ border: '1px solid #000', padding: '5px 6px', color: '#000', textAlign: 'left',   background: '#d0d0d0', fontWeight: 'bold' }}>Proveedor</th>
          <th style={{ border: '1px solid #000', padding: '5px 6px', color: '#000', textAlign: 'center', background: '#d0d0d0', fontWeight: 'bold' }}>Barriles</th>
          <th style={{ border: '1px solid #000', padding: '5px 6px', color: '#000', textAlign: 'center', background: '#d0d0d0', fontWeight: 'bold' }}>Días</th>
          <th style={{ border: '1px solid #000', padding: '5px 6px', color: '#000', textAlign: 'center', background: '#d0d0d0', fontWeight: 'bold' }}>Litros aprox</th>
        </tr>
      </thead>
      <tbody>
        {pinchadas.length > 0 && (
          <>
            <tr className="rb-row"><td colSpan={6} style={rb}>EN CANILLA</td></tr>
            {pinchadas.map(e => (
              <tr key={e.estilo}>
                <td style={td}>{e.canillas.join(', ') || '—'}</td>
                <td style={tdL}>{e.estilo}</td>
                <td style={tdL}>{e.proveedor}</td>
                <td style={td}>{e.barriles_pinchados + e.barriles_camara}</td>
                <td style={td}>{e.dias_pinchado_max != null ? `${e.dias_pinchado_max}d` : '—'}</td>
                <td style={td}>{fmtL(e.litros_total)}</td>
              </tr>
            ))}
          </>
        )}
        {soloCamara.length > 0 && (
          <>
            <tr className="rb-row"><td colSpan={6} style={rb}>SIN PINCHAR</td></tr>
            {soloCamara.map(e => (
              <tr key={e.estilo}>
                <td style={td}>—</td>
                <td style={tdL}>{e.estilo}</td>
                <td style={tdL}>{e.proveedor}</td>
                <td style={td}>{e.barriles_camara}</td>
                <td style={td}>—</td>
                <td style={td}>{fmtL(e.litros_total)}</td>
              </tr>
            ))}
          </>
        )}
      </tbody>
    </table>
  )
}

// ── Fila de estilo ─────────────────────────────────────────────────────────────

function FilaEstilo({ item }: { item: EstiloStock }) {
  return (
    <tr className="border-b border-gray-50 dark:border-dark-border/40 hover:bg-gray-50/50 dark:hover:bg-dark-elevated/30 transition-colors">
      {/* Canilla */}
      <td className="py-3 pl-4 pr-2 w-20">
        {item.canillas.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.canillas.map(c => (
              <span
                key={c}
                className="inline-flex items-center justify-center text-[11px] font-black w-7 h-7 rounded-lg"
                style={{ background: 'rgba(245,166,35,0.13)', color: GOLD, border: '1px solid rgba(245,166,35,0.28)' }}
              >
                {c}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>

      {/* Cerveza */}
      <td className="py-3 px-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{item.estilo}</p>
        {item.proveedor && (
          <p className="text-[11px] text-gray-400 mt-0.5">{item.proveedor}</p>
        )}
      </td>

      {/* Barriles */}
      <td className="py-3 px-3 w-24">
        <div className="flex flex-col gap-0.5">
          {item.barriles_pinchados > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              {item.barriles_pinchados} pinch.
            </span>
          )}
          {item.barriles_camara > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] text-sky-500 dark:text-sky-400">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
              {item.barriles_camara} cámara
            </span>
          )}
        </div>
      </td>

      {/* APROX litros + días pinchado */}
      <td className="py-3 px-3 w-36">
        <span className="text-base font-black tabular-nums" style={{ color: GOLD }}>
          {fmtL(item.litros_total)}
        </span>
        <span className="text-[11px] text-gray-400 ml-1.5">aprox</span>
        {item.dias_pinchado_max != null && (
          <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">{item.dias_pinchado_max}d pinchada</p>
        )}
      </td>
    </tr>
  )
}

// ── Tarjeta de proveedor ───────────────────────────────────────────────────────

function TarjetaProveedor({ item }: { item: ProveedorStock }) {
  return (
    <div className="rounded-xl p-5 border border-gray-100 dark:border-dark-border bg-white dark:bg-dark-surface">
      <div className="mb-3">
        <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{item.proveedor}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {item.barriles_count} barril{item.barriles_count !== 1 ? 'es' : ''} activos
        </p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black tabular-nums" style={{ color: GOLD }}>
          {fmtL(item.litros_total)}
        </span>
        <span className="text-sm text-gray-400">aprox</span>
      </div>
    </div>
  )
}

// ── Fila de barril (detalle) ───────────────────────────────────────────────────

function FilaBarril({ b }: { b: BarrilV2 }) {
  const isPinchado = b.estado === 'Pinchada'
  return (
    <tr className="border-b border-gray-50 dark:border-dark-border/40 hover:bg-gray-50/50 dark:hover:bg-dark-elevated/30 transition-colors">
      <td className="py-3 px-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.estilo || '—'}</p>
        <p className="text-[11px] text-gray-400">{b.proveedor}</p>
      </td>
      <td className="py-3 px-4 w-28">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
          isPinchado
            ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
            : 'bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isPinchado ? 'bg-amber-400' : 'bg-sky-400'}`} />
          {b.estado}
        </span>
      </td>
      <td className="py-3 px-4 w-20">
        {b.canilla != null ? (
          <span
            className="inline-flex items-center justify-center text-[11px] font-black w-7 h-7 rounded-lg"
            style={{ background: 'rgba(245,166,35,0.13)', color: GOLD, border: '1px solid rgba(245,166,35,0.28)' }}
          >
            {b.canilla}
          </span>
        ) : <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>}
      </td>
      <td className="py-3 px-4 w-28 text-sm text-gray-500 dark:text-gray-500 tabular-nums">
        {b.fecha_pinchado || '—'}
        {b.dias_pinchado != null && (
          <span className="ml-1.5 text-[11px] text-gray-400">({b.dias_pinchado}d)</span>
        )}
      </td>
      <td className="py-3 px-4 text-sm font-bold tabular-nums" style={{ color: GOLD }}>
        {fmtL(b.litros)}
      </td>
    </tr>
  )
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

type Tab = 'estilos' | 'proveedores' | 'detalle'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'estilos',     label: 'Por estilo',    icon: Beer },
  { id: 'proveedores', label: 'Por proveedor', icon: Package },
  { id: 'detalle',     label: 'Detalle',       icon: Droplets },
]

// ── Página principal ──────────────────────────────────────────────────────────

export function StockCervezas() {
  const [tab,        setTab       ] = useState<Tab>('estilos')
  const [barriles,   setBarriles  ] = useState<BarrilV2[]>([])
  const [loading,    setLoading   ] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError     ] = useState<string | null>(null)
  const [canillas,   setCanillas  ] = useState<any[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handlePrint = () => {
    document.body.classList.add('print-cervezas')
    setTimeout(() => {
      window.print()
      document.body.classList.remove('print-cervezas')
    }, 80)
  }

  const cargarStock = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    setError(null)
    try {
      const data = await barrilesV2Api.getBarriles('activos')
      setBarriles(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando stock')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    cargarStock()
    stockGeneralApi.getCanillas().then(setCanillas).catch(() => {})
  }, [cargarStock])

  useEffect(() => {
    intervalRef.current = setInterval(() => cargarStock(true), 20 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [cargarStock])

  const { por_estilo, por_proveedor } = useMemo(() => computeStock(barriles), [barriles])

  const pinchadas = useMemo(() =>
    por_estilo
      .filter(e => e.barriles_pinchados > 0)
      .sort((a, b) => {
        const ca = a.canillas.length > 0 ? a.canillas[0] : 999
        const cb = b.canillas.length > 0 ? b.canillas[0] : 999
        return ca - cb
      }),
    [por_estilo]
  )

  const soloCamara = useMemo(() =>
    por_estilo
      .filter(e => e.barriles_pinchados === 0)
      .sort((a, b) => a.estilo.localeCompare(b.estilo)),
    [por_estilo]
  )

  // Para la impresión: excluir estilos que son próximos en alguna canilla
  const soloCamaraParaPrint = useMemo(() => {
    const proximosSet = new Set(
      canillas.flatMap(c => c.estilo_proximo ? [c.estilo_proximo as string] : [])
    )
    return proximosSet.size === 0
      ? soloCamara
      : soloCamara.filter(e => !proximosSet.has(e.estilo))
  }, [soloCamara, canillas])

  const totalLitros   = por_estilo.reduce((s, e) => s + e.litros_total, 0)
  const totalBarriles = barriles.length

  return (
    <div className="min-h-full bg-surface dark:bg-dark-bg">
      <style dangerouslySetInnerHTML={{ __html: CERV_PRINT_CSS }} />
      {createPortal(
        <div id="cerv-print-root" style={{ display: 'none' }}>
          <CervezasPrintTable pinchadas={pinchadas} soloCamara={soloCamaraParaPrint} />
        </div>,
        document.body
      )}

      {/* ── Header de marca ────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A0418 0%, #180830 60%, #0A0A0A 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${GOLD} 0, ${GOLD} 1px, transparent 0, transparent 50%)`,
            backgroundSize: '18px 18px',
          }}
        />

        <div className="relative px-6 py-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] mb-1.5" style={{ color: PURPLE }}>
            Santa Cebada · Recoleta
          </p>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: CREAM }}>
            Stock de Cervezas
          </h1>
          <p className="text-xs mt-1" style={{ color: 'rgba(239,235,214,0.38)' }}>
            Inventario aproximado · barriles en cámara y canilla
          </p>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 mt-6">
            <div>
              <p className="text-2xl font-black tabular-nums" style={{ color: GOLD }}>{fmtL(totalLitros)}</p>
              <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(239,235,214,0.38)' }}>Aprox. disponibles</p>
            </div>
            <div className="w-px self-stretch" style={{ background: 'rgba(239,235,214,0.1)' }} />
            <div>
              <p className="text-2xl font-black" style={{ color: CREAM }}>{totalBarriles}</p>
              <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(239,235,214,0.38)' }}>Barriles activos</p>
            </div>
            {pinchadas.length > 0 && (
              <>
                <div className="w-px self-stretch" style={{ background: 'rgba(239,235,214,0.1)' }} />
                <div>
                  <p className="text-2xl font-black text-amber-400">{pinchadas.length}</p>
                  <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(239,235,214,0.38)' }}>En canilla</p>
                </div>
              </>
            )}
          </div>

          <div className="absolute top-6 right-6 flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={!barriles.length}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              style={{ background: 'rgba(239,235,214,0.07)', color: CREAM, border: '1px solid rgba(239,235,214,0.13)' }}
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button
              onClick={() => cargarStock(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              style={{ background: 'rgba(239,235,214,0.07)', color: CREAM, border: '1px solid rgba(239,235,214,0.13)' }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 dark:border-dark-border bg-white dark:bg-dark-surface sticky top-0 z-10">
        <div className="px-6 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all flex-shrink-0 whitespace-nowrap ${
                tab === t.id
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              style={tab === t.id ? { borderColor: GOLD } : {}}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido ───────────────────────────────────────────────────────── */}
      <div className="p-6">
        {loading && !barriles.length ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: GOLD, borderTopColor: 'transparent' }}
            />
            <p className="text-sm text-gray-400">Cargando stock…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-gray-500">{error}</p>
            <button onClick={() => cargarStock()} className="text-sm text-accent hover:underline">Reintentar</button>
          </div>
        ) : (
          <>
            {/* ── Tab: Por estilo ─────────────────────────────────────────── */}
            {tab === 'estilos' && (
              !por_estilo.length ? (
                <div className="rounded-xl border border-gray-100 dark:border-dark-border bg-white dark:bg-dark-surface">
                  <p className="text-center text-gray-400 py-14 text-sm">Sin barriles activos</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-100 dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-dark-border bg-gray-50/60 dark:bg-dark-elevated/60">
                        <th className="text-left py-2.5 pl-4 pr-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-20">Canilla</th>
                        <th className="text-left py-2.5 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cerveza</th>
                        <th className="text-left py-2.5 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-24">Barriles</th>
                        <th className="text-left py-2.5 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-36">Litros aprox</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pinchadas.length > 0 && (
                        <>
                          <tr>
                            <td colSpan={4} className="px-4 py-2.5 bg-amber-50/70 dark:bg-amber-950/15">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                                  En canilla
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  · {pinchadas.length} estilo{pinchadas.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {pinchadas.map(e => <FilaEstilo key={e.estilo} item={e} />)}
                        </>
                      )}
                      {soloCamara.length > 0 && (
                        <>
                          <tr>
                            <td colSpan={4} className="px-4 py-2.5 bg-sky-50/70 dark:bg-sky-950/15">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-sky-400" />
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
                                  Solo en cámara
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  · {soloCamara.length} estilo{soloCamara.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {soloCamara.map(e => <FilaEstilo key={e.estilo} item={e} />)}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* ── Tab: Por proveedor ───────────────────────────────────────── */}
            {tab === 'proveedores' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {por_proveedor.length ? (
                  [...por_proveedor]
                    .sort((a, b) => b.litros_total - a.litros_total)
                    .map(p => <TarjetaProveedor key={p.proveedor} item={p} />)
                ) : (
                  <p className="col-span-full text-center text-gray-400 py-12">Sin datos</p>
                )}
              </div>
            )}

            {/* ── Tab: Detalle ─────────────────────────────────────────────── */}
            {tab === 'detalle' && (
              <div className="rounded-xl border border-gray-100 dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-dark-border bg-gray-50/60 dark:bg-dark-elevated/60">
                        {['Estilo / Proveedor', 'Estado', 'Canilla', 'Pinchado', 'Litros'].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {barriles.length ? (
                        [...barriles]
                          .sort((a, b) => {
                            const order: Record<string, number> = { Pinchada: 0, 'En Camara': 1 }
                            const ao = order[a.estado] ?? 2
                            const bo = order[b.estado] ?? 2
                            if (ao !== bo) return ao - bo
                            return a.estilo.localeCompare(b.estilo)
                          })
                          .map(b => <FilaBarril key={b.id} b={b} />)
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">Sin barriles activos</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

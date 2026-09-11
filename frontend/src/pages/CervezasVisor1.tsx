import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Maximize2, LogOut, Monitor } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { barrilesV2Api } from '../lib/api'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../context/AuthContext'
import { loadVisorConfig } from '../lib/visorConfig'

// ── Paleta de marca ───────────────────────────────────────────────────────────
// NEGRO   #000000  — fondo
// BEIGE   #EFEBD6  — texto principal, ornamentos
// VIOLETA #6730bf  — acento, canillas, labels
// DORADO  #F5A623  — precio, título (color de marca existente)

const VISOR_CSS = `
  @keyframes phase-enter {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .phase-enter {
    animation: phase-enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .neon-word {
    color: #F5A623;
    font-weight: 900;
  }
  .gothic-font {
    font-family: 'UnifrakturMaguntia', 'UnifrakturCook', serif;
  }
  .argentina-flag {
    background: linear-gradient(90deg, #4B9BD5 33%, #EFEBD6 33%, #EFEBD6 67%, #4B9BD5 67%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 900;
  }
`

// ── Ornamento de esquina ──────────────────────────────────────────────────────
function CornerOrnament({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const flipX = position === 'tr' || position === 'br'
  const flipY = position === 'bl' || position === 'br'
  const pos = { tl: 'top-3 left-3', tr: 'top-3 right-3', bl: 'bottom-3 left-3', br: 'bottom-3 right-3' }[position]
  // Beige a baja opacidad para los ornamentos decorativos
  const B = (o: number) => `rgba(239,235,214,${o})`
  return (
    <div
      className={`absolute ${pos} w-24 h-24 pointer-events-none`}
      style={{ transform: `scale(${flipX ? -1 : 1},${flipY ? -1 : 1})`, transformOrigin: 'center' }}
    >
      <svg viewBox="0 0 96 96" fill="none" className="w-full h-full">
        <path d="M4 38 L4 4 L38 4" stroke={B(0.28)} strokeWidth="1.2" fill="none" />
        <path d="M4 32 C9 24, 18 13, 32 4" stroke={B(0.1)} strokeWidth="0.9" fill="none" />
        <path d="M16 16 C13 10, 7 10, 7 16 C7 22, 13 24, 18 22 C23 20, 23 14, 18 12 C16 10, 10 12, 12 16"
              stroke={B(0.25)} strokeWidth="0.9" fill="none" />
        <path d="M24 10 C22 7, 17 9, 19 14" stroke={B(0.16)} strokeWidth="0.7" fill="none" />
        <path d="M10 24 C7 22, 9 17, 14 19" stroke={B(0.16)} strokeWidth="0.7" fill="none" />
        <circle cx="26" cy="26" r="3" stroke={B(0.16)} strokeWidth="0.7" fill="none" />
        <circle cx="26" cy="26" r="1" fill={B(0.14)} />
        <path d="M52 4 L54 6 L52 8 L50 6 Z" fill={B(0.45)} />
        <path d="M4 52 L6 54 L4 56 L2 54 Z" fill={B(0.45)} />
        <line x1="52" y1="4" x2="52" y2="1" stroke={B(0.25)} strokeWidth="0.6" />
        <line x1="4" y1="52" x2="1" y2="52" stroke={B(0.25)} strokeWidth="0.6" />
      </svg>
    </div>
  )
}

// ── Icono de lúpulo — cono con escamas ───────────────────────────────────────
function HopIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 19" fill="none">
      <path d="M7 1.5 C9.5 3.5 12 6.5 12 10.5 C12 14 9.8 17 7 17 C4.2 17 2 14 2 10.5 C2 6.5 4.5 3.5 7 1.5Z"
            fill="#F5A623" />
      <path d="M3.5 6.5 Q7 5 10.5 6.5"  stroke="#000000" strokeWidth="0.9" fill="none" opacity="0.35" />
      <path d="M2.8 9.5  Q7 8  11.2 9.5" stroke="#000000" strokeWidth="0.9" fill="none" opacity="0.35" />
      <path d="M3   12.5 Q7 11 11 12.5"  stroke="#000000" strokeWidth="0.9" fill="none" opacity="0.35" />
      <path d="M3.8 15   Q7 14 10.2 15"  stroke="#000000" strokeWidth="0.9" fill="none" opacity="0.3"  />
      <ellipse cx="7" cy="3.5" rx="1.8" ry="1.2" fill="#FCD34D" opacity="0.4" />
      <line x1="7" y1="17" x2="7" y2="19" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function HopRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }, (_, i) => <HopIcon key={i} />)}
    </div>
  )
}

// ── Badge de ABV ──────────────────────────────────────────────────────────────
function ABVBadge({ abv }: { abv: string }) {
  const v = parseFloat(abv)
  const color = v >= 7 ? '#F87171' : v >= 5.5 ? '#FB923C' : v >= 4 ? '#FBBF24' : '#86EFAC'
  return (
    <div className="flex flex-col items-center leading-none gap-0.5">
      <span style={{ color: 'rgba(239,235,214,0.35)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em' }}>
        ABV
      </span>
      <span style={{ color, fontSize: '15px', fontWeight: 900 }}>
        {abv}
      </span>
    </div>
  )
}

// ── Nombre con highlight y bandera ────────────────────────────────────────────
function HighlightedName({ estilo, palabras }: { estilo: string; palabras: string }) {
  if (!estilo) return null
  let parts: Array<string | React.ReactElement> = []
  let key = 0

  const reArgenta = /\bargenta\b/gi
  let last = 0
  let m: RegExpExecArray | null
  while ((m = reArgenta.exec(estilo)) !== null) {
    if (m.index > last) parts.push(estilo.slice(last, m.index))
    parts.push(<span key={key++} className="argentina-flag">{m[0]}</span>)
    last = reArgenta.lastIndex
  }
  if (last < estilo.length) parts.push(estilo.slice(last))
  if (parts.length === 0) parts = [estilo]

  if (palabras?.trim()) {
    for (const word of palabras.split(',').map(w => w.trim()).filter(Boolean)) {
      const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`\\b${esc}\\b`, 'gi')
      parts = parts.flatMap(part => {
        if (typeof part !== 'string') return [part]
        const segs = part.split(re)
        const hits = part.match(re)
        if (!hits) return [part]
        const out: Array<string | React.ReactElement> = []
        segs.forEach((s, i) => {
          if (s) out.push(s)
          if (i < hits.length) out.push(<span key={key++} className="neon-word">{hits[i]}</span>)
        })
        return out
      })
    }
  }
  return <>{parts}</>
}

// ── Hora Santa (17-20hs Buenos Aires = UTC-3) ─────────────────────────────────
function isBsAsHoraSanta(): boolean {
  const now = new Date()
  const bsAsMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() - 180 + 1440) % 1440
  const h = Math.floor(bsAsMinutes / 60)
  return h >= 17 && h < 20
}

// Ms hasta el próximo :00 BsAs (UTC-3 comparte grilla de minutos con UTC)
function msHastaProximaHoraEnPunto(): number {
  const now = new Date()
  return (60 - now.getUTCMinutes()) * 60_000
    - now.getUTCSeconds() * 1000
    - now.getUTCMilliseconds()
}

// ── Cycling slot ──────────────────────────────────────────────────────────────
type Phase = 0 | 1 | 2
const PHASE_LABELS: Record<Phase, string> = { 0: 'Cervecería', 1: 'Amargor', 2: 'Alcohol' }

// ── Fila de cerveza ───────────────────────────────────────────────────────────
function BeerRow({
  cerveza, striped, phase, isHoraSanta,
}: {
  cerveza: CervezaInfo; striped: boolean; phase: Phase
  isHoraSanta: boolean
}) {
  const soldOut = !!cerveza.soldOut
  const showDiscount = !soldOut && isHoraSanta && !!cerveza.precio_hora_santa && !!cerveza.precio

  return (
    <div
      className={`flex items-center gap-5 px-5 py-3 rounded-xl relative`}
      style={{
        background: soldOut
          ? 'rgba(120,0,0,0.12)'
          : striped ? 'rgba(239,235,214,0.025)' : undefined,
        borderLeft: soldOut ? '3px solid rgba(239,68,68,0.45)' : undefined,
      }}
    >
      {/* Canilla */}
      <div
        className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center"
        style={{
          background: soldOut ? 'rgba(120,0,0,0.35)' : 'rgba(103,48,191,0.22)',
          border: `1px solid ${soldOut ? 'rgba(239,68,68,0.55)' : 'rgba(103,48,191,0.55)'}`,
        }}
      >
        <span className="text-[11px] font-black leading-none" style={{ color: soldOut ? '#FCA5A5' : '#EFEBD6' }}>
          {cerveza.canilla}
        </span>
      </div>

      {/* Nombre */}
      <div className="flex-1 min-w-0 overflow-hidden flex items-center gap-3">
        <div
          className="font-black tracking-tight whitespace-nowrap"
          style={{
            fontSize: '1.55rem',
            lineHeight: 1.25,
            color: soldOut ? 'rgba(239,235,214,0.45)' : '#EFEBD6',
            textDecoration: soldOut ? 'line-through' : 'none',
            textDecorationColor: 'rgba(239,68,68,0.7)',
            textDecorationThickness: '2px',
          }}
        >
          {cerveza.estilo
            ? <HighlightedName estilo={cerveza.estilo} palabras={soldOut ? '' : cerveza.palabras_destacar} />
            : <span style={{ color: 'rgba(239,235,214,0.2)' }}>—</span>
          }
        </div>

        {/* Foto — solo si hay imagen y no es sold-out */}
        {!soldOut && cerveza.photo && (
          <img
            src={cerveza.photo}
            alt=""
            className="flex-shrink-0 rounded-lg object-cover"
            style={{
              width: '42px',
              height: '42px',
              border: '1px solid rgba(239,235,214,0.15)',
              opacity: 0.88,
            }}
          />
        )}
      </div>

      {/* Slot ciclante o badge AGOTADA */}
      <div className="flex-shrink-0 w-36 flex flex-col items-center justify-center gap-1.5">
        {soldOut ? (
          <div
            className="flex flex-col items-center gap-1"
          >
            {/* Ícono ⊘ */}
            <span style={{ fontSize: '22px', color: 'rgba(239,68,68,0.75)', lineHeight: 1 }}>⊘</span>
            <div
              style={{
                background: 'rgba(185,28,28,0.25)',
                border: '1.5px solid rgba(239,68,68,0.6)',
                borderRadius: '5px',
                padding: '3px 12px',
              }}
            >
              <span
                className="font-black uppercase"
                style={{ fontSize: '11px', letterSpacing: '0.28em', color: '#F87171' }}
              >
                AGOTADA
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Label de categoría — violeta visible */}
            <span
              className="font-bold uppercase"
              style={{ fontSize: '8px', letterSpacing: '0.22em', color: 'rgba(103,48,191,0.85)' }}
            >
              {PHASE_LABELS[phase]}
            </span>

            {/* Contenido animado */}
            <div
              key={`${cerveza.canilla}-${phase}`}
              className="phase-enter flex items-center justify-center"
              style={{ minHeight: '24px' }}
            >
              {phase === 0 && (
                cerveza.proveedor
                  ? <span
                      className="font-black uppercase"
                      style={{ fontSize: '17px', letterSpacing: '0.12em', color: '#EFEBD6' }}
                    >
                      {cerveza.proveedor}
                    </span>
                  : <span style={{ color: 'rgba(239,235,214,0.2)', fontSize: '15px' }}>—</span>
              )}
              {phase === 1 && (
                cerveza.amargor > 0
                  ? <HopRating count={cerveza.amargor} />
                  : <span style={{ color: 'rgba(239,235,214,0.2)', fontSize: '15px' }}>—</span>
              )}
              {phase === 2 && (
                cerveza.abv
                  ? <ABVBadge abv={cerveza.abv} />
                  : <span style={{ color: 'rgba(239,235,214,0.2)', fontSize: '15px' }}>—</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Separador vertical sutil — beige */}
      <div
        className="self-stretch flex-shrink-0 w-px"
        style={{ background: 'rgba(239,235,214,0.08)', margin: '6px 0' }}
      />

      {/* Precio */}
      <div className="flex-shrink-0 min-w-[7rem] text-right">
        {soldOut ? (
          <span style={{ display: 'inline-block', width: '7rem' }} />
        ) : showDiscount ? (
          /* Precio Hora Santa: tachado original + descuento violeta */
          <div className="flex flex-col items-end gap-0" style={{ lineHeight: 1.1 }}>
            <span
              className="font-bold"
              style={{
                fontSize: '1rem',
                color: 'rgba(245,166,35,0.28)',
                textDecoration: 'line-through',
                textDecorationColor: 'rgba(245,166,35,0.35)',
              }}
            >
              {cerveza.precio}
            </span>
            <span
              className="font-black"
              style={{
                fontSize: '2.2rem',
                color: '#C4B5FD',
                textShadow: '0 0 18px rgba(167,139,250,0.5), 0 0 40px rgba(167,139,250,0.2)',
              }}
            >
              {cerveza.precio_hora_santa}
            </span>
          </div>
        ) : cerveza.precio ? (
          <span
            className="font-black"
            style={{
              fontSize: '2.2rem',
              color: '#F5A623',
              textShadow: '0 0 14px rgba(245,166,35,0.35), 0 0 30px rgba(245,166,35,0.12)',
            }}
          >
            {cerveza.precio}
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ── Leyenda de amargor ────────────────────────────────────────────────────────
function AmargorLegend() {
  return (
    <div className="flex items-center gap-5">
      {[{ label: 'Suave', count: 1 }, { label: 'Medio', count: 3 }, { label: 'Intenso', count: 5 }].map(({ label, count }) => (
        <div key={label} className="flex items-center gap-1.5">
          <HopRating count={count} />
          <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'rgba(239,235,214,0.35)', fontWeight: 600, textTransform: 'uppercase' }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Tipos y helpers ───────────────────────────────────────────────────────────
interface CervezaInfo {
  canilla: string
  estilo: string
  proveedor: string
  amargor: number
  abv: string
  precio: string
  palabras_destacar: string
  tipo: string
  precio_hora_santa: string
  soldOut?: boolean
  photo?: string
}

function formatPrecio(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '' || n === 0) return ''
  const num = typeof n === 'string' ? parseFloat(n.replace(/[^0-9.]/g, '')) : n
  if (isNaN(num) || num === 0) return ''
  return `$${num.toLocaleString('es-AR')}`
}

// ── Componente principal ──────────────────────────────────────────────────────
export function CervezasVisor1() {
  const [cervezas, setCervezas] = useState<CervezaInfo[]>([])
  const [loading, setLoading]   = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [phase, setPhase] = useState<Phase>(0)
  const [isHoraSanta, setIsHoraSanta] = useState(() => isBsAsHoraSanta())
  const navigate = useNavigate()
  const { logout } = useAuth()

  // Ciclo 0→1→2→0 cada 3 s, sincronizado en todas las filas
  useEffect(() => {
    const id = setInterval(() => setPhase(p => ((p + 1) % 3) as Phase), 3000)
    return () => clearInterval(id)
  }, [])

  // Check Hora Santa cada minuto para activar/desactivar automáticamente
  useEffect(() => {
    const id = setInterval(() => setIsHoraSanta(isBsAsHoraSanta()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = VISOR_CSS
    document.head.appendChild(style)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Instrument+Sans:wght@700&display=swap'
    document.head.appendChild(link)
    return () => { style.remove(); link.remove() }
  }, [])

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const cargarCervezas = useCallback(async () => {
    setLoading(true)
    try {
      const barriles: any[] = await barrilesV2Api.getVisorBarriles()
      const cfg = loadVisorConfig()

      const canillasPinchadas = new Set(barriles.map(b => String(b.canilla)))

      // Activas (ya vienen filtradas por estado=Pinchada desde el backend)
      const activas: CervezaInfo[] = barriles.slice(0, 18).map(b => ({
        canilla: String(b.canilla),
        estilo: b.estilo || 'Cerveza',
        proveedor: b.proveedor || '',
        amargor: typeof b.amargor === 'number' ? Math.min(Math.max(b.amargor, 0), 5) : 0,
        abv: b.abv ? (String(b.abv).includes('%') ? String(b.abv) : `${b.abv}%`) : '',
        precio: formatPrecio(b.precio),
        palabras_destacar: b.palabras_destacar || '',
        tipo: b.tipo || '',
        precio_hora_santa: formatPrecio(b.precio_hora_santa),
        photo: cfg.beer_photos[String(b.canilla)] ?? undefined,
      }))

      // Canillas fijas vacías → sold-out
      const soldOuts: CervezaInfo[] = []
      for (const fija of cfg.canillas_fijas.filter((f: any) => f.enabled)) {
        if (canillasPinchadas.has(fija.canilla)) continue
        soldOuts.push({
          canilla: fija.canilla,
          estilo: fija.estilo || '',
          proveedor: '',
          amargor: 0,
          abv: '',
          precio: fija.precio || '',
          palabras_destacar: '',
          tipo: '',
          precio_hora_santa: '',
          soldOut: true,
          photo: cfg.beer_photos[fija.canilla] ?? undefined,
        })
      }

      const todas = [...activas, ...soldOuts]
        .sort((a, b) => (parseInt(a.canilla) || 0) - (parseInt(b.canilla) || 0))

      setCervezas(todas)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Error cargando cervezas:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarCervezas() }, [cargarCervezas])

  // Auto-refresh al :00 exacto de cada hora BsAs (UTC-3 comparte minutos con UTC)
  useEffect(() => {
    if (!autoRefresh) return
    let timeoutId: ReturnType<typeof setTimeout>
    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        cargarCervezas()
        scheduleNext()
      }, msHastaProximaHoraEnPunto())
    }
    scheduleNext()
    return () => clearTimeout(timeoutId)
  }, [autoRefresh, cargarCervezas])

  // SSE: actualizar inmediatamente cuando se pincha/despincha un barril
  useEffect(() => {
    const es = new EventSource('/api/barriles/events')
    es.onmessage = (e) => { if (e.data === 'barrel_update') cargarCervezas() }
    return () => es.close()
  }, [cargarCervezas])

  const toggleFullscreen = () => {
    if (!fullscreen) document.documentElement.requestFullscreen().catch(console.error)
    else document.exitFullscreen()
  }

  if (loading && cervezas.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ background: '#000000' }}>
        <Spinner size="lg" />
        <p className="gothic-font text-2xl" style={{ color: '#F5A623', opacity: 0.6 }}>birras</p>
      </div>
    )
  }

  const mid = Math.ceil(cervezas.length / 2)
  const left  = cervezas.slice(0, mid)
  const right = cervezas.slice(mid)
  const timeStr = lastRefresh?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) ?? ''

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ background: '#000000', color: '#EFEBD6', fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}
    >

      {/* Ornamentos barrocos */}
      <CornerOrnament position="tl" />
      <CornerOrnament position="tr" />
      <CornerOrnament position="bl" />
      <CornerOrnament position="br" />

      {/* Marco delgado — beige muy sutil */}
      <div
        className="absolute inset-4 pointer-events-none"
        style={{ border: '1px solid rgba(239,235,214,0.1)' }}
      />

      {/* Texto vertical — "El Templo Sagrado de la Birra" */}
      <div className="absolute left-4 top-0 bottom-0 w-16 flex items-center justify-center pointer-events-none z-10">
        <p
          className="font-bold uppercase whitespace-nowrap"
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: '9px',
            letterSpacing: '0.35em',
            color: 'rgba(239,235,214,0.14)',
          }}
        >
          El Templo Sagrado de la Birra
        </p>
      </div>

      {/* Panel de controles */}
      {!fullscreen && (
        <div className="absolute top-5 right-5 z-50 flex items-center gap-1.5">
          {/* LIVE */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(239,235,214,0.1)' }}
          >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700'}`} />
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className="text-[10px] font-bold uppercase tracking-widest transition-colors"
              style={{ color: '#6730bf' }}
            >
              {autoRefresh ? 'Live' : 'Pausa'}
            </button>
            {timeStr && (
              <span className="text-[10px] tabular-nums" style={{ color: 'rgba(239,235,214,0.3)' }}>
                · {timeStr}
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-0.5 rounded-lg p-0.5"
            style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(239,235,214,0.1)' }}
          >
            {[
              { icon: <Monitor className="w-4 h-4" />, onClick: () => navigate('/visor/2'), title: 'Visor 2' },
              { icon: <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />, onClick: cargarCervezas, title: 'Actualizar', disabled: loading },
              { icon: <Maximize2 className="w-4 h-4" />, onClick: toggleFullscreen, title: 'Pantalla completa' },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={btn.onClick}
                title={btn.title}
                disabled={(btn as any).disabled}
                className="p-2 rounded-md transition-all disabled:opacity-40"
                style={{ color: 'rgba(239,235,214,0.4)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EFEBD6')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,235,214,0.4)')}
              >
                {btn.icon}
              </button>
            ))}
            <div className="w-px h-5" style={{ background: 'rgba(239,235,214,0.1)' }} />
            <button
              onClick={() => { logout(); navigate('/login') }}
              title="Salir"
              className="p-2 rounded-md transition-all"
              style={{ color: 'rgba(239,235,214,0.3)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#EFEBD6')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,235,214,0.3)')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="relative h-full flex flex-col pl-20 pr-12 pt-9 pb-7">

        {/* Header */}
        <div className="flex-shrink-0 flex items-end gap-6 mb-6">
          <div>
            <p
              className="font-medium mb-1.5 uppercase"
              style={{ fontSize: '9px', letterSpacing: '0.35em', color: 'rgba(103,48,191,0.7)' }}
            >
              Nuestra verdadera religión
            </p>
            <h1
              className="gothic-font leading-none"
              style={{ fontSize: '4.8rem', color: '#F5A623', textShadow: '0 0 50px rgba(245,166,35,0.15)' }}
            >
              birras
            </h1>
          </div>

          <div className="flex-1 flex items-center pb-2">
            <div className="flex-1 h-px" style={{ background: 'rgba(239,235,214,0.07)' }} />
          </div>

          {/* Santa Cebada + Hora Santa */}
          <div className="flex-shrink-0 text-right" style={{ width: '250px' }}>

            {/* "Santa Cebada" en Instrument Sans uppercase — legible */}
            <p
              className="leading-none uppercase"
              style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 700,
                fontSize: '1.05rem',
                letterSpacing: '0.28em',
                color: isHoraSanta ? 'rgba(239,235,214,0.65)' : 'rgba(239,235,214,0.2)',
                marginBottom: '4px',
                transition: 'color 1.2s ease',
              }}
            >
              Santa Cebada
            </p>

            {/* "hora santa" en gótico — mismo peso visual que "birras" pero más contenido */}
            <h2
              className="gothic-font leading-none"
              style={{
                fontSize: '3.1rem',
                color: isHoraSanta ? '#C4B5FD' : 'rgba(196,181,253,0.1)',
                textShadow: isHoraSanta
                  ? '0 0 40px rgba(196,181,253,0.75), 0 0 80px rgba(167,139,250,0.4), 0 0 140px rgba(103,48,191,0.22)'
                  : 'none',
                transition: 'color 1.2s ease, text-shadow 1.2s ease',
              }}
            >
              hora santa
            </h2>

            {isHoraSanta ? (
              <>
                <p style={{ fontSize: '14px', letterSpacing: '0.22em', color: '#C4B5FD', marginTop: '5px' }}>
                  🙏 MODE ON 🙏
                </p>
                <p
                  className="italic"
                  style={{ fontSize: '10px', color: 'rgba(196,181,253,0.55)', letterSpacing: '0.04em', marginTop: '4px' }}
                >
                  La penitencia que recompensa
                </p>
                <p
                  className="uppercase"
                  style={{ fontSize: '9px', letterSpacing: '0.3em', color: 'rgba(103,48,191,0.85)', marginTop: '4px' }}
                >
                  17HS · A · 20HS
                </p>
              </>
            ) : (
              <>
                <p
                  className="italic"
                  style={{ fontSize: '10px', color: 'rgba(239,235,214,0.1)', letterSpacing: '0.05em', marginTop: '5px' }}
                >
                  La liturgia comienza a las 17
                </p>
                <p
                  className="uppercase"
                  style={{ fontSize: '9px', letterSpacing: '0.3em', color: 'rgba(103,48,191,0.3)', marginTop: '4px' }}
                >
                  17HS · A · 20HS
                </p>
              </>
            )}
          </div>
        </div>

        {/* Sin cervezas */}
        {cervezas.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="gothic-font text-5xl" style={{ color: '#F5A623', opacity: 0.3 }}>birras</p>
            <p style={{ fontSize: '14px', color: 'rgba(239,235,214,0.25)', fontWeight: 500 }}>
              Sin cervezas disponibles
            </p>
          </div>
        ) : (
          <div className="flex-1 flex min-h-0 gap-0">
            {/* Columna izquierda */}
            <div className="flex-1 flex flex-col justify-evenly overflow-hidden pr-5">
              {left.map((c, i) => (
                <BeerRow
                  key={c.canilla} cerveza={c} striped={i % 2 === 1} phase={phase}
                  isHoraSanta={isHoraSanta}
                />
              ))}
            </div>

            {/* Separador */}
            <div
              className="w-px self-stretch flex-shrink-0"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(239,235,214,0.08) 20%, rgba(239,235,214,0.08) 80%, transparent)' }}
            />

            {/* Columna derecha */}
            <div className="flex-1 flex flex-col justify-evenly overflow-hidden pl-5">
              {right.map((c, i) => (
                <BeerRow
                  key={c.canilla} cerveza={c} striped={i % 2 === 1} phase={phase}
                  isHoraSanta={isHoraSanta}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer — Escala de amargor */}
        <div
          className="flex-shrink-0 flex items-center justify-between mt-4 pt-3"
          style={{ borderTop: '1px solid rgba(239,235,214,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="font-black uppercase"
              style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(103,48,191,0.6)' }}
            >
              Escala de Amargor
            </span>
            <div className="w-px h-3" style={{ background: 'rgba(239,235,214,0.1)' }} />
            <AmargorLegend />
          </div>
          <p
            className="italic font-medium"
            style={{ fontSize: '9px', color: 'rgba(239,235,214,0.12)', letterSpacing: '0.05em' }}
          >
            El único templo que acepta tentaciones
          </p>
        </div>
      </div>
    </div>
  )
}

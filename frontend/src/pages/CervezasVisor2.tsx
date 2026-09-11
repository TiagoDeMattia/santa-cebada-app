import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Maximize2, LogOut, Monitor } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { barrilesV2Api } from '../lib/api'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../context/AuthContext'

const VISOR_CSS = `
  @keyframes phase-enter {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .phase-enter { animation: phase-enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .gothic-font { font-family: 'UnifrakturMaguntia', 'UnifrakturCook', serif; }
  .argentina-flag {
    background: linear-gradient(90deg, #4B9BD5 33%, #EFEBD6 33%, #EFEBD6 67%, #4B9BD5 67%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 900;
  }
  .holy-glow {
    color: #FFF8DC;
    text-shadow:
      0 0 4px rgba(255,255,255,0.95),
      0 0 12px rgba(255,240,140,0.9),
      0 0 28px rgba(245,166,35,0.65),
      0 0 55px rgba(245,166,35,0.25);
  }
`

// ── Ornamento de esquina ──────────────────────────────────────────────────────
function CornerOrnament({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const flipX = position === 'tr' || position === 'br'
  const flipY = position === 'bl' || position === 'br'
  const pos = { tl: 'top-3 left-3', tr: 'top-3 right-3', bl: 'bottom-3 left-3', br: 'bottom-3 right-3' }[position]
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

// ── Horario BsAs (UTC-3) ──────────────────────────────────────────────────────
function getBsAsHour(): number {
  const now = new Date()
  return Math.floor(((now.getUTCHours() * 60 + now.getUTCMinutes() - 180 + 1440) % 1440) / 60)
}

function parseHorario(h: string): { start: number; end: number } | null {
  if (!h) return null
  const m = h.match(/(\d{1,2})[\s:h]*(?:hs)?\s*(?:a|-|–|to)\s*(\d{1,2})/i)
  return m ? { start: parseInt(m[1]), end: parseInt(m[2]) } : null
}

function isPromoActiva(_horario: string): boolean {
  return true  // visibilidad manejada server-side via campo `visible`
}

function formatHorario(horario: string): string {
  const p = parseHorario(horario)
  return p ? `${p.start}HS · A · ${p.end}HS` : horario.toUpperCase()
}

function msHastaProximaHoraEnPunto(): number {
  const now = new Date()
  return (60 - now.getUTCMinutes()) * 60_000 - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds()
}

// ── Texto con palabras especiales ─────────────────────────────────────────────
function HighlightedMenuText({ text, activa = true }: { text: string; activa?: boolean }) {
  if (!text) return null
  const re = /\b(SANTO|SAGRADO|ARGENTIN[IÍ]SIMA)\b/gi
  const parts: Array<string | React.ReactElement> = []
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const w = m[0]
    const isSanto = /^(SANTO|SAGRADO)$/i.test(w)
    parts.push(
      <span key={k++} className={isSanto && activa ? 'holy-glow' : isSanto ? '' : activa ? 'argentina-flag' : ''}>
        {w}
      </span>
    )
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Item { nombre: string; precio: string }
interface Group { id: string; nombre: string; horario: string; items: Item[]; visible?: boolean }
interface MenuRow { label: string; value: string }

// ── Card de ítem — nombre izq + precio der, siempre una fila ─────────────────
function ItemCard({ item, activa }: { item: Item; activa: boolean }) {
  const hasName = !!item.nombre.trim()

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{
        background: activa ? 'rgba(167,139,250,0.06)' : 'rgba(239,235,214,0.02)',
        border: `1px solid ${activa ? 'rgba(196,181,253,0.18)' : 'rgba(239,235,214,0.06)'}`,
        transition: 'background 1.2s ease, border-color 1.2s ease',
      }}
    >
      {hasName && (
        <span
          className="flex-1 font-black leading-snug min-w-0"
          style={{
            fontSize: '0.95rem',
            color: activa ? '#EFEBD6' : 'rgba(239,235,214,0.2)',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            transition: 'color 1.2s ease',
          }}
        >
          {item.nombre}
        </span>
      )}

      {item.precio && (
        <span
          className="flex-shrink-0 font-black"
          style={{
            fontSize: '1.45rem',
            lineHeight: 1.1,
            marginLeft: hasName ? undefined : 'auto',
            color: activa ? '#C4B5FD' : 'rgba(245,166,35,0.18)',
            textShadow: activa ? '0 0 14px rgba(167,139,250,0.45), 0 0 32px rgba(167,139,250,0.18)' : 'none',
            transition: 'color 1.2s ease, text-shadow 1.2s ease',
          }}
        >
          {item.precio}
        </span>
      )}
    </div>
  )
}

// ── Desglose del Menú Ejecutivo (O31:P35) ─────────────────────────────────────
// Estructura esperada:
//   Row 0 → O="TITULO"         P=texto del título
//   Row 1 → O="Plato Ppal"    P="-opcion1\n-opcion2\nTexto libre"
//   Row 2 → O="Bebida"        P="-opcion1\n-opcion2"
//   Row 3 → O="Postre"        P="-opcion1\n-opcion2"
//   Row 4 → O="PIE DE PAGINA" P=texto del pie
// Líneas con "-" al inicio → bullets ✦  |  sin "-" → texto plano
function MenuEjecutivoContent({ data, activa }: { data: MenuRow[]; activa: boolean }) {
  const nonEmpty = data.filter(r => r.label || r.value)
  if (!nonEmpty.length) return null

  const titulo  = nonEmpty[0]
  const footer  = nonEmpty.length > 1 ? nonEmpty[nonEmpty.length - 1] : null
  const cuerpo  = nonEmpty.length > 2 ? nonEmpty.slice(1, -1) : nonEmpty.slice(1)

  const colorBeige    = activa ? '#EFEBD6'                   : 'rgba(239,235,214,0.2)'
  const colorLavanda  = activa ? '#C4B5FD'                   : 'rgba(196,181,253,0.2)'
  const colorGold     = activa ? '#F5A623'                   : 'rgba(245,166,35,0.25)'
  const colorDesc     = activa ? 'rgba(239,235,214,0.52)'    : 'rgba(239,235,214,0.12)'
  const shadowLavanda = activa ? '0 0 28px rgba(196,181,253,0.55)' : 'none'
  const borderColor   = activa ? 'rgba(196,181,253,0.3)'     : 'rgba(239,235,214,0.07)'
  const bgOuter       = activa ? 'rgba(10,6,28,0.6)'         : 'rgba(239,235,214,0.02)'
  const bgInner       = activa ? 'rgba(255,255,255,0.04)'    : 'rgba(239,235,214,0.02)'
  const borderInner   = activa ? 'rgba(239,235,214,0.1)'     : 'rgba(239,235,214,0.04)'

  return (
    /* ── Un único recuadro exterior ── */
    <div
      className="flex flex-col overflow-hidden rounded-xl"
      style={{
        background: bgOuter,
        border: `1.5px solid ${borderColor}`,
        transition: 'background 1.2s ease, border-color 1.2s ease',
      }}
    >
      {/* ── Título (solo columna P) ── */}
      <div
        className="flex-shrink-0 px-4 py-3 text-center"
        style={{ borderBottom: `1px solid ${borderColor}` }}
      >
        <p
          className="font-black uppercase leading-tight"
          style={{
            fontSize: '1.75rem',
            color: colorLavanda,
            textShadow: shadowLavanda,
            transition: 'color 1.2s ease, text-shadow 1.2s ease',
          }}
        >
          <HighlightedMenuText text={titulo.value || titulo.label} activa={activa} />
        </p>
      </div>

      {/* ── Tres cards internas (Plato Principal, Bebida, Postre) ── */}
      <div className="flex-1 flex flex-col gap-2 p-3 overflow-hidden">
        {cuerpo.map((row, i) => {
          const lines = (row.value || '').split('\n').map(s => s.trim()).filter(Boolean)
          return (
            <div
              key={i}
              className="flex-shrink-0 flex flex-col rounded-lg px-3 py-2.5"
              style={{
                background: bgInner,
                border: `1px solid ${borderInner}`,
              }}
            >
              {/* Encabezado de sección — dorado con línea decorativa */}
              {row.label && (
                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                  <span
                    style={{
                      fontSize: '0.45rem',
                      color: colorGold,
                      flexShrink: 0,
                    }}
                  >
                    ◆
                  </span>
                  <p
                    className="uppercase font-black"
                    style={{
                      fontSize: '0.66rem',
                      letterSpacing: '0.32em',
                      color: colorGold,
                      transition: 'color 1.2s ease',
                    }}
                  >
                    {row.label}
                  </p>
                  <div
                    className="flex-1"
                    style={{ height: '1px', background: `linear-gradient(to right, ${colorGold.replace(')', ', 0.4)').replace('rgb', 'rgba')}, transparent)` }}
                  />
                </div>
              )}

              {/* Líneas del value: solo las que empiezan con "-" llevan bullet */}
              <div className="flex flex-col gap-1 overflow-hidden">
                {lines.map((line, j) => {
                  const hasDash = line.startsWith('-')
                  const text = hasDash ? line.slice(1).trim() : line
                  return (
                    <div key={j} className={`flex items-start ${hasDash ? 'gap-2' : 'pl-4'}`}>
                      {hasDash && (
                        <span
                          className="flex-shrink-0"
                          style={{ fontSize: '0.5rem', color: colorGold, lineHeight: '1.5rem' }}
                        >
                          ✦
                        </span>
                      )}
                      <span
                        className="leading-snug"
                        style={{
                          fontSize: hasDash ? '1.05rem' : '0.87rem',
                          fontWeight: hasDash ? 800 : 400,
                          color: colorBeige,
                          fontStyle: hasDash ? 'normal' : 'italic',
                          textShadow: hasDash && activa ? '0 0 18px rgba(239,235,214,0.35)' : 'none',
                          transition: 'color 1.2s ease, text-shadow 1.2s ease',
                        }}
                      >
                        <HighlightedMenuText text={text} activa={activa} />
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Pie de página (solo columna P) ── */}
      {footer && (footer.value || footer.label) && (
        <div
          className="flex-shrink-0 px-4 py-2.5 text-center"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <p
            className="font-black leading-snug"
            style={{
              fontSize: '1.0rem',
              color: colorBeige,
              transition: 'color 1.2s ease',
            }}
          >
            <HighlightedMenuText text={footer.value || footer.label} activa={activa} />
          </p>
        </div>
      )}
    </div>
  )
}

// ── Columna combinada (ej: Bebidas HS + Comida HS en una sola) ───────────────
function MergedPromoColumn({ groups, delay }: { groups: Group[]; delay: number }) {
  const activa = groups.some(g => g.visible !== false)
  const horario = groups[0].horario
  const horarioFmt = horario ? formatHorario(horario) : null

  // Título compartido: palabras comunes entre todos los nombres (HORA SANTA)
  const sharedTitle = (() => {
    const words0 = groups[0].nombre.toUpperCase().split(/\s+/)
    const rest   = groups.slice(1).map(g => g.nombre.toUpperCase().split(/\s+/))
    return words0.filter(w => rest.every(ws => ws.includes(w))).join(' ') || groups[0].nombre
  })()

  // Sub-etiqueta: la palabra única de cada grupo (BEBIDAS / COMIDA)
  const subLabel = (g: Group) => {
    const sharedWords = sharedTitle.toUpperCase().split(/\s+/)
    const unique = g.nombre.toUpperCase().split(/\s+/).filter(w => !sharedWords.includes(w))
    return unique.join(' ') || g.nombre
  }

  const colorActivo = activa ? '#EFEBD6' : 'rgba(239,235,214,0.2)'
  const colorLabel  = activa ? 'rgba(103,48,191,0.85)' : 'rgba(103,48,191,0.35)'
  const colorTitle  = activa ? '#C4B5FD' : 'rgba(239,235,214,0.22)'
  const shadowTitle = activa ? '0 0 40px rgba(196,181,253,0.75), 0 0 80px rgba(167,139,250,0.4)' : 'none'
  const colorGold   = activa ? '#F5A623' : 'rgba(245,166,35,0.25)'

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full phase-enter" style={{ animationDelay: `${delay}ms` }}>

      {/* ── Header compartido ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 mb-3">
        <p className="font-medium uppercase mb-1" style={{ fontSize: '8px', letterSpacing: '0.38em', color: colorLabel, transition: 'color 1.2s ease' }}>
          promo
        </p>
        <h2 className="leading-none uppercase" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '1.85rem', letterSpacing: '0.05em', color: colorTitle, textShadow: shadowTitle, transition: 'color 1.2s ease, text-shadow 1.2s ease' }}>
          {sharedTitle}
        </h2>

        {/* Horario badge */}
        <div className="mt-2.5 rounded-xl px-3 py-2.5" style={{ background: activa ? 'rgba(167,139,250,0.1)' : 'rgba(239,235,214,0.03)', border: `1.5px solid ${activa ? 'rgba(196,181,253,0.35)' : 'rgba(239,235,214,0.07)'}`, transition: 'background 1.2s ease, border-color 1.2s ease' }}>
          {activa ? (
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span className="font-black uppercase" style={{ fontSize: '10px', letterSpacing: '0.25em', color: '#C4B5FD' }}>Activa ahora</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ fontSize: '13px', color: 'rgba(239,68,68,0.55)', lineHeight: 1 }}>⊘</span>
              <div style={{ background: 'rgba(185,28,28,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '1px 7px' }}>
                <span className="font-black uppercase" style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(248,113,113,0.7)' }}>Fuera de horario</span>
              </div>
            </div>
          )}
          {horario && <p className="font-black leading-tight" style={{ fontSize: '1.15rem', color: colorTitle, transition: 'color 1.2s ease' }}>{horario}</p>}
          {horarioFmt && <p className="uppercase mt-0.5" style={{ fontSize: '8px', letterSpacing: '0.28em', color: activa ? 'rgba(103,48,191,0.9)' : 'rgba(103,48,191,0.3)', transition: 'color 1.2s ease' }}>{horarioFmt}</p>}
        </div>

        {/* Separador */}
        <div className="mt-3" style={{ height: '1px', background: activa ? 'linear-gradient(to right, rgba(196,181,253,0.45), rgba(196,181,253,0.08) 70%, transparent)' : 'linear-gradient(to right, rgba(239,235,214,0.08), transparent)', transition: 'background 1.2s ease' }} />
      </div>

      {/* ── Dos categorías lado a lado ────────────────────────────────────── */}
      <div className="flex-1 flex gap-0 min-h-0 overflow-hidden">
        {groups.map((group, i) => (
          <div key={group.id} className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {/* Divisor vertical entre categorías */}
            {i > 0 && (
              <div className="absolute" style={{ display: 'contents' }} />
            )}
            <div className={`flex-1 flex flex-col min-h-0 ${i > 0 ? 'pl-3 border-l' : 'pr-3'}`}
              style={{ borderColor: 'rgba(239,235,214,0.07)' }}>
              {/* Sub-etiqueta de categoría */}
              <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
                <span style={{ fontSize: '0.4rem', color: colorGold }}>◆</span>
                <p className="uppercase font-black" style={{ fontSize: '0.62rem', letterSpacing: '0.3em', color: colorGold, transition: 'color 1.2s ease' }}>
                  {subLabel(group)}
                </p>
              </div>
              {/* Items */}
              <div className="flex flex-col gap-1.5 overflow-hidden">
                {group.items.map((item, j) => (
                  <ItemCard key={j} item={item} activa={activa} />
                ))}
                {group.items.length === 0 && (
                  <p style={{ fontSize: '13px', color: 'rgba(239,235,214,0.15)', fontStyle: 'italic' }}>Sin ítems</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Columna de promo ──────────────────────────────────────────────────────────
function PromoColumn({
  group, delay, menuEjecutivo,
}: {
  group: Group
  delay: number
  menuEjecutivo: MenuRow[]
}) {
  const activa = group.visible !== false
  const horarioFmt = group.horario ? formatHorario(group.horario) : null
  // Detecta Menú Ejecutivo por nombre del grupo O por nombre de algún ítem
  const isEjecutivo = menuEjecutivo.length > 0 && (
    /ejecutivo|menú|menu/i.test(group.nombre) ||
    group.items.some(it => /ejecutivo/i.test(it.nombre))
  )

  return (
    <div
      className="flex-1 flex flex-col min-w-0 h-full phase-enter"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 mb-3">
        <p
          className="font-medium uppercase mb-1"
          style={{
            fontSize: '8px',
            letterSpacing: '0.38em',
            color: activa ? 'rgba(103,48,191,0.85)' : 'rgba(103,48,191,0.35)',
            transition: 'color 1.2s ease',
          }}
        >
          promo
        </p>

        <h2
          className="leading-none uppercase"
          style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 700,
            fontSize: '1.85rem',
            letterSpacing: '0.05em',
            color: activa ? '#C4B5FD' : 'rgba(239,235,214,0.22)',
            textShadow: activa
              ? '0 0 40px rgba(196,181,253,0.75), 0 0 80px rgba(167,139,250,0.4)'
              : 'none',
            transition: 'color 1.2s ease, text-shadow 1.2s ease',
          }}
        >
          {group.nombre}
        </h2>

        {/* Bloque de horario */}
        <div
          className="mt-2.5 rounded-xl px-3 py-2.5"
          style={{
            background: activa ? 'rgba(167,139,250,0.1)' : 'rgba(239,235,214,0.03)',
            border: `1.5px solid ${activa ? 'rgba(196,181,253,0.35)' : 'rgba(239,235,214,0.07)'}`,
            transition: 'background 1.2s ease, border-color 1.2s ease',
          }}
        >
          {activa ? (
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span
                className="font-black uppercase"
                style={{ fontSize: '10px', letterSpacing: '0.25em', color: '#C4B5FD' }}
              >
                Activa ahora
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ fontSize: '13px', color: 'rgba(239,68,68,0.55)', lineHeight: 1 }}>⊘</span>
              <div style={{ background: 'rgba(185,28,28,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '1px 7px' }}>
                <span className="font-black uppercase" style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(248,113,113,0.7)' }}>
                  Fuera de horario
                </span>
              </div>
            </div>
          )}

          {group.horario && (
            <p
              className="font-black leading-tight"
              style={{
                fontSize: '1.15rem',
                color: activa ? '#C4B5FD' : 'rgba(239,235,214,0.22)',
                transition: 'color 1.2s ease',
              }}
            >
              {group.horario}
            </p>
          )}
          {horarioFmt && (
            <p
              className="uppercase mt-0.5"
              style={{
                fontSize: '8px',
                letterSpacing: '0.28em',
                color: activa ? 'rgba(103,48,191,0.9)' : 'rgba(103,48,191,0.3)',
                transition: 'color 1.2s ease',
              }}
            >
              {horarioFmt}
            </p>
          )}
        </div>

        {/* Separador */}
        <div
          className="mt-3"
          style={{
            height: '1px',
            background: activa
              ? 'linear-gradient(to right, rgba(196,181,253,0.45), rgba(196,181,253,0.08) 70%, transparent)'
              : 'linear-gradient(to right, rgba(239,235,214,0.08), transparent)',
            transition: 'background 1.2s ease',
          }}
        />
      </div>

      {/* ── Contenido ─────────────────────────────────────────────────────────── */}
      {isEjecutivo && menuEjecutivo.length > 0 ? (
        <MenuEjecutivoContent data={menuEjecutivo} activa={activa} />
      ) : (
        <div className="flex flex-col gap-1.5 overflow-hidden">
          {group.items.map((item, i) => (
            <ItemCard key={i} item={item} activa={activa} />
          ))}
          {group.items.length === 0 && (
            <p style={{ fontSize: '13px', color: 'rgba(239,235,214,0.15)', fontStyle: 'italic', padding: '8px 16px' }}>
              Sin ítems
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Separador de columnas ─────────────────────────────────────────────────────
function ColumnDivider() {
  return (
    <div
      className="flex-shrink-0 w-px self-stretch mx-1"
      style={{
        background: 'linear-gradient(to bottom, transparent, rgba(239,235,214,0.08) 20%, rgba(239,235,214,0.08) 80%, transparent)',
      }}
    />
  )
}

// Agrupa grupos consecutivos con "hora santa" en el nombre en un único slot combinado
function buildColumns(groups: Group[]): (Group | Group[])[] {
  const result: (Group | Group[])[] = []
  let buffer: Group[] = []
  for (const g of groups) {
    if (/hora santa/i.test(g.nombre)) {
      buffer.push(g)
    } else {
      if (buffer.length) { result.push(buffer.length === 1 ? buffer[0] : [...buffer]); buffer = [] }
      result.push(g)
    }
  }
  if (buffer.length) result.push(buffer.length === 1 ? buffer[0] : [...buffer])
  return result
}

// ── Componente principal ──────────────────────────────────────────────────────
export function CervezasVisor2() {
  const [groups, setGroups] = useState<Group[]>([])
  const [menuEjecutivo, setMenuEjecutivo] = useState<MenuRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [, setTick] = useState(0)
  const navigate = useNavigate()
  const { logout } = useAuth()

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
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await barrilesV2Api.getVisor2()
      setGroups(data.groups)
      setMenuEjecutivo(data.menu_ejecutivo ?? [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Error cargando visor2:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  useEffect(() => {
    if (!autoRefresh) return
    let tid: ReturnType<typeof setTimeout>
    const scheduleNext = () => {
      tid = setTimeout(() => { cargarDatos(); scheduleNext() }, msHastaProximaHoraEnPunto())
    }
    scheduleNext()
    return () => clearTimeout(tid)
  }, [autoRefresh, cargarDatos])

  // SSE: actualizar inmediatamente cuando se pincha/despincha un barril
  useEffect(() => {
    const es = new EventSource('/api/barriles/events')
    es.onmessage = (e) => { if (e.data === 'barrel_update') cargarDatos() }
    return () => es.close()
  }, [cargarDatos])

  const toggleFullscreen = () => {
    if (!fullscreen) document.documentElement.requestFullscreen().catch(console.error)
    else document.exitFullscreen()
  }

  if (loading && groups.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ background: '#000000' }}>
        <Spinner size="lg" />
        <p className="gothic-font text-2xl" style={{ color: '#F5A623', opacity: 0.6 }}>promos</p>
      </div>
    )
  }

  const timeStr = lastRefresh?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) ?? ''
  const visibleGroups = groups  // todos los grupos siempre visibles; activa/inactiva se maneja por styling

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ background: '#000000', color: '#EFEBD6', fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}
    >
      <CornerOrnament position="tl" />
      <CornerOrnament position="tr" />
      <CornerOrnament position="bl" />
      <CornerOrnament position="br" />

      <div className="absolute inset-4 pointer-events-none" style={{ border: '1px solid rgba(239,235,214,0.1)' }} />

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

      {/* Controles */}
      {!fullscreen && (
        <div className="absolute top-5 right-5 z-50 flex items-center gap-1.5">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(239,235,214,0.1)' }}
          >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700'}`} />
            <button onClick={() => setAutoRefresh(v => !v)} className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6730bf' }}>
              {autoRefresh ? 'Live' : 'Pausa'}
            </button>
            {timeStr && <span className="text-[10px] tabular-nums" style={{ color: 'rgba(239,235,214,0.3)' }}>· {timeStr}</span>}
          </div>
          <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(239,235,214,0.1)' }}>
            {[
              { icon: <Monitor className="w-4 h-4" />, onClick: () => navigate('/visor/1'), title: 'Visor 1' },
              { icon: <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />, onClick: cargarDatos, title: 'Actualizar', disabled: loading },
              { icon: <Maximize2 className="w-4 h-4" />, onClick: toggleFullscreen, title: 'Pantalla completa' },
            ].map((btn, i) => (
              <button
                key={i} onClick={btn.onClick} title={btn.title}
                disabled={(btn as { disabled?: boolean }).disabled}
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

      {/* Contenido */}
      <div className="relative h-full flex flex-col pl-20 pr-12 pt-9 pb-7">

        {/* Header */}
        <div className="flex-shrink-0 flex items-end gap-6 mb-5">
          <div>
            <p className="font-medium mb-1.5 uppercase" style={{ fontSize: '9px', letterSpacing: '0.35em', color: 'rgba(103,48,191,0.7)' }}>
              Nuestra verdadera religión
            </p>
            <h1 className="gothic-font leading-none" style={{ fontSize: '4.8rem', color: '#F5A623', textShadow: '0 0 50px rgba(245,166,35,0.15)' }}>
              promos
            </h1>
          </div>
          <div className="flex-1 flex items-center pb-2">
            <div className="flex-1 h-px" style={{ background: 'rgba(239,235,214,0.07)' }} />
          </div>
          <div className="flex-shrink-0 text-right" style={{ width: '220px' }}>
            <p className="leading-none uppercase" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.28em', color: 'rgba(239,235,214,0.5)', marginBottom: '6px' }}>
              Santa Cebada
            </p>
            <p className="italic" style={{ fontSize: '10px', color: 'rgba(239,235,214,0.2)', letterSpacing: '0.05em' }}>
              La penitencia que recompensa
            </p>
          </div>
        </div>

        {/* Columnas */}
        {visibleGroups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="gothic-font text-5xl" style={{ color: '#F5A623', opacity: 0.3 }}>promos</p>
            <p style={{ fontSize: '14px', color: 'rgba(239,235,214,0.25)' }}>Sin promos disponibles</p>
          </div>
        ) : (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {buildColumns(visibleGroups.slice(0, 4)).map((col, idx) => (
              <div key={Array.isArray(col) ? col.map(g => g.id).join('-') : col.id} className="flex flex-1 min-w-0 min-h-0">
                {idx > 0 && <ColumnDivider />}
                <div className="flex-1 min-w-0 min-h-0 overflow-hidden px-3 py-1 flex flex-col">
                  {Array.isArray(col) ? (
                    <MergedPromoColumn groups={col} delay={idx * 80} />
                  ) : (
                    <PromoColumn group={col} delay={idx * 80} menuEjecutivo={menuEjecutivo} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(239,235,214,0.07)' }}>
          <div className="flex items-center gap-3">
            <span className="font-black uppercase" style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(103,48,191,0.6)' }}>Santa Cebada</span>
            <div className="w-px h-3" style={{ background: 'rgba(239,235,214,0.1)' }} />
            <span style={{ fontSize: '9px', color: 'rgba(239,235,214,0.15)', letterSpacing: '0.15em' }}>Cervecería Artesanal</span>
          </div>
          <p className="italic font-medium" style={{ fontSize: '9px', color: 'rgba(239,235,214,0.12)', letterSpacing: '0.05em' }}>
            El único templo que acepta tentaciones
          </p>
        </div>
      </div>
    </div>
  )
}

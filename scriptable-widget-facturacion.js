// ─────────────────────────────────────────────────────────
//  Santa Cebada · Facturación
//  Tamaño recomendado: Medium (ancho completo)
//  Refresh: cada 5 minutos
// ─────────────────────────────────────────────────────────

const API_URL   = "http://89.167.100.235:8001/api/widgets/data?key=santa-widget-sc2025"
const CACHE_KEY = "sc_widget_v3.json"

// ── Paleta del sitio ──────────────────────────────────────
const BG      = new Color("#141109")   // dark-surface
const BORDER  = new Color("#2A2318")   // dark-border
const AMBER   = new Color("#C8860A")   // accent
const WHITE   = new Color("#F5F1E8")   // warm white
const GRAY    = new Color("#7C6E56")   // muted
const DIM     = new Color("#3A3020")   // very dim
const YELLOW  = new Color("#F59E0B")   // almuerzo
const BLUE    = new Color("#60A5FA")   // noche
const GREEN   = new Color("#34D399")   // live indicator
const ORANGE  = new Color("#F97316")   // cached warning

// ── Utilidades ────────────────────────────────────────────

const fm        = FileManager.local()
const cachePath = fm.joinPath(fm.cacheDirectory(), CACHE_KEY)

function fmt(n) {
  if (!n || n === 0) return "$0"
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000)     return "$" + Math.round(n / 1_000) + "k"
  return "$" + Math.round(n)
}

function hhmm() {
  const d = new Date()
  return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0")
}

function fechaCorta(s) {
  // "2026-07-02" → "Jue 02"
  const dias = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"]
  const d = new Date(s + "T12:00:00")
  return dias[d.getDay()] + " " + d.getDate()
}

// ── Separador horizontal confiable ────────────────────────
// BUG CORREGIDO: new Size(9999,1) rompe el layout.
// Usamos addSpacer() dentro de un stack con height=1.
function addHSep(parent) {
  const s = parent.addStack()
  s.layoutHorizontally()
  s.backgroundColor = BORDER
  s.size = new Size(0, 1)   // width=0→auto-fill, height=1pt
  s.addSpacer()              // fuerza expansión horizontal
}

// ── Celda de métrica (label + valor) ─────────────────────
function addCell(parent, label, value, color, bigFont) {
  const cell = parent.addStack()
  cell.layoutVertically()
  cell.spacing = 1

  const lbl = cell.addText(label)
  lbl.font      = Font.semiboldSystemFont(7)
  lbl.textColor = GRAY
  lbl.lineLimit = 1

  const val = cell.addText(value)
  val.font                = Font.boldSystemFont(bigFont || 16)
  val.textColor           = color
  val.lineLimit           = 1
  val.minimumScaleFactor  = 0.6
}

// ── Fetch con caché ───────────────────────────────────────
async function loadData() {
  try {
    const req = new Request(API_URL)
    req.timeoutInterval = 12
    const json = await req.loadJSON()
    if (json && json.facturacion) {
      fm.writeString(cachePath, JSON.stringify({ ts: Date.now(), d: json }))
      return { ok: true, data: json }
    }
    throw new Error("Respuesta inválida")
  } catch(e) {
    if (fm.fileExists(cachePath)) {
      try {
        const c = JSON.parse(fm.readString(cachePath))
        const age = Math.round((Date.now() - c.ts) / 60000)
        return { ok: false, data: c.d, age }
      } catch(_) {}
    }
    return { ok: false, data: null, err: e.message }
  }
}

// ── Construcción del widget ───────────────────────────────
async function buildWidget() {
  const w = new ListWidget()
  w.backgroundColor = BG
  w.setPadding(13, 15, 11, 15)
  w.spacing = 0

  const result = await loadData()

  // ─ Error total: sin datos y sin caché ──────────────────
  if (!result.data) {
    w.addSpacer()
    const t = w.addText("Sin conexión\n" + (result.err || ""))
    t.textColor = ORANGE
    t.font      = Font.systemFont(11)
    t.lineLimit = 3
    w.addSpacer()
    return w
  }

  const f      = result.data.facturacion
  const cached = !result.ok

  // ─ HEADER ──────────────────────────────────────────────
  const header = w.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()
  header.spacing = 5

  // Ícono
  const ico = header.addText("⬡")
  ico.font      = Font.boldSystemFont(10)
  ico.textColor = AMBER
  ico.lineLimit = 1

  // Título
  const tit = header.addText("FACTURACIÓN")
  tit.font      = Font.boldSystemFont(10)
  tit.textColor = WHITE
  tit.lineLimit = 1

  header.addSpacer()

  // Fecha + turno
  const turnoIcon = f.turno_actual === "manana" ? "☀" : "🌙"
  const fecha = header.addText(fechaCorta(f.fecha_negocio) + "  " + turnoIcon)
  fecha.font      = Font.systemFont(9)
  fecha.textColor = GRAY
  fecha.lineLimit = 1

  header.addSpacer()

  // Estado live/caché
  const badge = header.addText(cached ? "⚑ " + result.age + "m" : "● live")
  badge.font      = Font.semiboldSystemFont(8)
  badge.textColor = cached ? ORANGE : GREEN

  // ─ Separador ───────────────────────────────────────────
  w.addSpacer(6)
  addHSep(w)
  w.addSpacer(9)

  // ─ CUERPO: 3 columnas ──────────────────────────────────
  // Layout: [col-hoy] | [separador] | [col-turnos] | [separador] | [col-periodo]
  // Sin addSpacer() flexible entre columnas — en su lugar usamos
  // spacing del stack para control predecible.

  const body = w.addStack()
  body.layoutHorizontally()
  body.centerAlignContent()
  body.spacing = 12  // Separación entre columnas

  // — Columna 1: HOY —
  const col1 = body.addStack()
  col1.layoutVertically()
  col1.spacing = 2

  const hoyLbl = col1.addText("HOY")
  hoyLbl.font      = Font.semiboldSystemFont(7)
  hoyLbl.textColor = GRAY

  const hoyVal = col1.addText(fmt(f.hoy))
  hoyVal.font               = Font.boldSystemFont(28)
  hoyVal.textColor          = AMBER
  hoyVal.lineLimit          = 1
  hoyVal.minimumScaleFactor = 0.5

  body.addSpacer()  // Un solo spacer flexible: empuja col2 y col3 a la derecha

  // — Separador vertical — (sin new Size con ancho enorme)
  const vd1 = body.addStack()
  vd1.backgroundColor = BORDER
  vd1.size            = new Size(1, 48)

  body.addSpacer(8)

  // — Columna 2: ALMUERZO + NOCHE —
  const col2 = body.addStack()
  col2.layoutVertically()
  col2.spacing = 7

  addCell(col2, "TURNO MAÑANA", fmt(f.manana), YELLOW, 15)
  addCell(col2, "NOCHE",    fmt(f.noche),    BLUE,   15)

  body.addSpacer(8)

  // — Separador vertical 2 —
  const vd2 = body.addStack()
  vd2.backgroundColor = BORDER
  vd2.size            = new Size(1, 48)

  body.addSpacer(8)

  // — Columna 3: SEMANA + MES —
  const col3 = body.addStack()
  col3.layoutVertically()
  col3.spacing = 7

  addCell(col3, "SEMANA", fmt(f.semanal), WHITE, 15)
  addCell(col3, "MES",    fmt(f.mensual), WHITE, 15)

  // ─ Footer: hora de actualización ───────────────────────
  w.addSpacer(6)
  const foot = w.addStack()
  foot.layoutHorizontally()

  foot.addSpacer()
  const act = foot.addText("Act. " + hhmm())
  act.font      = Font.systemFont(8)
  act.textColor = DIM

  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000)
  return w
}

// ── Main con catch global ─────────────────────────────────
let widget
try {
  widget = await buildWidget()
} catch(e) {
  widget = new ListWidget()
  widget.backgroundColor = BG
  widget.addSpacer()
  const errTxt = widget.addText("JS Error:\n" + e.message)
  errTxt.textColor = new Color("#FF6B6B")
  errTxt.font      = Font.systemFont(10)
  errTxt.lineLimit = 4
  widget.addSpacer()
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()

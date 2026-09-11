// ─────────────────────────────────────────────────────────
//  Santa Cebada · Vales
//  Tamaño recomendado: Medium (ancho completo)
//  Refresh: cada 5 minutos
// ─────────────────────────────────────────────────────────

const API_URL   = "http://89.167.100.235:8001/api/widgets/data?key=santa-widget-sc2025"
const CACHE_KEY = "sc_widget_v3.json"   // mismo caché que facturación

// ── Paleta del sitio ──────────────────────────────────────
const BG     = new Color("#141109")
const BORDER = new Color("#2A2318")
const AMBER  = new Color("#C8860A")
const WHITE  = new Color("#F5F1E8")
const GRAY   = new Color("#7C6E56")
const DIM    = new Color("#3A3020")
const RICK   = new Color("#F97316")   // naranja
const GUST   = new Color("#A78BFA")   // violeta
const KARI   = new Color("#F472B6")   // rosa
const GREEN  = new Color("#34D399")
const ORANGE = new Color("#F97316")

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

// ── Separador horizontal confiable ────────────────────────
function addHSep(parent) {
  const s = parent.addStack()
  s.layoutHorizontally()
  s.backgroundColor = BORDER
  s.size = new Size(0, 1)   // width=auto, height=1pt
  s.addSpacer()
}

// ── Fetch con caché compartido ────────────────────────────
async function loadData() {
  try {
    const req = new Request(API_URL)
    req.timeoutInterval = 12
    const json = await req.loadJSON()
    if (json && json.vales) {
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

// ── Fila de persona ───────────────────────────────────────
function addRow(parent, nombre, semanal, mensual, color, isLast) {
  const row = parent.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.spacing = 0

  // Barra de color lateral
  const bar = row.addStack()
  bar.backgroundColor = color
  bar.cornerRadius    = 2
  bar.size            = new Size(3, 38)

  row.addSpacer(10)

  // Nombre
  const nameStack = row.addStack()
  nameStack.layoutVertically()
  // Sin size fijo: auto-height. new Size(75,0) colapsaba a 0pt de alto.

  const nameT = nameStack.addText(nombre)
  nameT.font      = Font.semiboldSystemFont(13)
  nameT.textColor = WHITE
  nameT.lineLimit = 1

  row.addSpacer()

  // SEMANA
  const semStack = row.addStack()
  semStack.layoutVertically()
  semStack.spacing = 1

  const semLbl = semStack.addText("SEMANA")
  semLbl.font      = Font.semiboldSystemFont(7)
  semLbl.textColor = GRAY

  const semVal = semStack.addText(fmt(semanal))
  semVal.font               = Font.boldSystemFont(17)
  semVal.textColor          = color
  semVal.lineLimit          = 1
  semVal.minimumScaleFactor = 0.6

  row.addSpacer(20)

  // MES
  const mesStack = row.addStack()
  mesStack.layoutVertically()
  mesStack.spacing = 1

  const mesLbl = mesStack.addText("MES")
  mesLbl.font      = Font.semiboldSystemFont(7)
  mesLbl.textColor = GRAY

  const mesVal = mesStack.addText(fmt(mensual))
  mesVal.font               = Font.boldSystemFont(17)
  mesVal.textColor          = color
  mesVal.lineLimit          = 1
  mesVal.minimumScaleFactor = 0.6
}

// ── Construcción del widget ───────────────────────────────
async function buildWidget() {
  const w = new ListWidget()
  w.backgroundColor = BG
  w.setPadding(13, 15, 11, 15)
  w.spacing = 0

  const result = await loadData()

  // ─ Error total ─────────────────────────────────────────
  if (!result.data) {
    w.addSpacer()
    const t = w.addText("Sin conexión\n" + (result.err || ""))
    t.textColor = ORANGE
    t.font      = Font.systemFont(11)
    t.lineLimit = 3
    w.addSpacer()
    return w
  }

  const v      = result.data.vales
  const cached = !result.ok

  // ─ HEADER ──────────────────────────────────────────────
  const header = w.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()
  header.spacing = 5

  const ico = header.addText("🎟")
  ico.font      = Font.systemFont(10)
  ico.lineLimit = 1

  const tit = header.addText("VALES")
  tit.font      = Font.boldSystemFont(10)
  tit.textColor = WHITE

  header.addSpacer()

  // Período
  const per = header.addText("Sem " + v.semana_desde + "  ·  Mes " + v.mes_desde)
  per.font      = Font.systemFont(8)
  per.textColor = GRAY
  per.lineLimit = 1

  header.addSpacer()

  const badge = header.addText(cached ? "⚑ " + result.age + "m" : "● live")
  badge.font      = Font.semiboldSystemFont(8)
  badge.textColor = cached ? ORANGE : GREEN

  // ─ Separador ───────────────────────────────────────────
  w.addSpacer(6)
  addHSep(w)
  w.addSpacer(10)

  // ─ FILAS ───────────────────────────────────────────────
  addRow(w, "Rick",    v.vales1.semanal, v.vales1.mensual, RICK)

  w.addSpacer(4)
  addHSep(w)
  w.addSpacer(4)

  addRow(w, "Gustavo", v.vales2.semanal, v.vales2.mensual, GUST)

  w.addSpacer(4)
  addHSep(w)
  w.addSpacer(4)

  addRow(w, "Karina",  v.vales3.semanal, v.vales3.mensual, KARI, true)

  // ─ Footer ──────────────────────────────────────────────
  w.addSpacer(5)
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

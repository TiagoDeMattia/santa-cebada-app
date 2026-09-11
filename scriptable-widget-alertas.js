// ─────────────────────────────────────────────────────────
//  Santa Cebada · Alertas 85/86
//  Tamaño: Large (329×345 pt)
//  Refresh: cada 2 minutos · Toca el widget para forzar
// ─────────────────────────────────────────────────────────
//  NOMBRE DEL SCRIPT EN SCRIPTABLE: "Alertas 85/86"
//  (debe coincidir exactamente para que el tap funcione)
// ─────────────────────────────────────────────────────────

const API_URL   = "http://89.167.100.235:8001/api/widgets/data?key=santa-widget-sc2025"
const CACHE_KEY = "sc_widget_v3.json"

// ── Paleta ────────────────────────────────────────────────
const BG     = new Color("#141109")
const BORDER = new Color("#2A2318")
const WHITE  = new Color("#F5F1E8")
const GRAY   = new Color("#7C6E56")
const DIM    = new Color("#3A3020")
const AMBER  = new Color("#C8860A")
const RED    = new Color("#EF4444")
const RED_BG = new Color("#2D1010")
const AMB_BG = new Color("#2A1F00")
const GREEN  = new Color("#34D399")
const ORANGE = new Color("#F97316")

// ── Utilidades ────────────────────────────────────────────
const fm        = FileManager.local()
const cachePath = fm.joinPath(fm.cacheDirectory(), CACHE_KEY)

function hhmm() {
  const d = new Date()
  return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0")
}

function addHSep(parent, opacity) {
  const s = parent.addStack()
  s.layoutHorizontally()
  s.backgroundColor = opacity ? new Color("#2A2318", opacity) : BORDER
  s.size = new Size(0, 1)
  s.addSpacer()
}

// ── Fetch con caché ───────────────────────────────────────
async function loadData() {
  try {
    const req = new Request(API_URL)
    req.timeoutInterval = 12
    const json = await req.loadJSON()
    if (json && json.alertas) {
      fm.writeString(cachePath, JSON.stringify({ ts: Date.now(), d: json }))
      return { ok: true, data: json }
    }
    throw new Error("Sin datos de alertas")
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

// ── Sección de alertas (86 o 85) ──────────────────────────
// Muestra nombres si son ≤5, solo cuenta si son más
function addSection(parent, tipo, count, nombres, color, bgColor) {
  if (count === 0) return

  const label = tipo === 86 ? "86 · URGENTE" : "85 · ATENCIÓN"
  const icon  = tipo === 86 ? "🔴" : "🟡"

  // Fondo de sección
  const box = parent.addStack()
  box.layoutVertically()
  box.backgroundColor = bgColor
  box.cornerRadius    = 8
  box.setPadding(7, 10, 7, 10)
  box.spacing = 3

  // Encabezado de sección
  const hdr = box.addStack()
  hdr.layoutHorizontally()
  hdr.centerAlignContent()
  hdr.spacing = 5

  const ico = hdr.addText(icon)
  ico.font      = Font.systemFont(10)
  ico.lineLimit = 1

  const lbl = hdr.addText(label)
  lbl.font      = Font.boldSystemFont(11)
  lbl.textColor = color
  lbl.lineLimit = 1

  hdr.addSpacer()

  const cnt = hdr.addText(String(count) + (count === 1 ? " producto" : " productos"))
  cnt.font      = Font.semiboldSystemFont(10)
  cnt.textColor = new Color(color.hex, 0.6)
  cnt.lineLimit = 1

  // Lista de nombres (máx 5) o solo resumen
  const MAX_NAMES = 5
  if (count <= MAX_NAMES) {
    nombres.forEach(n => {
      const row = box.addStack()
      row.layoutHorizontally()
      row.centerAlignContent()
      row.spacing = 5

      const dot = row.addText("·")
      dot.font      = Font.boldSystemFont(10)
      dot.textColor = new Color(color.hex, 0.5)

      const name = row.addText(n)
      name.font               = Font.systemFont(11)
      name.textColor          = WHITE
      name.lineLimit          = 1
      name.minimumScaleFactor = 0.75
    })
  } else {
    // Mostrar primeros 4 + "X más"
    const shown = nombres.slice(0, 4)
    const extra = count - 4
    shown.forEach(n => {
      const row = box.addStack()
      row.layoutHorizontally()
      row.centerAlignContent()
      row.spacing = 5

      const dot = row.addText("·")
      dot.font      = Font.boldSystemFont(10)
      dot.textColor = new Color(color.hex, 0.5)

      const name = row.addText(n)
      name.font               = Font.systemFont(11)
      name.textColor          = WHITE
      name.lineLimit          = 1
      name.minimumScaleFactor = 0.75
    })
    const more = box.addText("  + " + extra + " más")
    more.font      = Font.italicSystemFont(10)
    more.textColor = new Color(color.hex, 0.55)
    more.lineLimit = 1
  }
}

// ── Construcción del widget ───────────────────────────────
async function buildWidget() {
  const w = new ListWidget()
  w.backgroundColor = BG
  w.setPadding(13, 14, 11, 14)
  w.spacing = 0

  const result = await loadData()

  // ─ Sin datos ───────────────────────────────────────────
  if (!result.data || !result.data.alertas) {
    w.addSpacer()
    const t = w.addText("Sin conexión\n" + (result.err || ""))
    t.textColor = ORANGE
    t.font      = Font.systemFont(11)
    t.lineLimit = 4
    w.addSpacer()
    return w
  }

  const a      = result.data.alertas
  const cached = !result.ok

  // ─ HEADER ──────────────────────────────────────────────
  const header = w.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()
  header.spacing = 5

  const ico = header.addText("⚑")
  ico.font      = Font.boldSystemFont(11)
  ico.textColor = AMBER
  ico.lineLimit = 1

  const tit = header.addText("ALERTAS  85 / 86")
  tit.font      = Font.boldSystemFont(11)
  tit.textColor = WHITE
  tit.lineLimit = 1

  header.addSpacer()

  const badge = header.addText(cached ? "⚑ " + result.age + "m" : "● live")
  badge.font      = Font.semiboldSystemFont(8)
  badge.textColor = cached ? ORANGE : GREEN

  // ─ Separador ───────────────────────────────────────────
  w.addSpacer(7)
  addHSep(w)
  w.addSpacer(9)

  // ─ TODO OK ─────────────────────────────────────────────
  if (a.todo_ok) {
    w.addSpacer()

    const okBox = w.addStack()
    okBox.layoutVertically()
    okBox.centerAlignContent()

    const okIcon = okBox.addText("✓")
    okIcon.font                = Font.boldSystemFont(44)
    okIcon.textColor           = GREEN
    okIcon.minimumScaleFactor  = 0.5
    okIcon.centerAlignText()

    okBox.addSpacer(6)

    const okTxt = okBox.addText("TODO OK")
    okTxt.font          = Font.boldSystemFont(20)
    okTxt.textColor     = GREEN
    okTxt.centerAlignText()
    okTxt.minimumScaleFactor = 0.5

    okBox.addSpacer(4)

    const okSub = okBox.addText("Sin productos en alerta")
    okSub.font          = Font.systemFont(11)
    okSub.textColor     = new Color("#34D399", 0.5)
    okSub.centerAlignText()

    w.addSpacer()
  } else {
    // ─ Secciones 86 + 85 ─────────────────────────────────
    const body = w.addStack()
    body.layoutVertically()
    body.spacing = 8

    addSection(body, 86, a.alerta86.count, a.alerta86.nombres, RED,  RED_BG)
    addSection(body, 85, a.alerta85.count, a.alerta85.nombres, AMBER, AMB_BG)

    w.addSpacer()
  }

  // ─ Footer ──────────────────────────────────────────────
  addHSep(w, 0.4)
  w.addSpacer(5)
  const foot = w.addStack()
  foot.layoutHorizontally()

  // Resumen total en footer
  const total86 = a.alerta86.count
  const total85 = a.alerta85.count
  if (!a.todo_ok) {
    const sumTxt = foot.addText(
      (total86 > 0 ? total86 + " urgentes" : "") +
      (total86 > 0 && total85 > 0 ? "  ·  " : "") +
      (total85 > 0 ? total85 + " atención" : "")
    )
    sumTxt.font      = Font.semiboldSystemFont(8)
    sumTxt.textColor = GRAY
    sumTxt.lineLimit = 1
  }

  foot.addSpacer()
  const act = foot.addText("Act. " + hhmm())
  act.font      = Font.systemFont(8)
  act.textColor = DIM

  // Toca el widget para forzar actualización manual
  w.url = "scriptable:///run/Alertas%2085%2F86"

  w.refreshAfterDate = new Date(Date.now() + 2 * 60 * 1000)
  return w
}

// ── Main ──────────────────────────────────────────────────
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
  await widget.presentLarge()
}
Script.complete()

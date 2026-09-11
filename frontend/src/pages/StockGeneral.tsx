import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { createPortal } from 'react-dom'
import {
  ClipboardList, Plus, Trash2, Save, RefreshCw,
  ChevronDown, ChevronRight, ChevronUp, X, Check, Search, History,
  UtensilsCrossed, Wine, Package, FolderOpen, AlertCircle, Printer,
  Truck, Pencil, ShoppingCart, Copy, MessageCircle, Droplets, GripVertical, Send, Settings2,
} from 'lucide-react'
import { stockGeneralApi, barrilesApi, barrilesV2Api, appConfigApi } from '../lib/api'
import { arToday } from '../lib/utils'
import { useAuth } from '../context/AuthContext'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Rubro {
  id: number; codigo: string; nombre: string; descripcion?: string
  orden: number; activo: number
}

interface Produto {
  id: number; codigo: string; nombre: string; nombre_proveedor?: string; descripcion?: string
  proveedor_id?: number; proveedor_nombre?: string
  unidad_stock: string; unidad_pedido: string; activo: number
}

interface PlanillaRow {
  item_id: number; producto_id: number; codigo: string; nombre: string
  unidad_stock: string; unidad_pedido: string
  rubro_id?: number; rubro_nombre?: string; rubro_orden?: number; item_orden: number
  registro_id?: number
  stock: string; pedido: string; notas: string
}

interface OtroRow {
  fila: number; nombre: string; u_stock: string; u_pedido: string
  stock: string; pedido: string; notas: string
}

interface Proveedor {
  id: number; nombre: string; categoria?: string
  nombre_remitente?: string; info_reco?: string
  activo: number
}

interface RegistroHistorial {
  id: number; fecha: string; area: string
  producto_nombre: string; producto_codigo: string; rubro_nombre?: string; rubro_id?: number
  stock?: number; pedido?: number; notas?: string
  unidad_stock: string; unidad_pedido: string
  item_orden?: number; rubro_orden?: number
}

interface PedidoRow {
  registro_id: number; fecha: string; area: string
  producto_id: number; codigo: string; nombre: string; nombre_pedido: string; unidad_pedido: string
  pedido: number
  notas?: string
  proveedor_id?: number; proveedor_nombre?: string
  nombre_remitente?: string; info_reco?: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TODAY = arToday()
const UNIDADES = ['unidad', 'Kg', 'Lt', 'Atado', 'Docena', 'Caja', 'Bolsa', 'Botella', 'Lata', 'Paquete', 'Bandeja', 'Tubo']
const AREA_LABEL: Record<string, string> = { salon: 'SALON', cocina: 'COCINA' }
const CATEGORIAS = ['ALMACEN', 'BEBIDAS', 'CERVEZAS', 'CARNICERIA', 'VERDULERIA', 'INSUMOS', 'PANADERIA', 'LOCAL']

const catColor: Record<string, string> = {
  ALMACEN: 'bg-amber-100 text-amber-700', BEBIDAS: 'bg-blue-100 text-blue-700',
  CERVEZAS: 'bg-yellow-100 text-yellow-700', CARNICERIA: 'bg-red-100 text-red-700',
  VERDULERIA: 'bg-green-100 text-green-700', INSUMOS: 'bg-gray-100 text-gray-600',
  PANADERIA: 'bg-orange-100 text-orange-700', LOCAL: 'bg-purple-100 text-purple-700',
}

function toNum(s: string): number | null {
  const v = parseFloat(s.replace(',', '.'))
  return isNaN(v) ? null : v
}
function fmtNum(n?: number | null) {
  if (n === null || n === undefined) return ''
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}
function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ── Utilidades de períodos semanales ──────────────────────────────────────────

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function latestSaturday(): string {
  const now = new Date()
  const day = now.getDay() // 0=Dom..6=Sab
  const daysBack = day === 6 ? 0 : (day + 1)
  const sat = new Date(now)
  sat.setDate(now.getDate() - daysBack)
  const y = sat.getFullYear()
  const m = String(sat.getMonth() + 1).padStart(2, '0')
  const d = String(sat.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function primerDelMes(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function periodLabel(fecha: string): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-').map(Number)
  if (d === 1) return `1ro de ${MESES[m - 1]} ${y}`
  const sat = new Date(y, m - 1, d)
  const fri = new Date(y, m - 1, d + 6)
  const fmt = (dt: Date) => `${dt.getDate()}/${dt.getMonth() + 1}`
  const yearSuffix = fri.getFullYear() !== sat.getFullYear() ? `/${fri.getFullYear()}` : ''
  return `Sem. ${fmt(sat)} al ${fmt(fri)}${yearSuffix}`
}

function nextSaturday(): string {
  const now = new Date()
  const day = now.getDay()
  const daysAhead = day === 6 ? 7 : (6 - day)
  const sat = new Date(now)
  sat.setDate(now.getDate() + daysAhead)
  return `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`
}

function recentSaturdays(n = 8): string[] {
  const sats: string[] = []
  const base = new Date()
  const day = base.getDay()
  base.setDate(base.getDate() - (day === 6 ? 0 : day + 1))
  for (let i = 0; i < n; i++) {
    const y = base.getFullYear()
    const mo = String(base.getMonth() + 1).padStart(2, '0')
    const d = String(base.getDate()).padStart(2, '0')
    sats.push(`${y}-${mo}-${d}`)
    base.setDate(base.getDate() - 7)
  }
  return sats
}

function buildPeriodoOptions(dbPeriodos: string[]): string[] {
  const set = new Set<string>([nextSaturday(), ...recentSaturdays(8), primerDelMes(), ...dbPeriodos])
  return Array.from(set).sort((a, b) => b.localeCompare(a))
}

// ── Modal generico ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-dark-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-dark-border">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-elevated">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Print styles ──────────────────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
  body > * { display: none !important; }
  body.print-salon    > .sg-print-area-salon    { display: block !important; background: white; }
  body.print-cocina   > .sg-print-area-cocina   { display: block !important; background: white; }
  body.print-canillas > .sg-print-area-canillas { display: block !important; background: white; }
  body.print-salon    > .sg-print-area-canillas,
  body.print-cocina   > .sg-print-area-canillas { display: none !important; }
  body.print-canillas > .sg-print-area-salon,
  body.print-canillas > .sg-print-area-cocina  { display: none !important; }
  @page sg-port { size: A4 portrait; margin: 8mm 10mm; }
  .sg-print-area-salon  { page: sg-port; }
  .sg-print-area-cocina { page: sg-port; }
  .sg-pt { font-family: Arial, sans-serif; font-size: 9pt; border-collapse: collapse; width: 100%; }
  .sg-pt th, .sg-pt td { border: 1px solid #444; padding: 3px 5px; text-align: center; }
  .sg-pt thead { display: table-row-group; }
  .sg-pt .pr-row td { background: #fde8e8 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .sg-pt .rb-row td { background: #dce3ef !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .cn-pt { font-family: Arial, sans-serif; font-size: 9pt; border-collapse: collapse; width: 100%; }
  .cn-pt th { background: #222 !important; color: #fff !important; padding: 3px 5px; text-align: center; font-size: 8.5pt; font-weight: bold; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .cn-pt td { border: 1px solid #000; padding: 3px 5px; text-align: center; font-weight: bold; color: #000; }
  .cn-pt td.left { text-align: left; }
  .cn-pt tr.tp-A td, .cn-pt tr.tp-B td, .cn-pt tr.tp-C td,
  .cn-pt tr.tp-D td, .cn-pt tr.tp-E td, .cn-pt tr.tp-GIN td,
  .cn-pt tr.tp-T td { background: #fff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .cn-pt .bdg-A, .cn-pt .bdg-B, .cn-pt .bdg-C, .cn-pt .bdg-D,
  .cn-pt .bdg-E, .cn-pt .bdg-GIN, .cn-pt .bdg-T { background: #d0d0d0 !important; color: #000 !important; font-weight: bold; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .cn-pt .st-red  { background: #d0d0d0 !important; color: #000 !important; font-weight: bold; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .cn-pt .sec-hdr td { background: #222 !important; color: #fff !important; font-weight: bold; font-style: italic; text-align: center; padding: 4px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`

function PrintStyle() { return <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} /> }

// ── Planilla Print Table ──────────────────────────────────────────────────────

function PlanillaTable({ area, fecha, rows, otros }: {
  area: string; fecha: string; rows: PlanillaRow[]; otros: OtroRow[]
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, { orden: number; rows: PlanillaRow[] }>()
    for (const r of rows) {
      const key = r.rubro_nombre ?? 'SIN RUBRO'
      if (!map.has(key)) map.set(key, { orden: r.rubro_orden ?? 999, rows: [] })
      map.get(key)!.rows.push(r)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].orden - b[1].orden || a[0].localeCompare(b[0]))
  }, [rows])

  const td  = { border: '1px solid #aaa', padding: '2px 4px', whiteSpace: 'nowrap' as const, fontWeight: 'bold' as const, color: '#000', textAlign: 'center' as const }
  const tdL = { border: '1px solid #aaa', padding: '2px 4px', fontWeight: 'bold' as const, color: '#000' }
  const rbStyle = { border: '1px solid #444', background: '#dce3ef', fontStyle: 'italic' as const, fontWeight: 'bold' as const, textAlign: 'center' as const, color: '#1a3260' }

  return (
    <table className="sg-pt" style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Arial, sans-serif', fontSize: '9pt', tableLayout: 'fixed' as const }}>
      <colgroup>
        <col style={{ width: '28%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '28%' }} />
      </colgroup>
      <thead>
        <tr>
          <td colSpan={6} style={{ padding: 0, border: '2px solid #1a3260' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', background: 'white', minHeight: 48 }}>
              <div style={{ width: 8, background: '#1a3260', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px' }}>
                <div>
                  <div style={{ fontSize: '14pt', fontWeight: 900, color: '#1a3260', letterSpacing: 1, lineHeight: 1.1 }}>SANTA CEBADA</div>
                  <div style={{ fontSize: '7.5pt', color: '#7a8aaa', letterSpacing: 3, marginTop: 1 }}>RECOLETA</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13pt', fontWeight: 'bold', color: '#1a3260', lineHeight: 1.1 }}>
                    {AREA_LABEL[area]?.toUpperCase() ?? area.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '7.5pt', color: '#7a8aaa', marginTop: 2 }}>
                    Planilla de stock y pedidos &nbsp;·&nbsp; {fmtDate(fecha)}
                  </div>
                </div>
              </div>
              <div style={{ width: 8, background: '#dce3ef', flexShrink: 0 }} />
            </div>
          </td>
        </tr>
        <tr style={{ background: '#1a3260' }}>
          <th rowSpan={2} style={{ border: '1px solid #2d4f8a', padding: '5px 6px', color: 'white', fontWeight: 'bold' }}>PRODUCTO</th>
          <th colSpan={2} style={{ border: '1px solid #2d4f8a', padding: '5px 6px', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>STOCK</th>
          <th colSpan={2} style={{ border: '1px solid #2d4f8a', padding: '5px 6px', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>PEDIDO</th>
          <th rowSpan={2} style={{ border: '1px solid #2d4f8a', padding: '5px 6px', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>OBSERVACION</th>
        </tr>
        <tr style={{ background: '#2a4480' }}>
          <th style={{ border: '1px solid #2d4f8a', padding: '3px', textAlign: 'center', fontSize: '8pt', color: '#c8d4e8' }}>Unidad</th>
          <th style={{ border: '1px solid #2d4f8a', padding: '3px', textAlign: 'center', fontSize: '8pt', color: '#c8d4e8' }}>Cantidad</th>
          <th style={{ border: '1px solid #2d4f8a', padding: '3px', textAlign: 'center', fontSize: '8pt', color: '#c8d4e8' }}>Unidad</th>
          <th style={{ border: '1px solid #2d4f8a', padding: '3px', textAlign: 'center', fontSize: '8pt', color: '#c8d4e8' }}>Cantidad</th>
        </tr>
      </thead>
      <tbody>
        {grouped.map(([rubroNombre, { rows: rubroRows }]) => (
          <Fragment key={rubroNombre}>
            <tr className="rb-row"><td colSpan={6} style={rbStyle}>{rubroNombre}</td></tr>
            {rubroRows.map(r => {
              const hasPedido = r.pedido !== ''
              return (
                <tr key={r.producto_id} className={hasPedido ? 'pr-row' : ''}>
                  <td style={tdL}>{r.nombre}</td>
                  <td style={{ ...td, fontSize: '8pt', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const }}>{r.unidad_stock}</td>
                  <td style={td}>{r.stock}</td>
                  <td style={{ ...td, fontSize: '8pt', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const }}>{r.unidad_pedido}</td>
                  <td style={{ ...td, color: hasPedido ? '#900' : '#000' }}>{r.pedido}</td>
                  <td style={tdL}>{r.notas}</td>
                </tr>
              )
            })}
          </Fragment>
        ))}
        {/* OTROS section */}
        {otros.some(o => o.nombre) && (
          <tr className="rb-row"><td colSpan={6} style={rbStyle}>OTROS</td></tr>
        )}
        {otros.filter(o => o.nombre).map(o => (
          <tr key={o.fila}>
            <td style={tdL}>{o.nombre}</td>
            <td style={{ ...td, fontSize: '8pt', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const }}>{o.u_stock}</td>
            <td style={td}>{o.stock}</td>
            <td style={{ ...td, fontSize: '8pt', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const }}>{o.u_pedido}</td>
            <td style={td}>{o.pedido}</td>
            <td style={tdL}></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Tab Planilla ──────────────────────────────────────────────────────────────

function makeOtros(): OtroRow[] {
  return Array.from({ length: 6 }, (_, i) => ({ fila: i + 1, nombre: '', u_stock: '', u_pedido: '', stock: '', pedido: '', notas: '' }))
}

function PlanillaTab({ area }: { area: 'salon' | 'cocina' }) {
  const { user } = useAuth()
  const [fecha, setFecha] = useState(latestSaturday)
  const [periodos, setPeriodos] = useState<string[]>([])
  const [rows, setRows] = useState<PlanillaRow[]>([])
  const [otros, setOtros] = useState<OtroRow[]>(makeOtros())
  const [rubros, setRubros] = useState<Rubro[]>([])
  const [todos, setTodos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [collapsedRubros, setCollapsedRubros] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addRubroId, setAddRubroId] = useState<number | ''>('')
  const [addingId, setAddingId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)

  useEffect(() => {
    stockGeneralApi.getPeriodos().then(p => setPeriodos(p)).catch(() => {})
  }, [])

  const periodoOptions = useMemo(() => buildPeriodoOptions(periodos), [periodos])

  const lsKey      = `sg_vals_${area}_${fecha}`
  const lsOtrosKey = `sg_otros_${area}_${fecha}`

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [planillaData, rubrosData, todosData, otrosData] = await Promise.all([
        stockGeneralApi.getPlanilla(fecha, area),
        stockGeneralApi.getRubros(),
        stockGeneralApi.getProductos(),
        stockGeneralApi.getOtros(fecha, area),
      ])
      const mapped: PlanillaRow[] = planillaData.map((r: any) => ({
        item_id: r.item_id, producto_id: r.producto_id,
        codigo: r.codigo, nombre: r.nombre,
        unidad_stock: r.unidad_stock ?? 'unidad',
        unidad_pedido: r.unidad_pedido ?? 'unidad',
        rubro_id: r.rubro_id, rubro_nombre: r.rubro_nombre,
        rubro_orden: r.rubro_orden ?? 999, item_orden: r.item_orden ?? 0,
        registro_id: r.registro_id,
        stock:  r.stock  != null ? String(r.stock)  : '',
        pedido: r.pedido != null ? String(r.pedido) : '',
        notas:  r.notas ?? '',
      }))
      // localStorage solo aplica para semanas actuales/futuras, y únicamente en filas sin dato guardado en DB
      if (fecha >= latestSaturday()) {
        try {
          const ls = localStorage.getItem(`sg_vals_${area}_${fecha}`)
          if (ls) {
            const vals: Record<number, { stock: string; pedido: string; notas: string }> = JSON.parse(ls)
            for (const r of mapped) {
              if (vals[r.item_id] !== undefined && r.registro_id == null) {
                r.stock  = vals[r.item_id].stock
                r.pedido = vals[r.item_id].pedido
                r.notas  = vals[r.item_id].notas
              }
            }
          }
        } catch {}
      }
      setRows(mapped)
      setRubros(rubrosData)
      setTodos(todosData)
      // Otros: preferir localStorage si hay datos sin enviar
      let otrosRestored = false
      try {
        const lsO = localStorage.getItem(`sg_otros_${area}_${fecha}`)
        if (lsO) { setOtros(JSON.parse(lsO)); otrosRestored = true }
      } catch {}
      if (!otrosRestored) {
        const otrosMapped: OtroRow[] = makeOtros().map((def, i) => {
          const found = otrosData[i]
          if (!found) return def
          return {
            fila: found.fila, nombre: found.nombre ?? '', u_stock: found.u_stock ?? '',
            u_pedido: found.u_pedido ?? '', stock: found.stock != null ? String(found.stock) : '',
            pedido: found.pedido != null ? String(found.pedido) : '',
            notas: found.notas ?? '',
          }
        })
        setOtros(otrosMapped)
      }
    } catch { setError('No se pudo cargar la planilla') }
    setLoading(false)
  }, [fecha, area])

  useEffect(() => { load() }, [load])

  // Persistir inputs en localStorage en cada cambio
  useEffect(() => {
    if (rows.length === 0) return
    const vals: Record<number, { stock: string; pedido: string; notas: string }> = {}
    for (const r of rows) vals[r.item_id] = { stock: r.stock, pedido: r.pedido, notas: r.notas }
    localStorage.setItem(lsKey, JSON.stringify(vals))
  }, [rows, lsKey])

  useEffect(() => {
    localStorage.setItem(lsOtrosKey, JSON.stringify(otros))
  }, [otros, lsOtrosKey])

  const updateRow = (itemId: number, field: 'stock' | 'pedido' | 'notas', value: string) => {
    setRows(prev => prev.map(r => r.item_id === itemId ? { ...r, [field]: value } : r))
    setSaved(false)
  }

  const saveRow = async (r: PlanillaRow) => {
    try {
      await stockGeneralApi.savePlanilla({
        fecha, area,
        entries: [{ producto_id: r.producto_id, stock: toNum(r.stock), pedido: toNum(r.pedido), notas: r.notas }],
        creado_por: user?.username ?? '',
      })
    } catch { /* silently fail, data stays in state */ }
  }

  const handleSave = async (es_modificacion = false, nota_edicion = '') => {
    setSaving(true); setError(''); setSaved(false)
    try {
      await stockGeneralApi.savePlanilla({
        fecha, area,
        entries: rows.map(r => ({ producto_id: r.producto_id, stock: toNum(r.stock), pedido: toNum(r.pedido), notas: r.notas })),
        creado_por: user?.username ?? '',
        es_modificacion,
        nota_edicion,
      })
      await saveOtrosBatch()
      localStorage.removeItem(lsKey)
      localStorage.removeItem(lsOtrosKey)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch { setError('Error al guardar') }
    setSaving(false)
  }

  const saveOtrosBatch = async () => {
    try {
      await stockGeneralApi.saveOtros({
        fecha, area,
        rows: otros.map(o => ({
          fila: o.fila, nombre: o.nombre || undefined, u_stock: o.u_stock || undefined,
          u_pedido: o.u_pedido || undefined, stock: toNum(o.stock), pedido: toNum(o.pedido),
          notas: o.notas || undefined,
        }))
      })
    } catch { /* silently fail */ }
  }

  const updateOtro = (fila: number, field: keyof OtroRow, val: string) => {
    setOtros(prev => prev.map(o => o.fila === fila ? { ...o, [field]: val } : o))
    setSaved(false)
  }

  const changeRubro = async (itemId: number, rubroId: number | '') => {
    const rid = rubroId === '' ? 0 : rubroId
    setRows(prev => prev.map(r => {
      if (r.item_id !== itemId) return r
      const rubro = rubros.find(rb => rb.id === rid)
      return { ...r, rubro_id: rid > 0 ? rid : undefined, rubro_nombre: rubro?.nombre, rubro_orden: rubro?.orden ?? 999 }
    }))
    try {
      await stockGeneralApi.updatePlanillaItem(itemId, { rubro_id: rid })
    } catch { /* revert on fail */ load() }
  }

  const addProduct = async (productoId: number, rubroId?: number) => {
    if (rows.some(r => r.producto_id === productoId)) return
    setAddingId(productoId)
    try {
      await stockGeneralApi.addPlanillaItem({ area, producto_id: productoId, rubro_id: rubroId })
      const p = todos.find(t => t.id === productoId)
      const rubro = rubroId ? rubros.find(rb => rb.id === rubroId) : undefined
      if (p) {
        setRows(prev => [...prev, {
          item_id: Date.now(), producto_id: p.id, codigo: p.codigo, nombre: p.nombre,
          unidad_stock: p.unidad_stock, unidad_pedido: p.unidad_pedido,
          rubro_id: rubroId, rubro_nombre: rubro?.nombre, rubro_orden: rubro?.orden ?? 999, item_orden: 999,
          registro_id: undefined, stock: '', pedido: '', notas: '',
        }])
      }
    } catch { /* silently fail */ }
    setAddingId(null)
  }

  const removeProduct = async (itemId: number) => {
    setRemovingId(itemId)
    try {
      await stockGeneralApi.removePlanillaItem(itemId)
      setRows(prev => prev.filter(r => r.item_id !== itemId))
    } catch { /* silently fail */ }
    setRemovingId(null)
  }

  const toggleRubro = (n: string) => setCollapsedRubros(prev => {
    const next = new Set(prev); next.has(n) ? next.delete(n) : next.add(n); return next
  })

  const visibleRows = useMemo(() => {
    if (!busqueda) return rows
    const q = busqueda.toLowerCase()
    return rows.filter(r => r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q))
  }, [rows, busqueda])

  const grouped = useMemo(() => {
    const map = new Map<string, { rubroId?: number; orden: number; rows: PlanillaRow[] }>()
    for (const r of visibleRows) {
      const key = r.rubro_nombre ?? 'SIN RUBRO'
      if (!map.has(key)) map.set(key, { rubroId: r.rubro_id, orden: r.rubro_orden ?? 999, rows: [] })
      map.get(key)!.rows.push(r)
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[1].orden - b[1].orden || a[0].localeCompare(b[0]))
    for (const [, v] of sorted) v.rows.sort((a, b) => (a.item_orden ?? 0) - (b.item_orden ?? 0))
    return sorted
  }, [visibleRows])

  const handleDrop = async (targetItemId: number, rubroNombre: string) => {
    if (dragId === null || dragId === targetItemId) return
    const groupRows = grouped.find(([n]) => n === rubroNombre)?.[1].rows ?? []
    const oldIdx = groupRows.findIndex(r => r.item_id === dragId)
    const newIdx = groupRows.findIndex(r => r.item_id === targetItemId)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = [...groupRows]
    const [moved] = reordered.splice(oldIdx, 1)
    reordered.splice(newIdx, 0, moved)
    const updatedOrders = reordered.map((r, i) => ({ ...r, item_orden: i }))
    setRows(prev => {
      const map = new Map(updatedOrders.map(r => [r.item_id, r]))
      return prev.map(r => map.get(r.item_id) ?? r)
    })
    for (const r of updatedOrders) {
      stockGeneralApi.updatePlanillaItem(r.item_id, { orden: r.item_orden }).catch(() => {})
    }
    setDragId(null)
  }

  const addFiltered = useMemo(() => {
    const q = addSearch.toLowerCase()
    return todos.filter(p => !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
  }, [todos, addSearch])

  const inPlanilla = useMemo(() => new Set(rows.map(r => r.producto_id)), [rows])
  const filledCount = rows.filter(r => r.stock !== '' || r.pedido !== '').length
  const hasExistingData = rows.some(r => r.registro_id != null)
  const isOldPeriod = fecha < latestSaturday() || hasExistingData
  const [modModal, setModModal] = useState(false)
  const [modNota, setModNota] = useState('')

  const handlePrint = () => {
    document.body.classList.add(`print-${area}`)
    window.print()
    setTimeout(() => document.body.classList.remove(`print-${area}`), 500)
  }

  const clearPlanilla = () => {
    if (!confirm('¿Limpiar todos los valores cargados? Esto no afecta la base de datos.')) return
    setRows(prev => prev.map(r => ({ ...r, stock: '', pedido: '', notas: '' })))
    setOtros(makeOtros())
    localStorage.removeItem(lsKey)
    localStorage.removeItem(lsOtrosKey)
    setSaved(false)
  }

  const numCls = 'w-full text-center text-xs rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent transition-colors text-gray-700 dark:text-gray-200'

  return (
    <>
      {modModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModModal(false)} />
          <div className="relative bg-white dark:bg-dark-surface rounded-2xl p-5 shadow-xl w-full max-w-sm mx-4">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Cargar modificaciones</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Período: {periodLabel(fecha)} — {AREA_LABEL[area]}</p>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">¿Qué se modificó? <span className="text-gray-400">(opcional)</span></label>
            <textarea
              className="input w-full resize-none text-sm"
              rows={3}
              placeholder="ej: se corrigió el stock de aceite, se agregó pedido de sal..."
              value={modNota}
              onChange={e => setModNota(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { setModModal(false); handleSave(true, modNota) } if (e.key === 'Escape') setModModal(false) }}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setModModal(false)} className="flex-1 h-9 rounded-lg bg-gray-100 dark:bg-dark-elevated text-sm font-semibold text-gray-600 dark:text-gray-400 hover:opacity-80 transition-opacity">
                Cancelar
              </button>
              <button
                onClick={() => { setModModal(false); handleSave(true, modNota) }}
                className="flex-1 h-9 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      <PrintStyle />
      {createPortal(
        <div className={`sg-print-area-${area}`} style={{ display: 'none' }}>
          <PlanillaTable area={area} fecha={fecha} rows={rows} otros={otros} />
        </div>,
        document.body
      )}

      <div>
        {/* Header bar */}
        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-xl bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border shadow-sm">
          <select
            className="w-auto min-w-[190px] max-w-[260px] text-sm h-8 px-3 pr-7 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-elevated text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent/60 cursor-pointer transition-all"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
          >
            {periodoOptions.map(f => (
              <option key={f} value={f}>{periodLabel(f)}{f === latestSaturday() ? ' ★' : f === nextSaturday() ? ' →' : ''}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-36">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input className="w-full input pl-8 text-xs h-8" placeholder="Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {filledCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{filledCount} cargados</span>
            )}
            <button onClick={load} disabled={loading} title="Recargar" className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-elevated text-gray-400 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={clearPlanilla} title="Limpiar valores cargados" className="h-8 flex items-center gap-1.5 px-3 rounded-lg border border-red-200 text-xs font-medium text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:border-red-900/40 dark:hover:bg-red-900/20 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Limpiar
            </button>
            <button onClick={handlePrint} className="h-8 flex items-center gap-1.5 px-3 rounded-lg border border-gray-200 dark:border-dark-border text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
            {isOldPeriod ? (
              <button
                onClick={() => { setModNota(''); setModModal(true) }}
                disabled={saving || loading}
                className="h-8 flex items-center gap-1.5 px-4 rounded-lg text-xs font-semibold transition-colors bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                {saved ? 'Guardado' : 'Cargar modificaciones'}
              </button>
            ) : (
              <button
                onClick={() => handleSave()} disabled={saving || loading}
                className={`h-8 flex items-center gap-1.5 px-4 rounded-lg text-xs font-semibold transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-accent text-white hover:bg-accent/90'} disabled:opacity-50`}
              >
                {saved ? <Check className="w-3.5 h-3.5" /> : saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saved ? 'Enviado' : 'Enviar Stock'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 text-xs mb-4">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-dark-elevated animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3">
            {/* Planilla rows grouped by rubro */}
            {grouped.map(([rubroNombre, { rows: rubroRows }]) => {
              const collapsed = collapsedRubros.has(rubroNombre)
              const conPedido = rubroRows.filter(r => r.pedido !== '' && r.pedido != null).length
              return (
                <div key={rubroNombre} className="rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-dark-border">
                  {/* Rubro header */}
                  <button
                    onClick={() => toggleRubro(rubroNombre)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                    style={{ background: 'linear-gradient(90deg, #1a3260 0%, #2a4480 100%)' }}
                  >
                    {collapsed
                      ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-white/70" />
                      : <ChevronDown  className="w-3.5 h-3.5 flex-shrink-0 text-white/70" />}
                    <span className="text-xs font-bold uppercase tracking-widest text-white flex-1 truncate">{rubroNombre}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {conPedido > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-400/90 text-white">{conPedido} pedido{conPedido > 1 ? 's' : ''}</span>
                      )}
                      <span className="text-[10px] text-white/50">{rubroRows.length} prod.</span>
                    </div>
                  </button>

                  {!collapsed && (
                    <div className="overflow-x-auto bg-white dark:bg-dark-surface">
                      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-dark-border" style={{ background: '#f8fafd' }}>
                            <th className="w-5"></th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '22%' }}>Producto</th>
                            <th className="px-2 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '15%' }}>Rubro</th>
                            <th className="px-2 py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '8%' }}>Unidad</th>
                            <th className="px-2 py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '12%' }}>Stock</th>
                            <th className="px-2 py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '8%' }}>Unidad</th>
                            <th className="px-2 py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '12%' }}>Pedido</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Observación</th>
                            <th className="w-7"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rubroRows.map((r, idx) => {
                            const hasPedido = r.pedido !== '' && r.pedido != null
                            const isDragging = dragId === r.item_id
                            return (
                              <tr
                                key={r.item_id}
                                draggable
                                onDragStart={() => setDragId(r.item_id)}
                                onDragEnd={() => setDragId(null)}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => handleDrop(r.item_id, rubroNombre)}
                                className="group transition-colors hover:bg-gray-50 dark:hover:bg-dark-elevated/50"
                                style={{
                                  borderBottom: idx < rubroRows.length - 1 ? '1px solid #f3f4f6' : undefined,
                                  opacity: isDragging ? 0.35 : 1,
                                  borderLeft: hasPedido ? '3px solid #e53e3e' : '3px solid transparent',
                                }}
                              >
                                <td className="pl-1 text-center cursor-grab text-gray-200 group-hover:text-gray-400 transition-colors">
                                  <GripVertical className="w-3.5 h-3.5 mx-auto" />
                                </td>
                                <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100">{r.nombre}</td>
                                <td className="px-2 py-1.5">
                                  <select
                                    className="w-full text-[11px] rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface px-1.5 py-1 focus:outline-none focus:border-accent cursor-pointer text-gray-600 dark:text-gray-300"
                                    value={r.rubro_id ?? ''}
                                    onChange={e => changeRubro(r.item_id, e.target.value === '' ? '' : parseInt(e.target.value))}
                                  >
                                    <option value="">— sin rubro —</option>
                                    {rubros.map(rb => <option key={rb.id} value={rb.id}>{rb.nombre}</option>)}
                                  </select>
                                </td>
                                <td className="px-2 py-1.5 text-center text-gray-400 font-medium" style={{ fontSize: 10 }}>{r.unidad_stock}</td>
                                <td className="px-2 py-1.5">
                                  <input type="number" step="0.01" min="0" placeholder="—" value={r.stock}
                                    onChange={e => updateRow(r.item_id, 'stock', e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const all = Array.from(document.querySelectorAll<HTMLInputElement>('[data-pl="stock"]')); const i = all.indexOf(e.currentTarget); all[i + 1]?.focus() } }}
                                    onWheel={e => e.currentTarget.blur()}
                                    data-pl="stock"
                                    className={numCls}
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-center text-gray-400 font-medium" style={{ fontSize: 10 }}>{r.unidad_pedido}</td>
                                <td className="px-2 py-1.5">
                                  <input type="number" step="0.01" min="0" placeholder="—" value={r.pedido}
                                    onChange={e => updateRow(r.item_id, 'pedido', e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const all = Array.from(document.querySelectorAll<HTMLInputElement>('[data-pl="pedido"]')); const i = all.indexOf(e.currentTarget); all[i + 1]?.focus() } }}
                                    onWheel={e => e.currentTarget.blur()}
                                    data-pl="pedido"
                                    className="w-full text-center text-xs rounded-md border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300 focus:border-red-400 transition-colors font-semibold"
                                    style={hasPedido
                                      ? { borderColor: '#fca5a5', background: '#fff1f1', color: '#b91c1c' }
                                      : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }}
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  <input type="text" placeholder="—" value={r.notas}
                                    onChange={e => updateRow(r.item_id, 'notas', e.target.value)}
                                    onBlur={() => saveRow(r)}
                                    className="w-full text-xs rounded-md border border-gray-200 dark:border-dark-border bg-transparent px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent text-gray-500 transition-colors"
                                  />
                                </td>
                                <td className="px-1 text-center">
                                  {removingId === r.item_id
                                    ? <RefreshCw className="w-3 h-3 text-gray-400 animate-spin mx-auto" />
                                    : <button onClick={() => removeProduct(r.item_id)} title="Quitar de planilla"
                                        className="p-1 rounded text-gray-200 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                        <X className="w-3 h-3" />
                                      </button>
                                  }
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Estado vacío */}
            {rows.length === 0 && !addOpen && (
              <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-600">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="mb-4">Esta planilla está vacía.</p>
                <button onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90">
                  <Plus className="w-3.5 h-3.5" /> Agregar productos
                </button>
              </div>
            )}

            {/* Boton agregar + panel inline */}
            {rows.length > 0 && !addOpen && (
              <button onClick={() => setAddOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 dark:border-dark-border rounded-xl text-xs text-gray-400 hover:text-accent hover:border-accent transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar producto
              </button>
            )}

            {addOpen && (
              <div className="border border-accent/30 rounded-xl overflow-hidden bg-white dark:bg-dark-surface shadow-sm">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-accent/5 border-b border-accent/20">
                  <span className="text-xs font-semibold text-accent flex-shrink-0">Agregar productos</span>
                  <div className="relative flex-1 min-w-32">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <input autoFocus className="w-full text-xs pl-6 pr-2 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface focus:outline-none focus:border-accent"
                      placeholder="Buscar..." value={addSearch} onChange={e => setAddSearch(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-gray-500">Rubro:</span>
                    <select
                      className="text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface px-2 py-1.5 focus:outline-none focus:border-accent cursor-pointer"
                      value={addRubroId}
                      onChange={e => setAddRubroId(e.target.value === '' ? '' : parseInt(e.target.value))}
                    >
                      <option value="">— sin rubro —</option>
                      {rubros.map(rb => <option key={rb.id} value={rb.id}>{rb.nombre}</option>)}
                    </select>
                  </div>
                  <button onClick={() => { setAddOpen(false); setAddSearch(''); setAddRubroId('') }}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-elevated text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-dark-border/50">
                  {addFiltered.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">Sin productos{addSearch ? ` para "${addSearch}"` : ''}</div>
                  ) : addFiltered.map(p => {
                    const ya = inPlanilla.has(p.id)
                    const isAdding = addingId === p.id
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-dark-elevated/50">
                        <span className="font-mono text-xs text-accent w-20 flex-shrink-0">{p.codigo}</span>
                        <span className="flex-1 text-xs text-gray-800 dark:text-gray-200">{p.nombre}</span>
                        {p.proveedor_nombre && (
                          <span className="text-xs text-gray-400 hidden sm:block">{p.proveedor_nombre}</span>
                        )}
                        <button
                          onClick={() => !ya && addProduct(p.id, addRubroId || undefined)}
                          disabled={ya || isAdding}
                          className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${ya ? 'text-green-600 bg-green-50' : 'text-accent bg-accent/10 hover:bg-accent hover:text-white'} disabled:opacity-50`}
                        >
                          {isAdding ? <RefreshCw className="w-3 h-3 animate-spin" /> : ya ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {ya ? 'Agregado' : 'Agregar'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sección OTROS (6 filas libres) */}
            <div className="border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden mt-4">
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#2a4480' }}>
                <span className="text-xs font-bold uppercase tracking-wider text-white">OTROS</span>
                <span className="text-xs text-white/50 ml-auto">6 filas libres — se guardan con la planilla</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#eef2f8' }} className="text-gray-500">
                      <th className="px-3 py-2 text-left font-semibold border-b border-gray-200" style={{ width: '22%' }}>Descripción</th>
                      <th className="px-2 py-2 text-center font-semibold border-b border-gray-200" style={{ width: '10%' }}>U.Stock</th>
                      <th className="px-2 py-2 text-center font-semibold border-b border-gray-200" style={{ width: '12%' }}>Stock</th>
                      <th className="px-2 py-2 text-center font-semibold border-b border-gray-200" style={{ width: '10%' }}>U.Pedido</th>
                      <th className="px-2 py-2 text-center font-semibold border-b border-gray-200" style={{ width: '12%' }}>Pedido</th>
                      <th className="px-2 py-2 text-left font-semibold border-b border-gray-200" style={{ width: '34%' }}>Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otros.map(o => (
                      <tr key={o.fila} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td className="px-3 py-1">
                          <input type="text" placeholder={`Fila ${o.fila}`} value={o.nombre}
                            onChange={e => updateOtro(o.fila, 'nombre', e.target.value)}
                            className="w-full text-xs rounded border border-gray-200 dark:border-dark-border bg-transparent px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent text-gray-700 transition-colors"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input type="text" list="sg-unidades-datalist" placeholder="—" value={o.u_stock}
                            onChange={e => updateOtro(o.fila, 'u_stock', e.target.value)}
                            className="w-full text-center text-xs rounded border border-gray-200 dark:border-dark-border bg-transparent px-1 py-1 focus:outline-none focus:border-accent transition-colors"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" step="0.01" min="0" placeholder="—" value={o.stock}
                            onChange={e => updateOtro(o.fila, 'stock', e.target.value)}
                            onWheel={e => e.currentTarget.blur()}
                            className={numCls}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input type="text" list="sg-unidades-datalist" placeholder="—" value={o.u_pedido}
                            onChange={e => updateOtro(o.fila, 'u_pedido', e.target.value)}
                            className="w-full text-center text-xs rounded border border-gray-200 dark:border-dark-border bg-transparent px-1 py-1 focus:outline-none focus:border-accent transition-colors"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" step="0.01" min="0" placeholder="—" value={o.pedido}
                            onChange={e => updateOtro(o.fila, 'pedido', e.target.value)}
                            onWheel={e => e.currentTarget.blur()}
                            className="w-full text-center text-xs rounded border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                            style={{ borderColor: o.pedido ? '#f99' : '#e5e7eb', background: o.pedido ? '#fde8e8' : 'white', fontWeight: o.pedido ? 'bold' : 'normal', color: o.pedido ? '#c53030' : undefined }}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input type="text" placeholder="—" value={o.notas}
                            onChange={e => updateOtro(o.fila, 'notas', e.target.value)}
                            className="w-full text-xs rounded border border-gray-200 dark:border-dark-border bg-transparent px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent text-gray-600 transition-colors"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <datalist id="sg-unidades-datalist">{UNIDADES.map(u => <option key={u} value={u} />)}</datalist>
          </div>
        )}
      </div>
    </>
  )
}

// ── Tab Rubros ────────────────────────────────────────────────────────────────

function RubrosTab() {
  const [rubros, setRubros] = useState<Rubro[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | 'create' | Rubro>(null)
  const [form, setForm] = useState({ codigo: '', nombre: '', descripcion: '', orden: '0' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setRubros(await stockGeneralApi.getRubros()) } catch { setRubros([]) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const openCreate = () => { setForm({ codigo: '', nombre: '', descripcion: '', orden: '0' }); setError(''); setModal('create') }
  const openEdit = (r: Rubro) => { setForm({ codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion ?? '', orden: String(r.orden) }); setError(''); setModal(r) }

  const handleSave = async (keepOpen = false) => {
    if (!form.codigo.trim() || !form.nombre.trim()) { setError('Codigo y nombre son obligatorios'); return }
    setSaving(true); setError('')
    try {
      if (modal === 'create') {
        await stockGeneralApi.createRubro({ codigo: form.codigo, nombre: form.nombre, descripcion: form.descripcion, orden: parseInt(form.orden) || 0 })
      } else {
        await stockGeneralApi.updateRubro((modal as Rubro).id, { codigo: form.codigo, nombre: form.nombre, descripcion: form.descripcion, orden: parseInt(form.orden) || 0 })
      }
      load()
      if (keepOpen) setForm({ codigo: '', nombre: '', descripcion: '', orden: '0' })
      else setModal(null)
    } catch (e: any) { setError(e?.response?.data?.detail ?? 'Error al guardar') }
    setSaving(false)
  }

  const handleDelete = async (r: Rubro) => {
    if (!confirm(`Desactivar rubro "${r.nombre}"?`)) return
    await stockGeneralApi.deleteRubro(r.id); load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{rubros.length} rubros activos</p>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90">
          <Plus className="w-3.5 h-3.5" /> Nuevo rubro
        </button>
      </div>
      {loading ? (
        <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-dark-elevated animate-pulse" />)}</div>
      ) : rubros.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400"><FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />Sin rubros. Crea el primero.</div>
      ) : (
        <div className="border border-gray-100 dark:border-dark-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-dark-elevated text-xs text-gray-500 uppercase">
              <th className="px-4 py-3 text-left">Codigo</th>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Descripcion</th>
              <th className="px-4 py-3 text-center">Orden</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {rubros.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-dark-elevated/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-accent">{r.codigo}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.nombre}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{r.descripcion || '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{r.orden}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-elevated text-gray-400 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal !== null && (
        <Modal title={modal === 'create' ? 'Nuevo Rubro' : 'Editar Rubro'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div><label className="label-xs block mb-1">Codigo *</label>
              <input className="w-full input uppercase font-mono" placeholder="ej. BARRA01" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} /></div>
            <div><label className="label-xs block mb-1">Nombre *</label>
              <input className="w-full input" placeholder="ej. Bebidas" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div><label className="label-xs block mb-1">Descripcion</label>
              <input className="w-full input" placeholder="Opcional" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
            <div><label className="label-xs block mb-1">Orden (menor = primero)</label>
              <input type="number" className="w-full input" value={form.orden} onChange={e => setForm(f => ({ ...f, orden: e.target.value }))} /></div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end pt-2 flex-wrap">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
              {modal === 'create' && (
                <button onClick={() => handleSave(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-accent text-accent text-xs font-semibold hover:bg-accent/5 disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" /> Guardar y crear otro
                </button>
              )}
              <button onClick={() => handleSave(false)} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-50">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Tab Productos ─────────────────────────────────────────────────────────────

type SortField = 'codigo' | 'nombre' | 'proveedor'
type ProdEdit = { codigo?: string; nombre?: string; nombre_proveedor?: string; proveedor_id?: string; proveedor_nombre?: string; unidad_stock?: string; unidad_pedido?: string }

function ProductosTab() {
  const [productos, setProductos] = useState<Produto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('codigo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [local, setLocal] = useState<Record<number, ProdEdit>>({})
  const [savingSet, setSavingSet] = useState<Set<number>>(new Set())
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set())
  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ codigo: '', nombre: '', nombre_proveedor: '', proveedor_id: '', unidad_stock: 'unidad', unidad_pedido: 'unidad' })
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, provs] = await Promise.all([stockGeneralApi.getProductos(), stockGeneralApi.getProveedores()])
      setProductos(prods); setProveedores(provs)
    } catch { setProductos([]) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const toggleSort = (field: SortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const list = productos.filter(p => {
      const q = busqueda.toLowerCase()
      return !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) || (p.proveedor_nombre ?? '').toLowerCase().includes(q)
    })
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'codigo') cmp = a.codigo.localeCompare(b.codigo, undefined, { numeric: true })
      else if (sortBy === 'nombre') cmp = a.nombre.localeCompare(b.nombre, 'es')
      else if (sortBy === 'proveedor') cmp = (a.proveedor_nombre ?? '').localeCompare(b.proveedor_nombre ?? '', 'es')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [productos, busqueda, sortBy, sortDir])

  const get = (p: Produto, f: keyof ProdEdit): string => {
    if (local[p.id] && f in local[p.id]) return local[p.id][f] as string
    if (f === 'proveedor_id') return p.proveedor_id ? String(p.proveedor_id) : ''
    if (f === 'nombre_proveedor') return p.nombre_proveedor ?? ''
    return (p as any)[f] ?? ''
  }

  const setField = (id: number, f: keyof ProdEdit, v: string) =>
    setLocal(prev => ({ ...prev, [id]: { ...prev[id], [f]: v } }))

  const saveRow = useCallback(async (p: Produto, extra?: Partial<ProdEdit>) => {
    const ov = { ...local[p.id], ...extra }
    const { proveedor_nombre: _pn, ...ovClean } = ov
    if (!Object.keys(ovClean).length) return
    setSavingSet(prev => new Set([...prev, p.id]))
    try {
      const provId = ovClean.proveedor_id !== undefined ? parseInt(ovClean.proveedor_id) || 0 : undefined
      const newCodigo = ovClean.codigo !== undefined ? ovClean.codigo.trim().toUpperCase() : undefined
      const newNomProv = ovClean.nombre_proveedor !== undefined ? (ovClean.nombre_proveedor.trim() || null) : undefined
      await stockGeneralApi.updateProducto(p.id, {
        codigo: newCodigo,
        nombre: ovClean.nombre ?? p.nombre,
        nombre_proveedor: newNomProv ?? undefined,
        proveedor_id: provId,
        unidad_stock: ovClean.unidad_stock ?? p.unidad_stock,
        unidad_pedido: ovClean.unidad_pedido ?? p.unidad_pedido,
      })
      const prov = proveedores.find(pv => pv.id === (provId && provId > 0 ? provId : p.proveedor_id))
      setProductos(prev => prev.map(pr => pr.id !== p.id ? pr : {
        ...pr,
        codigo: newCodigo ?? pr.codigo,
        nombre: ovClean.nombre ?? pr.nombre,
        nombre_proveedor: newNomProv !== undefined ? (newNomProv ?? undefined) : pr.nombre_proveedor,
        proveedor_id: provId != null ? (provId > 0 ? provId : undefined) : pr.proveedor_id,
        proveedor_nombre: prov?.nombre,
        unidad_stock: ovClean.unidad_stock ?? pr.unidad_stock,
        unidad_pedido: ovClean.unidad_pedido ?? pr.unidad_pedido,
      }))
      setLocal(prev => { const n = { ...prev }; delete n[p.id]; return n })
      setDoneSet(prev => {
        const n = new Set([...prev, p.id])
        setTimeout(() => setDoneSet(s => { const ns = new Set(s); ns.delete(p.id); return ns }), 1200)
        return n
      })
    } catch { /* keep local override */ }
    setSavingSet(prev => { const n = new Set(prev); n.delete(p.id); return n })
  }, [local, proveedores])

  const handleDelete = async (p: Produto) => {
    if (!confirm(`Desactivar producto "${p.nombre}"?`)) return
    await stockGeneralApi.deleteProducto(p.id)
    setProductos(prev => prev.filter(pr => pr.id !== p.id))
  }

  const handleCreate = async (keepOpen = false) => {
    if (!createForm.codigo.trim() || !createForm.nombre.trim()) { setCreateError('Codigo y nombre son obligatorios'); return }
    setCreating(true); setCreateError('')
    try {
      await stockGeneralApi.createProducto({
        codigo: createForm.codigo, nombre: createForm.nombre,
        nombre_proveedor: createForm.nombre_proveedor || undefined,
        proveedor_id: createForm.proveedor_id ? parseInt(createForm.proveedor_id) : undefined,
        unidad_stock: createForm.unidad_stock, unidad_pedido: createForm.unidad_pedido,
      })
      load()
      if (keepOpen) setCreateForm({ codigo: '', nombre: '', nombre_proveedor: '', proveedor_id: createForm.proveedor_id, unidad_stock: createForm.unidad_stock, unidad_pedido: createForm.unidad_pedido })
      else { setCreateModal(false); setCreateForm({ codigo: '', nombre: '', nombre_proveedor: '', proveedor_id: '', unidad_stock: 'unidad', unidad_pedido: 'unidad' }) }
    } catch (e: any) { setCreateError(e?.response?.data?.detail ?? 'Error al guardar') }
    setCreating(false)
  }

  const inCls = 'w-full text-sm bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-dark-border focus:border-accent focus:bg-white dark:focus:bg-dark-surface focus:outline-none rounded px-2 py-1 transition-colors'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input className="w-full input pl-8 text-xs" placeholder="Buscar por nombre, codigo o proveedor..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <button onClick={() => { setCreateForm({ codigo: '', nombre: '', nombre_proveedor: '', proveedor_id: '', unidad_stock: 'unidad', unidad_pedido: 'unidad' }); setCreateError(''); setCreateModal(true) }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90">
          <Plus className="w-3.5 h-3.5" /> Nuevo producto
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[0,1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-dark-elevated animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400"><Package className="w-8 h-8 mx-auto mb-2 opacity-40" />Sin productos{busqueda ? ` para "${busqueda}"` : ''}.</div>
      ) : (
        <>
        <datalist id="sg-unidades-datalist">{UNIDADES.map(u => <option key={u} value={u} />)}</datalist>
        <div className="border border-gray-100 dark:border-dark-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-dark-elevated text-xs text-gray-500 uppercase select-none">
              {(['codigo', 'nombre', 'proveedor'] as SortField[]).map((field) => (
                <th key={field} onClick={() => toggleSort(field)}
                  className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-elevated/80 transition-colors">
                  <span className="flex items-center gap-1">
                    {field === 'codigo' ? 'Codigo' : field === 'nombre' ? 'Nombre stock' : 'Proveedor'}
                    {sortBy === field
                      ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-accent" /> : <ChevronDown className="w-3 h-3 text-accent" />
                      : <ChevronUp className="w-3 h-3 opacity-20" />}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre pedido</th>
              <th className="px-4 py-3 hidden sm:table-cell text-left text-xs font-semibold">U.Stock</th>
              <th className="px-4 py-3 hidden sm:table-cell text-left text-xs font-semibold">U.Pedido</th>
              <th className="px-4 py-3 w-10"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {filtered.map(p => {
                const s = savingSet.has(p.id)
                const d = doneSet.has(p.id)
                const changed = !!(local[p.id] && Object.keys(local[p.id]).length)
                const rowCls = s ? 'bg-amber-50 dark:bg-amber-900/10' : d ? 'bg-green-50 dark:bg-green-900/10' : changed ? 'bg-blue-50/40 dark:bg-blue-900/5' : 'hover:bg-gray-50 dark:hover:bg-dark-elevated/50'
                return (
                  <tr key={p.id} className={`group transition-colors ${rowCls}`}>
                    <td className="px-2 py-1.5 align-middle w-28">
                      <input className={`${inCls} font-mono text-xs font-bold text-accent uppercase`}
                        value={get(p, 'codigo')}
                        onChange={e => setField(p.id, 'codigo', e.target.value.toUpperCase())}
                        onBlur={() => saveRow(p)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <input className={inCls} value={get(p, 'nombre')}
                        onChange={e => setField(p.id, 'nombre', e.target.value)}
                        onBlur={() => saveRow(p)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <input className={inCls} list="sg-proveedores-datalist"
                        placeholder="Sin proveedor"
                        value={local[p.id]?.proveedor_nombre !== undefined ? local[p.id].proveedor_nombre! : (p.proveedor_nombre ?? '')}
                        onChange={e => setLocal(prev => ({ ...prev, [p.id]: { ...prev[p.id], proveedor_nombre: e.target.value } }))}
                        onBlur={() => {
                          const typed = local[p.id]?.proveedor_nombre
                          if (typed === undefined) return
                          const match = proveedores.find(pv => pv.nombre.toLowerCase() === typed.trim().toLowerCase())
                          if (match) {
                            saveRow(p, { proveedor_id: String(match.id) })
                          } else if (typed.trim() === '') {
                            saveRow(p, { proveedor_id: '0' })
                          } else {
                            setLocal(prev => {
                              const n = { ...prev }
                              if (n[p.id]) { const u = { ...n[p.id] }; delete u.proveedor_nombre; delete u.proveedor_id; if (!Object.keys(u).length) delete n[p.id]; else n[p.id] = u }
                              return n
                            })
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <input className={inCls} placeholder="igual al nombre"
                        value={get(p, 'nombre_proveedor')}
                        onChange={e => setField(p.id, 'nombre_proveedor', e.target.value)}
                        onBlur={() => saveRow(p)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        style={{ color: get(p, 'nombre_proveedor') ? undefined : '#aaa', fontStyle: get(p, 'nombre_proveedor') ? 'normal' : 'italic' }}
                      />
                    </td>
                    <td className="px-2 py-1.5 hidden sm:table-cell align-middle">
                      <input className={inCls} list="sg-unidades-datalist" value={get(p, 'unidad_stock')}
                        onChange={e => setField(p.id, 'unidad_stock', e.target.value)}
                        onBlur={() => saveRow(p)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    </td>
                    <td className="px-2 py-1.5 hidden sm:table-cell align-middle">
                      <input className={inCls} list="sg-unidades-datalist" value={get(p, 'unidad_pedido')}
                        onChange={e => setField(p.id, 'unidad_pedido', e.target.value)}
                        onBlur={() => saveRow(p)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right align-middle">
                      {s ? <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin ml-auto" />
                       : d ? <Check className="w-3.5 h-3.5 text-green-500 ml-auto" />
                       : <button onClick={() => handleDelete(p)}
                           className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <datalist id="sg-proveedores-datalist">{proveedores.map(pv => <option key={pv.id} value={pv.nombre} />)}</datalist>
          <div className="px-4 py-2 bg-gray-50 dark:bg-dark-elevated text-xs text-gray-400 border-t border-gray-100 dark:border-dark-border flex items-center gap-3">
            <span>{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</span>
            <span className="text-gray-300">— Los cambios se guardan automaticamente</span>
          </div>
        </div>
        </>
      )}

      {createModal && (
        <Modal title="Nuevo Producto" onClose={() => setCreateModal(false)}>
          <div className="space-y-4">
            <div><label className="label-xs block mb-1">Codigo *</label>
              <input className="w-full input uppercase font-mono" placeholder="ej. BEB-001" value={createForm.codigo}
                onChange={e => setCreateForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} /></div>
            <div><label className="label-xs block mb-1">Nombre (en el stock) *</label>
              <input className="w-full input" placeholder="ej. Gaseosa 1.5L" value={createForm.nombre}
                onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div>
              <label className="label-xs block mb-1">Nombre para el proveedor <span className="text-gray-400 font-normal">(en los pedidos)</span></label>
              <input className="w-full input" placeholder="Si es distinto al nombre de stock, ej. Gaseosa cola 1500cc" value={createForm.nombre_proveedor}
                onChange={e => setCreateForm(f => ({ ...f, nombre_proveedor: e.target.value }))} />
            </div>
            <div><label className="label-xs block mb-1">Proveedor</label>
              <select className="w-full input" value={createForm.proveedor_id} onChange={e => setCreateForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                <option value="">Sin proveedor</option>
                {proveedores.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-xs block mb-1">Unidad de Stock</label>
                <select className="w-full input" value={createForm.unidad_stock} onChange={e => setCreateForm(f => ({ ...f, unidad_stock: e.target.value }))}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select></div>
              <div><label className="label-xs block mb-1">Unidad de Pedido</label>
                <select className="w-full input" value={createForm.unidad_pedido} onChange={e => setCreateForm(f => ({ ...f, unidad_pedido: e.target.value }))}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select></div>
            </div>
            {createError && <p className="text-xs text-red-500">{createError}</p>}
            <div className="flex gap-2 justify-end pt-2 flex-wrap">
              <button onClick={() => setCreateModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={() => handleCreate(true)} disabled={creating} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-accent text-accent text-xs font-semibold hover:bg-accent/5 disabled:opacity-50">
                <Plus className="w-3.5 h-3.5" /> Guardar y crear otro
              </button>
              <button onClick={() => handleCreate(false)} disabled={creating} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-50">
                {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Tab Historial ─────────────────────────────────────────────────────────────

// ── Subcomponente: tabla de rubro dentro del historial ───────────────────────

function HistorialRubroRows({ registros, modo }: { registros: RegistroHistorial[], modo: 'stock_pedido' | 'solo_pedido' }) {
  const byRubro = useMemo(() => {
    const map = new Map<string, { orden: number; rows: RegistroHistorial[] }>()
    for (const r of registros) {
      const key = r.rubro_nombre ?? 'SIN RUBRO'
      if (!map.has(key)) map.set(key, { orden: r.rubro_orden ?? 999, rows: [] })
      map.get(key)!.rows.push(r)
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[1].orden - b[1].orden || a[0].localeCompare(b[0]))
    for (const [, v] of sorted) v.rows.sort((a, b) => (a.item_orden ?? 0) - (b.item_orden ?? 0))
    return sorted
  }, [registros])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (n: string) => setCollapsed(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s })

  return (
    <div className="space-y-2">
      {byRubro.map(([rubroNombre, { rows: allRubroRows }]) => {
        const rubroRows = modo === 'solo_pedido'
          ? allRubroRows.filter(r => r.pedido != null && r.pedido !== 0)
          : allRubroRows
        if (rubroRows.length === 0) return null
        const isCollapsed = collapsed.has(rubroNombre)
        const conPedido = rubroRows.filter(r => r.pedido != null && r.pedido !== 0).length
        return (
          <div key={rubroNombre} className="rounded-xl overflow-hidden border border-gray-100 dark:border-dark-border">
            <button onClick={() => toggle(rubroNombre)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left" style={{ background: 'linear-gradient(90deg, #1a3260 0%, #2a4480 100%)' }}>
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-white/70" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-white/70" />}
              <span className="text-xs font-bold uppercase tracking-widest text-white flex-1 truncate">{rubroNombre}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {conPedido > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-400/90 text-white">{conPedido} pedido{conPedido > 1 ? 's' : ''}</span>}
                <span className="text-[10px] text-white/50">{rubroRows.length} prod.</span>
              </div>
            </button>
            {!isCollapsed && (
              <div className="overflow-x-auto bg-white dark:bg-dark-surface">
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-dark-border" style={{ background: '#f8fafd' }}>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '30%' }}>Producto</th>
                      <th className="px-2 py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '8%' }}>U.</th>
                      <th className="px-2 py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '14%' }}>Stock</th>
                      <th className="px-2 py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '8%' }}>U.</th>
                      <th className="px-2 py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: '14%' }}>Pedido</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rubroRows.map((r, idx) => {
                      const hasPedido = r.pedido != null && r.pedido !== 0
                      return (
                        <tr key={r.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-dark-elevated/50"
                          style={{ borderBottom: idx < rubroRows.length - 1 ? '1px solid #f3f4f6' : undefined, borderLeft: hasPedido ? '3px solid #e53e3e' : '3px solid transparent' }}>
                          <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100">{r.producto_nombre}</td>
                          <td className="px-2 py-2 text-center text-gray-400 font-medium" style={{ fontSize: 10 }}>{r.unidad_stock}</td>
                          <td className="px-2 py-1.5 text-center"><span className="inline-block min-w-[48px] rounded-md border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-elevated px-2 py-1 text-gray-700 dark:text-gray-300">{r.stock != null ? fmtNum(r.stock) : '—'}</span></td>
                          <td className="px-2 py-2 text-center text-gray-400 font-medium" style={{ fontSize: 10 }}>{r.unidad_pedido}</td>
                          <td className="px-2 py-1.5 text-center"><span className="inline-block min-w-[48px] rounded-md border px-2 py-1 font-semibold" style={hasPedido ? { borderColor: '#fca5a5', background: '#fff1f1', color: '#b91c1c' } : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }}>{r.pedido != null ? fmtNum(r.pedido) : '—'}</span></td>
                          <td className="px-3 py-2 text-gray-400">{r.notas || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Subcomponente: bloque expandible de un período ────────────────────────────

function HistorialPeriodo({ fecha, modo }: { fecha: string; modo: 'stock_pedido' | 'solo_pedido' }) {
  const sucursal = '1'
  const [open, setOpen] = useState(false)
  const [area, setArea] = useState<'salon' | 'cocina' | 'cervezas'>('salon')
  const [data, setData] = useState<Record<string, RegistroHistorial[] | any[]>>({})
  const [loading, setLoading] = useState(false)

  const loadArea = useCallback(async (a: 'salon' | 'cocina' | 'cervezas') => {
    const key = `${fecha}__${a}`
    if (data[key]) return
    setLoading(true)
    try {
      if (a === 'cervezas') {
        const d = await stockGeneralApi.getCervezasHistorial(fecha, sucursal)
        setData(prev => ({ ...prev, [key]: d }))
      } else {
        const d = await stockGeneralApi.getHistorial({ area: a, desde: fecha, hasta: fecha })
        setData(prev => ({ ...prev, [key]: d }))
      }
    } catch {}
    setLoading(false)
  }, [fecha, data, sucursal])

  const handleOpen = () => {
    const next = !open
    setOpen(next)
    if (next) loadArea(area)
  }

  const handleArea = (a: 'salon' | 'cocina' | 'cervezas') => {
    setArea(a)
    if (open) loadArea(a)
  }

  const currentKey = `${fecha}__${area}`
  const currentData = data[currentKey]
  const registros = area !== 'cervezas' ? (currentData as RegistroHistorial[] | undefined) ?? [] : []
  const cervezas = area === 'cervezas' ? (currentData as any[] | undefined) ?? [] : []
  const totalPedido = registros.filter(r => r.pedido != null && r.pedido !== 0).length

  return (
    <div className="border border-gray-100 dark:border-dark-border rounded-xl overflow-hidden">
      {/* Header del período */}
      <button onClick={handleOpen} className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-dark-surface hover:bg-gray-50 dark:hover:bg-dark-elevated/50 transition-colors text-left">
        <History className="w-4 h-4 text-accent flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{periodLabel(fecha)}</span>
          <span className="ml-2 text-xs text-gray-400">{fmtDate(fecha)}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-dark-border">
          {/* Tabs de área */}
          <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 dark:bg-dark-elevated border-b border-gray-100 dark:border-dark-border">
            {(['salon','cocina','cervezas'] as const).map(a => (
              <button key={a} onClick={() => handleArea(a)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${area === a ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-border'}`}>
                {a === 'salon' ? 'Salón' : a === 'cocina' ? 'Cocina' : 'Cervezas'}
              </button>
            ))}
            {!loading && area !== 'cervezas' && registros.length > 0 && (
              <span className="ml-auto text-xs text-gray-400">{registros.length} prod.{totalPedido > 0 && <span className="ml-1 text-red-400 font-semibold">{totalPedido} pedido{totalPedido > 1 ? 's' : ''}</span>}</span>
            )}
          </div>

          {/* Contenido */}
          <div className="p-3">
            {loading ? (
              <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-8 rounded bg-gray-100 dark:bg-dark-elevated animate-pulse" />)}</div>
            ) : area !== 'cervezas' ? (
              registros.length === 0
                ? <p className="text-center py-6 text-xs text-gray-400">Sin registros de {area} para este período.</p>
                : <HistorialRubroRows registros={registros} modo={modo} />
            ) : (
              cervezas.length === 0
                ? <p className="text-center py-6 text-xs text-gray-400">Sin historial de cervezas para este período.</p>
                : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-dark-border">
                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr className="bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border">
                          <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase" rowSpan={2}>#</th>
                          <th colSpan={5} className="px-3 py-2 text-center text-[10px] font-semibold text-accent uppercase border-b border-gray-200 dark:border-dark-border border-r border-gray-200 dark:border-dark-border">ACTUAL</th>
                          <th colSpan={4} className="px-3 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-200 dark:border-dark-border">PRÓXIMO</th>
                        </tr>
                        <tr className="bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border">
                          <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Estilo</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">Tipo</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">Cám.</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">Brls.</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase border-r border-gray-200 dark:border-dark-border">Días P.</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Estilo</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">Tipo</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">Cám.</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">Brls.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cervezas.map((r: any, idx: number) => (
                          <tr key={r.canilla_num} className={`border-b border-gray-100 dark:border-dark-border/30 hover:bg-gray-50 dark:hover:bg-dark-elevated/40 ${!r.estilo_actual ? 'opacity-40' : ''} ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                            <td className="px-3 py-2 text-center font-bold text-gray-700 dark:text-gray-300">{r.canilla_num}</td>
                            <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{r.estilo_actual || 'sin pinchar'}</td>
                            <td className="px-3 py-2 text-center"><TipoBadge tipo={r.tipo_actual} /></td>
                            <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{r.stock_camara || '—'}</td>
                            <td className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">{r.aprox_litros > 0 ? r.aprox_litros : '—'}</td>
                            <td className="px-3 py-2 text-center border-r border-gray-200 dark:border-dark-border"><DiasBadge dias={r.dias_pinchado} /></td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.estilo_proximo || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                            <td className="px-3 py-2 text-center"><TipoBadge tipo={r.tipo_proximo} /></td>
                            <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{r.estilo_proximo ? (r.stock_camara_proximo || '—') : '—'}</td>
                            <td className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">{r.estilo_proximo && r.aprox_litros_proximo > 0 ? r.aprox_litros_proximo : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function HistorialTab() {
  const [periodos, setPeriodos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [modo, setModo] = useState<'stock_pedido' | 'solo_pedido'>('stock_pedido')

  useEffect(() => {
    stockGeneralApi.getPeriodos().then(p => setPeriodos(p)).catch(() => setPeriodos([])).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <History className="w-4 h-4 text-accent" /> Historial de Stocks
        </h2>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={modo}
            onChange={e => setModo(e.target.value as 'stock_pedido' | 'solo_pedido')}
            className="text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          >
            <option value="stock_pedido">Stock y Pedido</option>
            <option value="solo_pedido">Solo Pedido</option>
          </select>
          <button onClick={() => { setLoading(true); stockGeneralApi.getPeriodos().then(p => setPeriodos(p)).catch(() => {}).finally(() => setLoading(false)) }}
            disabled={loading} className="p-1.5 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-elevated text-gray-400 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-dark-elevated animate-pulse" />)}</div>
      ) : periodos.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">
          <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
          Sin stocks registrados aún. Cargá y enviá una planilla para que aparezca aquí.
        </div>
      ) : (
        <div className="space-y-2">
          {periodos.map(f => <HistorialPeriodo key={f} fecha={f} modo={modo} />)}
        </div>
      )}
    </div>
  )
}

// ── Tab Proveedores ───────────────────────────────────────────────────────────

function ProveedoresTab() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [modal, setModal] = useState<null | 'create' | Proveedor>(null)
  const [form, setForm] = useState({ nombre: '', categoria: '', nombre_remitente: '', info_reco: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setProveedores(await stockGeneralApi.getProveedores()) } catch { setProveedores([]) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => proveedores.filter(p => {
    const q = busqueda.toLowerCase()
    return (!q || p.nombre.toLowerCase().includes(q) || (p.nombre_remitente ?? '').toLowerCase().includes(q)) &&
           (!filtroCategoria || p.categoria === filtroCategoria)
  }), [proveedores, busqueda, filtroCategoria])

  const openCreate = () => { setForm({ nombre: '', categoria: '', nombre_remitente: '', info_reco: '' }); setError(''); setModal('create') }
  const openEdit = (p: Proveedor) => {
    setForm({ nombre: p.nombre, categoria: p.categoria ?? '', nombre_remitente: p.nombre_remitente ?? '', info_reco: p.info_reco ?? '' })
    setError(''); setModal(p)
  }

  const handleSave = async (keepOpen = false) => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const payload = { nombre: form.nombre, categoria: form.categoria || undefined, nombre_remitente: form.nombre_remitente || undefined, info_reco: form.info_reco || undefined }
      if (modal === 'create') {
        await stockGeneralApi.createProveedor(payload)
      } else {
        await stockGeneralApi.updateProveedor((modal as Proveedor).id, payload)
      }
      load()
      if (keepOpen) setForm({ nombre: '', categoria: form.categoria, nombre_remitente: '', info_reco: '' })
      else setModal(null)
    } catch (e: any) { setError(e?.response?.data?.detail ?? 'Error al guardar') }
    setSaving(false)
  }

  const handleDelete = async (p: Proveedor) => {
    if (!confirm(`Desactivar proveedor "${p.nombre}"?`)) return
    await stockGeneralApi.deleteProveedor(p.id); load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input className="w-full input pl-8 text-xs" placeholder="Buscar por nombre o remitente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input text-xs" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90">
          <Plus className="w-3.5 h-3.5" /> Nuevo proveedor
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[0,1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-dark-elevated animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400"><Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />Sin proveedores{busqueda ? ` para "${busqueda}"` : ''}.</div>
      ) : (
        <div className="border border-gray-100 dark:border-dark-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-dark-elevated text-xs text-gray-500 uppercase">
              <th className="px-4 py-3 text-left">Proveedor</th>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-left hidden lg:table-cell">Remitente</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Info entrega</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-dark-elevated/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.nombre}</td>
                  <td className="px-4 py-3">
                    {p.categoria
                      ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${catColor[p.categoria] ?? 'bg-gray-100 text-gray-600'}`}>{p.categoria}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">{p.nombre_remitente || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell max-w-xs truncate">{p.info_reco || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-elevated text-gray-400 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-gray-50 dark:bg-dark-elevated text-xs text-gray-400 border-t border-gray-100 dark:border-dark-border">{filtered.length} proveedor{filtered.length !== 1 ? 'es' : ''}</div>
        </div>
      )}

      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 dark:border-dark-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-dark-border sticky top-0 bg-white dark:bg-dark-surface z-10">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{modal === 'create' ? 'Nuevo Proveedor' : 'Editar Proveedor'}</h3>
              <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-elevated"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="label-xs block mb-1">Nombre *</label>
                <input className="w-full input" placeholder="ej. MASTAPAS" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
              <div><label className="label-xs block mb-1">Categoria</label>
                <select className="w-full input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  <option value="">Sin categoria</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="label-xs block mb-1">Nombre del Remitente</label>
                <input className="w-full input" placeholder="ej. Marcelo" value={form.nombre_remitente} onChange={e => setForm(f => ({ ...f, nombre_remitente: e.target.value }))} /></div>
              <div><label className="label-xs block mb-1">Informacion de Entrega</label>
                <textarea className="w-full input resize-none" rows={3} placeholder="ej. Entregar el jueves antes de las 10am en Ayacucho 810" value={form.info_reco} onChange={e => setForm(f => ({ ...f, info_reco: e.target.value }))} /></div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 justify-end pt-2 flex-wrap">
                <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
                {modal === 'create' && (
                  <button onClick={() => handleSave(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-accent text-accent text-xs font-semibold hover:bg-accent/5 disabled:opacity-50">
                    <Plus className="w-3.5 h-3.5" /> Guardar y crear otro
                  </button>
                )}
                <button onClick={() => handleSave(false)} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Central de Pedidos ────────────────────────────────────────────────────

const EMPRESA = 'CEBADOS SRL CUIT: 30-71635237-0'

function CentralPedidosTab() {
  const [fecha, setFecha] = useState<string | null>(null)
  const [pedidos, setPedidos] = useState<PedidoRow[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [asignaciones, setAsignaciones] = useState<Record<number, number | null>>({})
  const [confirmaciones, setConfirmaciones] = useState<Record<number, boolean>>({})
  const [savingConf, setSavingConf] = useState<number | null>(null)
  const [searchAsig, setSearchAsig] = useState('')
  const [asigOpen, setAsigOpen] = useState(true)
  const [birrasOpen, setBirrasOpen] = useState(false)
  const [cervezasHistorial, setCervezasHistorial] = useState<any[]>([])
  const [loadingBirras, setLoadingBirras] = useState(false)
  const [umbrales, setUmbrales] = useState<Record<string, string>>({})
  const [expandedProv, setExpandedProv] = useState<number | null | 'none'>('none')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  type AsigCol = 'area' | 'nombre' | 'pedido' | 'proveedor'
  const [asigSort, setAsigSort] = useState<{ col: AsigCol; dir: 'asc' | 'desc' }>({ col: 'area', dir: 'asc' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ fecha: f, pedidos: ped }, provs, umbs] = await Promise.all([
        stockGeneralApi.getPedidosUltimo(),
        stockGeneralApi.getProveedores(),
        stockGeneralApi.getUmbrales(),
      ])
      setFecha(f); setPedidos(ped); setProveedores(provs)
      const umbMap: Record<string, string> = {}
      for (const u of umbs) umbMap[u.estilo] = u.umbral
      setUmbrales(umbMap)
      if (f) {
        const [asigs, confs] = await Promise.all([
          stockGeneralApi.getPedidoAsignaciones(f),
          stockGeneralApi.getPedidoConfirmaciones(f),
        ])
        setAsignaciones(asigs)
        setConfirmaciones(confs)
      } else {
        setAsignaciones({})
        setConfirmaciones({})
      }
    } catch { setPedidos([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const getProvId = (p: PedidoRow) => asignaciones[p.producto_id] !== undefined ? asignaciones[p.producto_id] : p.proveedor_id

  // Group pedidos by proveedor (using effective assignment)
  const byProveedor = useMemo(() => {
    const map = new Map<number | null, { proveedor: Proveedor | null; pedidos: PedidoRow[] }>()
    for (const p of pedidos) {
      const pid = getProvId(p) ?? null
      if (!map.has(pid)) {
        const prov = pid ? proveedores.find(pv => pv.id === pid) ?? null : null
        map.set(pid, { proveedor: prov, pedidos: [] })
      }
      map.get(pid)!.pedidos.push(p)
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === null) return 1
      if (b[0] === null) return -1
      return (a[1].proveedor?.nombre ?? '').localeCompare(b[1].proveedor?.nombre ?? '', 'es')
    })
  }, [pedidos, asignaciones, proveedores])

  const toggleSort = (col: AsigCol) =>
    setAsigSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const sortedAsigRows = useMemo(() => {
    const rows = pedidos.map(p => {
      const effProvId = asignaciones[p.producto_id] !== undefined ? asignaciones[p.producto_id] : p.proveedor_id
      const effProvNombre = effProvId ? (proveedores.find(pv => pv.id === effProvId)?.nombre ?? '') : ''
      return { ...p, effProvId, effProvNombre }
    })
    rows.sort((a, b) => {
      let cmp = 0
      if (asigSort.col === 'area')      cmp = a.area.localeCompare(b.area, 'es')
      else if (asigSort.col === 'nombre')    cmp = a.nombre.localeCompare(b.nombre, 'es')
      else if (asigSort.col === 'pedido')    cmp = (a.pedido ?? 0) - (b.pedido ?? 0)
      else if (asigSort.col === 'proveedor') cmp = a.effProvNombre.localeCompare(b.effProvNombre, 'es')
      return asigSort.dir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [pedidos, asigSort, asignaciones, proveedores])

  const generateMessage = (prov: Proveedor, items: PedidoRow[]): string => {
    const remitente = prov.nombre_remitente || prov.nombre
    const lista = items.map(p => `• ${fmtNum(p.pedido)} ${p.unidad_pedido} de ${p.nombre_pedido}`).join('\n')
    const info = prov.info_reco ? `\n${prov.info_reco}` : ''
    return `Hola ${remitente}! Te dejo el pedido de ${EMPRESA} para esta semana:\n\n${lista}${info}`
  }

  const copyMessage = (prov: Proveedor, items: PedidoRow[]) => {
    const msg = generateMessage(prov, items)
    navigator.clipboard.writeText(msg)
    setCopiedId(prov.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openWhatsapp = (prov: Proveedor, items: PedidoRow[]) => {
    const msg = generateMessage(prov, items)
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const provIdsConPedido = useMemo(
    () => new Set(byProveedor.filter(([id]) => id !== null).map(([id]) => id as number)),
    [byProveedor]
  )

  const toggleConfirmacion = async (provId: number) => {
    if (!fecha || savingConf === provId) return
    const current = confirmaciones[provId] ?? false
    setSavingConf(provId)
    setConfirmaciones(prev => ({ ...prev, [provId]: !current }))
    try {
      await stockGeneralApi.savePedidoConfirmacion(fecha, provId, !current)
    } catch {
      setConfirmaciones(prev => ({ ...prev, [provId]: current }))
    } finally {
      setSavingConf(null)
    }
  }

  const filteredAsigRows = useMemo(() => {
    if (!searchAsig.trim()) return sortedAsigRows
    const q = searchAsig.toLowerCase()
    return sortedAsigRows.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.effProvNombre.toLowerCase().includes(q)
    )
  }, [sortedAsigRows, searchAsig])

  const toggleBirras = async () => {
    const next = !birrasOpen
    setBirrasOpen(next)
    if (next && fecha && cervezasHistorial.length === 0) {
      setLoadingBirras(true)
      try {
        const data = await stockGeneralApi.getCervezasHistorial(fecha)
        setCervezasHistorial(data)
      } catch { setCervezasHistorial([]) }
      setLoadingBirras(false)
    }
  }

  const provsConPedido = useMemo(
    () => proveedores.filter(pv => provIdsConPedido.has(pv.id)),
    [proveedores, provIdsConPedido]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
          <ShoppingCart className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">Período de pedido</p>
            <p className="text-sm font-bold text-blue-800 dark:text-blue-200">{fecha ? periodLabel(fecha) : '—'}</p>
          </div>
          {fecha && <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-500 text-white text-xs font-bold uppercase tracking-wide">ÚLTIMO</span>}
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-elevated text-gray-400">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-dark-elevated animate-pulse" />)}</div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-600">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          {fecha ? `Sin pedidos registrados para ${periodLabel(fecha)}.` : 'Aún no se envió ningún stock. Cargá valores de pedido en las planillas de Salón y Cocina.'}
        </div>
      ) : (
        <>
          {/* Fila superior: Pedidos Automatizados (izq) + Estado de Proveedores (der) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

            {/* Columna izquierda: Pedidos Automatizados */}
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-600" /> Pedidos Automatizados
              </h2>
              <div className="space-y-2">
                {byProveedor.map(([provId, { proveedor, pedidos: items }]) => {
                  const isExpanded = expandedProv === provId
                  const msg = proveedor ? generateMessage(proveedor, items) : null
                  return (
                    <div key={provId ?? 'sin-prov'} className="border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden">
                      <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-elevated/50 text-left transition-colors"
                        onClick={() => setExpandedProv(isExpanded ? 'none' : provId)}>
                        {proveedor ? (
                          <>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{proveedor.nombre}</span>
                              {proveedor.categoria && (
                                <span className={`flex-shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${catColor[proveedor.categoria] ?? 'bg-gray-100 text-gray-600'}`}>{proveedor.categoria}</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">{items.length} producto{items.length !== 1 ? 's' : ''}</span>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center gap-1.5 text-xs text-red-500 flex-1"><AlertCircle className="w-3.5 h-3.5" /> Sin proveedor asignado</span>
                            <span className="text-xs text-gray-400">{items.length} producto{items.length !== 1 ? 's' : ''}</span>
                          </>
                        )}
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100 dark:border-dark-border p-4 space-y-3">
                          <div className="space-y-1">
                            {items.map(p => (
                              <div key={`${p.area}-${p.producto_id}`} className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-3 text-xs">
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${p.area === 'salon' ? 'bg-accent/10 text-accent' : 'bg-purple-100 text-purple-700'}`}>{p.area}</span>
                                  <span className="flex-1 text-gray-700 dark:text-gray-300">
                                    {p.nombre_pedido !== p.nombre
                                      ? <><span className="text-gray-400 line-through mr-1">{p.nombre}</span>{p.nombre_pedido}</>
                                      : p.nombre}
                                  </span>
                                  <span className="font-bold text-red-600">{fmtNum(p.pedido)} {p.unidad_pedido}</span>
                                </div>
                                {p.notas && (
                                  <div className="pl-[52px] text-[10px] text-amber-700 dark:text-amber-400 italic">
                                    📝 {p.notas}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {proveedor && msg && (
                            <>
                              <div className="bg-gray-50 dark:bg-dark-elevated rounded-xl p-3">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Mensaje WhatsApp</p>
                                <pre className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{msg}</pre>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => copyMessage(proveedor, items)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-border text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors">
                                  {copiedId === proveedor.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  {copiedId === proveedor.id ? 'Copiado!' : 'Copiar'}
                                </button>
                                <button onClick={() => openWhatsapp(proveedor, items)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors">
                                  <MessageCircle className="w-3.5 h-3.5" /> Abrir WhatsApp
                                </button>
                              </div>
                            </>
                          )}
                          {!proveedor && (
                            <p className="text-xs text-red-500">Asigná un proveedor a estos productos para generar el mensaje.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Columna derecha: Estado de Proveedores — solo los que tienen pedido, reactivo */}
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-500" /> Estado de Proveedores
                <span className="ml-auto text-xs font-normal text-gray-400">{provsConPedido.length} con pedido</span>
              </h2>
              {provsConPedido.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-10 text-xs text-gray-400 border border-dashed border-gray-200 dark:border-dark-border rounded-xl">
                  Asigná proveedores en la tabla de abajo para verlos aquí
                </div>
              ) : (
                <div className="border border-gray-100 dark:border-dark-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-dark-elevated text-gray-500 uppercase">
                        <th className="px-4 py-3 text-left">Proveedor</th>
                        <th className="px-3 py-3 text-center whitespace-nowrap">Productos</th>
                        <th className="px-3 py-3 text-center whitespace-nowrap">Enviado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-dark-border/50">
                      {provsConPedido.map(prov => {
                        const enviado = confirmaciones[prov.id] ?? false
                        const nProductos = byProveedor.find(([id]) => id === prov.id)?.[1].pedidos.length ?? 0
                        return (
                          <tr key={prov.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-elevated/30">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-gray-800 dark:text-gray-200 leading-tight">{prov.nombre}</span>
                                {prov.categoria && (
                                  <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${catColor[prov.categoria] ?? 'bg-gray-100 text-gray-600'}`}>{prov.categoria}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap">
                                <Check className="w-3 h-3" /> {nProductos} prod.
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => toggleConfirmacion(prov.id)}
                                disabled={savingConf === prov.id}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                                  enviado
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                    : 'border border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-elevated'
                                } disabled:opacity-50`}
                              >
                                {enviado ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                                {enviado ? 'Enviado' : 'Enviar'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Asignación de Proveedores — desplegable, ancho completo */}
          <div className="border border-gray-100 dark:border-dark-border rounded-xl overflow-hidden">
            <button
              onClick={() => setAsigOpen(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-dark-elevated hover:bg-gray-100 dark:hover:bg-dark-border/30 transition-colors text-left"
            >
              <Truck className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 flex-1">Asignación de Proveedores</span>
              <span className="text-xs text-gray-400">{sortedAsigRows.length} productos</span>
              {asigOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {asigOpen && (
              <>
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-dark-border bg-white dark:bg-dark-surface flex items-center justify-end">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Buscar producto o proveedor..."
                      value={searchAsig}
                      onChange={e => setSearchAsig(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-200 focus:outline-none focus:border-accent w-56"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 dark:bg-dark-elevated text-gray-500 uppercase select-none border-t border-gray-100 dark:border-dark-border">
                    {([['area','Area'],['nombre','Producto'],['pedido','Pedido'],['proveedor','Proveedor']] as [AsigCol, string][]).map(([col, label]) => (
                      <th key={col} onClick={() => toggleSort(col)}
                        className={`px-4 py-3 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-border/30 transition-colors whitespace-nowrap ${col === 'pedido' ? 'text-center' : ''}`}>
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {asigSort.col === col
                            ? asigSort.dir === 'asc' ? <ChevronUp className="w-3 h-3 text-accent" /> : <ChevronDown className="w-3 h-3 text-accent" />
                            : <span className="w-3 h-3 inline-block" />}
                        </span>
                      </th>
                    ))}
                  <th className="px-4 py-3 text-left whitespace-nowrap text-gray-500 font-medium">Observación</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-dark-border/50">
                    {filteredAsigRows.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-xs">Sin resultados para "{searchAsig}"</td></tr>
                    ) : filteredAsigRows.map(p => (
                      <tr key={`${p.area}-${p.producto_id}`} className="hover:bg-gray-50/50 dark:hover:bg-dark-elevated/30">
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${p.area === 'salon' ? 'bg-accent/10 text-accent' : 'bg-purple-100 text-purple-700'}`}>
                            {p.area === 'salon' ? <Wine className="w-3 h-3" /> : <UtensilsCrossed className="w-3 h-3" />}
                            {p.area}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{p.nombre}</td>
                        <td className="px-4 py-2 text-center">
                          <span className="font-bold text-red-600">{fmtNum(p.pedido)}</span>
                          <span className="text-gray-400 ml-1">{p.unidad_pedido}</span>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className="text-xs rounded border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-200 px-2 py-1 focus:outline-none focus:border-accent cursor-pointer"
                            value={p.effProvId ?? ''}
                            onChange={e => {
                              const newProvId = e.target.value ? parseInt(e.target.value) : null
                              setAsignaciones(prev => ({ ...prev, [p.producto_id]: newProvId }))
                              if (fecha) stockGeneralApi.savePedidoAsignacion(fecha, p.producto_id, newProvId).catch(() => {})
                            }}
                          >
                            <option value="">Sin proveedor</option>
                            {proveedores.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2 max-w-[200px]">
                          {p.notas ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic truncate block">{p.notas}</span>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>

          {/* Stock de Birras — desplegable, mismo período */}
          <div className="border border-gray-100 dark:border-dark-border rounded-xl overflow-hidden">
            <button
              onClick={toggleBirras}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-dark-elevated hover:bg-gray-100 dark:hover:bg-dark-border/30 transition-colors text-left"
            >
              <Droplets className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 flex-1">Stock de Birras</span>
              <span className="text-xs text-gray-400">{fecha ? periodLabel(fecha) : '—'}</span>
              {loadingBirras
                ? <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                : birrasOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {birrasOpen && (
              <div className="border-t border-gray-100 dark:border-dark-border">
                {loadingBirras ? (
                  <div className="space-y-2 p-4">{[0,1,2].map(i => <div key={i} className="h-8 rounded bg-gray-100 dark:bg-dark-elevated animate-pulse" />)}</div>
                ) : cervezasHistorial.length === 0 ? (
                  <div className="py-10 text-center text-xs text-gray-400">
                    <Droplets className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay registro de stock de birras para este período
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-dark-elevated text-gray-500 uppercase">
                          <th className="px-3 py-3 text-center whitespace-nowrap">Can.</th>
                          <th className="px-4 py-3 text-left">Estilo Actual</th>
                          <th className="px-3 py-3 text-center">Tipo</th>
                          <th className="px-3 py-3 text-center whitespace-nowrap">Cám.</th>
                          <th className="px-3 py-3 text-center whitespace-nowrap">Brls.</th>
                          <th className="px-3 py-3 text-center whitespace-nowrap">Días</th>
                          <th className="px-4 py-3 text-left">Próximo</th>
                          <th className="px-3 py-3 text-center whitespace-nowrap">Cám. px.</th>
                          <th className="px-3 py-3 text-center whitespace-nowrap">Brls. px.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-dark-border/50">
                        {cervezasHistorial.map((row: any) => {
                          const umbral = umbrales[row.estilo_actual]
                          const bajoBrls = row.estilo_actual && umbral !== undefined && umbral !== ''
                            ? row.aprox_litros <= Number(umbral)
                            : false
                          const bajoCam = row.estilo_actual && umbral !== undefined && umbral !== ''
                            ? (row.stock_camara ?? 0) <= Number(umbral)
                            : false
                          const alerta = bajoBrls || bajoCam
                          return (
                          <tr key={row.canilla_num} className={`hover:bg-gray-50/50 dark:hover:bg-dark-elevated/30 ${alerta ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                            <td className="px-3 py-2.5 text-center">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-[11px]">
                                {row.canilla_num}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                {alerta && (
                                  <span title="Stock bajo" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
                                    <AlertCircle className="w-3 h-3" />bajo stock
                                  </span>
                                )}
                                <div className="font-medium text-gray-800 dark:text-gray-200 leading-tight">{row.estilo_actual || <span className="text-gray-300 dark:text-gray-600">—</span>}</div>
                              </div>
                              {row.proveedor_actual && <div className="text-[10px] text-gray-400 mt-0.5">{row.proveedor_actual}</div>}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {row.tipo_actual ? (
                                <span className={`inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded ${TIPO_CLASS[row.tipo_actual] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {row.tipo_actual}
                                </span>
                              ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-semibold text-gray-700 dark:text-gray-300">{row.stock_camara ?? '—'}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-gray-700 dark:text-gray-300">{row.aprox_litros > 0 ? row.aprox_litros : '—'}</td>
                            <td className="px-3 py-2.5 text-center">
                              {row.dias_pinchado ? (
                                <DiasBadge dias={String(row.dias_pinchado)} />
                              ) : <span className="text-gray-300 dark:text-gray-600 text-[11px]">—</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="text-gray-600 dark:text-gray-400 leading-tight">{row.estilo_proximo || <span className="text-gray-300 dark:text-gray-600">—</span>}</div>
                              {row.proveedor_proximo && <div className="text-[10px] text-gray-400 mt-0.5">{row.proveedor_proximo}</div>}
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-500">{row.stock_camara_proximo ?? '—'}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-gray-700 dark:text-gray-300">{row.aprox_litros_proximo > 0 ? row.aprox_litros_proximo : '—'}</td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Stock Cervezas ────────────────────────────────────────────────────────────

interface CatalogEntry { estilo: string; productor: string; tipo: string }
interface BarrilSC { estilo: string; estado: string; canilla: string; proveedor: string; dias_pinchado: string; tp: string; litros?: number }
interface CanillaCfg { canilla_num: number; estilo_actual: string | null; estilo_proximo: string | null; stock_camara: number; stock_camara_proximo: number }

const parseCanillaNum = (c: any): number => {
  if (typeof c === 'number') return c
  const m = String(c ?? '').match(/(\d+)/)
  return m ? parseInt(m[1]) : 0
}

const TIPO_CLASS: Record<string, string> = {
  A:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  B:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  C:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  D:   'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  E:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  GIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
}
const TIPO_LABELS: Record<string, string> = {
  A: 'Pinta A', B: 'Pinta B', C: 'Pinta C', D: 'Pinta D', E: 'Pinta E', GIN: 'Gin / Esp.',
}

function TipoBadge({ tipo }: { tipo: string }) {
  const cls = TIPO_CLASS[tipo]
  if (!cls) return <span className="text-gray-300 dark:text-gray-600 text-[10px]">—</span>
  return (
    <span className={`inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>
      {tipo}
    </span>
  )
}

function DiasBadge({ dias }: { dias: string }) {
  const n = parseInt(dias)
  if (isNaN(n) || !dias || dias === '—') return <span className="text-gray-300 dark:text-gray-600 text-[11px]">—</span>
  if (n >= 20) return <span className="inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{n}d</span>
  if (n >= 10) return <span className="inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{n}d</span>
  return <span className="inline-flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">{n}d</span>
}

function StockCervezasTab() {
  const sucursal = '1'
  const [cfgMap, setCfgMap] = useState<Map<number, CanillaCfg>>(new Map())
  const [catalogo, setCatalogo] = useState<CatalogEntry[]>([])
  const [barriles, setBarriles] = useState<BarrilSC[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Set<number>>(new Set())
  // Local input state while typing: key = "num-sc" | "num-scp" | "num-prox"
  const [localInputs, setLocalInputs] = useState<Map<string, string>>(new Map())
  const [sendingAll, setSendingAll] = useState(false)
  const [sentAll, setSentAll] = useState(false)
  const [fecha, setFecha] = useState(latestSaturday)
  const [periodos, setPeriodos] = useState<string[]>([])
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [dragFromProx, setDragFromProx] = useState<number | null>(null)
  const [dragOverProx, setDragOverProx] = useState<number | null>(null)

  useEffect(() => {
    stockGeneralApi.getPeriodos().then(p => setPeriodos(p)).catch(() => {})
  }, [])

  const periodoOptions = useMemo(() => buildPeriodoOptions(periodos), [periodos])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cnls, cat, v2barrs] = await Promise.all([
        stockGeneralApi.getCanillas(sucursal),
        barrilesApi.catalogo(sucursal),
        barrilesV2Api.getBarriles('activos'),
      ])
      const m = new Map<number, CanillaCfg>()
      for (const c of cnls) {
        m.set(c.canilla_num, {
          canilla_num: c.canilla_num,
          estilo_actual: c.estilo_actual ?? null,
          estilo_proximo: c.estilo_proximo,
          stock_camara: c.stock_camara ?? 0,
          stock_camara_proximo: c.stock_camara_proximo ?? 0,
        })
      }
      setCfgMap(m)
      setCatalogo(cat as CatalogEntry[])
      const barrs: BarrilSC[] = v2barrs.map((b: any) => ({
        estilo: b.estilo || '',
        estado: b.estado || '',
        canilla: b.canilla != null ? String(b.canilla) : '',
        proveedor: b.proveedor || '',
        dias_pinchado: b.dias_pinchado != null ? String(b.dias_pinchado) : '—',
        tp: b.tipo || '',
        litros: b.litros || 0,
      }))
      setBarriles(barrs)
      setLocalInputs(new Map())
    } catch { /* ignore */ }
    setLoading(false)
  }, [sucursal])

  useEffect(() => { load() }, [load])

  const catalogoMap = useMemo(() => {
    const m = new Map<string, CatalogEntry>()
    for (const c of catalogo) m.set(c.estilo, c)
    return m
  }, [catalogo])

  const rows = useMemo(() => {
    const showBarriles = fecha === latestSaturday() || fecha === nextSaturday()
    return Array.from({ length: 20 }, (_, i) => {
      const num = i + 1
      const cfg = cfgMap.get(num) ?? { canilla_num: num, estilo_actual: null, estilo_proximo: null, stock_camara: 0, stock_camara_proximo: 0 }

      // ACTUAL — cfg.estilo_actual override, fallback to barril data
      const actualBarril = barriles.find(b => b.estado === 'Pinchada' && parseCanillaNum(b.canilla) === num)
      const estiloActual = cfg.estilo_actual || actualBarril?.estilo || null
      const tipoActual = catalogoMap.get(estiloActual || '')?.tipo || actualBarril?.tp || ''
      const provActual = barriles.find(b => b.estilo === estiloActual && b.estado === 'Pinchada')?.proveedor
        || (estiloActual ? actualBarril?.proveedor : null) || '—'
      const stockA = cfg.stock_camara

      // BARRILES: se muestran para semana actual y semana próxima (datos en vivo)
      const cantBarrilesA = (showBarriles && estiloActual)
        ? barriles.filter(b => (b.estado === 'Pinchada' || b.estado === 'En Camara') && b.estilo === estiloActual).length
        : 0
      const aproxA = cantBarrilesA > 0 ? String(cantBarrilesA) : '—'

      // PRÓXIMO — editable
      const estiloP = cfg.estilo_proximo
      const catP = catalogoMap.get(estiloP || '')
      const tipoP = catP?.tipo || ''
      const provP = estiloP ? (barriles.find(b => b.estilo === estiloP)?.proveedor || '—') : '—'
      const stockP = cfg.stock_camara_proximo
      const cantBarrilesP = (showBarriles && estiloP)
        ? barriles.filter(b => (b.estado === 'Pinchada' || b.estado === 'En Camara') && b.estilo === estiloP).length
        : 0
      const aproxP = cantBarrilesP > 0 ? String(cantBarrilesP) : '—'

      return { num, hasPinchada: !!actualBarril, estiloActual, tipoActual, provActual, stockA,
               aproxA, estiloP, tipoP, provP, stockP, aproxP, dias: actualBarril?.dias_pinchado || '—' }
    })
  }, [barriles, cfgMap, catalogoMap, fecha])

  // ── helpers ──────────────────────────────────────────────────────────────────

  const getInput = (num: number, key: 'sc' | 'scp'): string => {
    const local = localInputs.get(`${num}-${key}`)
    if (local !== undefined) return local
    const cfg = cfgMap.get(num)
    const val = key === 'sc' ? (cfg?.stock_camara ?? 0) : (cfg?.stock_camara_proximo ?? 0)
    return val === 0 ? '' : String(val)
  }

  const setInput = (num: number, key: 'sc' | 'scp' | 'ea', val: string) =>
    setLocalInputs(prev => new Map(prev).set(`${num}-${key}`, val))

  const saveStock = async (num: number, key: 'sc' | 'scp') => {
    const inputKey = `${num}-${key}`
    const local = localInputs.get(inputKey)
    if (local === undefined) return
    const numVal = Math.max(0, parseInt(local) || 0)
    const cfg = cfgMap.get(num)
    const saved = key === 'sc' ? (cfg?.stock_camara ?? 0) : (cfg?.stock_camara_proximo ?? 0)
    // always clear local input
    setLocalInputs(prev => { const n = new Map(prev); n.delete(inputKey); return n })
    setSaving(prev => new Set([...prev, num]))
    try {
      const field = key === 'sc' ? 'stock_camara' : 'stock_camara_proximo'
      await stockGeneralApi.updateCanilla(num, { sucursal_id: sucursal, [field]: numVal })
      setCfgMap(prev => {
        const n = new Map(prev)
        const existing = n.get(num) ?? { canilla_num: num, estilo_actual: null, estilo_proximo: null, stock_camara: 0, stock_camara_proximo: 0 }
        n.set(num, { ...existing, [field]: numVal })
        return n
      })
    } catch { /* ignore */ }
    setSaving(prev => { const n = new Set(prev); n.delete(num); return n })
  }

  const handleActual = async (num: number, value: string) => {
    const newVal = value || null
    setCfgMap(prev => {
      const n = new Map(prev)
      const ex = n.get(num) ?? { canilla_num: num, estilo_actual: null, estilo_proximo: null, stock_camara: 0, stock_camara_proximo: 0 }
      n.set(num, { ...ex, estilo_actual: newVal })
      return n
    })
    setSaving(prev => new Set([...prev, num]))
    try {
      await stockGeneralApi.updateCanilla(num, { sucursal_id: sucursal, estilo_actual: value })
    } catch { /* ignore */ }
    setSaving(prev => { const n = new Set(prev); n.delete(num); return n })
  }

  const handleProximo = async (num: number, value: string) => {
    const newVal = value || null
    setCfgMap(prev => {
      const n = new Map(prev)
      const ex = n.get(num) ?? { canilla_num: num, estilo_actual: null, estilo_proximo: null, stock_camara: 0, stock_camara_proximo: 0 }
      n.set(num, { ...ex, estilo_proximo: newVal })
      return n
    })
    setSaving(prev => new Set([...prev, num]))
    try {
      await stockGeneralApi.updateCanilla(num, { sucursal_id: sucursal, estilo_proximo: value })
    } catch { /* ignore */ }
    setSaving(prev => { const n = new Set(prev); n.delete(num); return n })
  }

  const getProxInput = (num: number): string => {
    const local = localInputs.get(`${num}-prox`)
    if (local !== undefined) return local
    return cfgMap.get(num)?.estilo_proximo ?? ''
  }

  const estilosSet = useMemo(() => new Set(catalogo.map(c => c.estilo)), [catalogo])

  const sinPinchar = useMemo(() => {
    const actuales = new Set(rows.map(r => r.estiloActual).filter(Boolean) as string[])
    const proximos = new Set(Array.from(cfgMap.values()).map(c => c.estilo_proximo).filter(Boolean) as string[])
    const groups = new Map<string, { estilo: string; tipo: string; proveedor: string; litros: number }>()
    for (const b of barriles) {
      if (b.estado !== 'En Camara') continue
      if (actuales.has(b.estilo) || proximos.has(b.estilo)) continue
      const ex = groups.get(b.estilo)
      if (ex) ex.litros += (b.litros || 0)
      else groups.set(b.estilo, { estilo: b.estilo, tipo: b.tp || '', proveedor: b.proveedor || '—', litros: b.litros || 0 })
    }
    return Array.from(groups.values()).sort((a, b) => a.estilo.localeCompare(b.estilo))
  }, [barriles, rows, cfgMap])

  const onProxChange = (num: number, val: string) => {
    setLocalInputs(prev => new Map(prev).set(`${num}-prox`, val))
  }

  const onProxBlur = (num: number, val: string) => {
    const saved = cfgMap.get(num)?.estilo_proximo ?? ''
    setLocalInputs(prev => { const n = new Map(prev); n.delete(`${num}-prox`); return n })
    if (val !== saved) handleProximo(num, val)
  }

  const handleDragStart = (num: number, e: React.DragEvent) => {
    setDragFrom(num)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (num: number, e: React.DragEvent) => {
    if (dragFrom !== null && dragFrom !== num) {
      e.preventDefault()
      setDragOver(num)
    }
  }

  const handleDrop = async (num: number, e: React.DragEvent) => {
    e.preventDefault()
    const from = dragFrom
    setDragFrom(null)
    setDragOver(null)
    if (from === null || from === num) return
    const a = from, b = num
    // Resolved estilos include the barril fallback (cfg.estilo_actual || actualBarril?.estilo)
    const estiloA = rows.find(r => r.num === a)?.estiloActual ?? null
    const estiloB = rows.find(r => r.num === b)?.estiloActual ?? null
    // Swap local state using resolved estilos so the display is always exact
    setCfgMap(prev => {
      const n = new Map(prev)
      const da = n.get(a) ?? { canilla_num: a, estilo_actual: null, estilo_proximo: null, stock_camara: 0, stock_camara_proximo: 0 }
      const db = n.get(b) ?? { canilla_num: b, estilo_actual: null, estilo_proximo: null, stock_camara: 0, stock_camara_proximo: 0 }
      n.set(a, { ...db, canilla_num: a, estilo_actual: estiloB })
      n.set(b, { ...da, canilla_num: b, estilo_actual: estiloA })
      return n
    })
    // Clear any local input overrides for both canillas
    setLocalInputs(prev => {
      const n = new Map(prev)
      for (const k of ['sc', 'scp', 'ea', 'prox']) { n.delete(`${a}-${k}`); n.delete(`${b}-${k}`) }
      return n
    })
    try {
      await stockGeneralApi.swapCanillas(a, b, sucursal, estiloA, estiloB)
    } catch { /* ignore */ }
  }

  const handleDragEnd = () => { setDragFrom(null); setDragOver(null) }

  // ── Drag próximos (solo intercambia estilo_proximo) ──────────────────────────
  const handleProxDragStart = (num: number, e: React.DragEvent) => {
    setDragFromProx(num)
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
  }

  const handleProxDragOver = (num: number, e: React.DragEvent) => {
    if (dragFromProx !== null && dragFromProx !== num) {
      e.preventDefault()
      e.stopPropagation()
      setDragOverProx(num)
    }
  }

  const handleProxDrop = async (num: number, e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const from = dragFromProx
    setDragFromProx(null)
    setDragOverProx(null)
    if (from === null || from === num) return
    const a = from, b = num
    const proxA = cfgMap.get(a)?.estilo_proximo ?? null
    const proxB = cfgMap.get(b)?.estilo_proximo ?? null
    // Swap local state
    setCfgMap(prev => {
      const n = new Map(prev)
      const da = n.get(a) ?? { canilla_num: a, estilo_actual: null, estilo_proximo: null, stock_camara: 0, stock_camara_proximo: 0 }
      const db = n.get(b) ?? { canilla_num: b, estilo_actual: null, estilo_proximo: null, stock_camara: 0, stock_camara_proximo: 0 }
      n.set(a, { ...da, estilo_proximo: proxB })
      n.set(b, { ...db, estilo_proximo: proxA })
      return n
    })
    setLocalInputs(prev => { const n = new Map(prev); n.delete(`${a}-prox`); n.delete(`${b}-prox`); return n })
    // Persist — cada updateCanilla dispara Telegram si el próximo cambió
    try {
      await Promise.all([
        stockGeneralApi.updateCanilla(a, { sucursal_id: sucursal, estilo_proximo: proxB ?? '' }),
        stockGeneralApi.updateCanilla(b, { sucursal_id: sucursal, estilo_proximo: proxA ?? '' }),
      ])
    } catch { /* ignore */ }
  }

  const handleProxDragEnd = () => { setDragFromProx(null); setDragOverProx(null) }

  const handleLimpiar = async () => {
    if (!confirm('¿Limpiar todos los stocks de cámara? Los estilos próximos se mantienen.')) return
    setLocalInputs(new Map())
    try {
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => i + 1).map(num =>
          stockGeneralApi.updateCanilla(num, { sucursal_id: sucursal, stock_camara: 0, stock_camara_proximo: 0 })
        )
      )
      setCfgMap(prev => {
        const n = new Map(prev)
        for (let num = 1; num <= 20; num++) {
          const ex = n.get(num) ?? { canilla_num: num, estilo_actual: null, estilo_proximo: null, stock_camara: 0, stock_camara_proximo: 0 }
          n.set(num, { ...ex, stock_camara: 0, stock_camara_proximo: 0 })
        }
        return n
      })
    } catch { /* ignore */ }
  }

  const handleEnviarStock = async () => {
    setSendingAll(true)
    setSentAll(false)
    try {
      // 1. Save current canilla values
      const stockValues = Array.from({ length: 20 }, (_, i) => {
        const num = i + 1
        return { num, sc: Math.max(0, parseInt(getInput(num, 'sc')) || 0), scp: Math.max(0, parseInt(getInput(num, 'scp')) || 0) }
      })
      await Promise.all(stockValues.map(({ num, sc, scp }) =>
        stockGeneralApi.updateCanilla(num, { sucursal_id: sucursal, stock_camara: sc, stock_camara_proximo: scp })
      ))

      // 2. Build historial snapshot from current rows + fresh stock values
      const historialRows = rows.map((r, i) => {
        const localEa = localInputs.get(`${r.num}-ea`)
        const hasOverride = localEa !== undefined && localEa !== (r.estiloActual || '')
        const estiloFinal = hasOverride ? (localEa || null) : (r.estiloActual || null)
        const catFinal = estiloFinal ? catalogoMap.get(estiloFinal) : undefined
        const tipoFinal = hasOverride ? (catFinal?.tipo || null) : (r.tipoActual || null)
        const provFinal = hasOverride
          ? (barriles.find(b => b.estilo === estiloFinal)?.proveedor || null)
          : (r.provActual !== '—' ? r.provActual : null)
        return {
          canilla_num: r.num,
          estilo_actual: estiloFinal,
          tipo_actual: tipoFinal,
          proveedor_actual: provFinal,
          stock_camara: stockValues[i].sc,
          aprox_litros: hasOverride ? 0 : (r.aproxA === '—' ? 0 : (parseInt(r.aproxA) || 0)),
          dias_pinchado: hasOverride ? null : (r.dias !== '—' ? r.dias : null),
          estilo_proximo: r.estiloP || null,
          tipo_proximo: r.tipoP || null,
          proveedor_proximo: r.provP !== '—' ? r.provP : null,
          stock_camara_proximo: stockValues[i].scp,
          aprox_litros_proximo: r.aproxP === '—' ? 0 : (parseInt(r.aproxP) || 0),
        }
      })
      await stockGeneralApi.saveCervezasHistorial({ fecha, sucursal_id: sucursal, rows: historialRows })

      setLocalInputs(new Map())
      await load()
      setSentAll(true)
      setTimeout(() => setSentAll(false), 2500)
    } catch { /* ignore */ }
    setSendingAll(false)
  }

  // ── render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-3">
      <RefreshCw className="w-4 h-4 animate-spin text-accent" />
      <span className="text-xs text-gray-400 dark:text-gray-500">Cargando...</span>
    </div>
  )

  const thCls = 'px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap'
  const tdCls = 'px-3 py-2 text-xs text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-dark-border'

  const handlePrintCanillas = () => {
    const style = document.createElement('style')
    style.id = '__cerv-canillas-page__'
    style.textContent = '@page { size: A4 landscape !important; margin: 10mm 12mm; }'
    document.head.appendChild(style)
    document.body.classList.add('print-canillas')
    setTimeout(() => {
      window.print()
      document.body.classList.remove('print-canillas')
      document.getElementById('__cerv-canillas-page__')?.remove()
    }, 120)
  }

  return (
    <>
    <PrintStyle />
    {createPortal(
      <div className="sg-print-area-canillas" style={{ display: 'none' }}>
        {(() => {
          const ptAprox = (v: string) => v === '—' ? '0' : v
          const emptyRows = Math.max(0, 5 - sinPinchar.length)
          return (
            <table className="cn-pt">
              <thead>
                <tr>
                  <td colSpan={12} style={{ background: '#1a3260', color: 'white', textAlign: 'center', fontSize: '11pt', fontStyle: 'italic', fontWeight: 'bold', padding: '6px', border: 'none' }}>
                    STOCK BIRRAS
                  </td>
                </tr>
                <tr>
                  <th style={{ width: 30 }}>CANILLA</th>
                  <th colSpan={2} style={{ textAlign: 'center' }}>ESTILO ACTUAL + TIPO PINTA</th>
                  <th>PROVEEDOR</th>
                  <th>STOCK</th>
                  <th>BARRILES</th>
                  <th>DIAS P.</th>
                  <th colSpan={2} style={{ textAlign: 'center' }}>ESTILO PROXIMO + TIPO PINTA</th>
                  <th>PROVEEDOR</th>
                  <th>STOCK</th>
                  <th>BARRILES</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const tipo = r.tipoActual || ''
                  return (
                    <tr key={r.num} className={tipo ? `tp-${tipo}` : ''}>
                      <td style={{ fontWeight: 'bold' }}>{r.num}</td>
                      <td className="left" style={{ fontWeight: r.hasPinchada ? 'bold' : undefined, color: r.hasPinchada ? undefined : '#999', fontStyle: r.hasPinchada ? undefined : 'italic' }}>
                        {r.estiloActual || '-'}
                      </td>
                      <td className={r.tipoActual ? `bdg-${r.tipoActual}` : ''} style={{ width: 22, fontWeight: 'bold' }}>
                        {r.tipoActual || '-'}
                      </td>
                      <td>{r.hasPinchada ? r.provActual : '-'}</td>
                      <td>{r.stockA || ''}</td>
                      <td>{r.hasPinchada ? ptAprox(r.aproxA) : '-'}</td>
                      <td>{r.dias}</td>
                      <td className="left" style={{ color: r.estiloP ? undefined : '#ccc', fontStyle: r.estiloP ? undefined : 'italic' }}>
                        {r.estiloP || '-'}
                      </td>
                      <td className={r.tipoP ? `bdg-${r.tipoP}` : ''} style={{ width: 22, fontWeight: 'bold' }}>
                        {r.tipoP || '-'}
                      </td>
                      <td>{r.estiloP ? r.provP : '-'}</td>
                      <td>{r.estiloP ? (r.stockP || '') : ''}</td>
                      <td>{r.estiloP ? ptAprox(r.aproxP) : '-'}</td>
                    </tr>
                  )
                })}
                <tr className="sec-hdr">
                  <td colSpan={12}>STOCK SIN PINCHAR</td>
                </tr>
                {sinPinchar.map((sp, i) => (
                  <tr key={i} className={sp.tipo ? `tp-${sp.tipo}` : ''}>
                    <td>-</td>
                    <td className="left">{sp.estilo}</td>
                    <td className={sp.tipo ? `bdg-${sp.tipo}` : ''} style={{ fontWeight: 'bold' }}>{sp.tipo || '-'}</td>
                    <td>{sp.proveedor}</td>
                    <td>{sp.litros || '-'}</td>
                    <td colSpan={7}></td>
                  </tr>
                ))}
                {Array.from({ length: emptyRows }, (_, i) => (
                  <tr key={`ep-${i}`}><td>-</td><td colSpan={11}></td></tr>
                ))}
              </tbody>
            </table>
          )
        })()}
      </div>,
      document.body
    )}

    <div className="space-y-5">

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
        <button onClick={handlePrintCanillas}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors">
          <Printer className="w-3.5 h-3.5" /> Imprimir
        </button>
        <button onClick={handleLimpiar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/40 text-xs font-medium text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> Limpiar
        </button>
        <select
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="w-auto min-w-[180px] text-sm rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-elevated text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/25 transition-all cursor-pointer"
        >
          {periodoOptions.map(f => (
            <option key={f} value={f}>{periodLabel(f)}{f === latestSaturday() ? ' ★' : f === nextSaturday() ? ' →' : ''}</option>
          ))}
        </select>
        <button onClick={handleEnviarStock} disabled={sendingAll || loading}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${sentAll ? 'bg-green-500 text-white' : 'bg-accent text-white hover:bg-accent/90'}`}>
          {sendingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : sentAll ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {sentAll ? 'Guardado' : 'Enviar Stock'}
        </button>
      </div>

      {/* Leyenda tipos */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TIPO_LABELS).map(([tipo, label]) => (
          <span key={tipo} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${TIPO_CLASS[tipo]}`}>
            <span className="font-bold">{tipo}</span>
            <span className="opacity-70">{label}</span>
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-dark-border shadow-sm">
        <table className="w-full bg-white dark:bg-dark-surface" style={{ borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            {/* Section labels */}
            <tr className="bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border">
              <th className={`${thCls} text-center w-10`} rowSpan={2} title="Arrastrá desde aquí para reordenar">#</th>
              <th colSpan={6} className={`${thCls} text-center text-accent border-r border-gray-200 dark:border-dark-border`}>
                ACTUAL
              </th>
              <th colSpan={5} className={`${thCls} text-center text-gray-400 dark:text-gray-500`}>
                PRÓXIMO — editable
              </th>
            </tr>
            {/* Column labels */}
            <tr className="bg-gray-50 dark:bg-dark-elevated border-b-2 border-gray-200 dark:border-dark-border">
              <th className={`${thCls} min-w-[140px]`}>Estilo</th>
              <th className={`${thCls} text-center`}>Tipo</th>
              <th className={`${thCls} min-w-[80px]`}>Proveedor</th>
              <th className={`${thCls} text-center`}>Stock</th>
              <th className={`${thCls} text-center`}>Barriles</th>
              <th className={`${thCls} text-center border-r-2 border-gray-200 dark:border-dark-border`}>Días P.</th>
              <th className={`${thCls} min-w-[150px]`}>Estilo</th>
              <th className={`${thCls} text-center`}>Tipo</th>
              <th className={`${thCls} min-w-[80px]`}>Proveedor</th>
              <th className={`${thCls} text-center`}>Stock</th>
              <th className={`${thCls} text-center`}>Barriles</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const localEa = localInputs.get(`${r.num}-ea`)
              const estiloDisplay = localEa !== undefined ? localEa : (r.estiloActual || '')
              const hasOverride = localEa !== undefined && localEa !== (r.estiloActual || '')
              const catDisplay = catalogoMap.get(estiloDisplay)
              const tipoDisplay = hasOverride ? (catDisplay?.tipo || '') : r.tipoActual
              const provDisplay = hasOverride
                ? (barriles.find(b => b.estilo === estiloDisplay)?.proveedor || '—')
                : r.provActual
              const barrilesDisplay = hasOverride ? '—' : r.aproxA
              const isActive = estiloDisplay !== ''
              const isDragging = dragFrom === r.num
              const isDropTarget = dragOver === r.num
              return (
              <tr key={r.num}
                onDragOver={e => handleDragOver(r.num, e)}
                onDrop={e => handleDrop(r.num, e)}
                onDragEnd={handleDragEnd}
                className={`transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-dark-elevated/20' : ''} ${isDragging ? 'opacity-40' : 'hover:bg-gray-50 dark:hover:bg-dark-elevated/60'} ${isDropTarget ? 'ring-2 ring-inset ring-accent' : ''}`}>
                {/* # — drag handle */}
                <td className={`${tdCls} text-center`}>
                  <div
                    draggable
                    onDragStart={e => handleDragStart(r.num, e)}
                    className="flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing select-none"
                    title="Arrastrar para intercambiar canilla"
                  >
                    <GripVertical className="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    <span className="font-bold text-gray-900 dark:text-gray-100">{r.num}</span>
                    {saving.has(r.num) && <span className="text-[7px] text-accent align-super">●</span>}
                  </div>
                </td>
                {/* ACTUAL — editable */}
                <td className={tdCls}>
                  <input
                    list="catalogo-estilos"
                    value={estiloDisplay}
                    onChange={e => setInput(r.num, 'ea', e.target.value)}
                    onBlur={e => {
                      const v = e.target.value
                      const orig = r.estiloActual || ''
                      setLocalInputs(prev => { const n = new Map(prev); n.delete(`${r.num}-ea`); return n })
                      if (v !== orig) handleActual(r.num, v)
                    }}
                    placeholder="— sin pinchar —"
                    className={`w-full bg-transparent text-xs placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-dark-elevated focus:bg-white dark:focus:bg-dark-elevated transition-colors ${isActive ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600 italic'}`}
                  />
                </td>
                <td className={`${tdCls} text-center`}><TipoBadge tipo={tipoDisplay} /></td>
                <td className={`${tdCls} text-gray-500 dark:text-gray-400 whitespace-nowrap`}>{isActive ? provDisplay : '—'}</td>
                <td className={`${tdCls} text-center`}>
                  <input
                    type="number" min="0"
                    data-cn="sc"
                    placeholder="L"
                    className="w-10 text-center text-xs bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-dark-border focus:border-accent focus:bg-white dark:focus:bg-dark-elevated rounded px-1 py-0.5 focus:outline-none transition-colors placeholder-gray-300 dark:placeholder-gray-600"
                    value={getInput(r.num, 'sc')}
                    onChange={e => setInput(r.num, 'sc', e.target.value)}
                    onBlur={() => saveStock(r.num, 'sc')}
                    onWheel={e => e.currentTarget.blur()}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const all = Array.from(document.querySelectorAll<HTMLInputElement>('[data-cn="sc"]')); const i = all.indexOf(e.currentTarget); all[i + 1]?.focus() } }}
                  />
                </td>
                <td className={`${tdCls} text-center font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap`}>{barrilesDisplay}</td>
                <td className={`${tdCls} text-center border-r-2 border-gray-200 dark:border-dark-border`}>
                  <DiasBadge dias={hasOverride ? '—' : r.dias} />
                </td>
                {/* PRÓXIMO — editable + drag handle propio */}
                <td
                  className={`${tdCls} ${dragOverProx === r.num ? 'ring-2 ring-inset ring-blue-400' : ''} ${dragFromProx === r.num ? 'opacity-40' : ''}`}
                  onDragOver={e => handleProxDragOver(r.num, e)}
                  onDrop={e => handleProxDrop(r.num, e)}
                  onDragEnd={handleProxDragEnd}
                >
                  <div className="flex items-center gap-1">
                    <div
                      draggable
                      onDragStart={e => handleProxDragStart(r.num, e)}
                      className="cursor-grab active:cursor-grabbing flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 select-none"
                      title="Arrastrar para intercambiar próximo"
                    >
                      <GripVertical className="w-3 h-3" />
                    </div>
                    <input
                      list="catalogo-estilos"
                      value={getProxInput(r.num)}
                      onChange={e => onProxChange(r.num, e.target.value)}
                      onBlur={e => onProxBlur(r.num, e.target.value)}
                      placeholder="— sin asignar —"
                      className="w-full bg-transparent text-xs text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-dark-elevated focus:bg-white dark:focus:bg-dark-elevated transition-colors"
                    />
                  </div>
                </td>
                <td className={`${tdCls} text-center`}><TipoBadge tipo={r.tipoP} /></td>
                <td className={`${tdCls} text-gray-500 dark:text-gray-400 whitespace-nowrap`}>{r.estiloP ? r.provP : '—'}</td>
                <td className={`${tdCls} text-center`}>
                  <input
                    type="number" min="0"
                    data-cn="scp"
                    className="w-10 text-center text-xs bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-dark-border focus:border-accent focus:bg-white dark:focus:bg-dark-elevated rounded px-1 py-0.5 focus:outline-none transition-colors"
                    value={getInput(r.num, 'scp')}
                    onChange={e => setInput(r.num, 'scp', e.target.value)}
                    onBlur={() => saveStock(r.num, 'scp')}
                    onWheel={e => e.currentTarget.blur()}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const all = Array.from(document.querySelectorAll<HTMLInputElement>('[data-cn="scp"]')); const i = all.indexOf(e.currentTarget); all[i + 1]?.focus() } }}
                  />
                </td>
                <td className={`${tdCls} text-center font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap`}>{r.aproxP}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <datalist id="catalogo-estilos">
        {catalogo.map(c => <option key={c.estilo} value={c.estilo} />)}
      </datalist>
    </div>
    </>
  )
}

// ── Pagina principal ──────────────────────────────────────────────────────────

type TabId = 'salon' | 'cocina' | 'cervezas'

export function StockGeneral() {
  const [tab, setTab] = useState<TabId>('salon')

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'salon',    label: 'Stocks Salon',   icon: Wine },
    { id: 'cocina',   label: 'Stocks Cocina',  icon: UtensilsCrossed },
    { id: 'cervezas', label: 'Stock Cervezas', icon: Droplets },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Stock General</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Planillas de stock y pedidos — Salon y Cocina</p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-100 dark:border-dark-border">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${tab === t.id ? 'border-accent text-accent' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      <div>
        {/* Salon y Cocina siempre montados para preservar estado no guardado */}
        <div style={{ display: tab === 'salon'  ? undefined : 'none' }}><PlanillaTab area="salon" /></div>
        <div style={{ display: tab === 'cocina' ? undefined : 'none' }}><PlanillaTab area="cocina" /></div>
        {tab === 'cervezas' && <StockCervezasTab />}
      </div>
    </div>
  )
}

// ── Estadísticas Tab ─────────────────────────────────────────────────────────

type EstModo = 'historico' | 'primer_dia'

interface EstData {
  resumen: { total_periodos: number; total_eventos_pedido: number; productos_pedidos: number; productos_con_stock: number }
  top_pedidos: { nombre: string; codigo: string; rubro_nombre: string; proveedor_nombre: string; unidad_pedido: string; total_pedido: number; veces_pedido: number; promedio_por_vez: number }[]
  por_rubro: { rubro_nombre: string; veces_pedido_total: number; productos_distintos: number; periodos_activos: number }[]
  por_proveedor: { proveedor_nombre: string; veces_pedido_total: number; productos_distintos: number }[]
  por_rubro_detalle: { rubro: string; productos: { nombre: string; total: number; unidad: string; veces: number }[] }[]
  evolucion_pedidos: { fecha: string; total_eventos_pedido: number; productos_pedidos: number }[]
  stock_stats: { nombre: string; codigo: string; rubro_nombre: string; unidad_stock: string; stock_promedio: number; stock_min: number; stock_max: number; periodos_registrados: number }[]
  catalog: { rubros: string[]; productos: { id: number; nombre: string; rubro_nombre: string }[] }
  modo: string
}

interface ProdSerie {
  producto_id: number
  nombre: string
  unidad: string
  serie: { fecha: string; pedido_norm: number | null; stock_prom: number | null }[]
}

function fmtQty(val: number, unit: string): string {
  const u = (unit ?? '').toLowerCase().trim()
  const useDec = u === 'kg' || u === 'l' || u === 'lt' || u === 'lts' || u === 'litros'
  const num = useDec ? val.toFixed(2) : Math.round(val).toLocaleString('es-AR')
  return unit ? `${num} ${unit}` : num
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-2xl font-black text-gray-900 dark:text-gray-100">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

function HBars({ items, labelKey, valueKey = 'veces_pedido', suffix = '' }: {
  items: any[]; labelKey: string; valueKey?: string; suffix?: string
}) {
  const max = Math.max(...items.map(i => Number(i[valueKey]) || 0), 1)
  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const val = Number(item[valueKey]) || 0
        const pct = Math.round((val / max) * 100)
        return (
          <div key={idx} className="flex items-center gap-3">
            <span className="w-36 text-sm text-right text-gray-700 dark:text-gray-300 truncate flex-shrink-0">{item[labelKey]}</span>
            <div className="flex-1 bg-gray-100 dark:bg-dark-elevated rounded-full h-4 overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-20 text-sm font-bold text-gray-900 dark:text-gray-100 text-right flex-shrink-0">
              {Math.round(val).toLocaleString('es-AR')}{suffix}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function EvolucionChart({ data }: { data: { fecha: string; total_eventos_pedido: number }[] }) {
  if (data.length < 2) return <p className="text-sm text-gray-400 text-center py-6">Insuficientes períodos para graficar</p>
  const W = 600, H = 110, PX = 38, PY = 10
  const maxVal = Math.max(...data.map(d => d.total_eventos_pedido), 1)
  const cx = (i: number) => PX + (i / (data.length - 1)) * (W - PX * 2)
  const cy = (v: number) => H - PY - (v / maxVal) * (H - PY * 2)
  const pts = data.map((d, i) => `${cx(i)},${cy(d.total_eventos_pedido)}`).join(' ')
  const area = `${cx(0)},${H - PY} ${pts} ${cx(data.length - 1)},${H - PY}`
  const tickEvery = Math.max(1, Math.ceil(data.length / 5))
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        <polygon points={area} fill="rgba(103,48,191,0.08)" />
        <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => <circle key={i} cx={cx(i)} cy={cy(d.total_eventos_pedido)} r="3" fill="#7c3aed" />)}
        {data.map((d, i) => (i % tickEvery === 0 || i === data.length - 1) && (
          <text key={i} x={cx(i)} y={H} fontSize="8" fill="#9ca3af" textAnchor="middle">{fmtDate(d.fecha)}</text>
        ))}
        {[0, 0.5, 1].map((pct, i) => {
          const yy = PY + pct * (H - PY * 2)
          return (
            <g key={i}>
              <line x1={PX} y1={yy} x2={W - PX} y2={yy} stroke="rgba(150,150,150,0.15)" strokeWidth="1" />
              <text x={PX - 4} y={yy + 4} fontSize="7" fill="#9ca3af" textAnchor="end">{Math.round(maxVal * (1 - pct))}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function SerieChart({ data }: { data: ProdSerie }) {
  const hasPedido = data.serie.some(d => d.pedido_norm != null && d.pedido_norm > 0)
  if (!hasPedido) return <p className="text-sm text-gray-400 text-center py-4">Sin datos de pedido para mostrar</p>

  const W = 640, H = 150, PX = 42, PY = 16
  const n = data.serie.length
  const maxV = Math.max(...data.serie.filter(d => d.pedido_norm != null).map(d => d.pedido_norm!), 1)
  const cx = (i: number) => PX + (i / Math.max(n - 1, 1)) * (W - PX * 2)
  const cy = (v: number) => H - PY - (v / maxV) * (H - PY * 2)
  const isSat = (s: string) => new Date(s + 'T12:00:00').getDay() === 6
  const is1st = (s: string) => s.slice(-2) === '01'

  const validPts = data.serie
    .map((d, i) => (d.pedido_norm != null && d.pedido_norm > 0) ? { x: cx(i), y: cy(d.pedido_norm) } : null)
    .filter((p): p is { x: number; y: number } => p !== null)

  const linePts = data.serie
    .map((d, i) => (d.pedido_norm != null && d.pedido_norm > 0) ? `${cx(i)},${cy(d.pedido_norm)}` : null)
    .filter(Boolean).join(' ')

  const areaPoints = validPts.length > 1 ? [
    `${validPts[0].x},${H - PY}`,
    ...validPts.map(p => `${p.x},${p.y}`),
    `${validPts[validPts.length - 1].x},${H - PY}`,
  ].join(' ') : ''

  const tickEvery = Math.max(1, Math.ceil(n / 7))

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-80" style={{ height: 165 }}>
        {[0, 0.33, 0.67, 1].map((pct, gi) => {
          const yy = PY + pct * (H - PY * 2)
          return (
            <g key={gi}>
              <line x1={PX} y1={yy} x2={W - PX} y2={yy} stroke="rgba(150,150,150,0.12)" strokeWidth="1" />
              <text x={PX - 4} y={yy + 3} fontSize="7" fill="#9ca3af" textAnchor="end">
                {(maxV * (1 - pct)).toFixed(maxV < 10 ? 1 : 0)}
              </text>
            </g>
          )
        })}
        {data.serie.map((d, i) => is1st(d.fecha) && (
          <line key={`v${i}`} x1={cx(i)} y1={PY} x2={cx(i)} y2={H - PY}
                stroke="rgba(234,179,8,0.3)" strokeWidth="1" strokeDasharray="3,2" />
        ))}
        {areaPoints && <polygon points={areaPoints} fill="rgba(103,48,191,0.07)" />}
        {linePts && <polyline points={linePts} fill="none" stroke="#7c3aed" strokeWidth="2"
                               strokeLinejoin="round" strokeLinecap="round" />}
        {data.serie.map((d, i) => {
          if (d.pedido_norm == null || d.pedido_norm <= 0) return null
          const x = cx(i), y = cy(d.pedido_norm)
          if (is1st(d.fecha)) return (
            <g key={i}>
              <circle cx={x} cy={y} r="6" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
              <circle cx={x} cy={y} r="3" fill="#f59e0b" />
            </g>
          )
          if (isSat(d.fecha)) return (
            <polygon key={i} points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`} fill="#f97316" />
          )
          return <circle key={i} cx={x} cy={y} r="3" fill="#7c3aed" />
        })}
        {data.serie.map((d, i) => {
          const show = i === 0 || i === n - 1 || is1st(d.fecha) || i % tickEvery === 0
          return show ? (
            <text key={`lbl${i}`} x={cx(i)} y={H} fontSize="7.5" fill="#9ca3af" textAnchor="middle">
              {fmtDate(d.fecha)}
            </text>
          ) : null
        })}
      </svg>
      <div className="flex items-center gap-5 mt-1 text-xs text-gray-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12"><circle cx="6" cy="6" r="3" fill="#7c3aed" /></svg>
          Normal
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12"><polygon points="6,1 11,6 6,11 1,6" fill="#f97316" /></svg>
          Sábado
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14">
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="7" cy="7" r="2.5" fill="#f59e0b" />
          </svg>
          1° de mes
        </span>
      </div>
    </div>
  )
}

function ConfigPanel({
  catalog, excludeRubros, excludeProductos, onToggleRubro, onToggleProd, onClear,
}: {
  catalog: EstData['catalog']
  excludeRubros: string[]
  excludeProductos: number[]
  onToggleRubro: (r: string) => void
  onToggleProd: (id: number) => void
  onClear: () => void
}) {
  const [search, setSearch] = useState('')
  const totalExcl = excludeRubros.length + excludeProductos.length
  const filtered = catalog.productos.filter(p =>
    !search ||
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.rubro_nombre.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="card p-5 space-y-4 border border-accent/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          Configuración de estadísticas
          {totalExcl > 0 && (
            <span className="text-xs font-semibold text-white bg-accent rounded-full px-2 py-0.5">
              {totalExcl} excluido{totalExcl !== 1 ? 's' : ''}
            </span>
          )}
        </p>
        {totalExcl > 0 && (
          <button onClick={onClear} className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">
            Limpiar exclusiones
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Rubros <span className="font-normal normal-case">(desmarcar para excluir)</span>
          </p>
          <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
            {catalog.rubros.map(rubro => (
              <label key={rubro} className="flex items-center gap-2 cursor-pointer rounded px-1 py-1 hover:bg-gray-50 dark:hover:bg-dark-elevated">
                <input type="checkbox" checked={!excludeRubros.includes(rubro)}
                  onChange={() => onToggleRubro(rubro)} className="accent-accent" />
                <span className={`text-sm ${excludeRubros.includes(rubro) ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {rubro}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Productos{excludeProductos.length > 0
              ? ` (${excludeProductos.length} excluido${excludeProductos.length !== 1 ? 's' : ''})`
              : ' (desmarcar para excluir)'}
          </p>
          <input type="text" placeholder="Buscar producto o rubro..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 placeholder-gray-400" />
          <div className="space-y-0.5 max-h-44 overflow-y-auto pr-1">
            {filtered.map(p => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-dark-elevated">
                <input type="checkbox" checked={!excludeProductos.includes(p.id)}
                  onChange={() => onToggleProd(p.id)} className="accent-accent flex-shrink-0" />
                <span className={`text-xs flex-1 min-w-0 truncate ${excludeProductos.includes(p.id) ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {p.nombre}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">{p.rubro_nombre}</span>
              </label>
            ))}
            {filtered.length === 0 && <p className="text-xs text-gray-400 px-1 py-2">Sin resultados</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductoSerieSection({ catalog }: { catalog: EstData['catalog'] }) {
  const [selectedId, setSelectedId] = useState<number | ''>('')
  const [serie, setSerie] = useState<ProdSerie | null>(null)
  const [loadingSerie, setLoadingSerie] = useState(false)

  useEffect(() => {
    if (!selectedId) { setSerie(null); return }
    setLoadingSerie(true)
    setSerie(null)
    stockGeneralApi.getProductoSerie(Number(selectedId))
      .then(setSerie)
      .catch(console.error)
      .finally(() => setLoadingSerie(false))
  }, [selectedId])

  const byRubro = catalog.productos.reduce<Record<string, typeof catalog.productos>>((acc, p) => {
    ;(acc[p.rubro_nombre] ??= []).push(p)
    return acc
  }, {})

  return (
    <div className="card p-5 space-y-4">
      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Serie histórica por producto</p>
      <select value={selectedId} onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : '')}
        className="w-full md:w-auto text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100">
        <option value="">Seleccioná un producto...</option>
        {Object.entries(byRubro).map(([rubro, prods]) => (
          <optgroup key={rubro} label={rubro}>
            {prods.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </optgroup>
        ))}
      </select>
      {loadingSerie && (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin text-accent" />
        </div>
      )}
      {serie && !loadingSerie && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {serie.nombre} · {serie.serie.length} períodos registrados · unidad: {serie.unidad}
          </p>
          <SerieChart data={serie} />
        </div>
      )}
    </div>
  )
}

function EstadisticasTab() {
  const [modo, setModo] = useState<EstModo>('historico')
  const [tipoEst, setTipoEst] = useState<'pedidos' | 'stock'>('pedidos')
  const [data, setData] = useState<EstData | null>(null)
  const [loading, setLoading] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [catalogCache, setCatalogCache] = useState<EstData['catalog'] | null>(null)
  const [periodos, setPeriodos] = useState<string[]>([])
  const [periodoDesde, setPeriodoDesde] = useState<string>('')
  const [periodoHasta, setPeriodoHasta] = useState<string>('')

  const [excludeRubros, setExcludeRubros] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('stats_excl_rubros') || '[]') } catch { return [] }
  })
  const [excludeProductos, setExcludeProductos] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('stats_excl_productos') || '[]') } catch { return [] }
  })

  useEffect(() => {
    stockGeneralApi.getPeriodos().then(p => setPeriodos(p)).catch(() => setPeriodos([]))
  }, [])

  useEffect(() => {
    localStorage.setItem('stats_excl_rubros', JSON.stringify(excludeRubros))
    localStorage.setItem('stats_excl_productos', JSON.stringify(excludeProductos))
  }, [excludeRubros, excludeProductos])

  useEffect(() => {
    setLoading(true)
    setData(null)
    stockGeneralApi.getEstadisticas(
      modo, excludeRubros, excludeProductos,
      periodoDesde || undefined,
      periodoHasta || undefined,
    )
      .then(d => { setData(d); if (d?.catalog) setCatalogCache(d.catalog) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [modo, excludeRubros, excludeProductos, periodoDesde, periodoHasta])

  const handleToggleRubro = (r: string) =>
    setExcludeRubros(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  const handleToggleProd = (id: number) =>
    setExcludeProductos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const handleClearExcl = () => { setExcludeRubros([]); setExcludeProductos([]) }

  const mBtnCls = (active: boolean) =>
    `px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${active
      ? 'bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 shadow-sm'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`

  const totalExcl = excludeRubros.length + excludeProductos.length

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ver:</span>
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-dark-elevated">
          <button onClick={() => setTipoEst('pedidos')} className={mBtnCls(tipoEst === 'pedidos')}>Estadística de Pedidos</button>
          <button onClick={() => setTipoEst('stock')} className={mBtnCls(tipoEst === 'stock')}>Estadística de Stock</button>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Analizar:</span>
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-dark-elevated">
          <button onClick={() => setModo('historico')} className={mBtnCls(modo === 'historico')}>Histórico completo</button>
          <button onClick={() => setModo('primer_dia')} className={mBtnCls(modo === 'primer_dia')}>Solo 1eros de mes</button>
        </div>
        <button
          onClick={() => setConfigOpen(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${configOpen
            ? 'border-accent text-accent bg-accent/5'
            : 'border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 hover:border-accent/50'}`}
        >
          ⚙ Config{totalExcl > 0 && (
            <span className="ml-1 text-xs bg-accent text-white rounded-full px-1.5 py-0.5 leading-none">{totalExcl}</span>
          )}
        </button>
      </div>

      {periodos.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Período:</span>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={periodoDesde}
              onChange={e => setPeriodoDesde(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
            >
              <option value="">Desde el inicio</option>
              {periodos.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span className="text-sm text-gray-400">→</span>
            <select
              value={periodoHasta}
              onChange={e => setPeriodoHasta(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
            >
              <option value="">Hasta el último</option>
              {periodos.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {(periodoDesde || periodoHasta) && (
              <button
                onClick={() => { setPeriodoDesde(''); setPeriodoHasta('') }}
                className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors px-2 py-1.5"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {configOpen && catalogCache && (
        <ConfigPanel
          catalog={catalogCache}
          excludeRubros={excludeRubros}
          excludeProductos={excludeProductos}
          onToggleRubro={handleToggleRubro}
          onToggleProd={handleToggleProd}
          onClear={handleClearExcl}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-accent" />
        </div>
      )}

      {!loading && !data && <p className="text-center py-20 text-sm text-gray-400">Sin datos</p>}

      {!loading && data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Períodos" value={data.resumen.total_periodos} />
            <StatCard label="Eventos de pedido" value={(data.resumen.total_eventos_pedido ?? 0).toLocaleString('es-AR')} sub="registros totales" />
            <StatCard label="Productos pedidos" value={data.resumen.productos_pedidos} sub="distintos" />
            <StatCard label="Con stock registrado" value={data.resumen.productos_con_stock} sub="productos" />
          </div>

          {tipoEst === 'pedidos' && <p className="text-xs font-bold uppercase tracking-widest text-accent pt-2">Pedidos</p>}

          {tipoEst === 'pedidos' && data.top_pedidos.length > 0 && (
            <div className="card p-5 space-y-3">
              <div className="flex items-end justify-between gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Top productos — frecuencia de pedido</p>
                <p className="text-xs text-gray-400 italic">gr→kg · ml→l normalizados</p>
              </div>
              <HBars items={data.top_pedidos} labelKey="nombre" valueKey="veces_pedido" suffix="×" />
            </div>
          )}

          {tipoEst === 'pedidos' && (data.por_rubro.length > 0 || data.por_proveedor.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.por_rubro.length > 0 && (
                <div className="card p-5 space-y-3">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    Por rubro <span className="font-normal text-xs text-gray-400">(veces pedido)</span>
                  </p>
                  <HBars items={data.por_rubro} labelKey="rubro_nombre" valueKey="veces_pedido_total" suffix="×" />
                </div>
              )}
              {data.por_proveedor.length > 0 && (
                <div className="card p-5 space-y-3">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    Por proveedor <span className="font-normal text-xs text-gray-400">(veces pedido)</span>
                  </p>
                  <HBars items={data.por_proveedor} labelKey="proveedor_nombre" valueKey="veces_pedido_total" suffix="×" />
                </div>
              )}
            </div>
          )}

          {tipoEst === 'pedidos' && data.por_rubro_detalle.length > 0 && (
            <div className="card p-5 space-y-4">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Top 3 productos por rubro</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.por_rubro_detalle.map((rg, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-dark-elevated rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-accent truncate">{rg.rubro}</p>
                    {rg.productos.map((p: any, j: number) => (
                      <div key={j} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{p.nombre}</span>
                        <span className="text-xs font-medium text-gray-500 flex-shrink-0 whitespace-nowrap">
                          {p.veces}× · {fmtQty(p.total, p.unidad)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tipoEst === 'pedidos' && data.evolucion_pedidos.length > 0 && (
            <div className="card p-5 space-y-3">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Evolución de eventos de pedido por período</p>
              <EvolucionChart data={data.evolucion_pedidos} />
            </div>
          )}

          {tipoEst === 'pedidos' && <p className="text-xs font-bold uppercase tracking-widest text-accent pt-2">Análisis por producto</p>}
          {tipoEst === 'pedidos' && <ProductoSerieSection catalog={data.catalog} />}

          {tipoEst === 'pedidos' && data.top_pedidos.length > 0 && (
            <div className="card p-5 space-y-3">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Detalle por producto</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-dark-border text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <th className="text-left py-2">Producto</th>
                      <th className="text-left py-2 hidden md:table-cell">Proveedor</th>
                      <th className="text-right py-2">Veces</th>
                      <th className="text-right py-2">Vol. total</th>
                      <th className="text-right py-2 hidden sm:table-cell">Prom./vez</th>
                      <th className="text-right py-2">Consistencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_pedidos.map((p, i) => {
                      const pct = data.resumen.total_periodos > 0
                        ? Math.round((p.veces_pedido / data.resumen.total_periodos) * 100)
                        : 0
                      return (
                        <tr key={i} className="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-elevated/50">
                          <td className="py-2">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{p.nombre}</div>
                            <div className="text-xs text-gray-400">{p.rubro_nombre}</div>
                          </td>
                          <td className="py-2 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">{p.proveedor_nombre}</td>
                          <td className="py-2 text-right font-bold text-accent">{p.veces_pedido}×</td>
                          <td className="py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtQty(p.total_pedido, p.unidad_pedido)}</td>
                          <td className="py-2 text-right text-gray-500 hidden sm:table-cell whitespace-nowrap">{fmtQty(p.promedio_por_vez, p.unidad_pedido)}</td>
                          <td className="py-2 text-right">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              pct >= 70 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : pct >= 40 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                              : 'bg-gray-100 dark:bg-dark-elevated text-gray-500'}`}>
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tipoEst === 'stock' && <p className="text-xs font-bold uppercase tracking-widest text-accent pt-2">Análisis por producto</p>}
          {tipoEst === 'stock' && <ProductoSerieSection catalog={data.catalog} />}

          {tipoEst === 'stock' && data.stock_stats.length > 0 && (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-accent pt-2">Stock</p>
              <div className="card p-5 space-y-3">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Promedios de stock por producto</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-dark-border text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        <th className="text-left py-2">Producto</th>
                        <th className="text-left py-2 hidden sm:table-cell">Rubro</th>
                        <th className="text-right py-2">Promedio</th>
                        <th className="text-right py-2">Mín</th>
                        <th className="text-right py-2">Máx</th>
                        <th className="text-right py-2 hidden sm:table-cell">Períodos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stock_stats.map((s, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-elevated/50">
                          <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{s.nombre}</td>
                          <td className="py-2 text-xs text-gray-500 dark:text-gray-400 hidden sm:table-cell">{s.rubro_nombre}</td>
                          <td className="py-2 text-right font-bold text-accent whitespace-nowrap">
                            {s.stock_promedio} <span className="text-xs font-normal text-gray-400">{s.unidad_stock}</span>
                          </td>
                          <td className="py-2 text-right text-gray-500">{s.stock_min}</td>
                          <td className="py-2 text-right text-gray-500">{s.stock_max}</td>
                          <td className="py-2 text-right text-gray-400 hidden sm:table-cell">{s.periodos_registrados}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function HistorialStocks() {
  const [tab, setTab] = useState<'historial' | 'estadisticas'>('historial')
  const tabCls = (active: boolean) =>
    `px-5 py-2 rounded-lg text-sm font-semibold transition-all ${active
      ? 'bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 shadow-sm'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
          <History className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Historial de Stocks</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Registro histórico de todos los períodos</p>
        </div>
      </div>
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-dark-elevated w-fit">
        <button onClick={() => setTab('historial')} className={tabCls(tab === 'historial')}>Historial</button>
        <button onClick={() => setTab('estadisticas')} className={tabCls(tab === 'estadisticas')}>Estadísticas</button>
      </div>
      {tab === 'historial' && <HistorialTab />}
      {tab === 'estadisticas' && <EstadisticasTab />}
    </div>
  )
}

// ── Cervezas Config Tab ────────────────────────────────────────────────────────

function CervezasConfigTab() {
  const [catalogo, setCatalogo] = useState<CatalogEntry[]>([])
  const [umbrales, setUmbrales] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      barrilesApi.catalogo('1'),
      stockGeneralApi.getUmbrales(),
    ]).then(([cat, umbs]) => {
      setCatalogo(cat)
      const map: Record<string, string> = {}
      for (const u of umbs) map[u.estilo] = u.umbral
      setUmbrales(map)
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async (estilo: string, val: string) => {
    setSaving(prev => ({ ...prev, [estilo]: true }))
    try {
      await stockGeneralApi.saveUmbral(estilo, val)
    } finally {
      setSaving(prev => ({ ...prev, [estilo]: false }))
    }
  }

  if (loading) return <div className="text-center py-10 text-xs text-gray-400">Cargando...</div>

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Ingresá el umbral de alerta por estilo. Si el stock de barriles es igual o menor al umbral, aparece un aviso en Central de Pedidos.
      </p>
      <div className="border border-gray-100 dark:border-dark-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-dark-elevated text-gray-500 text-xs uppercase">
              <th className="px-4 py-2.5 text-left font-semibold">Estilo</th>
              <th className="px-3 py-2.5 text-center font-semibold">Tipo</th>
              <th className="px-3 py-2.5 text-center font-semibold w-36">Umbral alerta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-dark-border/50">
            {catalogo.map(c => (
              <tr key={c.estilo} className="hover:bg-gray-50/50 dark:hover:bg-dark-elevated/30">
                <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{c.estilo}</td>
                <td className="px-3 py-2 text-center"><TipoBadge tipo={c.tipo} /></td>
                <td className="px-3 py-2 text-center">
                  <div className="relative flex items-center justify-center gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={umbrales[c.estilo] ?? ''}
                      onChange={e => setUmbrales(prev => ({ ...prev, [c.estilo]: e.target.value }))}
                      onBlur={e => handleSave(c.estilo, e.target.value)}
                      placeholder="0"
                      className="w-20 text-center border border-gray-200 dark:border-dark-border rounded-lg px-2 py-1 text-xs bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    {saving[c.estilo] && <RefreshCw className="w-3 h-3 text-accent animate-spin" />}
                  </div>
                </td>
              </tr>
            ))}
            {catalogo.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-xs text-gray-400">No hay estilos en el catálogo</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GeneralConfigTab() {
  const [pct, setPct]       = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    appConfigApi.getValesObjetivoPct()
      .then(v => setPct(v))
      .catch(() => setPct(15))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (pct === '' || pct < 1 || pct > 100) {
      setError('El porcentaje debe estar entre 1 y 100')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await appConfigApi.setValesObjetivoPct(pct)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Error al guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Monitor de Vales</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Porcentaje objetivo de vales sobre el total cobrado del turno.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Objetivo de vales (%)</label>
          {loading ? (
            <div className="h-9 rounded-lg bg-gray-100 dark:bg-dark-elevated animate-pulse" />
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                step={0.5}
                value={pct}
                onChange={e => { setPct(e.target.value === '' ? '' : parseFloat(e.target.value)); setSaved(false) }}
                className="input w-28 tabular-nums"
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Afecta el monitor de vales en tiempo real y el dashboard.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving || loading} className="btn-primary text-xs">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
              <Check className="w-3.5 h-3.5" /> Guardado
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

type ConfigTabId = 'general' | 'productos' | 'rubros' | 'proveedores' | 'cervezas'

export function ConfiguracionStock() {
  const [tab, setTab] = useState<ConfigTabId>('general')
  const tabs: { id: ConfigTabId; label: string; icon: React.ElementType }[] = [
    { id: 'general',     label: 'General',     icon: Settings2 },
    { id: 'productos',   label: 'Productos',   icon: Package },
    { id: 'rubros',      label: 'Rubros',      icon: FolderOpen },
    { id: 'proveedores', label: 'Proveedores', icon: Truck },
    { id: 'cervezas',    label: 'Cervezas',    icon: Droplets },
  ]
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Configuraciones</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Parámetros generales, productos, rubros, proveedores y umbrales</p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-gray-100 dark:border-dark-border">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${tab === t.id ? 'border-accent text-accent' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>
      <div>
        {tab === 'general'     && <GeneralConfigTab />}
        {tab === 'productos'   && <ProductosTab />}
        {tab === 'rubros'      && <RubrosTab />}
        {tab === 'proveedores' && <ProveedoresTab />}
        {tab === 'cervezas'    && <CervezasConfigTab />}
      </div>
    </div>
  )
}

export function CentralPedidos() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Central de Pedidos</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Gestión de pedidos a proveedores</p>
        </div>
      </div>
      <CentralPedidosTab />
    </div>
  )
}

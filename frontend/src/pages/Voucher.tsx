import { useState, useEffect, useCallback } from 'react'
import {
  Users, Plus, Trash2, Search, RefreshCw, X,
  ChevronLeft, ChevronRight, AlertTriangle, Check, Edit2,
  ShoppingBag, Wallet, TrendingUp, Settings, Minus,
} from 'lucide-react'
import { voucherApi, type VProductoCatalogo, type VRubroConfig } from '../lib/api'
import { useToast, ToastContainer, type ToastType } from '../components/ui/Toast'
import { Spinner } from '../components/ui/Spinner'
import { formatCurrency } from '../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Empleado = { id: number; nombre: string; apellido: string; activo: number; created_at: string }
type Producto = { codigo: string; nombre: string; precio: number; categoria: string }
type Entrada  = { id: number; empleado_id: number; periodo: string; producto_nombre: string; producto_precio: number; cantidad: number; tipo: string; fecha: string | null; created_at: string }
type Resumen  = { empleado_id: number; periodo: string; presupuesto_base: number; extra: number; presupuesto_total: number; total_consumos: number; total_descuentos: number; total_gastado: number; diferencia: number; excedido: boolean }
type CartItem = { producto: Producto; cantidad: number }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodoLabel(p: string) {
  const [y, m] = p.split('-')
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${names[parseInt(m) - 1]} ${y}`
}

function periodoActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function periodoAnterior(p: string) {
  const [y, m] = p.split('-').map(Number)
  const d = new Date(y, m - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function periodoSiguiente(p: string) {
  const [y, m] = p.split('-').map(Number)
  const d = new Date(y, m)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayAR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function fmtFecha(f: string | null): string {
  if (!f) return '—'
  const [, m, d] = f.split('-')
  return `${d}/${m}`
}

// ─── Period Selector ─────────────────────────────────────────────────────────

function PeriodSelector({ value, onChange }: { value: string; onChange: (p: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(periodoAnterior(value))}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-elevated text-gray-500 transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[130px] text-center">
        {periodoLabel(value)}
      </span>
      <button onClick={() => onChange(periodoSiguiente(value))}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-elevated text-gray-500 transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

function TabResumen({ empleados, addToast }: {
  empleados: Empleado[]
  addToast: (t: 'success'|'error'|'warning', m: string) => void
}) {
  const [periodo, setPeriodo] = useState(periodoActual)
  const [resumenes, setResumenes] = useState<Resumen[]>([])
  const [entradas, setEntradas]   = useState<Entrada[]>([])
  const [configPres, setConfigPres] = useState(75000)
  const [loading, setLoading] = useState(false)

  // ── Config presupuesto global ──
  const [editingConfig, setEditingConfig] = useState(false)
  const [newConfigVal, setNewConfigVal]   = useState('')
  const [savingConfig, setSavingConfig]   = useState(false)

  // ── Extra individual ──
  const [editingExtraId, setEditingExtraId] = useState<number | null>(null)
  const [newExtra, setNewExtra]             = useState('')
  const [savingExtra, setSavingExtra]       = useState(false)

  // ── Add product modal (carrito) ──
  const [showAdd, setShowAdd]           = useState(false)
  const [addEmpleadoId, setAddEmpleadoId] = useState<number | null>(null)
  const [addFecha, setAddFecha]         = useState(todayAR)
  const [productos, setProductos]       = useState<Producto[]>([])
  const [loadingP, setLoadingP]         = useState(false)
  const [searchP, setSearchP]           = useState('')
  const [cart, setCart]                 = useState<CartItem[]>([])
  const [adding, setAdding]             = useState(false)

  // ── Descuento modal ──
  const [showDesc, setShowDesc]         = useState(false)
  const [descEmpleadoId, setDescEmpleadoId] = useState<number | null>(null)
  const [descFecha, setDescFecha]       = useState(todayAR)
  const [descNombre, setDescNombre]     = useState('')
  const [descMonto, setDescMonto]       = useState('')
  const [savingDesc, setSavingDesc]     = useState(false)

  const empMap = Object.fromEntries(empleados.map(e => [e.id, e]))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, res, ent] = await Promise.all([
        voucherApi.getConfigPresupuesto(),
        voucherApi.getResumenPeriodo(periodo),
        voucherApi.getEntradasPeriodo(periodo),
      ])
      setConfigPres(cfg.presupuesto_base)
      setResumenes(res)
      setEntradas(ent)
    } catch { addToast('error', 'Error cargando datos') }
    finally { setLoading(false) }
  }, [periodo, addToast])

  useEffect(() => { load() }, [load])

  // ── Config ──
  async function handleSaveConfig() {
    const val = parseInt(newConfigVal)
    if (!val || val < 0) return
    setSavingConfig(true)
    try {
      const r = await voucherApi.setConfigPresupuesto(val)
      setConfigPres(r.presupuesto_base)
      addToast('success', 'Presupuesto base actualizado')
      setEditingConfig(false)
      load()
    } catch { addToast('error', 'Error guardando configuración') }
    finally { setSavingConfig(false) }
  }

  // ── Extra ──
  async function handleSaveExtra(empleadoId: number) {
    const val = parseInt(newExtra) || 0
    setSavingExtra(true)
    try {
      await voucherApi.updatePresupuesto(empleadoId, periodo, val)
      addToast('success', 'Extra actualizado')
      setEditingExtraId(null)
      load()
    } catch { addToast('error', 'Error guardando extra') }
    finally { setSavingExtra(false) }
  }

  // ── Cart ──
  function openAdd(empleadoId: number) {
    setAddEmpleadoId(empleadoId)
    setCart([])
    setSearchP('')
    setAddFecha(todayAR())
    setShowAdd(true)
    loadProductos('')
  }

  async function loadProductos(q: string) {
    setLoadingP(true)
    try { setProductos(await voucherApi.getProductos(q || undefined)) }
    catch { addToast('error', 'Error cargando productos') }
    finally { setLoadingP(false) }
  }

  function cartAdd(p: Producto) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.producto.codigo === p.codigo)
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], cantidad: n[idx].cantidad + 1 }; return n }
      return [...prev, { producto: p, cantidad: 1 }]
    })
  }

  function cartSetQty(codigo: string, qty: number) {
    if (qty < 1) setCart(prev => prev.filter(i => i.producto.codigo !== codigo))
    else setCart(prev => prev.map(i => i.producto.codigo === codigo ? { ...i, cantidad: qty } : i))
  }

  async function handleAdd() {
    if (!addEmpleadoId || cart.length === 0) return
    setAdding(true)
    try {
      await Promise.all(cart.map(({ producto, cantidad }) =>
        voucherApi.addEntrada(addEmpleadoId, { periodo, producto_nombre: producto.nombre, producto_precio: producto.precio, cantidad, tipo: 'consumo', fecha: addFecha })
      ))
      addToast('success', `${cart.length === 1 ? '1 producto agregado' : `${cart.length} productos agregados`}`)
      setShowAdd(false)
      load()
    } catch { addToast('error', 'Error agregando productos') }
    finally { setAdding(false) }
  }

  // ── Descuento ──
  function openDesc(empleadoId: number) {
    setDescEmpleadoId(empleadoId)
    setDescNombre('')
    setDescMonto('')
    setDescFecha(todayAR())
    setShowDesc(true)
  }

  async function handleDesc() {
    if (!descEmpleadoId || !descNombre.trim() || !descMonto) return
    const monto = parseInt(descMonto)
    if (!monto || monto <= 0) { addToast('warning', 'Ingresá un monto válido'); return }
    setSavingDesc(true)
    try {
      await voucherApi.addEntrada(descEmpleadoId, { periodo, producto_nombre: descNombre.trim(), producto_precio: monto, cantidad: 1, tipo: 'descuento', fecha: descFecha })
      addToast('success', 'Descuento registrado')
      setShowDesc(false)
      load()
    } catch { addToast('error', 'Error registrando descuento') }
    finally { setSavingDesc(false) }
  }

  // ── Delete ──
  async function handleDelete(id: number) {
    try { await voucherApi.deleteEntrada(id); addToast('success', 'Eliminado'); load() }
    catch { addToast('error', 'Error eliminando') }
  }

  // ── KPIs ──
  const totalGastado     = resumenes.reduce((s, r) => s + r.total_gastado, 0)
  const totalPresupuesto = resumenes.reduce((s, r) => s + r.presupuesto_total, 0)
  const totalDisponible  = totalPresupuesto - totalGastado
  const excedidos        = resumenes.filter(r => r.excedido)

  const filteredP = productos.filter(p =>
    !searchP || p.nombre.toLowerCase().includes(searchP.toLowerCase()) || (p.categoria||'').toLowerCase().includes(searchP.toLowerCase())
  )
  const cartTotal = cart.reduce((s, i) => s + i.producto.precio * i.cantidad, 0)

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSelector value={periodo} onChange={p => { setPeriodo(p); setResumenes([]); setEntradas([]) }} />
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {/* Config presupuesto global */}
      <div className="flex items-center gap-3 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl px-4 py-2.5">
        <Settings className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className="text-xs text-gray-500 dark:text-gray-400">Presupuesto base mensual:</span>
        {editingConfig ? (
          <div className="flex items-center gap-2">
            <input type="number" value={newConfigVal} onChange={e => setNewConfigVal(e.target.value)}
              className="input w-28 text-sm py-1" placeholder="75000" autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSaveConfig(); if (e.key === 'Escape') setEditingConfig(false) }} />
            <button onClick={handleSaveConfig} disabled={savingConfig}
              className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors">
              {savingConfig ? <Spinner size="sm" /> : <Check className="w-3 h-3" />}
            </button>
            <button onClick={() => setEditingConfig(false)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{formatCurrency(configPres)}</span>
            <button onClick={() => { setNewConfigVal(String(configPres)); setEditingConfig(true) }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors">
              <Edit2 className="w-3 h-3" /> Editar
            </button>
          </>
        )}
      </div>

      {/* KPI cards */}
      {resumenes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Total gastado',    value: formatCurrency(totalGastado),     icon: Wallet,     color: 'text-primary' },
            { label: 'Presupuesto total', value: formatCurrency(totalPresupuesto), icon: TrendingUp, color: 'text-gray-700 dark:text-gray-200' },
            { label: totalDisponible >= 0 ? 'Disponible' : 'Excedido',
              value: formatCurrency(Math.abs(totalDisponible)), icon: Check,
              color: totalDisponible >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500' },
            { label: 'Empleados excedidos', value: `${excedidos.length}/${resumenes.length}`, icon: AlertTriangle,
              color: excedidos.length > 0 ? 'text-red-500' : 'text-green-600' },
          ].map(k => (
            <div key={k.label} className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border px-3.5 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <k.icon className={`w-3.5 h-3.5 ${k.color}`} />
                <p className="text-[11px] text-gray-500 leading-tight">{k.label}</p>
              </div>
              <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : resumenes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Sin empleados activos para este período</div>
      ) : (

        /* ── Dos paneles lado a lado ── */
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,_440px)_1fr] gap-4 items-start">

          {/* ── Panel izquierdo: cards por empleado ── */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-0.5">
              Presupuesto empleados
            </p>

            {resumenes.map(r => {
              const emp = empMap[r.empleado_id]
              const pct = Math.min((r.total_gastado / Math.max(r.presupuesto_total, 1)) * 100, 100)
              const disponible = r.presupuesto_total - r.total_gastado
              return (
                <div key={r.empleado_id}
                  className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border px-4 py-3 space-y-2">

                  {/* Fila 1: nombre + botones */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {emp ? `${emp.apellido}, ${emp.nombre}` : `#${r.empleado_id}`}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                        Presp. {formatCurrency(r.presupuesto_total)}
                        {r.total_descuentos > 0 && <span className="text-green-500"> · −{formatCurrency(r.total_descuentos)} desc.</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => openAdd(r.empleado_id)}
                        className="flex items-center gap-0.5 px-2 py-1 text-[11px] font-semibold bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                        <Plus className="w-3 h-3" /> Cons.
                      </button>
                      <button onClick={() => openDesc(r.empleado_id)}
                        className="flex items-center gap-0.5 px-2 py-1 text-[11px] font-semibold bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                        <Minus className="w-3 h-3" /> Desc.
                      </button>
                    </div>
                  </div>

                  {/* Fila 2: barra de progreso */}
                  <div className="h-1.5 bg-gray-100 dark:bg-dark-elevated rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${r.excedido ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-green-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Fila 3: stats + extra */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] tabular-nums">
                      <span className="text-gray-500 dark:text-gray-400">
                        {formatCurrency(r.total_gastado)} <span className="text-gray-400 dark:text-gray-600">gastado</span>
                      </span>
                      <span className={`font-semibold ${r.excedido ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                        {r.excedido ? `−${formatCurrency(Math.abs(disponible))} exc.` : `+${formatCurrency(disponible)} libre`}
                      </span>
                    </div>
                    {/* Extra editable */}
                    {editingExtraId === r.empleado_id ? (
                      <div className="flex items-center gap-1">
                        <input type="number" value={newExtra} onChange={e => setNewExtra(e.target.value)}
                          className="input py-0.5 px-1.5 text-[11px] w-20" autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveExtra(r.empleado_id); if (e.key === 'Escape') setEditingExtraId(null) }} />
                        <button onClick={() => handleSaveExtra(r.empleado_id)} disabled={savingExtra} className="p-0.5 text-green-600">
                          {savingExtra ? <Spinner size="sm" /> : <Check className="w-3 h-3" />}
                        </button>
                        <button onClick={() => setEditingExtraId(null)} className="p-0.5 text-gray-400"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingExtraId(r.empleado_id); setNewExtra(String(r.extra)) }}
                        className="flex items-center gap-0.5 text-[11px] text-gray-400 hover:text-primary transition-colors">
                        <Edit2 className="w-2.5 h-2.5" />
                        extra: {formatCurrency(r.extra)}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

          </div>

          {/* ── Panel derecho: Detalle movimientos ── */}
          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-0.5">
              Movimientos — {periodoLabel(periodo)}
            </p>
            {entradas.length === 0 ? (
              <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border flex flex-col items-center justify-center py-16 text-gray-300 dark:text-gray-600">
                <ShoppingBag className="w-8 h-8 mb-2" />
                <p className="text-xs">Sin movimientos en este período</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[480px]">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-elevated">
                        <th className="text-left px-2.5 py-2 font-semibold text-gray-400 uppercase tracking-wide w-12">Fecha</th>
                        <th className="text-left px-2.5 py-2 font-semibold text-gray-400 uppercase tracking-wide">Empleado</th>
                        <th className="text-left px-2.5 py-2 font-semibold text-gray-400 uppercase tracking-wide">Descripción</th>
                        <th className="px-2.5 py-2 font-semibold text-gray-400 uppercase tracking-wide text-center w-20">Tipo</th>
                        <th className="text-right px-2.5 py-2 font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                        <th className="w-8 px-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {[...entradas].sort((a, b) => {
                        const fa = a.fecha || a.created_at
                        const fb = b.fecha || b.created_at
                        return fb.localeCompare(fa)
                      }).map(e => {
                        const emp = empMap[e.empleado_id]
                        const esDesc = e.tipo === 'descuento'
                        return (
                          <tr key={e.id} className="border-b border-gray-50 dark:border-dark-border/50 hover:bg-gray-50/50 dark:hover:bg-dark-elevated/30">
                            <td className="px-2.5 py-2 tabular-nums text-gray-400 dark:text-gray-500 whitespace-nowrap">
                              {fmtFecha(e.fecha)}
                            </td>
                            <td className="px-2.5 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {emp ? emp.apellido : `#${e.empleado_id}`}
                            </td>
                            <td className="px-2.5 py-2 text-gray-800 dark:text-gray-200 font-medium max-w-[180px] truncate">
                              {e.producto_nombre}
                            </td>
                            <td className="px-2.5 py-2 text-center">
                              <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                esDesc
                                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                              }`}>
                                {esDesc ? <Minus className="w-2 h-2" /> : <Plus className="w-2 h-2" />}
                                {esDesc ? 'desc.' : 'cons.'}
                              </span>
                            </td>
                            <td className={`px-2.5 py-2 text-right tabular-nums font-semibold whitespace-nowrap ${esDesc ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-gray-200'}`}>
                              {esDesc ? '−' : ''}{formatCurrency(e.producto_precio * e.cantidad)}
                            </td>
                            <td className="px-1 py-2">
                              <button onClick={() => handleDelete(e.id)}
                                className="p-1 rounded text-gray-200 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Agregar consumición ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-dark-border shrink-0">
              <div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Agregar consumición — {addEmpleadoId && empMap[addEmpleadoId] ? `${empMap[addEmpleadoId].apellido}, ${empMap[addEmpleadoId].nombre}` : ''}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Hacé clic en un producto para agregarlo al carrito</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            {/* Fecha selector */}
            <div className="px-5 py-2 border-b border-gray-50 dark:border-dark-border/50 shrink-0 flex items-center gap-3 bg-gray-50/50 dark:bg-dark-elevated/30">
              <label className="text-xs font-medium text-gray-500 shrink-0">Fecha del consumo:</label>
              <input type="date" value={addFecha} onChange={e => setAddFecha(e.target.value)}
                className="input text-xs py-1 px-2 w-36" />
            </div>

            <div className="flex flex-col sm:flex-row flex-1 min-h-0">
              {/* Left: productos */}
              <div className="flex flex-col sm:w-[55%] border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-dark-border min-h-0">
                <div className="px-4 pt-3 pb-2 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input type="text" value={searchP}
                      onChange={e => { setSearchP(e.target.value); loadProductos(e.target.value) }}
                      placeholder="Buscar producto…" className="input pl-8 text-sm" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-3">
                  {loadingP ? <div className="flex justify-center py-8"><Spinner /></div>
                  : filteredP.length === 0 ? <p className="text-center text-sm text-gray-400 py-8">Sin resultados</p>
                  : (
                    <div className="space-y-0.5">
                      {filteredP.slice(0, 100).map(p => {
                        const inCart = cart.find(i => i.producto.codigo === p.codigo)
                        return (
                          <button key={p.codigo} onClick={() => cartAdd(p)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              inCart ? 'bg-primary/10 border border-primary/20 text-primary' : 'hover:bg-gray-50 dark:hover:bg-dark-elevated text-gray-700 dark:text-gray-300'
                            }`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate text-xs">{p.nombre}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                {inCart && <span className="text-[10px] bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">{inCart.cantidad}</span>}
                                <span className="text-xs font-semibold text-gray-500">{formatCurrency(p.precio)}</span>
                              </div>
                            </div>
                            {p.categoria && <span className="text-[10px] text-gray-400">{p.categoria}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              {/* Right: cart */}
              <div className="flex flex-col sm:w-[45%] min-h-0">
                <div className="px-4 pt-3 pb-2 shrink-0 border-b border-gray-50 dark:border-dark-border/50">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Carrito {cart.length > 0 && `· ${cart.length} ítem${cart.length > 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-2">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 py-6">
                      <ShoppingBag className="w-7 h-7 mb-2" />
                      <p className="text-xs">Agregá productos desde la izquierda</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {cart.map(({ producto, cantidad }) => (
                        <div key={producto.codigo} className="flex items-center gap-2 bg-gray-50 dark:bg-dark-elevated rounded-lg px-2.5 py-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{producto.nombre}</p>
                            <p className="text-[10px] text-gray-400">{formatCurrency(producto.precio)} c/u</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => cartSetQty(producto.codigo, cantidad - 1)}
                              className="w-5 h-5 rounded border border-gray-200 dark:border-dark-border flex items-center justify-center text-gray-500 text-xs hover:bg-white dark:hover:bg-dark-surface transition-colors">−</button>
                            <span className="w-5 text-center text-xs font-bold text-gray-800 dark:text-gray-100">{cantidad}</span>
                            <button onClick={() => cartSetQty(producto.codigo, cantidad + 1)}
                              className="w-5 h-5 rounded border border-gray-200 dark:border-dark-border flex items-center justify-center text-gray-500 text-xs hover:bg-white dark:hover:bg-dark-surface transition-colors">+</button>
                          </div>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 w-14 text-right shrink-0">{formatCurrency(producto.precio * cantidad)}</span>
                          <button onClick={() => setCart(prev => prev.filter(i => i.producto.codigo !== producto.codigo))}
                            className="text-gray-300 hover:text-red-400 transition-colors"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {cart.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-dark-border shrink-0 bg-gray-50 dark:bg-dark-elevated rounded-br-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">Total a agregar</span>
                      <span className="text-sm font-bold text-primary">{formatCurrency(cartTotal)}</span>
                    </div>
                    <button onClick={handleAdd} disabled={adding} className="w-full btn-primary text-sm py-2">
                      {adding ? <Spinner size="sm" /> : `Confirmar ${cart.length === 1 ? '1 producto' : `${cart.length} productos`}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Descuento ── */}
      {showDesc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowDesc(false)}>
          <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border shadow-2xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-border">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                Descuento — {descEmpleadoId && empMap[descEmpleadoId] ? `${empMap[descEmpleadoId].apellido}, ${empMap[descEmpleadoId].nombre}` : ''}
              </h3>
              <button onClick={() => setShowDesc(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fecha</label>
                <input type="date" value={descFecha} onChange={e => setDescFecha(e.target.value)} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descripción</label>
                <input type="text" value={descNombre} onChange={e => setDescNombre(e.target.value)}
                  placeholder="Ej: Devolución uniforme" className="input text-sm" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Monto (ARS)</label>
                <input type="number" value={descMonto} onChange={e => setDescMonto(e.target.value)}
                  placeholder="Ej: 5000" className="input text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') handleDesc() }} />
              </div>
              <p className="text-[11px] text-gray-400">Se restará del consumido en {periodoLabel(periodo)}.</p>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={handleDesc} disabled={savingDesc || !descNombre.trim() || !descMonto}
                className="flex-1 btn-primary text-sm">
                {savingDesc ? <Spinner size="sm" /> : 'Registrar descuento'}
              </button>
              <button onClick={() => setShowDesc(false)} className="btn-secondary text-sm px-4">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Empleados ───────────────────────────────────────────────────────────

function TabEmpleados({ empleados, onRefresh, addToast }: {
  empleados: Empleado[]
  onRefresh: () => void
  addToast: (t: 'success'|'error'|'warning', m: string) => void
}) {
  const [nombre, setNombre]   = useState('')
  const [apellido, setApellido] = useState('')
  const [saving, setSaving]   = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !apellido.trim()) { addToast('warning', 'Completá nombre y apellido'); return }
    setSaving(true)
    try {
      await voucherApi.createEmpleado(nombre.trim(), apellido.trim())
      addToast('success', 'Empleado creado')
      setNombre(''); setApellido('')
      onRefresh()
    } catch { addToast('error', 'Error creando empleado') }
    finally { setSaving(false) }
  }

  async function handleToggle(emp: Empleado) {
    try { await voucherApi.updateEmpleado(emp.id, { activo: emp.activo ? 0 : 1 }); onRefresh() }
    catch { addToast('error', 'Error actualizando empleado') }
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-5">
        <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Agregar empleado
        </h3>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2.5 items-end">
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan" className="input" />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Apellido</label>
            <input value={apellido} onChange={e => setApellido(e.target.value)} placeholder="García" className="input" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary px-4">
            {saving ? <Spinner size="sm" /> : 'Agregar'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-elevated">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Empleados</h3>
        </div>
        {empleados.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Sin empleados creados</div>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-dark-border/50">
            {empleados.map(e => (
              <li key={e.id} className="flex items-center justify-between px-4 py-2.5">
                <span className={`text-sm ${e.activo ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 line-through'}`}>
                  {e.apellido}, {e.nombre}
                </span>
                <button onClick={() => handleToggle(e)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    e.activo
                      ? 'bg-gray-50 dark:bg-dark-elevated text-gray-500 border-gray-200 dark:border-dark-border hover:border-red-300 hover:text-red-500'
                      : 'bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200 dark:border-green-800'
                  }`}>
                  {e.activo ? 'Desactivar' : 'Activar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Productos ───────────────────────────────────────────────────────────

function ToggleSwitch({ on, disabled, onToggle, title }: { on: boolean; disabled?: boolean; onToggle: () => void; title?: string }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={title}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-wait ${
        on ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-border'
      }`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
        on ? 'translate-x-4' : 'translate-x-0'
      }`} />
    </button>
  )
}

function TabProductos({ addToast }: { addToast: (type: ToastType, msg: string) => void }) {
  const [productos, setProductos] = useState<VProductoCatalogo[]>([])
  const [rubros, setRubros] = useState<VRubroConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [togglingRubro, setTogglingRubro] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, rubs] = await Promise.all([voucherApi.getProductosConfig(), voucherApi.getRubrosConfig()])
      setProductos(prods)
      setRubros(rubs)
    } catch { addToast('error', 'Error cargando productos') }
    finally { setLoading(false) }
  }, [addToast])

  useEffect(() => { load() }, [load])

  const rubroMap = rubros.reduce<Record<string, boolean>>((acc, r) => { acc[r.rubro] = r.habilitado; return acc }, {})

  const toggleProducto = async (codigo: string, actual: boolean) => {
    setToggling(prev => new Set(prev).add(codigo))
    setProductos(prev => prev.map(p => p.codigo === codigo ? { ...p, habilitado: !actual } : p))
    try {
      await voucherApi.setProductoHabilitado(codigo, !actual)
    } catch {
      setProductos(prev => prev.map(p => p.codigo === codigo ? { ...p, habilitado: actual } : p))
      addToast('error', 'Error actualizando producto')
    } finally {
      setToggling(prev => { const s = new Set(prev); s.delete(codigo); return s })
    }
  }

  const toggleRubro = async (rubro: string, actual: boolean) => {
    setTogglingRubro(prev => new Set(prev).add(rubro))
    setRubros(prev => prev.map(r => r.rubro === rubro ? { ...r, habilitado: !actual } : r))
    try {
      await voucherApi.setRubroHabilitado(rubro, !actual)
    } catch {
      setRubros(prev => prev.map(r => r.rubro === rubro ? { ...r, habilitado: actual } : r))
      addToast('error', 'Error actualizando rubro')
    } finally {
      setTogglingRubro(prev => { const s = new Set(prev); s.delete(rubro); return s })
    }
  }

  const q = busqueda.toLowerCase().trim()
  const filtrados = q
    ? productos.filter(p => p.nombre.toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q))
    : productos

  const grupos = filtrados.reduce<Record<string, VProductoCatalogo[]>>((acc, p) => {
    const cat = p.categoria || 'Sin categoría'
    ;(acc[cat] = acc[cat] || []).push(p)
    return acc
  }, {})
  const cats = Object.keys(grupos).sort()

  const totalHab = productos.filter(p => p.habilitado && (rubroMap[p.categoria] !== false)).length
  const totalDes = productos.length - totalHab

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-green-600 dark:text-green-400">{totalHab} habilitados</span>
            {totalDes > 0 && <span className="ml-2 text-gray-400">· {totalDes} deshabilitados</span>}
          </p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o categoría…"
          className="input pl-9 w-full text-sm"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtrados.length === 0 ? (
        <p className="text-center text-gray-400 py-12 text-sm">Sin resultados</p>
      ) : (
        <div className="space-y-4">
          {cats.map(cat => {
            const rubroHab = rubroMap[cat] !== false
            return (
              <div key={cat}>
                {/* Category header with toggle */}
                <div className={`flex items-center justify-between mb-2 px-0.5 ${!rubroHab ? 'opacity-60' : ''}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${rubroHab ? 'text-gray-400' : 'text-red-400 line-through'}`}>
                    {cat}
                  </p>
                  <div className="flex items-center gap-2">
                    {!rubroHab && (
                      <span className="text-[10px] text-red-400 font-medium">Rubro deshabilitado</span>
                    )}
                    <ToggleSwitch
                      on={rubroHab}
                      disabled={togglingRubro.has(cat)}
                      onToggle={() => toggleRubro(cat, rubroHab)}
                      title={rubroHab ? `Deshabilitar rubro ${cat}` : `Habilitar rubro ${cat}`}
                    />
                  </div>
                </div>
                {/* Products */}
                <div className={`space-y-1.5 ${!rubroHab ? 'opacity-50 pointer-events-none' : ''}`}>
                  {grupos[cat].map(p => (
                    <div key={p.codigo}
                      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
                        p.habilitado
                          ? 'bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border'
                          : 'bg-gray-50 dark:bg-dark-elevated border-gray-200 dark:border-dark-border opacity-60'
                      }`}>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${p.habilitado ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                          {p.nombre}
                        </p>
                        <p className="text-xs text-gray-400 tabular-nums">{formatCurrency(p.precio)}</p>
                      </div>
                      <ToggleSwitch
                        on={p.habilitado}
                        disabled={toggling.has(p.codigo)}
                        onToggle={() => toggleProducto(p.codigo, p.habilitado)}
                        title={p.habilitado ? 'Deshabilitar para voucher' : 'Habilitar para voucher'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'empleados' | 'productos'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen',   label: 'Resumen',   icon: TrendingUp },
  { id: 'empleados', label: 'Empleados', icon: Users },
  { id: 'productos', label: 'Productos', icon: ShoppingBag },
]

export default function Voucher() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const { toasts, addToast, removeToast } = useToast()

  const loadEmpleados = useCallback(async () => {
    setLoading(true)
    try { setEmpleados(await voucherApi.getEmpleados(true)) }
    catch { addToast('error', 'Error cargando empleados') }
    finally { setLoading(false) }
  }, [addToast])

  useEffect(() => { loadEmpleados() }, [loadEmpleados])

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Voucher</h1>
        <p className="text-sm text-gray-500 mt-0.5">Beneficio mensual de empleados</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-dark-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'productos' ? (
        <TabProductos addToast={addToast} />
      ) : loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          {tab === 'resumen'   && <TabResumen   empleados={empleados} addToast={addToast} />}
          {tab === 'empleados' && <TabEmpleados empleados={empleados} onRefresh={loadEmpleados} addToast={addToast} />}
        </>
      )}
    </div>
  )
}

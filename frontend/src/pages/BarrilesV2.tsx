import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Beer, RefreshCw, Plus, Edit2, Check, X,
  Package, Archive, TrendingDown, Settings, BookOpen,
  User, DollarSign, ChevronDown, ChevronUp, Download,
  FlaskConical, Search, ArrowUpDown, ArrowUp, ArrowDown,
  History, ShieldAlert,
} from 'lucide-react'
import { barrilesV2Api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui/Spinner'
import { useToast, ToastContainer } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { getErrorMessage, arToday } from '../lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Light: badge sólido. Dark: tinte + texto brillante
const TIPO_COLORS: Record<string, string> = {
  A:   'bg-amber-400   text-amber-950  dark:bg-amber-400/20   dark:text-amber-300',
  B:   'bg-sky-500     text-white       dark:bg-sky-500/20     dark:text-sky-300',
  C:   'bg-emerald-500 text-white       dark:bg-emerald-500/20 dark:text-emerald-300',
  D:   'bg-violet-500  text-white       dark:bg-violet-500/20  dark:text-violet-300',
  E:   'bg-rose-500    text-white       dark:bg-rose-500/20    dark:text-rose-300',
  GIN: 'bg-pink-400    text-pink-950   dark:bg-pink-400/20    dark:text-pink-300',
  T:   'bg-red-500     text-white       dark:bg-red-500/20     dark:text-red-300',
}

// Acento izquierdo en los cards de canilla — div bg para evitar conflicto con dark:border-*
const TIPO_ACCENT: Record<string, string> = {
  A:   'bg-amber-400',
  B:   'bg-sky-500',
  C:   'bg-emerald-500',
  D:   'bg-violet-500',
  E:   'bg-rose-500',
  GIN: 'bg-pink-400',
  T:   'bg-red-500',
}

const ESTADO_COLORS: Record<string, string> = {
  'En Camara':    'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  'Pinchada':     'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  'Para Retirar': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  'Retirada':     'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500',
}

function todayDDMMYYYY(): string {
  const [y, m, d] = arToday().split('-')
  return `${d}/${m}/${y}`
}

function toInputDate(ddmmyyyy: string): string {
  if (!ddmmyyyy) return ''
  const p = ddmmyyyy.split('/')
  if (p.length !== 3) return ''
  return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
}

function fromInputDate(yyyymmdd: string): string {
  if (!yyyymmdd) return ''
  const p = yyyymmdd.split('-')
  if (p.length !== 3) return ''
  return `${p[2]}/${p[1]}/${p[0]}`
}

function diasPinchadoColor(dias: number | null): string {
  if (dias === null) return 'text-gray-400'
  if (dias <= 31)  return 'text-green-600 dark:text-green-400 font-semibold'
  if (dias <= 60)  return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-red-600 dark:text-red-400 font-bold'
}

type Tab = 'activos' | 'historial' | 'ingresar' | 'catalogo' | 'config' | 'auditoria'

// ─── Main component ───────────────────────────────────────────────────────────

export default function BarrilesV2() {
  const [tab, setTab] = useState<Tab>('activos')
  const { toasts, addToast, removeToast } = useToast()
  const [editBarril, setEditBarril] = useState<any | null>(null)
  const { user } = useAuth()
  const isSalon = user?.role === 'salon'
  const isAdmin = user?.role === 'admin'

  // Shared data
  const [barriles, setBarriles]       = useState<any[]>([])
  const [birras, setBirras]           = useState<any[]>([])
  const [personal, setPersonal]       = useState<any[]>([])
  const [precios, setPrecios]         = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [loading, setLoading]         = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [bArr, bBirras, bPersonal, bPrecios, bProveedores] = await Promise.all([
        barrilesV2Api.getBarriles(),
        barrilesV2Api.getBirras(),
        barrilesV2Api.getPersonal(),
        barrilesV2Api.getPrecios(),
        barrilesV2Api.getProveedores(),
      ])
      setBarriles(bArr)
      setBirras(bBirras)
      setPersonal(bPersonal)
      setPrecios(bPrecios)
      setProveedores(bProveedores)
    } catch (e) {
      addToast('error', `Error cargando datos: ${getErrorMessage(e)}`)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { loadAll() }, [loadAll])

  const personalNames = personal.filter(p => p.activo).map(p => p.nombre)

  const ALL_TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'activos',    label: 'Activos',    icon: Beer },
    { id: 'historial',  label: 'Historial',  icon: Archive },
    { id: 'ingresar',   label: 'Ingresar',   icon: Plus },
    { id: 'catalogo',   label: 'Catálogo',   icon: BookOpen },
    { id: 'config',     label: 'Config',     icon: Settings },
    ...(isAdmin ? [{ id: 'auditoria' as Tab, label: 'Auditoría', icon: ShieldAlert }] : []),
  ]
  const TABS = isSalon ? ALL_TABS.filter(t => t.id === 'activos') : ALL_TABS

  return (
    <div className="p-4 space-y-4 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Barriles
          </h1>
        </div>
        <button onClick={loadAll} disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-dark-border overflow-x-auto">
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

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}
      {!loading && (
        <>
          {tab === 'activos'    && <TabActivos   barriles={barriles} personal={personalNames} onSaved={loadAll} addToast={addToast} onEdit={setEditBarril} />}
          {tab === 'historial'  && <TabHistorial  barriles={barriles} personal={personalNames} onSaved={loadAll} addToast={addToast} onEdit={setEditBarril} />}
          {tab === 'ingresar'   && <TabIngresar   birras={birras} onSaved={loadAll} addToast={addToast} />}
          {tab === 'catalogo'   && <TabCatalogo   birras={birras} proveedores={proveedores} onSaved={loadAll} addToast={addToast} />}
          {tab === 'config'     && <TabConfig     personal={personal} precios={precios} proveedores={proveedores} onSaved={loadAll} addToast={addToast} />}
          {tab === 'auditoria'  && isAdmin && <TabAuditoria addToast={addToast} />}
        </>
      )}

      {editBarril && (
        <EditBarrilModal barril={editBarril} personal={personalNames}
          onClose={() => setEditBarril(null)} onSaved={loadAll} addToast={addToast} />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

// ─── EditBarrilModal ──────────────────────────────────────────────────────────

function EditBarrilModal({ barril, personal, onClose, onSaved, addToast }: {
  barril: any; personal: string[]; onClose: () => void; onSaved: () => void
  addToast: (t: 'success'|'error'|'warning', m: string) => void
}) {
  const [form, setForm] = useState({
    litros:            String(barril.litros || ''),
    codigo:            barril.codigo || '',
    ingreso_at:        toInputDate(barril.ingreso_at || ''),
    fecha_pinchado:    toInputDate(barril.fecha_pinchado || ''),
    nombre_pincho:     barril.nombre_pincho || '',
    turno_pinchado:    barril.turno_pinchado || 'Mañana',
    canilla:           String(barril.canilla || ''),
    fecha_despinchado: toInputDate(barril.fecha_despinchado || ''),
    nombre_despincho:  barril.nombre_despincho || '',
    turno_despinchado: barril.turno_despinchado || 'Mañana',
    fecha_retirado:    toInputDate(barril.fecha_retirado || ''),
    nota:              barril.nota || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (key: string) => (val: string) => setForm(p => ({...p, [key]: val}))

  async function handleSave() {
    setSaving(true)
    try {
      await barrilesV2Api.updateBarril(barril.id, {
        litros:            parseInt(form.litros) || undefined,
        codigo:            form.codigo.trim() || null,
        ingreso_at:        fromInputDate(form.ingreso_at) || undefined,
        fecha_pinchado:    fromInputDate(form.fecha_pinchado) || null,
        nombre_pincho:     form.nombre_pincho || null,
        turno_pinchado:    form.turno_pinchado || null,
        canilla:           form.canilla ? parseInt(form.canilla) : null,
        fecha_despinchado: fromInputDate(form.fecha_despinchado) || null,
        nombre_despincho:  form.nombre_despincho || null,
        turno_despinchado: form.turno_despinchado || null,
        fecha_retirado:    fromInputDate(form.fecha_retirado) || null,
        nota:              form.nota.trim() || null,
      })
      addToast('success', 'Barril actualizado')
      onClose()
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Editar — ${barril.estilo}`}>
      <div className="space-y-4 p-1 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-dark-elevated rounded-lg px-3 py-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_COLORS[barril.tipo] || 'bg-gray-400 text-white'}`}>{barril.tipo}</span>
          <span className="text-gray-700 dark:text-gray-200 font-medium">{barril.estilo}</span>
          <span className="ml-auto text-xs text-gray-400 font-mono">{barril.proveedor}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Litros">
            <input type="number" value={form.litros} onChange={e => set('litros')(e.target.value)} className="input" min={1} />
          </FormField>
          <FormField label="Código">
            <input type="text" value={form.codigo} onChange={e => set('codigo')(e.target.value)} className="input" />
          </FormField>
          <FormField label="Fecha ingreso">
            <input type="date" value={form.ingreso_at} onChange={e => set('ingreso_at')(e.target.value)} className="input" />
          </FormField>
        </div>

        <div>
          <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">Pinchado</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha pinchado">
              <input type="date" value={form.fecha_pinchado} onChange={e => set('fecha_pinchado')(e.target.value)} className="input" />
            </FormField>
            <FormField label="Canilla">
              <input type="number" value={form.canilla} onChange={e => set('canilla')(e.target.value)} className="input" min={1} max={20} />
            </FormField>
            <FormField label="Quien pinchó">
              <PersonalSelect value={form.nombre_pincho} onChange={set('nombre_pincho')} personal={personal} />
            </FormField>
            <FormField label="Turno">
              <TurnoSelect value={form.turno_pinchado} onChange={set('turno_pinchado')} />
            </FormField>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">Despinchado</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha despinchado">
              <input type="date" value={form.fecha_despinchado} onChange={e => set('fecha_despinchado')(e.target.value)} className="input" />
            </FormField>
            <FormField label="Quien despinchó">
              <PersonalSelect value={form.nombre_despincho} onChange={set('nombre_despincho')} personal={personal} />
            </FormField>
            <FormField label="Turno">
              <TurnoSelect value={form.turno_despinchado} onChange={set('turno_despinchado')} />
            </FormField>
            <FormField label="Fecha retirado">
              <input type="date" value={form.fecha_retirado} onChange={e => set('fecha_retirado')(e.target.value)} className="input" />
            </FormField>
          </div>
        </div>

        <FormField label="Nota">
          <textarea value={form.nota} onChange={e => set('nota')(e.target.value)} className="input resize-none" rows={2} />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Spinner size="sm" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Tab Activos ─────────────────────────────────────────────────────────────

function TabActivos({ barriles, personal, onSaved, addToast, onEdit }: {
  barriles: any[]; personal: string[]; onSaved: () => void
  addToast: (t: 'success'|'error'|'warning', m: string) => void
  onEdit: (b: any) => void
}) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string>('estilo')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')

  function handleSort(key: string) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function cmpVal(b: any, key: string): string | number {
    switch (key) {
      case 'estilo':  return (b.estilo  || '').toLowerCase()
      case 'tipo':    return (b.tipo    || '').toLowerCase()
      case 'litros':  return b.litros  || 0
      case 'codigo':  return (b.codigo  || '').toLowerCase()
      case 'ingreso': {
        const p = (b.ingreso_at || '').split('/')
        return p.length === 3 ? `${p[2]}${p[1]}${p[0]}` : b.ingreso_at || ''
      }
      default: return ''
    }
  }

  const q = search.trim().toLowerCase()
  const match = (b: any) => !q || [b.estilo, b.proveedor, b.codigo, b.tipo, String(b.canilla ?? '')]
    .some(v => (v || '').toLowerCase().includes(q))

  const pinchadas = barriles.filter(b => b.estado === 'Pinchada' && match(b))

  const enCamara = [...barriles.filter(b => b.estado === 'En Camara' && match(b))]
    .sort((a, b) => {
      const av = cmpVal(a, sortKey), bv = cmpVal(b, sortKey)
      const dir = sortDir === 'asc' ? 1 : -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'es') * dir
    })
  const totalActivos = barriles.filter(b => b.estado === 'Pinchada' || b.estado === 'En Camara')

  const [modal, setModal] = useState<{ type: 'pinchar'|'despinchar'; barril: any } | null>(null)
  const [form, setForm]   = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [pincharSiguiente, setPincharSiguiente] = useState(true)
  const [siguienteId, setSiguienteId] = useState<number | null>(null)

  const todosEnCamara = barriles.filter((b: any) => b.estado === 'En Camara')

  function openPinchar(b: any) {
    setForm({ fecha_pinchado: toInputDate(todayDDMMYYYY()), nombre_pincho: '', turno_pinchado: 'Mañana', canilla: '' })
    setModal({ type: 'pinchar', barril: b })
  }
  function openDespinchar(b: any) {
    setForm({ fecha_despinchado: toInputDate(todayDDMMYYYY()), nombre_despincho: '', turno_despinchado: 'Mañana' })
    setPincharSiguiente(true)
    setSiguienteId(null)
    setModal({ type: 'despinchar', barril: b })
  }

  async function handleSubmit() {
    if (!modal) return
    setSaving(true)
    try {
      if (modal.type === 'pinchar') {
        if (!form.fecha_pinchado || !form.nombre_pincho || !form.canilla) {
          addToast('warning', 'Completá fecha, quien pincha y canilla')
          return
        }
        await barrilesV2Api.updateBarril(modal.barril.id, {
          fecha_pinchado: fromInputDate(form.fecha_pinchado),
          nombre_pincho:  form.nombre_pincho,
          turno_pinchado: form.turno_pinchado,
          canilla:        parseInt(form.canilla),
        })
        addToast('success', `Barril pinchado en canilla ${form.canilla}`)
      } else {
        if (!form.fecha_despinchado || !form.nombre_despincho) {
          addToast('warning', 'Completá fecha y quien despincha')
          return
        }
        const canillaOriginal = modal.barril.canilla
        await barrilesV2Api.updateBarril(modal.barril.id, {
          fecha_despinchado: fromInputDate(form.fecha_despinchado),
          nombre_despincho:  form.nombre_despincho,
          turno_despinchado: form.turno_despinchado,
          canilla: null,
        })
        if (pincharSiguiente && siguienteId !== null) {
          const sig = todosEnCamara.find((b: any) => b.id === siguienteId)
          if (sig) {
            await barrilesV2Api.updateBarril(sig.id, {
              fecha_pinchado: fromInputDate(form.fecha_despinchado),
              nombre_pincho:  form.nombre_despincho,
              turno_pinchado: form.turno_despinchado,
              canilla:        canillaOriginal,
            })
            addToast('success', `${modal.barril.estilo} despinchado · ${sig.estilo} pinchado en C${canillaOriginal}`)
          } else {
            addToast('success', 'Barril despinchado')
          }
        } else {
          addToast('success', 'Barril despinchado')
        }
      }
      setModal(null)
      onSaved()
    } catch (e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por estilo, proveedor, código…"
          className="input pl-8 text-sm py-1.5 w-full"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Pinchadas */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Beer className="w-5 h-5 text-green-500" />
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            Pinchadas <span className="text-sm text-gray-400 ml-1">({pinchadas.length}{q ? `/${totalActivos.filter(b=>b.estado==='Pinchada').length}` : ''})</span>
          </h2>
        </div>
        {pinchadas.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-600 italic">No hay barriles pinchados</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {pinchadas.sort((a,b) => (a.canilla||99)-(b.canilla||99)).map(b => (
              <BarrilPinchadoCard key={b.id} barril={b} onDespinchar={() => openDespinchar(b)} onEdit={() => onEdit(b)} />
            ))}
          </div>
        )}
      </section>

      {/* En Camara */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            En Cámara <span className="text-sm text-gray-400 ml-1">({enCamara.length}{q ? `/${totalActivos.filter(b=>b.estado==='En Camara').length}` : ''})</span>
          </h2>
        </div>
        {enCamara.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-600 italic">No hay barriles en cámara</p>
        ) : (
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-x-auto">
            <table className="w-full text-sm min-w-[540px]">
              <thead className="bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border">
                <tr>
                  {([
                    { label: 'Estilo',  key: 'estilo'  },
                    { label: 'Tipo',    key: 'tipo'    },
                    { label: 'Litros',  key: 'litros'  },
                    { label: 'Código',  key: 'codigo'  },
                    { label: 'Ingreso', key: 'ingreso' },
                    { label: '',        key: ''        },
                  ] as { label: string; key: string }[]).map(col => (
                    <th key={col.key || '__actions'}
                      onClick={col.key ? () => handleSort(col.key) : undefined}
                      className={`px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap
                        ${col.key ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none' : ''}`}>
                      {col.key ? (
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key
                            ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />)
                            : <ArrowUpDown className="w-3 h-3 opacity-25" />}
                        </span>
                      ) : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {enCamara.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-dark-elevated">
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{b.estilo}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_COLORS[b.tipo] || 'bg-gray-400 text-white'}`}>{b.tipo}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{b.litros}L</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-500 font-mono text-xs">{b.codigo || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{b.ingreso_at}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => onEdit(b)}
                          className="text-xs bg-gray-50 dark:bg-dark-elevated text-gray-500 dark:text-gray-400 hover:bg-gray-100 border border-gray-200 dark:border-dark-border px-2 py-1 rounded-lg transition-colors">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => openPinchar(b)}
                          className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-lg font-medium transition-colors">
                          Pinchar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Para Retirar */}
      <ParaRetirarSection barriles={barriles} onSaved={onSaved} addToast={addToast} onEdit={onEdit} />

      {/* Modal Pinchar / Despinchar */}
      {modal && (
        <Modal open={!!modal} onClose={() => setModal(null)}
          title={modal.type === 'pinchar' ? `Pinchar — ${modal.barril.estilo}` : `Despinchar — ${modal.barril.estilo}`}>
          <div className="space-y-4 p-1">
            {modal.type === 'pinchar' ? (
              <>
                <FormField label="Fecha de pinchado">
                  <input type="date" value={form.fecha_pinchado || ''} onChange={e => setForm({...form, fecha_pinchado: e.target.value})}
                    className="input" />
                </FormField>
                <FormField label="Quien pincha">
                  <PersonalSelect value={form.nombre_pincho} onChange={v => setForm({...form, nombre_pincho: v})} personal={personal} />
                </FormField>
                <FormField label="Turno">
                  <TurnoSelect value={form.turno_pinchado} onChange={v => setForm({...form, turno_pinchado: v})} />
                </FormField>
                <FormField label="Canilla (1-20)">
                  <input type="number" min={1} max={20} value={form.canilla || ''} onChange={e => setForm({...form, canilla: e.target.value})}
                    placeholder="Número de canilla" className="input" />
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Fecha de despinchado">
                  <input type="date" value={form.fecha_despinchado || ''} onChange={e => setForm({...form, fecha_despinchado: e.target.value})}
                    className="input" />
                </FormField>
                <FormField label="Quien despincha">
                  <PersonalSelect value={form.nombre_despincho} onChange={v => setForm({...form, nombre_despincho: v})} personal={personal} />
                </FormField>
                <FormField label="Turno">
                  <TurnoSelect value={form.turno_despinchado} onChange={v => setForm({...form, turno_despinchado: v})} />
                </FormField>
                {/* Pinchar siguiente */}
                <div className="border-t border-gray-200 dark:border-dark-border pt-3 space-y-2">
                  <button type="button"
                    onClick={() => { setPincharSiguiente(v => !v); setSiguienteId(null) }}
                    className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all w-full
                      ${pincharSiguiente ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400' : 'bg-gray-50 dark:bg-dark-elevated border-gray-200 dark:border-dark-border text-gray-400'}`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                      ${pincharSiguiente ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-dark-border'}`}>
                      {pincharSiguiente && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    Pinchar siguiente en C{modal?.barril?.canilla ?? '?'}
                  </button>
                  {pincharSiguiente && (
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {todosEnCamara.length === 0 ? (
                        <p className="text-xs text-gray-400 italic px-1">No hay birras en cámara disponibles.</p>
                      ) : [...todosEnCamara].sort((a: any, b: any) => (a.estilo || '').localeCompare(b.estilo || '', 'es')).map((b: any) => (
                        <button key={b.id} type="button"
                          onClick={() => setSiguienteId(b.id)}
                          className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg border text-xs transition-all
                            ${siguienteId === b.id ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600' : 'bg-gray-50 dark:bg-dark-elevated border-gray-200 dark:border-dark-border hover:border-gray-300'}`}>
                          <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0
                            ${siguienteId === b.id ? 'border-green-500 bg-green-500' : 'border-gray-300 dark:border-dark-border'}`} />
                          <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{b.estilo}</span>
                          {b.codigo && <span className="text-gray-400 dark:text-gray-500 font-mono text-xs flex-shrink-0">{b.codigo}</span>}
                          <span className={`ml-auto px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${TIPO_COLORS[b.tipo] || 'bg-gray-400 text-white'}`}>{b.tipo}</span>
                          {b.proveedor && <span className="text-gray-400 text-xs flex-shrink-0 hidden sm:inline">{b.proveedor}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary">
                {saving ? <Spinner size="sm" /> : modal.type === 'pinchar' ? 'Pinchar' : 'Despinchar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function BarrilPinchadoCard({ barril: b, onDespinchar, onEdit }: { barril: any; onDespinchar: () => void; onEdit: () => void }) {
  const tipoClass  = TIPO_COLORS[b.tipo]  || 'bg-gray-400 text-white'
  const accentClass = TIPO_ACCENT[b.tipo] || 'bg-gray-400'
  return (
    <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden hover:shadow-md transition-shadow flex">
      <div className={`w-1 shrink-0 ${accentClass}`} />
      <div className="flex flex-col gap-1.5 p-3 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400">C-{b.canilla}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${tipoClass}`}>{b.tipo}</span>
        </div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight line-clamp-2">{b.estilo}</p>
        {b.codigo && (
          <p className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-dark-elevated rounded px-1.5 py-0.5 self-start">{b.codigo}</p>
        )}
        <p className="text-xs text-gray-400">{b.litros}L · {b.proveedor}</p>
        {b.dias_pinchado !== null && (
          <p className={`text-xs ${diasPinchadoColor(b.dias_pinchado)}`}>{b.dias_pinchado}d pinchado</p>
        )}
        <p className="text-xs text-gray-400 truncate">{b.nombre_pincho} · {b.turno_pinchado}</p>
        <div className="flex gap-1.5 mt-1">
          <button onClick={onEdit}
            className="flex items-center justify-center w-7 shrink-0 bg-gray-50 dark:bg-dark-elevated text-gray-400 hover:text-primary border border-gray-200 dark:border-dark-border rounded-lg transition-colors">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={onDespinchar}
            className="flex-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 py-1 rounded-lg font-medium transition-colors">
            Despinchar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Para Retirar (shared section used in TabActivos) ────────────────────────

function ParaRetirarSection({ barriles, onSaved, addToast, onEdit }: {
  barriles: any[]; onSaved: () => void
  addToast: (t: 'success'|'error'|'warning', m: string) => void
  onEdit: (b: any) => void
}) {
  const paraRetirar = barriles.filter(b => b.estado === 'Para Retirar')

  const [modal, setModal] = useState<any>(null)
  const [form, setForm]   = useState<Record<string,any>>({})
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkModal, setBulkModal] = useState(false)
  const [bulkDate, setBulkDate]   = useState(toInputDate(todayDDMMYYYY()))
  const [savingBulk, setSavingBulk] = useState(false)

  function toggleOne(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll(ids: number[]) {
    const allSelected = ids.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  function openRetirar(b: any) {
    setForm({ fecha_retirado: toInputDate(todayDDMMYYYY()) })
    setModal(b)
  }

  async function handleRetirar() {
    if (!modal) return
    setSaving(true)
    try {
      await barrilesV2Api.updateBarril(modal.id, { fecha_retirado: fromInputDate(form.fecha_retirado) })
      addToast('success', 'Barril marcado como retirado')
      setModal(null)
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkRetirar() {
    const ids = Array.from(selectedIds)
    setSavingBulk(true)
    let ok = 0, fail = 0
    for (const id of ids) {
      try {
        await barrilesV2Api.updateBarril(id, { fecha_retirado: fromInputDate(bulkDate) })
        ok++
      } catch { fail++ }
    }
    setSavingBulk(false)
    setBulkModal(false)
    setSelectedIds(new Set())
    if (ok > 0) {
      addToast('success', `${ok} barril${ok > 1 ? 'es' : ''} retirado${ok > 1 ? 's' : ''}${fail > 0 ? ` (${fail} con error)` : ''}`)
      onSaved()
    } else {
      addToast('error', 'No se pudo retirar ningún barril')
    }
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            Para Retirar <span className="text-sm text-gray-400 ml-1">({paraRetirar.length})</span>
          </h2>
        </div>
        {selectedIds.size > 0 && (
          <button onClick={() => { setBulkDate(toInputDate(todayDDMMYYYY())); setBulkModal(true) }}
            className="ml-auto flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
            <TrendingDown className="w-4 h-4" />
            Retirar marcados ({selectedIds.size})
          </button>
        )}
      </div>
      {paraRetirar.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-600 italic">No hay barriles para retirar</p>
      ) : (
        <BarrilesTable
          barriles={paraRetirar} showAction actionLabel="Retirar" onAction={openRetirar} onEdit={onEdit}
          selectable selectedIds={selectedIds} onToggle={toggleOne} onToggleAll={toggleAll}
        />
      )}

      {modal && (
        <Modal open={!!modal} onClose={() => setModal(null)} title={`Retirar barril — ${modal.estilo}`}>
          <div className="space-y-4 p-1">
            <FormField label="Fecha de retiro">
              <input type="date" value={form.fecha_retirado || ''} onChange={e => setForm({...form, fecha_retirado: e.target.value})}
                className="input" />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleRetirar} disabled={saving} className="btn-primary">
                {saving ? <Spinner size="sm" /> : 'Confirmar retiro'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {bulkModal && (
        <Modal open={bulkModal} onClose={() => setBulkModal(false)} title={`Retirar ${selectedIds.size} barril${selectedIds.size > 1 ? 'es' : ''}`}>
          <div className="space-y-4 p-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Se marcará como retirado cada barril seleccionado con la misma fecha.
            </p>
            <FormField label="Fecha de retiro">
              <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
                className="input" />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setBulkModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleBulkRetirar} disabled={savingBulk} className="btn-primary">
                {savingBulk ? <Spinner size="sm" /> : `Confirmar retiro (${selectedIds.size})`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

// ─── Tab Historial ────────────────────────────────────────────────────────────

function TabHistorial({ barriles, personal: _personal, onSaved: _onSaved, addToast: _addToast, onEdit }: {
  barriles: any[]; personal: string[]; onSaved: () => void
  addToast: (t: 'success'|'error'|'warning', m: string) => void
  onEdit: (b: any) => void
}) {
  const retiradas = barriles.filter(b => b.estado === 'Retirada')
  const [showRetiradas, setShowRetiradas] = useState(false)

  return (
    <div className="space-y-6">
      {/* Retiradas */}
      <section>
        <button onClick={() => setShowRetiradas(v => !v)}
          className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity">
          {showRetiradas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <Archive className="w-5 h-5 text-slate-400" />
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            Retiradas <span className="text-sm text-gray-400 ml-1">({retiradas.length})</span>
          </h2>
        </button>
        {showRetiradas && (
          <BarrilesTable barriles={retiradas} showAction={false} onEdit={onEdit}
            initialSortCol="fecha_retirado" initialSortDir="desc" />
        )}
      </section>
    </div>
  )
}

type TblSortCol = 'estilo' | 'proveedor' | 'tipo' | 'litros' | 'codigo' | 'fecha_retirado'
type TblSortDir = 'asc' | 'desc'

function TblSortIcon({ active, dir }: { active: boolean; dir: TblSortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />
  return dir === 'asc'
    ? <ArrowUp className="w-3 h-3 inline ml-0.5" />
    : <ArrowDown className="w-3 h-3 inline ml-0.5" />
}

function ddmmyyyyToSortKey(v: string): string {
  if (!v) return ''
  const p = v.split('/')
  return p.length === 3 ? `${p[2]}${p[1].padStart(2,'0')}${p[0].padStart(2,'0')}` : ''
}

function BarrilesTable({ barriles, showAction, actionLabel = '', onAction, onEdit, selectable, selectedIds, onToggle, onToggleAll, initialSortCol = 'estilo', initialSortDir = 'asc' }: {
  barriles: any[]; showAction: boolean; actionLabel?: string
  onAction?: (b: any) => void; onEdit?: (b: any) => void
  selectable?: boolean; selectedIds?: Set<number>
  onToggle?: (id: number) => void; onToggleAll?: (ids: number[]) => void
  initialSortCol?: TblSortCol; initialSortDir?: TblSortDir
}) {
  const [sortCol, setSortCol] = useState<TblSortCol>(initialSortCol)
  const [sortDir, setSortDir] = useState<TblSortDir>(initialSortDir)

  function toggleSort(col: TblSortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = [...barriles].sort((a, b) => {
    let cmp: number
    if (sortCol === 'litros') {
      cmp = Number(a.litros) - Number(b.litros)
    } else if (sortCol === 'fecha_retirado') {
      const ak = ddmmyyyyToSortKey(a.fecha_retirado)
      const bk = ddmmyyyyToSortKey(b.fecha_retirado)
      if (!ak && !bk) cmp = 0
      else if (!ak) return 1
      else if (!bk) return -1
      else cmp = ak.localeCompare(bk)
    } else {
      const av = (a[sortCol] ?? '').toString().toLowerCase()
      const bv = (b[sortCol] ?? '').toString().toLowerCase()
      cmp = av.localeCompare(bv)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortTh({ col, label }: { col: TblSortCol; label: string }) {
    return (
      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-primary transition-colors"
        onClick={() => toggleSort(col)}>
        {label}<TblSortIcon active={sortCol === col} dir={sortDir} />
      </th>
    )
  }

  const allIds = sorted.map(b => b.id)
  const allChecked = selectable && allIds.length > 0 && allIds.every(id => selectedIds?.has(id))
  const someChecked = selectable && allIds.some(id => selectedIds?.has(id)) && !allChecked

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
      {/* Vista en tarjetas para móvil */}
      <div className="sm:hidden divide-y divide-gray-100 dark:divide-dark-border">
        {sorted.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic p-4">Sin resultados</p>
        )}
        {sorted.map(b => {
          const isChecked = selectable && !!selectedIds?.has(b.id)
          return (
            <div key={b.id}
              className={`p-3 ${selectable ? 'cursor-pointer select-none' : ''} ${isChecked ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
              onClick={selectable ? () => onToggle?.(b.id) : undefined}>
              <div className="flex items-start gap-2">
                {selectable && (
                  <input type="checkbox" checked={isChecked} onChange={() => onToggle?.(b.id)}
                    onClick={e => e.stopPropagation()}
                    className="mt-0.5 rounded border-gray-300 text-primary cursor-pointer shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">{b.estilo}</span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_COLORS[b.tipo] || 'bg-gray-400 text-white'}`}>{b.tipo}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{b.litros}L</span>
                    {b.codigo && <span className="text-xs text-gray-400 font-mono">{b.codigo}</span>}
                  </div>
                  {b.proveedor && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{b.proveedor}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {b.fecha_pinchado && (
                      <span>Pinch: {b.fecha_pinchado}{b.dias_pinchado !== null && (
                        <span className={`ml-1 font-medium ${diasPinchadoColor(b.dias_pinchado)}`}>({b.dias_pinchado}d)</span>
                      )}</span>
                    )}
                    {b.fecha_despinchado && <span>Desp: {b.fecha_despinchado}</span>}
                    {b.dias_retirado !== null
                      ? <span>Ret: {b.dias_retirado}d</span>
                      : b.fecha_retirado ? <span>Ret: {b.fecha_retirado}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onEdit && (
                    <button onClick={e => { e.stopPropagation(); onEdit(b) }}
                      className="text-xs bg-gray-50 dark:bg-dark-elevated text-gray-400 hover:text-primary border border-gray-200 dark:border-dark-border p-1.5 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {showAction && onAction && (
                    <button onClick={e => { e.stopPropagation(); onAction(b) }}
                      className="text-xs bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg font-medium transition-colors">
                      {actionLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* Vista en tabla para desktop */}
      <div className="hidden sm:block overflow-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border">
            <tr>
              {selectable && (
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = !!someChecked }}
                    onChange={() => onToggleAll?.(allIds)}
                    className="rounded border-gray-300 text-primary cursor-pointer" />
                </th>
              )}
              <SortTh col="estilo" label="Estilo" />
              <SortTh col="proveedor" label="Proveedor" />
              <SortTh col="tipo" label="Tipo" />
              <SortTh col="litros" label="Litros" />
              <SortTh col="codigo" label="Código" />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Pinchado</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Despinchado</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Días p.</th>
              <SortTh col="fecha_retirado" label="Retirado" />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Días ret.</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {sorted.map(b => {
              const isChecked = selectable && !!selectedIds?.has(b.id)
              return (
                <tr key={b.id}
                  className={`hover:bg-gray-50 dark:hover:bg-dark-elevated ${isChecked ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                  onClick={selectable ? () => onToggle?.(b.id) : undefined}
                  style={selectable ? { cursor: 'pointer' } : undefined}>
                  {selectable && (
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={isChecked} onChange={() => onToggle?.(b.id)}
                        onClick={e => e.stopPropagation()}
                        className="rounded border-gray-300 text-primary cursor-pointer" />
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{b.estilo}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{b.proveedor || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_COLORS[b.tipo] || 'bg-gray-400 text-white'}`}>{b.tipo}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{b.litros}L</td>
                  <td className="px-3 py-2 text-gray-400 dark:text-gray-500 font-mono text-xs">{b.codigo || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-500 text-xs">
                    <div>{b.fecha_pinchado || '—'}</div>
                    <div className="text-gray-400">{b.nombre_pincho}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-500 text-xs">
                    <div>{b.fecha_despinchado || '—'}</div>
                    <div className="text-gray-400">{b.nombre_despincho}</div>
                  </td>
                  <td className="px-3 py-2">
                    {b.dias_pinchado !== null ? (
                      <span className={diasPinchadoColor(b.dias_pinchado)}>{b.dias_pinchado}d</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-500 text-xs">{b.fecha_retirado || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-500 text-xs">
                    {b.dias_retirado !== null ? `${b.dias_retirado}d` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {onEdit && (
                        <button onClick={e => { e.stopPropagation(); onEdit(b) }}
                          className="text-xs bg-gray-50 dark:bg-dark-elevated text-gray-400 hover:text-primary border border-gray-200 dark:border-dark-border p-1 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {showAction && onAction && (
                        <button onClick={e => { e.stopPropagation(); onAction(b) }}
                          className="text-xs bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg font-medium transition-colors">
                          {actionLabel}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── BirraCombobox ────────────────────────────────────────────────────────────

function BirraCombobox({ birras, value, onChange, placeholder = '— Seleccioná una birra —' }: {
  birras: any[]; value: string; onChange: (id: string) => void; placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = birras.find(b => String(b.id) === value)
  const displayLabel = selected
    ? `${selected.estilo}${selected.proveedor ? ` — ${selected.proveedor}` : ''} (${selected.tipo})`
    : ''

  const filtered = query.trim()
    ? birras.filter(b =>
        `${b.estilo} ${b.proveedor || ''} ${b.tipo}`.toLowerCase().includes(query.toLowerCase())
      )
    : birras

  return (
    <div className="relative">
      <input
        type="text"
        className="input"
        value={open ? query : displayLabel}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery('') }}
        onBlur={() => { setOpen(false); setQuery('') }}
        onChange={e => setQuery(e.target.value)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg shadow-lg">
          {filtered.map(b => (
            <li key={b.id}
              onMouseDown={e => { e.preventDefault(); onChange(String(b.id)); setOpen(false) }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-elevated ${String(b.id) === value ? 'bg-primary/5 font-medium' : ''} text-gray-800 dark:text-gray-100`}>
              {b.estilo}{b.proveedor ? ` — ${b.proveedor}` : ''} <span className="text-gray-400">({b.tipo})</span>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
          Sin resultados para "{query}"
        </div>
      )}
    </div>
  )
}

// ─── Tab Ingresar ─────────────────────────────────────────────────────────────

const EMPTY_ROW = () => ({ birra_id: '', litros: '50', codigo: '' })

function TabIngresar({ birras, onSaved, addToast }: {
  birras: any[]; onSaved: () => void
  addToast: (t: 'success'|'error'|'warning', m: string) => void
}) {
  const birrasActivas = birras
    .filter(b => b.activo)
    .sort((a, b) => a.estilo.localeCompare(b.estilo))

  const [mode, setMode] = useState<'individual' | 'masa'>('individual')

  // ── Individual mode ──
  const [form, setForm] = useState({
    birra_id: '', litros: '50', codigo: '', ingreso_at: toInputDate(todayDDMMYYYY())
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmitIndividual(e: React.FormEvent) {
    e.preventDefault()
    if (!form.birra_id || !form.litros) {
      addToast('warning', 'Elegí una birra e ingresá los litros')
      return
    }
    setSaving(true)
    try {
      await barrilesV2Api.createBarril({
        birra_id: parseInt(form.birra_id),
        litros: parseInt(form.litros),
        codigo: form.codigo.trim(),
        ingreso_at: fromInputDate(form.ingreso_at),
      })
      addToast('success', 'Barril ingresado')
      setForm({ birra_id: '', litros: '50', codigo: '', ingreso_at: toInputDate(todayDDMMYYYY()) })
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Bulk mode ──
  const [rows, setRows] = useState([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
  const [bulkDate, setBulkDate] = useState(toInputDate(todayDDMMYYYY()))
  const [savingBulk, setSavingBulk] = useState(false)

  function updateRow(i: number, field: string, val: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  function addRow() { setRows(prev => [...prev, EMPTY_ROW()]) }

  function removeRow(i: number) {
    setRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)
  }

  async function handleSubmitBulk(e: React.FormEvent) {
    e.preventDefault()
    const validRows = rows.filter(r => r.birra_id && r.litros)
    if (validRows.length === 0) {
      addToast('warning', 'Completá al menos una fila con birra y litros')
      return
    }
    setSavingBulk(true)
    let ok = 0, fail = 0
    for (const r of validRows) {
      try {
        await barrilesV2Api.createBarril({
          birra_id: parseInt(r.birra_id),
          litros: parseInt(r.litros),
          codigo: r.codigo.trim(),
          ingreso_at: fromInputDate(bulkDate),
        })
        ok++
      } catch {
        fail++
      }
    }
    setSavingBulk(false)
    if (ok > 0) {
      addToast('success', `${ok} barril${ok > 1 ? 'es' : ''} ingresado${ok > 1 ? 's' : ''}${fail > 0 ? ` (${fail} con error)` : ''}`)
      setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
      setBulkDate(toInputDate(todayDDMMYYYY()))
      onSaved()
    } else {
      addToast('error', 'No se pudo ingresar ningún barril')
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        {(['individual', 'masa'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${mode === m
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-border hover:border-primary/50'}`}>
            {m === 'individual' ? 'Individual' : 'En masa'}
          </button>
        ))}
      </div>

      {mode === 'individual' ? (
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Ingresar barril
          </h2>
          <form onSubmit={handleSubmitIndividual} className="space-y-4">
            <FormField label="Birra *">
              <BirraCombobox birras={birrasActivas} value={form.birra_id} onChange={id => setForm({ ...form, birra_id: id })} />
            </FormField>
            <FormField label="Litros *">
              <input type="number" min={1} max={999} value={form.litros}
                onChange={e => setForm({ ...form, litros: e.target.value })}
                className="input" required />
            </FormField>
            <FormField label="Código (opcional)">
              <input type="text" value={form.codigo}
                onChange={e => setForm({ ...form, codigo: e.target.value })}
                placeholder="Ej: BA-001" className="input" />
            </FormField>
            <FormField label="Fecha de ingreso">
              <input type="date" value={form.ingreso_at}
                onChange={e => setForm({ ...form, ingreso_at: e.target.value })}
                className="input" />
            </FormField>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? <Spinner size="sm" /> : 'Ingresar barril'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Ingreso en masa
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Completá solo las filas que quieras ingresar. Las vacías se ignoran.</p>
          <form onSubmit={handleSubmitBulk} className="space-y-4">
            <FormField label="Fecha de ingreso">
              <input type="date" value={bulkDate}
                onChange={e => setBulkDate(e.target.value)}
                className="input max-w-xs" />
            </FormField>

            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-gray-100 dark:border-dark-border p-2.5 sm:flex-row sm:items-start sm:border-0 sm:rounded-none sm:p-0 sm:gap-2">
                  {/* Encabezado de fila en móvil: número + botón eliminar */}
                  <div className="flex items-center justify-between sm:hidden">
                    <span className="text-xs text-gray-400 dark:text-gray-600 font-mono font-medium">#{i + 1}</span>
                    <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Número de fila en desktop */}
                  <span className="hidden sm:block text-xs text-gray-400 dark:text-gray-600 font-mono pt-2.5 w-5 shrink-0 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <BirraCombobox birras={birrasActivas} value={row.birra_id}
                      onChange={id => updateRow(i, 'birra_id', id)}
                      placeholder="Birra..." />
                  </div>
                  {/* En móvil: litros y código lado a lado; en desktop: items directos del flex */}
                  <div className="flex gap-2 sm:contents">
                    <input type="number" min={1} max={999} value={row.litros}
                      onChange={e => updateRow(i, 'litros', e.target.value)}
                      placeholder="Litros" className="input flex-1 sm:flex-none sm:w-24 sm:shrink-0" />
                    <input type="text" value={row.codigo}
                      onChange={e => updateRow(i, 'codigo', e.target.value)}
                      placeholder="Código" className="input flex-1 sm:flex-none sm:w-28 sm:shrink-0" />
                  </div>
                  {/* Botón eliminar solo en desktop */}
                  <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                    className="hidden sm:block mt-1 p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={addRow}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors">
              <Plus className="w-4 h-4" /> Agregar fila
            </button>

            <button type="submit" disabled={savingBulk} className="btn-primary w-full">
              {savingBulk ? <Spinner size="sm" /> : `Ingresar ${rows.filter(r => r.birra_id && r.litros).length || ''} barril${rows.filter(r => r.birra_id && r.litros).length !== 1 ? 'es' : ''}`}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── Tab Catálogo ─────────────────────────────────────────────────────────────

type SortCol = 'estilo' | 'proveedor' | 'tipo'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30" />
  return dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
}

function TabCatalogo({ birras, proveedores, onSaved, addToast }: {
  birras: any[]; proveedores: any[]; onSaved: () => void
  addToast: (t: 'success'|'error'|'warning', m: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<number|null>(null)
  const [form, setForm] = useState({ estilo:'', proveedor_id: '' as string|number, tipo:'B', abv:'', amargor:'', descripcion:'' })
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  // Crear proveedor inline
  const [newProvNombre, setNewProvNombre] = useState('')
  const [savingProv, setSavingProv]       = useState(false)
  const [showNewProv, setShowNewProv]     = useState(false)

  async function createProveedorInline() {
    if (!newProvNombre.trim()) return
    setSavingProv(true)
    try {
      const created = await barrilesV2Api.createProveedor(newProvNombre.trim())
      setNewProvNombre('')
      setShowNewProv(false)
      setForm(f => ({ ...f, proveedor_id: String(created.id) }))
      onSaved()
      addToast('success', `Proveedor "${created.nombre}" creado`)
    } catch(e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setSavingProv(false)
    }
  }

  // Filtros y ordenamiento
  const [search, setSearch]                   = useState('')
  const [filterProveedor, setFilterProveedor] = useState('')
  const [filterTipo, setFilterTipo]           = useState('')
  const [sortCol, setSortCol]                 = useState<SortCol>('estilo')
  const [sortDir, setSortDir]                 = useState<SortDir>('asc')

  const proveedoresActivos = proveedores.filter(p => p.activo)

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const visibles = useMemo(() => {
    let list = birras.filter(b => showInactive || b.activo)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(b => b.estilo?.toLowerCase().includes(q))
    }
    if (filterProveedor) list = list.filter(b => String(b.proveedor_id) === filterProveedor)
    if (filterTipo)      list = list.filter(b => b.tipo === filterTipo)
    list = [...list].sort((a, b) => {
      const va = (a[sortCol] || '').toLowerCase()
      const vb = (b[sortCol] || '').toLowerCase()
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
    return list
  }, [birras, showInactive, search, filterProveedor, filterTipo, sortCol, sortDir])

  function startEdit(b: any) {
    setEditId(b.id)
    setForm({ estilo: b.estilo, proveedor_id: b.proveedor_id ?? '', tipo: b.tipo, abv: b.abv||'', amargor: b.amargor||'', descripcion: b.descripcion||'' })
    setShowForm(true)
  }

  function cancelEdit() {
    setEditId(null)
    setForm({ estilo:'', proveedor_id: '', tipo:'B', abv:'', amargor:'', descripcion:'' })
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.estilo.trim()) { addToast('warning', 'El estilo es requerido'); return }
    if (!form.proveedor_id)  { addToast('warning', 'El proveedor es requerido'); return }
    setSaving(true)
    try {
      const payload = { ...form, proveedor_id: Number(form.proveedor_id) }
      if (editId) {
        await barrilesV2Api.updateBirra(editId, payload)
        addToast('success', 'Birra actualizada')
      } else {
        await barrilesV2Api.createBirra(payload)
        addToast('success', 'Birra creada')
      }
      cancelEdit()
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivo(b: any) {
    try {
      await barrilesV2Api.updateBirra(b.id, { activo: b.activo ? 0 : 1 })
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            Birras <span className="text-sm font-normal text-gray-400">({visibles.length})</span>
          </h2>
          <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Ver inactivas
          </label>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Nueva birra
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="input pl-8 text-sm py-1.5"
          />
        </div>
        <select value={filterProveedor} onChange={e => setFilterProveedor(e.target.value)}
          className="input text-sm py-1.5 min-w-[140px]">
          <option value="">Todos los proveedores</option>
          {proveedoresActivos.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          className="input text-sm py-1.5">
          <option value="">Todos los tipos</option>
          {['A','B','C','D','E','GIN','T'].map(t => (
            <option key={t} value={t}>Tipo {t}</option>
          ))}
        </select>
        {(search || filterProveedor || filterTipo) && (
          <button onClick={() => { setSearch(''); setFilterProveedor(''); setFilterTipo('') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors">
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
          <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-3">
            {editId ? 'Editar birra' : 'Nueva birra'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Estilo *">
              <input type="text" value={form.estilo} onChange={e => setForm({...form, estilo: e.target.value})}
                placeholder="Ej: Helles Lager" className="input" />
            </FormField>
            <FormField label="Proveedor *">
              {showNewProv ? (
                <div className="flex gap-1.5">
                  <input autoFocus type="text" value={newProvNombre}
                    onChange={e => setNewProvNombre(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createProveedorInline(); if (e.key === 'Escape') setShowNewProv(false) }}
                    placeholder="Nombre del proveedor" className="input flex-1 text-sm" />
                  <button onClick={createProveedorInline} disabled={savingProv}
                    className="btn-primary text-xs px-2.5">
                    {savingProv ? <Spinner size="sm" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setShowNewProv(false)}
                    className="btn-secondary text-xs px-2.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <select value={String(form.proveedor_id)} onChange={e => setForm({...form, proveedor_id: e.target.value})}
                    className="input flex-1">
                    <option value="">— Seleccioná un proveedor —</option>
                    {proveedoresActivos.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
                  </select>
                  <button onClick={() => setShowNewProv(true)} title="Nuevo proveedor"
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border text-gray-500 hover:text-primary hover:border-primary transition-colors bg-white dark:bg-dark-surface">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </FormField>
            <FormField label="Tipo (A-E)">
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} className="input">
                {['A','B','C','D','E'].map(t => <option key={t} value={t}>Tipo {t}</option>)}
              </select>
            </FormField>
            <FormField label="ABV (%)">
              <input type="text" value={form.abv} onChange={e => setForm({...form, abv: e.target.value})}
                placeholder="Ej: 5.2%" className="input" />
            </FormField>
            <FormField label="Amargor (IBU)">
              <input type="text" value={form.amargor} onChange={e => setForm({...form, amargor: e.target.value})}
                placeholder="Ej: 20 IBU" className="input" />
            </FormField>
            <FormField label="Descripción">
              <input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
                placeholder="Descripción breve" className="input" />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={cancelEdit} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" /> : editId ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border">
            <tr>
              {(['estilo','proveedor','tipo'] as SortCol[]).map(col => (
                <th key={col} className="px-3 py-2 text-left">
                  <button onClick={() => toggleSort(col)}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors capitalize">
                    {col === 'estilo' ? 'Estilo' : col === 'proveedor' ? 'Proveedor' : 'Tipo'}
                    <SortIcon col={col} active={sortCol === col} dir={sortDir} />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">ABV</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Amargor</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {visibles.map(b => (
              <tr key={b.id} className={`hover:bg-gray-50 dark:hover:bg-dark-elevated ${!b.activo ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{b.estilo}</td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{b.proveedor || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_COLORS[b.tipo] || 'bg-gray-400 text-white'}`}>{b.tipo}</span>
                </td>
                <td className="px-3 py-2 text-gray-400 text-xs">{b.abv || '—'}</td>
                <td className="px-3 py-2 text-gray-400 text-xs">{b.amargor || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => startEdit(b)} className="text-gray-400 hover:text-primary transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleActivo(b)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${b.activo
                        ? 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                        : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                      {b.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibles.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">
            {search || filterProveedor || filterTipo ? 'Sin resultados para los filtros aplicados' : 'No hay birras en el catálogo'}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Tab Auditoría ────────────────────────────────────────────────────────────

function auditLabel(row: any): string {
  if (row.action === 'ingreso') return 'Ingresó'
  if (row.action === 'delete')  return 'Eliminó'
  if (row.action === 'update') {
    const d: string = row.detalle || ''
    if (d.includes('fecha_pinchado'))    return 'Pinchó'
    if (d.includes('fecha_despinchado')) return 'Despinchó'
    if (d.includes('fecha_retirado'))    return 'Retiró'
    return 'Editó'
  }
  return row.action || '—'
}

function TabAuditoria({ addToast }: {
  addToast: (t: 'success'|'error'|'warning', m: string) => void
}) {
  const [rows, setRows]     = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]  = useState('')

  useEffect(() => {
    setLoading(true)
    barrilesV2Api.getAudit(500)
      .then(data => setRows(data))
      .catch(e => addToast('error', `Error cargando auditoría: ${getErrorMessage(e)}`))
      .finally(() => setLoading(false))
  }, [addToast])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter(r =>
        (r.estilo || '').toLowerCase().includes(q) ||
        (r.usuario || '').toLowerCase().includes(q) ||
        auditLabel(r).toLowerCase().includes(q)
      )
    : rows

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por estilo, usuario, acción…"
          className="input pl-8 text-sm py-1.5 w-full" />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Acción</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Estilo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Detalle</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-400 italic">Sin registros</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-dark-elevated">
                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">
                    {r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      auditLabel(r) === 'Pinchó'    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      auditLabel(r) === 'Despinchó' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                      auditLabel(r) === 'Retiró'    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' :
                      auditLabel(r) === 'Ingresó'   ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                      auditLabel(r) === 'Eliminó'   ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {auditLabel(r)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{r.estilo || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">{r.detalle || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{r.usuario || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab Config ───────────────────────────────────────────────────────────────

function TabConfig({ personal, precios, proveedores, onSaved, addToast }: {
  personal: any[]; precios: any[]; proveedores: any[]; onSaved: () => void
  addToast: (t: 'success'|'error'|'warning', m: string) => void
}) {
  const [newPersonal, setNewPersonal]     = useState('')
  const [savingP, setSavingP]             = useState(false)
  const [newProveedor, setNewProveedor]   = useState('')
  const [savingProv, setSavingProv]       = useState(false)
  const [preciosEdit, setPreciosEdit]   = useState<Record<string, any>>({})
  const [savingPr, setSavingPr]         = useState(false)
  const [syncingPr, setSyncingPr]       = useState(false)
  const [migrating, setMigrating]       = useState(false)
  const [migrateLog, setMigrateLog]   = useState<string[]>([])

  useEffect(() => {
    const m: Record<string, any> = {}
    precios.forEach(p => { m[p.tipo] = { precio_normal: p.precio_normal, precio_hora_santa: p.precio_hora_santa } })
    setPreciosEdit(m)
  }, [precios])

  async function addPersonal() {
    if (!newPersonal.trim()) return
    setSavingP(true)
    try {
      await barrilesV2Api.createPersonal(newPersonal.trim())
      setNewPersonal('')
      addToast('success', 'Personal agregado')
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setSavingP(false)
    }
  }

  async function togglePersonal(p: any) {
    try {
      await barrilesV2Api.updatePersonal(p.id, { activo: p.activo ? 0 : 1 })
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    }
  }

  async function addProveedor() {
    if (!newProveedor.trim()) return
    setSavingProv(true)
    try {
      await barrilesV2Api.createProveedor(newProveedor.trim())
      setNewProveedor('')
      addToast('success', 'Proveedor agregado')
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setSavingProv(false)
    }
  }

  async function toggleProveedor(p: any) {
    try {
      await barrilesV2Api.updateProveedor(p.id, { activo: p.activo ? 0 : 1 })
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    }
  }

  async function syncPreciosDesdeSheets() {
    setSyncingPr(true)
    try {
      const result = await barrilesV2Api.syncPrecios()
      addToast('success', `${result.count} precios sincronizados desde Sheets`)
      onSaved()
    } catch (e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setSyncingPr(false)
    }
  }

  async function savePrecio(tipo: string) {
    setSavingPr(true)
    try {
      const { precio_normal, precio_hora_santa } = preciosEdit[tipo] || {}
      await barrilesV2Api.upsertPrecio(tipo, parseInt(precio_normal)||0, parseInt(precio_hora_santa)||0)
      addToast('success', `Precio tipo ${tipo} guardado`)
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setSavingPr(false)
    }
  }

  async function handleMigrar() {
    if (!window.confirm('¿Importar todos los datos desde Google Sheets? (Solo necesario una vez)')) return
    setMigrating(true)
    setMigrateLog([])
    try {
      const res = await barrilesV2Api.migrar()
      setMigrateLog(res.log || [])
      if (res.success) addToast('success', 'Migración completada')
      else addToast('error', res.error || 'Error en migración')
      onSaved()
    } catch(e) {
      addToast('error', getErrorMessage(e))
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Proveedores */}
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" /> Proveedores
        </h3>
        <div className="flex gap-2 mb-3">
          <input value={newProveedor} onChange={e => setNewProveedor(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addProveedor()}
            placeholder="Nombre del proveedor" className="input flex-1 text-sm" />
          <button onClick={addProveedor} disabled={savingProv} className="btn-primary text-sm px-3">
            {savingProv ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {proveedores.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(p => (
            <li key={p.id} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
              p.activo ? 'bg-gray-50 dark:bg-dark-elevated' : 'opacity-50 bg-gray-50 dark:bg-dark-elevated'}`}>
              <span className={p.activo ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 line-through'}>{p.nombre}</span>
              <button onClick={() => toggleProveedor(p)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${p.activo
                  ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-500'
                  : 'bg-green-50 text-green-600 border-green-200'}`}>
                {p.activo ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
          {proveedores.length === 0 && <p className="text-sm text-gray-400 italic">Sin proveedores cargados</p>}
        </ul>
      </div>

      {/* Personal */}
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
          <User className="w-4 h-4" /> Personal
        </h3>
        <div className="flex gap-2 mb-3">
          <input value={newPersonal} onChange={e => setNewPersonal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPersonal()}
            placeholder="Nombre" className="input flex-1 text-sm" />
          <button onClick={addPersonal} disabled={savingP} className="btn-primary text-sm px-3">
            {savingP ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {personal.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(p => (
            <li key={p.id} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
              p.activo ? 'bg-gray-50 dark:bg-dark-elevated' : 'opacity-50 bg-gray-50 dark:bg-dark-elevated'}`}>
              <span className={p.activo ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 line-through'}>{p.nombre}</span>
              <button onClick={() => togglePersonal(p)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${p.activo
                  ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-500'
                  : 'bg-green-50 text-green-600 border-green-200'}`}>
                {p.activo ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
          {personal.length === 0 && <p className="text-sm text-gray-400 italic">Sin personal cargado</p>}
        </ul>
      </div>

      {/* Precios */}
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Precios por tipo
          </h3>
          <button onClick={syncPreciosDesdeSheets} disabled={syncingPr}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors disabled:opacity-50 font-medium">
            {syncingPr ? <Spinner size="sm" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sincronizar desde Sheets
          </button>
        </div>
        <div className="space-y-2">
          {['A','B','C','D','E','GIN','T'].map(tipo => {
            const curr = preciosEdit[tipo] || { precio_normal: 0, precio_hora_santa: 0 }
            return (
              <div key={tipo} className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded border w-10 text-center ${TIPO_COLORS[tipo]||''}`}>{tipo}</span>
                <input type="number" placeholder="Normal" value={curr.precio_normal||''}
                  onChange={e => setPreciosEdit(prev => ({...prev, [tipo]: {...curr, precio_normal: e.target.value}}))}
                  className="input text-sm flex-1" />
                <input type="number" placeholder="Hora santa" value={curr.precio_hora_santa||''}
                  onChange={e => setPreciosEdit(prev => ({...prev, [tipo]: {...curr, precio_hora_santa: e.target.value}}))}
                  className="input text-sm flex-1" />
                <button onClick={() => savePrecio(tipo)} disabled={savingPr} className="btn-primary text-xs px-2 py-1.5">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
          <p className="text-xs text-gray-400 mt-1">Normal · Hora Santa</p>
        </div>
      </div>

      {/* Migración */}
      <div className="md:col-span-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Download className="w-4 h-4" /> Importar desde Sheets
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Importa todo el catálogo, personal, barriles activos e historial desde Google Sheets.
              Esta operación es idempotente — si ya hay datos en la DB, los barriles no se reimportan.
            </p>
          </div>
          <button onClick={handleMigrar} disabled={migrating}
            className="flex-shrink-0 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
            {migrating ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
            Importar
          </button>
        </div>
        {migrateLog.length > 0 && (
          <div className="mt-3 bg-white dark:bg-dark-surface rounded-lg p-3 font-mono text-xs text-gray-700 dark:text-gray-300 space-y-0.5 max-h-40 overflow-y-auto">
            {migrateLog.map((line, i) => (
              <div key={i} className={line.startsWith('ERROR') ? 'text-red-600' : ''}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      {children}
    </div>
  )
}

function PersonalSelect({ value, onChange, personal }: { value: string; onChange: (v: string) => void; personal: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="input">
      <option value="">— Seleccioná —</option>
      {personal.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  )
}

function TurnoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="input">
      <option value="Mañana">Mañana</option>
      <option value="Noche">Noche</option>
    </select>
  )
}

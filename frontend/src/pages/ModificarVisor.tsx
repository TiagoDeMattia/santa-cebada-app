import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, Image, Check, Tv, AlertCircle, Loader2, Pencil, X, ChevronUp, ChevronDown, Save, RefreshCw } from 'lucide-react'
import { loadVisorConfig, saveVisorConfig } from '../lib/visorConfig'
import type { VisorConfig } from '../lib/visorConfig'
import { barrilesApi, barrilesV2Api } from '../lib/api'

interface BirraOpcion { estilo: string; precio: string }

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        value ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
      }`}
      role="switch"
      aria-checked={value}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          value ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// ── Tipos para Visor 2 admin ──────────────────────────────────────────────────
interface AdminItem { id: number; nombre: string; precio: string; orden: number }
interface AdminGroup { id: string; nombre: string; horario: string; orden: number; items: AdminItem[] }
interface AdminMenuItem { id: number; label: string; value: string; orden: number }

// ── Visor 2 Admin ─────────────────────────────────────────────────────────────
function Visor2Admin() {
  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [menuEjecutivo, setMenuEjecutivo] = useState<AdminMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Estados de edición inline para grupos
  const [editGrupo, setEditGrupo] = useState<Record<string, { nombre: string; horario: string }>>({})
  // Estados de edición inline para items
  const [editItem, setEditItem] = useState<Record<number, { nombre: string; precio: string }>>({})
  // Nuevos items por grupo
  const [newItem, setNewItem] = useState<Record<string, { nombre: string; precio: string } | null>>({})
  // Estado de edición para menu ejecutivo
  const [editMenu, setEditMenu] = useState<Record<number, { label: string; value: string }>>({})
  const [newMenu, setNewMenu] = useState<{ label: string; value: string } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await barrilesV2Api.getVisor2()
      const gs: AdminGroup[] = (data.groups ?? []).map((g: any) => ({
        id: String(g.id),
        nombre: g.nombre ?? '',
        horario: g.horario ?? '',
        orden: g.orden ?? 0,
        items: (g.items ?? []).map((it: any) => ({
          id: it.id,
          nombre: it.nombre ?? '',
          precio: it.precio ?? '',
          orden: it.orden ?? 0,
        })),
      }))
      setGroups(gs)
      setMenuEjecutivo((data.menu_ejecutivo ?? []).map((m: any) => ({
        id: m.id, label: m.label ?? '', value: m.value ?? '', orden: m.orden ?? 0,
      })))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Grupos ──────────────────────────────────────────────────────────────────
  const startEditGrupo = (g: AdminGroup) =>
    setEditGrupo(prev => ({ ...prev, [g.id]: { nombre: g.nombre, horario: g.horario } }))

  const cancelEditGrupo = (id: string) =>
    setEditGrupo(prev => { const n = { ...prev }; delete n[id]; return n })

  const saveGrupo = async (g: AdminGroup) => {
    const draft = editGrupo[g.id]
    if (!draft) return
    setSaving(`grupo-${g.id}`)
    try {
      await barrilesV2Api.upsertGrupo({ id: g.id, nombre: draft.nombre, horario: draft.horario, orden: g.orden })
      setGroups(prev => prev.map(x => x.id === g.id ? { ...x, ...draft } : x))
      cancelEditGrupo(g.id)
    } finally { setSaving(null) }
  }

  const moveGrupo = async (id: string, dir: -1 | 1) => {
    const idx = groups.findIndex(g => g.id === id)
    if (idx + dir < 0 || idx + dir >= groups.length) return
    const next = [...groups]
    ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
    const reordered = next.map((g, i) => ({ ...g, orden: i }))
    setGroups(reordered)
    setSaving(`move-${id}`)
    try {
      await Promise.all(reordered.map(g => barrilesV2Api.upsertGrupo({ id: g.id, nombre: g.nombre, horario: g.horario, orden: g.orden })))
    } finally { setSaving(null) }
  }

  // ── Items ───────────────────────────────────────────────────────────────────
  const startEditItem = (it: AdminItem) =>
    setEditItem(prev => ({ ...prev, [it.id]: { nombre: it.nombre, precio: it.precio } }))

  const cancelEditItem = (id: number) =>
    setEditItem(prev => { const n = { ...prev }; delete n[id]; return n })

  const saveItem = async (grupoId: string, it: AdminItem) => {
    const draft = editItem[it.id]
    if (!draft) return
    setSaving(`item-${it.id}`)
    try {
      await barrilesV2Api.upsertItem({ grupo_id: grupoId, nombre: draft.nombre, precio: draft.precio, orden: it.orden, item_id: it.id })
      setGroups(prev => prev.map(g => g.id === grupoId
        ? { ...g, items: g.items.map(x => x.id === it.id ? { ...x, ...draft } : x) }
        : g))
      cancelEditItem(it.id)
    } finally { setSaving(null) }
  }

  const deleteItem = async (grupoId: string, itemId: number) => {
    setSaving(`del-item-${itemId}`)
    try {
      await barrilesV2Api.deleteItem(itemId)
      setGroups(prev => prev.map(g => g.id === grupoId
        ? { ...g, items: g.items.filter(x => x.id !== itemId) }
        : g))
    } finally { setSaving(null) }
  }

  const addItem = async (grupoId: string) => {
    const draft = newItem[grupoId]
    if (!draft || !draft.nombre.trim()) return
    const grupo = groups.find(g => g.id === grupoId)
    const orden = (grupo?.items.length ?? 0)
    setSaving(`add-item-${grupoId}`)
    try {
      const res = await barrilesV2Api.upsertItem({ grupo_id: grupoId, nombre: draft.nombre, precio: draft.precio, orden })
      setGroups(prev => prev.map(g => g.id === grupoId
        ? { ...g, items: [...g.items, { id: res.id, nombre: draft.nombre, precio: draft.precio, orden }] }
        : g))
      setNewItem(prev => ({ ...prev, [grupoId]: null }))
    } finally { setSaving(null) }
  }

  // ── Menú Ejecutivo ──────────────────────────────────────────────────────────
  const startEditMenu = (m: AdminMenuItem) =>
    setEditMenu(prev => ({ ...prev, [m.id]: { label: m.label, value: m.value } }))

  const cancelEditMenu = (id: number) =>
    setEditMenu(prev => { const n = { ...prev }; delete n[id]; return n })

  const saveMenu = async (m: AdminMenuItem) => {
    const draft = editMenu[m.id]
    if (!draft) return
    setSaving(`menu-${m.id}`)
    try {
      await barrilesV2Api.upsertMenuItem({ item_id: m.id, label: draft.label, value: draft.value, orden: m.orden })
      setMenuEjecutivo(prev => prev.map(x => x.id === m.id ? { ...x, ...draft } : x))
      cancelEditMenu(m.id)
    } finally { setSaving(null) }
  }

  const deleteMenu = async (id: number) => {
    setSaving(`del-menu-${id}`)
    try {
      await barrilesV2Api.deleteMenuItem(id)
      setMenuEjecutivo(prev => prev.filter(x => x.id !== id))
    } finally { setSaving(null) }
  }

  const addMenu = async () => {
    if (!newMenu || !newMenu.label.trim()) return
    const orden = menuEjecutivo.length
    setSaving('add-menu')
    try {
      const res = await barrilesV2Api.upsertMenuItem({ item_id: null, label: newMenu.label, value: newMenu.value, orden })
      setMenuEjecutivo(prev => [...prev, { id: res.id, label: newMenu.label, value: newMenu.value, orden }])
      setNewMenu(null)
    } finally { setSaving(null) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Grupos de promos */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Grupos de Promos</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cada grupo es una columna en el Visor 2. Editá el nombre, horario e ítems de cada uno.
            </p>
          </div>
          <button onClick={cargar} className="btn btn-ghost p-2" title="Recargar">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {groups.map((g, gi) => {
            const isEditing = !!editGrupo[g.id]
            const draft = editGrupo[g.id]
            const isSavingThis = saving?.startsWith(`grupo-${g.id}`) || saving?.startsWith('move-')

            return (
              <div key={g.id} className="rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
                {/* Header del grupo */}
                <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 dark:bg-dark-elevated">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5 pt-0.5 flex-shrink-0">
                    <button onClick={() => moveGrupo(g.id, -1)} disabled={gi === 0 || !!saving} className="p-0.5 rounded text-gray-400 hover:text-accent disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveGrupo(g.id, 1)} disabled={gi === groups.length - 1 || !!saving} className="p-0.5 rounded text-gray-400 hover:text-accent disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                  </div>

                  {isEditing ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <input
                        className="input text-sm font-semibold"
                        value={draft.nombre}
                        onChange={e => setEditGrupo(prev => ({ ...prev, [g.id]: { ...draft, nombre: e.target.value } }))}
                        placeholder="Nombre del grupo"
                      />
                      <input
                        className="input text-sm"
                        value={draft.horario}
                        onChange={e => setEditGrupo(prev => ({ ...prev, [g.id]: { ...draft, horario: e.target.value } }))}
                        placeholder="Horario (ej: 17 a 20hs)"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{g.nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{g.horario || 'Sin horario'}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isEditing ? (
                      <>
                        <button onClick={() => saveGrupo(g)} disabled={!!saving} className="btn btn-primary text-xs py-1 px-2.5 flex items-center gap-1 disabled:opacity-50">
                          {isSavingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Guardar
                        </button>
                        <button onClick={() => cancelEditGrupo(g.id)} className="btn btn-ghost text-xs py-1 px-2.5"><X className="w-3 h-3" /></button>
                      </>
                    ) : (
                      <button onClick={() => startEditGrupo(g)} className="btn btn-ghost p-1.5" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>

                {/* Items del grupo */}
                <div className="divide-y divide-gray-100 dark:divide-dark-border">
                  {g.items.map(it => {
                    const isEditingItem = !!editItem[it.id]
                    const draftItem = editItem[it.id]
                    const isSavingItem = saving === `item-${it.id}` || saving === `del-item-${it.id}`

                    return (
                      <div key={it.id} className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-dark-surface">
                        {isEditingItem ? (
                          <>
                            <input
                              className="input text-sm flex-1"
                              value={draftItem.nombre}
                              onChange={e => setEditItem(prev => ({ ...prev, [it.id]: { ...draftItem, nombre: e.target.value } }))}
                              placeholder="Nombre del ítem"
                            />
                            <input
                              className="input text-sm w-28 flex-shrink-0"
                              value={draftItem.precio}
                              onChange={e => setEditItem(prev => ({ ...prev, [it.id]: { ...draftItem, precio: e.target.value } }))}
                              placeholder="Precio"
                            />
                            <button onClick={() => saveItem(g.id, it)} disabled={!!saving} className="btn btn-primary text-xs py-1 px-2 disabled:opacity-50">
                              {isSavingItem ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            </button>
                            <button onClick={() => cancelEditItem(it.id)} className="btn btn-ghost p-1"><X className="w-3 h-3" /></button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{it.nombre}</span>
                            <span className="text-sm font-semibold text-accent w-24 flex-shrink-0">{it.precio}</span>
                            <button onClick={() => startEditItem(it)} className="p-1 rounded text-gray-400 hover:text-accent"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteItem(g.id, it.id)} disabled={!!saving} className="p-1 rounded text-gray-400 hover:text-danger disabled:opacity-30">
                              {saving === `del-item-${it.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}

                  {/* Agregar item */}
                  {newItem[g.id] ? (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-accent/4 dark:bg-accent/8">
                      <input
                        className="input text-sm flex-1"
                        placeholder="Nombre del ítem"
                        value={newItem[g.id]!.nombre}
                        onChange={e => setNewItem(prev => ({ ...prev, [g.id]: { ...prev[g.id]!, nombre: e.target.value } }))}
                        onKeyDown={e => e.key === 'Enter' && addItem(g.id)}
                        autoFocus
                      />
                      <input
                        className="input text-sm w-28 flex-shrink-0"
                        placeholder="Precio"
                        value={newItem[g.id]!.precio}
                        onChange={e => setNewItem(prev => ({ ...prev, [g.id]: { ...prev[g.id]!, precio: e.target.value } }))}
                        onKeyDown={e => e.key === 'Enter' && addItem(g.id)}
                      />
                      <button onClick={() => addItem(g.id)} disabled={!!saving} className="btn btn-primary text-xs py-1 px-2.5 flex items-center gap-1 disabled:opacity-50">
                        {saving === `add-item-${g.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </button>
                      <button onClick={() => setNewItem(prev => ({ ...prev, [g.id]: null }))} className="p-1 rounded text-gray-400 hover:text-danger"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewItem(prev => ({ ...prev, [g.id]: { nombre: '', precio: '' } }))}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-400 hover:text-accent hover:bg-accent/4 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar ítem
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Menú Ejecutivo */}
      <div className="card p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Menú Ejecutivo</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Filas del menú ejecutivo. La primera fila es el título, la última el pie de página.
            En la columna "Valor", comenzá las líneas con <code className="text-xs bg-gray-100 dark:bg-dark-elevated px-1 rounded">-</code> para mostrarlas como bullets.
          </p>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-dark-border rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
          {menuEjecutivo.map(m => {
            const isEditing = !!editMenu[m.id]
            const draft = editMenu[m.id]

            return (
              <div key={m.id} className="bg-white dark:bg-dark-surface">
                {isEditing ? (
                  <div className="flex gap-3 p-3">
                    <input
                      className="input text-sm w-36 flex-shrink-0"
                      value={draft.label}
                      onChange={e => setEditMenu(prev => ({ ...prev, [m.id]: { ...draft, label: e.target.value } }))}
                      placeholder="Etiqueta"
                    />
                    <textarea
                      className="input text-sm flex-1 resize-none min-h-[60px]"
                      value={draft.value}
                      onChange={e => setEditMenu(prev => ({ ...prev, [m.id]: { ...draft, value: e.target.value } }))}
                      placeholder="Valor (una línea por ítem, comenzar con - para bullets)"
                      rows={3}
                    />
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => saveMenu(m)} disabled={!!saving} className="btn btn-primary text-xs py-1 px-2.5 flex items-center gap-1 disabled:opacity-50">
                        {saving === `menu-${m.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Guardar
                      </button>
                      <button onClick={() => cancelEditMenu(m.id)} className="btn btn-ghost text-xs py-1 px-2.5"><X className="w-3 h-3" /> Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="w-36 flex-shrink-0">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{m.label || '—'}</span>
                    </div>
                    <p className="flex-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{m.value || '—'}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => startEditMenu(m)} className="p-1 rounded text-gray-400 hover:text-accent"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteMenu(m.id)} disabled={!!saving} className="p-1 rounded text-gray-400 hover:text-danger disabled:opacity-30">
                        {saving === `del-menu-${m.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Agregar fila */}
          {newMenu ? (
            <div className="flex gap-3 p-3 bg-accent/4 dark:bg-accent/8">
              <input
                className="input text-sm w-36 flex-shrink-0"
                placeholder="Etiqueta"
                value={newMenu.label}
                onChange={e => setNewMenu(prev => ({ ...prev!, label: e.target.value }))}
                autoFocus
              />
              <textarea
                className="input text-sm flex-1 resize-none"
                placeholder="Valor"
                value={newMenu.value}
                onChange={e => setNewMenu(prev => ({ ...prev!, value: e.target.value }))}
                rows={2}
              />
              <div className="flex flex-col gap-1.5">
                <button onClick={addMenu} disabled={!!saving} className="btn btn-primary text-xs py-1 px-2.5 flex items-center gap-1 disabled:opacity-50">
                  {saving === 'add-menu' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Agregar
                </button>
                <button onClick={() => setNewMenu(null)} className="btn btn-ghost text-xs py-1 px-2.5">Cancelar</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setNewMenu({ label: '', value: '' })}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-accent hover:bg-accent/4 transition-all"
            >
              <Plus className="w-4 h-4" />
              Agregar fila al menú
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/8 border border-blue-200 dark:border-blue-500/20">
        <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Los cambios se guardan en el servidor y se aplican al Visor 2 inmediatamente desde cualquier dispositivo.
        </p>
      </div>
    </div>
  )
}

// ── Visor 1 Admin ─────────────────────────────────────────────────────────────
interface BirraV2 { birra_id: number; canilla: number; estilo: string; tipo: string; palabras_destacar: string }

function Visor1Admin() {
  const [config, setConfig] = useState<VisorConfig>(() => loadVisorConfig())
  const [savedMsg, setSavedMsg] = useState(false)
  const [nuevaCanilla, setNuevaCanilla] = useState('')
  const [errorCanilla, setErrorCanilla] = useState('')
  const [addingPhoto, setAddingPhoto] = useState(false)
  const [fotoCanillaInput, setFotoCanillaInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputEditRef = useRef<HTMLInputElement>(null)
  const [editingPhotoCanilla, setEditingPhotoCanilla] = useState<string | null>(null)
  const [birras, setBirras] = useState<BirraOpcion[]>([])
  const [loadingBirras, setLoadingBirras] = useState(true)

  // Birras V2 para palabras destacadas
  const [birrasV2, setBirrasV2] = useState<BirraV2[]>([])
  const [palabrasDraft, setPalabrasDraft] = useState<Record<number, string>>({})
  const [savingPalabras, setSavingPalabras] = useState<Record<number, boolean>>({})

  useEffect(() => {
    barrilesApi.infoBirras('1')
      .then(data => setBirras(data.birras))
      .catch(() => {})
      .finally(() => setLoadingBirras(false))
  }, [])

  useEffect(() => {
    barrilesV2Api.getVisorBarriles()
      .then((data: any[]) => {
        const sorted = [...data].sort((a, b) => (a.canilla ?? 0) - (b.canilla ?? 0))
        setBirrasV2(sorted.map(b => ({
          birra_id: b.birra_id,
          canilla: b.canilla ?? 0,
          estilo: b.estilo ?? '',
          tipo: b.tipo ?? '',
          palabras_destacar: b.palabras_destacar ?? '',
        })))
        const draft: Record<number, string> = {}
        for (const b of sorted) draft[b.birra_id] = b.palabras_destacar ?? ''
        setPalabrasDraft(draft)
      })
      .catch(() => {})
  }, [])

  const savePalabras = async (birra_id: number) => {
    const val = palabrasDraft[birra_id] ?? ''
    const current = birrasV2.find(b => b.birra_id === birra_id)?.palabras_destacar ?? ''
    if (val === current) return
    setSavingPalabras(prev => ({ ...prev, [birra_id]: true }))
    try {
      await barrilesV2Api.updateBirra(birra_id, { palabras_destacar: val })
      setBirrasV2(prev => prev.map(b => b.birra_id === birra_id ? { ...b, palabras_destacar: val } : b))
    } catch (e) {
      console.error(e)
    } finally {
      setSavingPalabras(prev => ({ ...prev, [birra_id]: false }))
    }
  }

  const save = (next: VisorConfig) => {
    saveVisorConfig(next)
    setConfig(next)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  const addCanillaFija = () => {
    const v = nuevaCanilla.trim()
    if (!v) { setErrorCanilla('Ingresá un número de canilla'); return }
    if (!/^\d+$/.test(v)) { setErrorCanilla('Solo números'); return }
    if (config.canillas_fijas.some(c => c.canilla === v)) { setErrorCanilla('Esa canilla ya está configurada'); return }
    setErrorCanilla('')
    save({ ...config, canillas_fijas: [...config.canillas_fijas, { canilla: v, enabled: true }].sort((a, b) => parseInt(a.canilla) - parseInt(b.canilla)) })
    setNuevaCanilla('')
  }

  const removeCanillaFija = (canilla: string) =>
    save({ ...config, canillas_fijas: config.canillas_fijas.filter(c => c.canilla !== canilla) })

  const toggleCanillaFija = (canilla: string) =>
    save({ ...config, canillas_fijas: config.canillas_fijas.map(c => c.canilla === canilla ? { ...c, enabled: !c.enabled } : c) })

  const updateCanillaFija = (canilla: string, fields: { estilo?: string; precio?: string }) =>
    save({ ...config, canillas_fijas: config.canillas_fijas.map(c => c.canilla === canilla ? { ...c, ...fields } : c) })

  const onEstiloChange = (canilla: string, estiloValue: string) => {
    const match = birras.find(b => b.estilo === estiloValue)
    updateCanillaFija(canilla, { estilo: estiloValue, ...(match ? { precio: match.precio } : {}) })
  }

  const handlePhotoFile = (canilla: string, file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => save({ ...config, beer_photos: { ...config.beer_photos, [canilla]: e.target?.result as string } })
    reader.readAsDataURL(file)
  }

  const removePhoto = (canilla: string) => {
    const { [canilla]: _, ...rest } = config.beer_photos
    save({ ...config, beer_photos: rest })
  }

  const photoEntries = Object.entries(config.beer_photos).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))

  return (
    <div className="space-y-8">
      {savedMsg && (
        <div className="flex items-center gap-1.5 text-sm text-success font-medium animate-slide-down">
          <Check className="w-4 h-4" /> Guardado
        </div>
      )}

      {/* Canillas fijas */}
      <div className="card p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Canillas con Posición Fija</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configurá las canillas que siempre tienen la misma birra. Cuando no haya nada pinchado,
            el visor mostrará la última cerveza con un cartel de <span className="font-semibold text-danger">AGOTADA</span>.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="number" min="1" max="99" placeholder="Número de canilla (ej: 9)"
              value={nuevaCanilla}
              onChange={e => { setNuevaCanilla(e.target.value); setErrorCanilla('') }}
              onKeyDown={e => e.key === 'Enter' && addCanillaFija()}
              className="input w-full"
            />
            {errorCanilla && (
              <p className="mt-1 text-xs text-danger flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errorCanilla}
              </p>
            )}
          </div>
          <button onClick={addCanillaFija} className="btn btn-primary flex items-center gap-1.5 flex-shrink-0">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>

        {config.canillas_fijas.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-600 border border-dashed border-gray-200 dark:border-dark-border rounded-xl">
            No hay canillas fijas configuradas
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-dark-border rounded-xl border border-gray-100 dark:border-dark-border overflow-hidden">
            {config.canillas_fijas.map(item => (
              <div key={item.canilla} className="flex flex-col gap-3 px-4 py-4 bg-white dark:bg-dark-surface">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center bg-accent/10 dark:bg-accent/20">
                    <span className="text-sm font-black text-accent">{item.canilla}</span>
                  </div>
                  <p className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Canilla {item.canilla}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.enabled ? 'Activa' : 'Off'}</span>
                    <Toggle value={item.enabled} onChange={() => toggleCanillaFija(item.canilla)} />
                  </div>
                  <button onClick={() => removeCanillaFija(item.canilla)} className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-danger/8 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2 pl-13">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1.5 block">
                      Cerveza {loadingBirras && <Loader2 className="w-3 h-3 animate-spin" />}
                    </label>
                    <input
                      list={`birras-list-${item.canilla}`}
                      placeholder={loadingBirras ? 'Cargando...' : 'Buscá o escribí el estilo…'}
                      value={item.estilo ?? ''}
                      onChange={e => onEstiloChange(item.canilla, e.target.value)}
                      className="input w-full text-sm"
                      disabled={loadingBirras}
                    />
                    <datalist id={`birras-list-${item.canilla}`}>
                      {birras.map(b => <option key={b.estilo} value={b.estilo} />)}
                    </datalist>
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1 block">Precio (auto)</label>
                    <input
                      type="text" placeholder="—"
                      value={item.precio ?? ''}
                      onChange={e => updateCanillaFija(item.canilla, { precio: e.target.value })}
                      className="input w-full text-sm"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 pl-13">
                  {item.estilo
                    ? `Visor mostrará "${item.estilo}"${item.precio ? ` · ${item.precio}` : ''} como AGOTADA.`
                    : 'Seleccioná una birra del listado para que aparezca en el visor cuando esté vacía.'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fotos de birras */}
      <div className="card p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Fotos de Birras</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Asigná una foto a cada canilla. Aparece en chiquito al lado del nombre en el visor. Si no hay foto, no se muestra nada.
          </p>
        </div>

        {photoEntries.length > 0 && (
          <div className="divide-y divide-gray-100 dark:divide-dark-border rounded-xl border border-gray-100 dark:border-dark-border overflow-hidden">
            {photoEntries.map(([canilla, dataUrl]) => (
              <div key={canilla} className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-dark-surface">
                <div className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center bg-accent/10 dark:bg-accent/20">
                  <span className="text-sm font-black text-accent">{canilla}</span>
                </div>
                <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-elevated">
                  <img src={dataUrl} alt={`Canilla ${canilla}`} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Canilla {canilla}</p>
                  <p className="text-xs text-gray-400">Foto cargada</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingPhotoCanilla(canilla); fileInputEditRef.current?.click() }} className="btn btn-ghost text-xs py-1.5 px-3">Cambiar</button>
                  <button onClick={() => removePhoto(canilla)} className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-danger/8 transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {addingPhoto ? (
          <div className="flex flex-wrap gap-2 p-4 rounded-xl border border-dashed border-accent/40 bg-accent/4 dark:bg-accent/8">
            <input type="number" min="1" max="99" placeholder="Nro. de canilla" value={fotoCanillaInput} onChange={e => setFotoCanillaInput(e.target.value)} className="input w-32 sm:w-40" />
            <button onClick={() => { const c = fotoCanillaInput.trim(); if (c && /^\d+$/.test(c)) fileInputRef.current?.click() }} disabled={!fotoCanillaInput.trim() || !/^\d+$/.test(fotoCanillaInput.trim())} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-40">
              <Image className="w-4 h-4" /> Elegir foto
            </button>
            <button onClick={() => { setAddingPhoto(false); setFotoCanillaInput('') }} className="btn btn-ghost">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setAddingPhoto(true)} className="btn btn-ghost w-full border border-dashed border-gray-300 dark:border-dark-border flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-accent hover:border-accent/40 transition-all">
            <Plus className="w-4 h-4" /> Agregar foto para una canilla
          </button>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => {
            const file = e.target.files?.[0] ?? null
            const c = fotoCanillaInput.trim()
            if (file && c) { handlePhotoFile(c, file); setAddingPhoto(false); setFotoCanillaInput('') }
            e.target.value = ''
          }}
        />
        <input ref={fileInputEditRef} type="file" accept="image/*" className="hidden"
          onChange={e => {
            const file = e.target.files?.[0] ?? null
            if (file && editingPhotoCanilla) { handlePhotoFile(editingPhotoCanilla, file); setEditingPhotoCanilla(null) }
            e.target.value = ''
          }}
        />
      </div>

      {/* Palabras destacadas */}
      <div className="card p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Palabras Destacadas</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Palabras que aparecen en <span className="font-bold" style={{ color: '#F5A623' }}>dorado</span> dentro del nombre de cada birra en el Visor 1.
            Separalas con comas. Se guarda automáticamente al salir del campo.
          </p>
        </div>

        {birrasV2.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400 dark:text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando estilos…
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-dark-border rounded-xl border border-gray-100 dark:border-dark-border overflow-hidden">
            {birrasV2.map(b => (
              <div key={b.birra_id} className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-dark-surface">
                <div className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-black bg-accent/10 dark:bg-accent/20 text-accent">
                  {b.canilla}
                </div>
                <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-200">{b.estilo}</span>
                <input
                  className="input w-56 flex-shrink-0 text-sm"
                  placeholder="ej: IPA, argenta, reserva"
                  value={palabrasDraft[b.birra_id] ?? ''}
                  onChange={e => setPalabrasDraft(prev => ({ ...prev, [b.birra_id]: e.target.value }))}
                  onBlur={() => savePalabras(b.birra_id)}
                  onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                />
                {savingPalabras[b.birra_id]
                  ? <Loader2 className="w-4 h-4 animate-spin text-accent flex-shrink-0" />
                  : (palabrasDraft[b.birra_id] ?? '') === b.palabras_destacar && b.palabras_destacar
                    ? <Check className="w-4 h-4 text-success flex-shrink-0" />
                    : <span className="w-4 flex-shrink-0" />
                }
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/8 border border-blue-200 dark:border-blue-500/20">
        <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Las canillas fijas y fotos se guardan en este dispositivo. Las palabras destacadas se guardan en el servidor y aplican desde cualquier dispositivo.
        </p>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
type VisorTab = 'visor1' | 'visor2'

export function ModificarVisor() {
  const [tab, setTab] = useState<VisorTab>('visor1')

  const tabs: { id: VisorTab; label: string }[] = [
    { id: 'visor1', label: 'Visor 1 — Birras' },
    { id: 'visor2', label: 'Visor 2 — Promos' },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center">
          <Tv className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Modificar Visor</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Configuración de los displays</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-dark-elevated w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'visor1' && <Visor1Admin />}
      {tab === 'visor2' && <Visor2Admin />}
    </div>
  )
}

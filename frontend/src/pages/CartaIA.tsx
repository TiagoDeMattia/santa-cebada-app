import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import {
  Bot, BookOpen, Upload, Trash2, ToggleLeft, ToggleRight,
  Send, FileText, Plus, Pencil, X, RefreshCw, ChevronDown, ChevronUp,
  File, FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { cartaIaApi } from '../lib/api'

// ─── Markdown renderer ───────────────────────────────────────────────────────

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const nodes: ReactNode[] = []
  let j = 0

  while (j < lines.length) {
    const raw = lines[j]
    const trimmed = raw.trim()

    if (!trimmed) { j++; continue }

    // Numbered list item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
    if (numMatch) {
      const listItems: ReactNode[] = []
      while (j < lines.length) {
        const l = lines[j]
        const lt = l.trim()
        if (!lt) { j++; continue }
        const nm = lt.match(/^(\d+)\.\s+(.+)/)
        if (nm) {
          const subItems: ReactNode[] = []
          j++
          while (j < lines.length && /^\s*[*\-]\s/.test(lines[j])) {
            const sub = lines[j].trim().replace(/^[*\-]\s+/, '')
            subItems.push(<li key={j} className="text-[0.82rem] opacity-85">{renderInline(sub)}</li>)
            j++
          }
          listItems.push(
            <li key={`n${j}`} className="mb-1.5">
              <span>{renderInline(nm[2])}</span>
              {subItems.length > 0 && (
                <ul className="list-[circle] pl-4 mt-1 space-y-0.5">{subItems}</ul>
              )}
            </li>
          )
        } else if (/^\s*[*\-]\s/.test(l)) {
          j++
        } else {
          break
        }
      }
      nodes.push(
        <ol key={nodes.length} className="list-decimal pl-5 space-y-0.5 my-2">
          {listItems}
        </ol>
      )
      continue
    }

    // Standalone bullet list
    if (/^\s*[*\-]\s/.test(raw)) {
      const items: ReactNode[] = []
      while (j < lines.length && /^\s*[*\-]\s/.test(lines[j])) {
        const sub = lines[j].trim().replace(/^[*\-]\s+/, '')
        items.push(<li key={j}>{renderInline(sub)}</li>)
        j++
      }
      nodes.push(<ul key={nodes.length} className="list-disc pl-4 space-y-0.5 my-1.5">{items}</ul>)
      continue
    }

    // Regular paragraph
    nodes.push(<p key={nodes.length} className="mb-1 last:mb-0">{renderInline(trimmed)}</p>)
    j++
  }

  return <div className="space-y-0.5 text-[0.84rem] leading-relaxed">{nodes}</div>
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Doc {
  id: number
  titulo: string
  tipo: string
  filename: string | null
  mime_type: string | null
  activo: number
  orden: number
  updated_at: string
  updated_by: string | null
  chars: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const TIPOS = ['general', 'carta', 'bebidas', 'cervezas', 'info']
const TIPO_LABELS: Record<string, string> = {
  general: 'General', carta: 'Carta', bebidas: 'Bebidas',
  cervezas: 'Cervezas', info: 'Info del local',
}

function fileIcon(doc: Doc) {
  const ext = doc.filename?.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return <FileText className="w-4 h-4 text-red-500" />
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="w-4 h-4 text-green-600" />
  if (ext === 'docx') return <FileText className="w-4 h-4 text-blue-500" />
  return <File className="w-4 h-4 text-gray-400" />
}

function fmt(chars: number) {
  if (chars < 1000) return `${chars} chars`
  return `${(chars / 1000).toFixed(1)}k chars`
}

// ─── Modal agregar / editar doc ──────────────────────────────────────────────

function DocModal({ doc, onClose, onSave }: {
  doc: Doc | null
  onClose: () => void
  onSave: () => void
}) {
  const isNew = !doc
  const [titulo, setTitulo] = useState(doc?.titulo ?? '')
  const [tipo, setTipo]     = useState(doc?.tipo ?? 'general')
  const [file, setFile]     = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const fileRef             = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!titulo.trim()) { setError('El título es obligatorio'); return }
    setSaving(true); setError('')
    try {
      if (isNew) {
        await cartaIaApi.createDoc(titulo.trim(), tipo, file ?? undefined)
      } else {
        await cartaIaApi.updateDoc(doc.id, { titulo: titulo.trim(), tipo })
        if (file) await cartaIaApi.replaceFile(doc.id, file)
      }
      onSave()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Error al guardar')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">
          {isNew ? 'Agregar documento' : 'Editar documento'}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Título</label>
            <input
              className="input w-full mt-1"
              placeholder="ej: Carta de comidas"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tipo</label>
            <select className="input w-full mt-1" value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {isNew ? 'Archivo (opcional — podés editar el contenido después)' : 'Reemplazar archivo'}
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-1 border-2 border-dashed border-gray-200 dark:border-dark-border rounded-xl p-4 text-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {file ? file.name : 'Subir PDF, Word, Excel, CSV o TXT'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Hacé clic para elegir</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.pdf,.docx,.xlsx,.xls,.csv"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg bg-gray-100 dark:bg-dark-elevated text-sm font-semibold text-gray-600 dark:text-gray-400 hover:opacity-80 transition-opacity">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 h-9 rounded-lg bg-accent text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fila de documento ────────────────────────────────────────────────────────

function DocRow({ doc, onEdit, onToggle, onDelete, onReplaceFile }: {
  doc: Doc
  onEdit: (d: Doc) => void
  onToggle: (d: Doc) => void
  onDelete: (d: Doc) => void
  onReplaceFile: (d: Doc, file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(false)
  const isActive = doc.activo === 1

  return (
    <div className={`rounded-xl border transition-all ${isActive ? 'bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border' : 'bg-gray-50 dark:bg-dark-elevated border-gray-100 dark:border-dark-border opacity-60'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="shrink-0">{fileIcon(doc)}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold truncate ${isActive ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-500'}`}>
              {doc.titulo}
            </p>
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-elevated text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {TIPO_LABELS[doc.tipo] ?? doc.tipo}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {doc.filename ?? 'Sin archivo'} · {fmt(doc.chars)}
            {doc.updated_by && ` · ${doc.updated_by}`}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-elevated transition-colors"
            title="Ver contenido"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="Reemplazar archivo"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(doc)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-elevated transition-colors"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggle(doc)}
            className={`p-1.5 rounded-lg transition-colors ${isActive ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
            title={isActive ? 'Desactivar' : 'Activar'}
          >
            {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onDelete(doc)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".txt,.md,.pdf,.docx,.xlsx,.xls,.csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) onReplaceFile(doc, f) }}
        />
      </div>

      {expanded && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-gray-50 dark:bg-dark-elevated border border-gray-100 dark:border-dark-border p-3 max-h-48 overflow-y-auto">
            <DocContent docId={doc.id} />
          </div>
        </div>
      )}
    </div>
  )
}

function DocContent({ docId }: { docId: number }) {
  const [content, setContent] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cartaIaApi.getDoc(docId).then(d => setContent(d.contenido)).catch(() => setContent('Error al cargar'))
  }, [docId])

  const save = async () => {
    setSaving(true)
    try {
      await cartaIaApi.updateDoc(docId, { contenido: draft })
      setContent(draft)
      setEditing(false)
    } catch {}
    setSaving(false)
  }

  if (content === null) return <p className="text-xs text-gray-400 animate-pulse">Cargando...</p>

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          className="input w-full text-xs font-mono resize-none"
          rows={8}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="text-xs px-3 py-1 rounded-lg bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-gray-400 hover:opacity-80">Cancelar</button>
          <button onClick={save} disabled={saving} className="text-xs px-3 py-1 rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group relative">
      <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">{content || '(vacío)'}</pre>
      <button
        onClick={() => { setDraft(content ?? ''); setEditing(true) }}
        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-0.5 rounded bg-accent text-white"
      >
        Editar texto
      </button>
    </div>
  )
}

// ─── Tab Documentos ───────────────────────────────────────────────────────────

function TabDocs() {
  const [docs, setDocs]       = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<Doc | null | 'new'>()

  const load = useCallback(async () => {
    setLoading(true)
    try { setDocs(await cartaIaApi.getDocs()) } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (doc: Doc) => {
    await cartaIaApi.toggleActive(doc.id)
    load()
  }

  const handleDelete = async (doc: Doc) => {
    if (!confirm(`¿Eliminar "${doc.titulo}"?`)) return
    await cartaIaApi.deleteDoc(doc.id)
    load()
  }

  const handleReplaceFile = async (doc: Doc, file: File) => {
    await cartaIaApi.replaceFile(doc.id, file)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {docs.filter(d => d.activo).length} de {docs.length} documentos activos
        </p>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 dark:border-dark-border text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-elevated transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setModal('new')}
            className="flex items-center gap-2 px-3 h-9 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0,1,2].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-dark-elevated animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-dark-border rounded-2xl">
          <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">Sin documentos</p>
          <p className="text-sm text-gray-400 dark:text-gray-600 mt-1">Agregá la carta, bebidas, cervezas, etc.</p>
          <button onClick={() => setModal('new')} className="mt-4 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            Agregar primer documento
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <DocRow
              key={doc.id}
              doc={doc}
              onEdit={setModal}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onReplaceFile={handleReplaceFile}
            />
          ))}
        </div>
      )}

      {modal && (
        <DocModal
          doc={modal === 'new' ? null : modal}
          onClose={() => setModal(undefined)}
          onSave={load}
        />
      )}
    </div>
  )
}

// ─── Tab Chat ─────────────────────────────────────────────────────────────────

function TabChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      const { respuesta } = await cartaIaApi.chat(q)
      setMessages(prev => [...prev, { role: 'assistant', content: respuesta }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar con el asistente.' }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-7 h-7 text-accent" />
            </div>
            <p className="font-semibold text-gray-700 dark:text-gray-300">Asistente de carta</p>
            <p className="text-sm text-gray-400 dark:text-gray-600 mt-1 max-w-xs mx-auto">
              Preguntame sobre platos, bebidas, ingredientes, precios o cualquier info de la carta.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {['¿Qué opciones vegetarianas hay?', '¿Cuánto cuesta la tabla de fiambres?', '¿Qué cervezas tienen en lata?'].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50) }}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-dark-elevated text-gray-600 dark:text-gray-400 hover:bg-accent/10 hover:text-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold ${
              msg.role === 'user'
                ? 'bg-accent text-white'
                : 'bg-gradient-to-br from-violet-500 to-accent text-white'
            }`}>
              {msg.role === 'user' ? 'Vos' : <Bot className="w-3.5 h-3.5" />}
            </div>

            {/* Bubble */}
            {msg.role === 'user' ? (
              <div className="max-w-[75%] bg-accent text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[88%] bg-white dark:bg-dark-elevated border border-gray-100 dark:border-dark-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="text-gray-800 dark:text-gray-200">
                  <MarkdownMessage content={msg.content} />
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-dark-elevated flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="bg-gray-100 dark:bg-dark-elevated rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2 pt-4 border-t border-gray-100 dark:border-dark-border">
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-elevated transition-all"
            title="Limpiar chat"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <input
          ref={inputRef}
          className="input flex-1 text-sm"
          placeholder="Preguntá sobre la carta..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          autoFocus
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="px-4 rounded-xl bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Tab = 'chat' | 'docs'

export default function CartaIA() {
  const { user } = useAuth()
  const isAdmin   = user?.role === 'admin'
  const [tab, setTab] = useState<Tab>('chat')

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-accent" />
            Asistente IA
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Consultas sobre la carta, bebidas y cervezas
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-dark-elevated w-fit">
        <button
          onClick={() => setTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'chat'
              ? 'bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Bot className="w-4 h-4" /> Chat
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab('docs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'docs'
                ? 'bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Documentos
          </button>
        )}
      </div>

      {tab === 'chat' && <TabChat />}
      {tab === 'docs' && isAdmin && <TabDocs />}
    </div>
  )
}

import { useState, useCallback } from 'react'
import {
  Search,
  Package,
  Edit2,
  Check,
  X,
  ChevronDown,
  Filter,
} from 'lucide-react'
import { productosApi } from '../lib/api'
import type { Producto } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { useToast, ToastContainer } from '../components/ui/Toast'
import { formatCurrency, getErrorMessage } from '../lib/utils'

const SUCURSALES = [
  { id: '1', nombre: 'Recoleta' },
]

interface EditingPrice {
  codigo: string
  value: string
}

export function Productos() {
  const { toasts, addToast, removeToast } = useToast()

  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const [searchCodigo, setSearchCodigo] = useState('')
  const [searchNombre, setSearchNombre] = useState('')
  const [sucursalId, setSucursalId] = useState('1')

  const [editing, setEditing] = useState<EditingPrice | null>(null)
  const [savingCodigo, setSavingCodigo] = useState<string | null>(null)

  const buscar = useCallback(async () => {
    setLoading(true)
    setSearched(true)
    try {
      const data = await productosApi.listar({
        codigo: searchCodigo || undefined,
        nombre: searchNombre || undefined,
        sucursal_id: sucursalId,
      })
      setProductos(data)
    } catch (err) {
      addToast('error', getErrorMessage(err))
      setProductos([])
    } finally {
      setLoading(false)
    }
  }, [searchCodigo, searchNombre, sucursalId, addToast])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buscar()
  }

  const startEdit = (producto: Producto) => {
    setEditing({
      codigo: producto.codigo,
      value: producto.precio?.toString() ?? '',
    })
  }

  const cancelEdit = () => setEditing(null)

  const savePrice = async (codigo: string) => {
    if (!editing) return
    const precio = parseFloat(editing.value.replace(',', '.'))
    if (isNaN(precio) || precio <= 0) {
      addToast('error', 'Ingresá un precio válido')
      return
    }

    setSavingCodigo(codigo)
    try {
      await productosApi.actualizarPrecio({ codigo, precio, sucursal_id: sucursalId })
      setProductos((prev) =>
        prev.map((p) => (p.codigo === codigo ? { ...p, precio } : p))
      )
      addToast('success', `Precio actualizado: ${codigo} → ${formatCurrency(precio)}`)
      setEditing(null)
    } catch (err) {
      addToast('error', getErrorMessage(err))
    } finally {
      setSavingCodigo(null)
    }
  }

  const sucursalNombre = SUCURSALES.find((s) => s.id === sucursalId)?.nombre

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Productos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
            Buscá y editá precios del catálogo
          </p>
        </div>
        {productos.length > 0 && (
          <span className="badge badge-neutral">
            {productos.length} resultado{productos.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Sucursal selector */}
          <div className="relative flex-shrink-0">
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              className="input appearance-none pr-8 w-full sm:w-40"
            >
              {SUCURSALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Código */}
          <div className="relative flex-1">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchCodigo}
              onChange={(e) => setSearchCodigo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Código..."
              className="input pl-9"
            />
          </div>

          {/* Nombre */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchNombre}
              onChange={(e) => setSearchNombre(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nombre del producto..."
              className="input pl-9"
            />
          </div>

          <button onClick={buscar} disabled={loading} className="btn-primary flex-shrink-0">
            {loading ? <Spinner size="sm" className="text-white" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500 dark:text-gray-500">Cargando productos...</p>
        </div>
      )}

      {!loading && searched && productos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-dark-elevated flex items-center justify-center">
            <Package className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            No se encontraron productos
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Probá con otros filtros o dejá los campos vacíos para ver todos
          </p>
        </div>
      )}

      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center">
            <Search className="w-6 h-6 text-accent" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Buscá productos para comenzar
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Podés filtrar por código, nombre o dejar vacío para ver todos
          </p>
        </div>
      )}

      {!loading && productos.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">
              Sucursal {sucursalNombre}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-600">
              Hacé clic en el ícono de edición para modificar el precio
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-border">
                  <th className="text-left px-5 py-3 table-header">Código</th>
                  <th className="text-left px-5 py-3 table-header">Nombre</th>
                  <th className="text-left px-5 py-3 table-header hidden md:table-cell">Categoría</th>
                  <th className="text-left px-5 py-3 table-header hidden lg:table-cell">Estado</th>
                  <th className="text-right px-5 py-3 table-header">Precio</th>
                  <th className="px-5 py-3 table-header w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-dark-border">
                {productos.map((p) => {
                  const isEditing = editing?.codigo === p.codigo
                  const isSaving = savingCodigo === p.codigo

                  return (
                    <tr
                      key={p.codigo}
                      className="hover:bg-surface-secondary dark:hover:bg-dark-elevated/50 transition-colors duration-100"
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-mono font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-dark-elevated px-2 py-0.5 rounded-md">
                          {p.codigo}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {p.nombre}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {p.categoria ?? '—'}
                          {p.subcategoria && (
                            <span className="text-gray-400 dark:text-gray-600"> · {p.subcategoria}</span>
                          )}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        {p.activo ? (
                          <span className="badge badge-success">Activo</span>
                        ) : (
                          <span className="badge badge-danger">Inactivo</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editing.value}
                            onChange={(e) =>
                              setEditing({ ...editing, value: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') savePrice(p.codigo)
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className="input text-right w-32 py-1.5 text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {p.precio != null ? formatCurrency(p.precio) : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => savePrice(p.codigo)}
                              disabled={isSaving}
                              className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors"
                            >
                              {isSaving ? (
                                <Spinner size="sm" className="text-success" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(p)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-all duration-200"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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
  )
}

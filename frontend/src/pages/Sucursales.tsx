import { useEffect, useState } from 'react'
import { Store, Mail, Hash, Building2 } from 'lucide-react'
import { sucursalesApi } from '../lib/api'
import type { Sucursal } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { useToast, ToastContainer } from '../components/ui/Toast'
import { getErrorMessage } from '../lib/utils'

export function Sucursales() {
  const { toasts, addToast, removeToast } = useToast()
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sucursalesApi
      .listar()
      .then(setSucursales)
      .catch((err) => addToast('error', getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [addToast])

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Sucursales</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
          Información de las sucursales configuradas
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!loading && sucursales.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-dark-elevated flex items-center justify-center">
            <Store className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            No se pudieron cargar las sucursales
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {sucursales.map((s) => (
          <div key={s.id} className="card p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center">
                <Store className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {s.nombre}
                </h2>
                <span className="badge badge-success">Activa</span>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-secondary dark:bg-dark-elevated flex items-center justify-center flex-shrink-0">
                  <Hash className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600">ID Sucursal</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-secondary dark:bg-dark-elevated flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600">Company ID (NucleoCheck)</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {s.company_id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-secondary dark:bg-dark-elevated flex items-center justify-center flex-shrink-0">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600">Email de acceso</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all">
                    {s.email}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="card p-4 flex items-start gap-3 bg-surface-secondary dark:bg-dark-elevated border-0">
        <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Configuración de sucursales
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
            Las sucursales se configuran en el archivo <code className="font-mono bg-gray-100 dark:bg-dark-border px-1 py-0.5 rounded text-xs">.env</code> del backend.
            Para agregar o modificar sucursales, editá las variables de entorno correspondientes.
          </p>
        </div>
      </div>
    </div>
  )
}

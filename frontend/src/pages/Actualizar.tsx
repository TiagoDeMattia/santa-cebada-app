import { useState } from 'react'
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  AlertTriangle,
  FileSpreadsheet,
  Zap,
} from 'lucide-react'
import { productosApi } from '../lib/api'
import type { ActualizacionResultado } from '../types'
import { Spinner } from '../components/ui/Spinner'
import { ProgressPanel } from '../components/ui/ProgressPanel'
import { useToast, ToastContainer } from '../components/ui/Toast'
import { getErrorMessage } from '../lib/utils'

const SUCURSALES = [
  { id: '1', nombre: 'Recoleta' },
]

export function Actualizar() {
  const { toasts, addToast, removeToast } = useToast()

  const [sucursalId, setSucursalId] = useState('1')
  const [modoPrueba, setModoPrueba] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<ActualizacionResultado | null>(null)
  const [progress, setProgress] = useState(0)

  const handleActualizar = async () => {
    setLoading(true)
    setResultado(null)
    setProgress(0)
    try {
      // Simular progreso mientras se procesa (máximo 90%)
      const progressInterval = setInterval(() => {
        setProgress((p) => {
          if (p >= 85) return p
          return p + Math.random() * 20
        })
      }, 800)

      const res = await productosApi.actualizarDesdeSheet({
        sucursal_id: sucursalId,
        modo_prueba: modoPrueba,
      })
      
      clearInterval(progressInterval)
      // Llegar a 100% solo cuando se completa
      setProgress(100)
      setResultado(res)
      
      if (res.fallidos === 0) {
        addToast('success', `${res.exitosos} precios actualizados correctamente`)
      } else {
        addToast('warning', `${res.exitosos} exitosos, ${res.fallidos} con errores`)
      }
    } catch (err) {
      setProgress(0)
      addToast('error', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const sucursalNombre = SUCURSALES.find((s) => s.id === sucursalId)?.nombre
  const successRate = resultado
    ? Math.round((resultado.exitosos / (resultado.exitosos + resultado.fallidos)) * 100)
    : null

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <ProgressPanel
        isVisible={loading}
        title={`Actualizando ${sucursalNombre}`}
        status={resultado ? (resultado.fallidos === 0 ? 'completed' : 'error') : 'processing'}
        progress={Math.round(progress)}
        currentItem={modoPrueba ? 'Modo prueba: 1 producto' : 'Procesando productos...'}
        totalItems={resultado?.total_procesados || (modoPrueba ? 1 : undefined)}
        processedItems={resultado ? resultado.exitosos + resultado.fallidos : undefined}
        successCount={resultado?.exitosos}
        errorCount={resultado?.fallidos}
        detalles={resultado?.detalles_exitosos || []}
      />

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Actualizar precios
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
          Sincronizá los precios desde Google Sheets a NucleoCheck
        </p>
      </div>

      {/* Info */}
      <div className="card p-4 flex items-start gap-3 bg-accent/5 dark:bg-accent/10 border-accent/20">
        <FileSpreadsheet className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Fuente: Google Sheets · Lista consolidada
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
            Lee los precios de la columna G y los códigos de la columna E.
            El proceso puede tardar varios minutos dependiendo de la cantidad de productos.
          </p>
        </div>
      </div>

      {/* Config */}
      <div className="card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Configuración
        </h2>

        {/* Sucursal */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Sucursal destino
          </label>
          <div className="relative">
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              className="input appearance-none pr-8"
              disabled={loading}
            >
              {SUCURSALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Modo prueba */}
        <div className="flex items-center justify-between p-4 bg-surface-secondary dark:bg-dark-elevated rounded-xl">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Modo prueba</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              Procesa solo el primer producto del Sheet
            </p>
          </div>
          <button
            onClick={() => setModoPrueba((v) => !v)}
            disabled={loading}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
              modoPrueba ? 'bg-accent' : 'bg-gray-200 dark:bg-dark-border'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                modoPrueba ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {modoPrueba && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-warning/8 border border-warning/20 rounded-xl">
            <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-xs text-warning">
              Modo prueba activo: solo se procesará el primer producto
            </p>
          </div>
        )}

        {/* Action button */}
        <button
          onClick={handleActualizar}
          disabled={loading}
          className="btn-primary w-full py-3"
        >
          {loading ? (
            <>
              <Spinner size="sm" className="text-white" />
              Actualizando precios...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Actualizar {sucursalNombre}
              {modoPrueba && ' (prueba)'}
            </>
          )}
        </button>

        {loading && (
          <p className="text-xs text-center text-gray-400 dark:text-gray-600">
            Este proceso puede tardar varios minutos. No cierres la ventana.
          </p>
        )}
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="card p-6 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Resultado
            </h2>
            {successRate !== null && (
              <span
                className={`badge ${
                  successRate === 100
                    ? 'badge-success'
                    : successRate >= 80
                    ? 'badge-warning'
                    : 'badge-danger'
                }`}
              >
                {successRate}% exitoso
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-success/8 dark:bg-success/15 rounded-xl border border-success/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-xs font-medium text-success uppercase tracking-wide">
                  Exitosos
                </span>
              </div>
              <p className="text-3xl font-semibold text-success">{resultado.exitosos}</p>
            </div>
            <div className="p-4 bg-danger/8 dark:bg-danger/15 rounded-xl border border-danger/20">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-danger" />
                <span className="text-xs font-medium text-danger uppercase tracking-wide">
                  Fallidos
                </span>
              </div>
              <p className="text-3xl font-semibold text-danger">{resultado.fallidos}</p>
            </div>
          </div>

          {resultado.detalles_fallidos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">
                Detalle de errores
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {resultado.detalles_fallidos.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-3 py-2.5 bg-danger/5 dark:bg-danger/10 rounded-lg border border-danger/10"
                  >
                    <span className="text-xs font-mono font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-dark-elevated px-1.5 py-0.5 rounded flex-shrink-0">
                      {d.codigo}
                    </span>
                    <span className="text-xs text-danger">{d.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

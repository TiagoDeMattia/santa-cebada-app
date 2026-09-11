import { CheckCircle, AlertCircle, Clock, Zap, ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface ProgressPanelProps {
  isVisible: boolean
  title: string
  status: 'processing' | 'completed' | 'error'
  progress: number // 0-100
  currentItem?: string
  totalItems?: number
  processedItems?: number
  successCount?: number
  errorCount?: number
  estimatedTimeRemaining?: string
  detalles?: Array<{
    codigo: string
    precio_nuevo?: number
    nombre?: string
    error?: string
  }>
}

export function ProgressPanel({
  isVisible,
  title,
  status,
  progress,
  currentItem,
  totalItems,
  processedItems,
  successCount = 0,
  errorCount = 0,
  estimatedTimeRemaining,
  detalles = [],
}: ProgressPanelProps) {
  const [expandedDetails, setExpandedDetails] = useState(false)

  if (!isVisible) return null

  const statusConfig = {
    processing: {
      icon: Zap,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      borderColor: 'border-accent/20',
      label: 'Procesando...',
    },
    completed: {
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/20',
      label: 'Completado',
    },
    error: {
      icon: AlertCircle,
      color: 'text-danger',
      bgColor: 'bg-danger/10',
      borderColor: 'border-danger/20',
      label: 'Error',
    },
  }

  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-dark-border shadow-2xl z-40 flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`${config.bgColor} border-b ${config.borderColor} p-6`}>
        <div className="flex items-center gap-3 mb-2">
          <StatusIcon className={`w-5 h-5 ${config.color}`} />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        </div>
        <p className={`text-sm ${config.color}`}>{config.label}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Progreso
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-dark-elevated rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                status === 'error'
                  ? 'bg-danger'
                  : status === 'completed'
                  ? 'bg-success'
                  : 'bg-accent'
              }`}
              style={{ width: `${Math.min(progress, 99)}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {processedItems !== undefined && totalItems !== undefined && (
            <div className="p-3 bg-gray-50 dark:bg-dark-elevated rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1">
                Procesados
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {processedItems}/{totalItems}
              </p>
            </div>
          )}

          {successCount > 0 && (
            <div className="p-3 bg-success/10 dark:bg-success/15 rounded-lg border border-success/20">
              <p className="text-xs text-success uppercase tracking-wide mb-1">Exitosos</p>
              <p className="text-2xl font-bold text-success">{successCount}</p>
            </div>
          )}

          {errorCount > 0 && (
            <div className="p-3 bg-danger/10 dark:bg-danger/15 rounded-lg border border-danger/20">
              <p className="text-xs text-danger uppercase tracking-wide mb-1">Errores</p>
              <p className="text-2xl font-bold text-danger">{errorCount}</p>
            </div>
          )}

          {estimatedTimeRemaining && (
            <div className="p-3 bg-gray-50 dark:bg-dark-elevated rounded-lg">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-gray-500" />
                <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide">
                  Tiempo restante
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {estimatedTimeRemaining}
              </p>
            </div>
          )}
        </div>

        {/* Current Item */}
        {currentItem && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Procesando
            </p>
            <div className="p-3 bg-gray-50 dark:bg-dark-elevated rounded-lg border border-gray-200 dark:border-dark-border">
              <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                {currentItem}
              </p>
            </div>
          </div>
        )}

        {/* Detalles */}
        {detalles.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setExpandedDetails(!expandedDetails)}
              className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-dark-elevated rounded-lg hover:bg-gray-100 dark:hover:bg-dark-elevated/80 transition-colors"
            >
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Detalles de cambios ({detalles.length})
              </p>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  expandedDetails ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedDetails && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detalles.map((detalle, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-success/5 dark:bg-success/10 rounded-lg border border-success/10"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {detalle.codigo}
                      </span>
                      {detalle.precio_nuevo && (
                        <span className="text-xs font-semibold text-success">
                          ${detalle.precio_nuevo.toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                    {detalle.nombre && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {detalle.nombre}
                      </p>
                    )}
                    {detalle.error && (
                      <p className="text-xs text-danger">{detalle.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status Message */}
        {status === 'completed' && (
          <div className="p-4 bg-success/10 dark:bg-success/15 rounded-lg border border-success/20">
            <p className="text-sm text-success font-medium">
              ✓ Actualización completada exitosamente
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="p-4 bg-danger/10 dark:bg-danger/15 rounded-lg border border-danger/20">
            <p className="text-sm text-danger font-medium">
              ✗ Ocurrió un error durante la actualización
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-dark-border p-4 bg-gray-50 dark:bg-dark-elevated/50">
        <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
          {status === 'processing'
            ? 'No cierres esta ventana'
            : status === 'completed'
            ? 'Actualización completada'
            : 'Revisa los errores arriba'}
        </p>
      </div>
    </div>
  )
}

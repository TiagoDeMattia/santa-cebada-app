import { useEffect, useState } from 'react'
import {
  RefreshCw, DollarSign, ShoppingBag,
  TrendingUp, Clock, UtensilsCrossed,
  Beer, AlertCircle, Ticket, Wallet,
} from 'lucide-react'
import { estadisticaApi, barrilesV2Api, panel8586Api } from '../lib/api'
import type { StatsHoyPorSucursal } from '../types'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDate } from '../lib/utils'

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  subs?: { label: string; value: string }[]
  icon: React.ElementType
  accent?: boolean
}

function StatCard({ label, value, subs, icon: Icon, accent = false }: StatCardProps) {
  return (
    <div className={`card p-5 flex flex-col gap-3 ${accent ? 'border-accent/30 dark:border-accent/20' : ''}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          accent ? 'bg-accent/10 dark:bg-accent/15' : 'bg-surface-secondary dark:bg-dark-elevated'
        }`}>
          <Icon className={`w-4 h-4 ${accent ? 'text-accent' : 'text-gray-400 dark:text-gray-500'}`} />
        </div>
      </div>
      <div>
        <p className={`font-display text-2xl font-bold tabular-nums tracking-tight ${
          accent ? 'text-accent' : 'text-gray-900 dark:text-gray-100'
        }`}>
          {value}
        </p>
      </div>
      {subs && subs.length > 0 && (
        <div className="border-t border-gray-100 dark:border-dark-border pt-2.5 space-y-1.5">
          {subs.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-600">{s.label}</span>
              <span className="text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-400">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type ValesData = {
  vales1: { nombre: string; semanal: number; mensual: number }
  vales2: { nombre: string; semanal: number; mensual: number }
  vales3?: { nombre: string; semanal: number; mensual: number }
  semana_desde: string; mes_desde: string; hasta: string
}

function parseFechaDDMMYYYY(s: string): number {
  if (!s) return 0
  const [d, m, y] = s.split('/')
  return parseInt((y ?? '0') + (m ?? '00').padStart(2, '0') + (d ?? '00').padStart(2, '0'))
}

export function Dashboard() {
  const { user } = useAuth()
  const [data, setData]           = useState<StatsHoyPorSucursal | null>(null)
  const [loading, setLoading]     = useState(true)
  const [vales, setVales]         = useState<ValesData | null>(null)
  const [valesLoading, setValesLoading] = useState(true)
  const [barriles, setBarriles]   = useState<any[]>([])
  const [barrilesLoading, setBarrilesLoading] = useState(true)
  const [alertas, setAlertas]     = useState<any[]>([])
  const [alertasLoading, setAlertasLoading] = useState(true)

  const cargar = () => {
    setLoading(true)
    estadisticaApi.hoyPorSucursal(true)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  const cargarVales = () => {
    setValesLoading(true)
    estadisticaApi.vales()
      .then(setVales)
      .catch(() => setVales(null))
      .finally(() => setValesLoading(false))
  }

  const cargarModulos = () => {
    setBarrilesLoading(true)
    barrilesV2Api.getBarriles('activos')
      .then(setBarriles)
      .catch(() => setBarriles([]))
      .finally(() => setBarrilesLoading(false))
    setAlertasLoading(true)
    panel8586Api.getAlertas()
      .then(setAlertas)
      .catch(() => setAlertas([]))
      .finally(() => setAlertasLoading(false))
  }

  useEffect(() => { cargar(); cargarVales(); cargarModulos() }, [])

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'
  const recoleta = data?.sucursales?.find(s => s.location_key === 'recoleta')
  const nombreUsuario = user?.nombre || user?.username

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">{saludo}</p>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white tracking-tight capitalize">
            {nombreUsuario}
          </h1>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="btn-ghost text-xs gap-1.5 mt-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats de hoy */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="label-xs">Hoy — Recoleta</h2>
          {data?.fecha && (
            <span className="text-xs text-gray-400 dark:text-gray-600">{data.fecha}</span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 h-28 animate-pulse bg-white dark:bg-dark-surface" />
            ))}
          </div>
        ) : recoleta ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label={`${recoleta.turno_actual ?? 'Facturación'}${recoleta.turno_desde ? ` · desde ${new Date(recoleta.turno_desde).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
              value={formatCurrency(recoleta.facturacion_turno ?? recoleta.facturacion_total)}
              subs={[
                { label: 'Total del día', value: formatCurrency(recoleta.facturacion_total) },
                ...(recoleta.facturacion_turno_manana != null
                  ? [{ label: 'Turno Mañana', value: formatCurrency(recoleta.facturacion_turno_manana) }]
                  : []),
              ]}
              icon={DollarSign}
              accent
            />
            <StatCard
              label="Ticket promedio"
              value={formatCurrency(recoleta.ticket_promedio)}
              subs={[
                { label: 'Pedidos del turno', value: recoleta.pedidos_count.toLocaleString('es-AR') },
                ...(recoleta.pedidos_count < (recoleta.pedidos_count_dia ?? recoleta.pedidos_count)
                  ? [{ label: 'Pedidos del día', value: (recoleta.pedidos_count_dia ?? recoleta.pedidos_count).toLocaleString('es-AR') }]
                  : []),
              ]}
              icon={Ticket}
            />
            <StatCard
              label="Productos vendidos"
              value={recoleta.productos_vendidos.toLocaleString('es-AR')}
              icon={ShoppingBag}
            />
            <StatCard
              label="Gastos"
              value={formatCurrency(recoleta.gastos_total)}
              icon={TrendingUp}
            />
          </div>
        ) : (
          <div className="card p-5 flex items-center gap-3 text-sm text-gray-400 dark:text-gray-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Sin datos para hoy — actualizá las estadísticas desde el módulo correspondiente.
          </div>
        )}

        {/* Mesas abiertas */}
        {recoleta && recoleta.mesas_abiertas > 0 && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-warning/8 border border-warning/20 text-sm font-medium text-warning">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            {recoleta.mesas_abiertas} mesa{recoleta.mesas_abiertas > 1 ? 's' : ''} abierta{recoleta.mesas_abiertas > 1 ? 's' : ''} en este momento
          </div>
        )}

        {/* Última actualización */}
        {recoleta?.ultima_actualizacion && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600">
            <Clock className="w-3 h-3" />
            Última actualización: {formatDate(recoleta.ultima_actualizacion)}
          </div>
        )}
      </section>

      {/* Vales */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="label-xs">Vales</h2>
          {vales && (
            <span className="text-xs text-gray-400 dark:text-gray-600">
              Semana desde {vales.semana_desde} · Mes desde {vales.mes_desde}
            </span>
          )}
        </div>

        {valesLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => <div key={i} className="card p-5 h-36 animate-pulse bg-white dark:bg-dark-surface" />)}
          </div>
        ) : vales ? (
          <div className="grid grid-cols-3 gap-3">
            {([vales.vales1, vales.vales2, vales.vales3] as Array<{nombre:string;semanal:number;mensual:number}>).filter(Boolean).map((v) => (
              <div key={v.nombre} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight">
                    {v.nombre}
                  </p>
                  <div className="w-8 h-8 rounded-lg bg-surface-secondary dark:bg-dark-elevated flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
                <div className="border-t border-gray-100 dark:border-dark-border pt-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-600">Esta semana</span>
                    <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(v.semanal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-600">Este mes</span>
                    <span className="text-sm font-bold tabular-nums text-accent">
                      {formatCurrency(v.mensual)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-4 text-xs text-gray-400 dark:text-gray-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Sin datos de vales — actualizá las estadísticas.
          </div>
        )}
      </section>

      {/* Módulos operativos */}
      <section>
        <h2 className="label-xs mb-4">Cervezas</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Más días pinchadas */}
          <div className="card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Más días pinchadas</p>
              <Beer className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            {barrilesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-5 rounded bg-gray-100 dark:bg-dark-elevated animate-pulse" />
                ))}
              </div>
            ) : (() => {
              const items = barriles
                .filter((b: any) => b.estado === 'Pinchada')
                .sort((a: any, b: any) => (b.dias_pinchado ?? 0) - (a.dias_pinchado ?? 0))
                .slice(0, 10)
              return items.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-600">Sin barriles pinchados</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((b, i) => {
                    const dias = b.dias_pinchado ?? 0
                    const prioridad = dias > 62 ? 'alta' : dias > 31 ? 'media' : null
                    return (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-gray-400 dark:text-gray-600 w-4 tabular-nums flex-shrink-0">{i + 1}</span>
                          <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{b.estilo}</span>
                          {prioridad === 'alta' && (
                            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex-shrink-0">Alta</span>
                          )}
                          {prioridad === 'media' && (
                            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex-shrink-0">Media</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {b.canilla && (
                            <span className="text-xs text-gray-400 dark:text-gray-600">C{b.canilla}</span>
                          )}
                          <span className="text-xs font-bold tabular-nums text-accent">
                            {b.dias_pinchado ?? '—'}d
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* Últimas pinchadas */}
          <div className="card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Últimas pinchadas</p>
              <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            {barrilesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-5 rounded bg-gray-100 dark:bg-dark-elevated animate-pulse" />
                ))}
              </div>
            ) : (() => {
              const items = barriles
                .filter((b: any) => b.estado === 'Pinchada' && b.fecha_pinchado)
                .sort((a: any, b: any) => parseFechaDDMMYYYY(b.fecha_pinchado) - parseFechaDDMMYYYY(a.fecha_pinchado))
                .slice(0, 10)
              return items.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-600">Sin barriles pinchados</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {b.canilla && (
                          <span className="text-xs text-gray-400 dark:text-gray-600 flex-shrink-0">C{b.canilla}</span>
                        )}
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{b.estilo}</span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-600 flex-shrink-0 tabular-nums">
                        {b.fecha_pinchado}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* 86/85 y Priorizado */}
          <div className="card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">86 / 85 y Priorizado</p>
              <AlertCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            {alertasLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-5 rounded bg-gray-100 dark:bg-dark-elevated animate-pulse" />
                ))}
              </div>
            ) : (() => {
              const items86 = alertas.filter(a => a.tipo === 86)
              const items85 = alertas.filter(a => a.tipo === 85)
              const itemsPriorizado = alertas.filter(a => a.priorizado && a.tipo !== 86 && a.tipo !== 85)
              const total = items86.length + items85.length + itemsPriorizado.length
              if (total === 0) return (
                <p className="text-xs text-gray-400 dark:text-gray-600">Sin alertas activas</p>
              )
              return (
                <div className="space-y-2.5">
                  {items86.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-500 mb-1">🔴 86 — Sin stock ({items86.length})</p>
                      <div className="space-y-1">
                        {items86.slice(0, 5).map((a, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{a.nombre}</span>
                            {a.nota && <span className="text-xs text-gray-400 dark:text-gray-600 truncate italic">· {a.nota}</span>}
                          </div>
                        ))}
                        {items86.length > 5 && <p className="text-xs text-gray-400 dark:text-gray-600">+{items86.length - 5} más</p>}
                      </div>
                    </div>
                  )}
                  {items85.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-yellow-500 mb-1">🟡 85 — Bajo stock ({items85.length})</p>
                      <div className="space-y-1">
                        {items85.slice(0, 5).map((a, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{a.nombre}</span>
                            {a.nota && <span className="text-xs text-gray-400 dark:text-gray-600 truncate italic">· {a.nota}</span>}
                          </div>
                        ))}
                        {items85.length > 5 && <p className="text-xs text-gray-400 dark:text-gray-600">+{items85.length - 5} más</p>}
                      </div>
                    </div>
                  )}
                  {itemsPriorizado.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-500 mb-1">🟢 Venta priorizada ({itemsPriorizado.length})</p>
                      <div className="space-y-1">
                        {itemsPriorizado.slice(0, 5).map((a, i) => (
                          <span key={i} className="block text-xs text-gray-700 dark:text-gray-300 truncate">{a.nombre}</span>
                        ))}
                        {itemsPriorizado.length > 5 && <p className="text-xs text-gray-400 dark:text-gray-600">+{itemsPriorizado.length - 5} más</p>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

        </div>
      </section>
    </div>
  )
}

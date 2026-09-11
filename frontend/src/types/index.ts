// ─── AUTH ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface User {
  username: string
  nombre?: string  // Nombre del propietario
  role: 'admin' | 'user' | 'visor' | 'cajero' | 'salon' | 'cocina'
  rememberMe?: boolean
}

// ─── PRODUCTOS ─────────────────────────────────────────────────────────────────

export interface Producto {
  id?: number
  codigo: string
  nombre: string
  precio?: number
  precio_sin_iva?: number
  alicuota_id?: number
  categoria?: string
  subcategoria?: string
  activo: boolean
  company_id?: number
}

export interface PrecioUpdate {
  codigo: string
  precio: number
  sucursal_id: string
}

export interface ActualizarDesdeSheetRequest {
  sucursal_id: string
  modo_prueba: boolean
}

export interface ActualizacionResultado {
  exitosos: number
  fallidos: number
  detalles_fallidos: Array<{ codigo: string; error: string }>
  detalles_exitosos?: Array<{ codigo: string; [key: string]: any }>
  total_procesados?: number
}

// ─── SUCURSALES ────────────────────────────────────────────────────────────────

export interface Sucursal {
  id: string
  nombre: string
  company_id: number
  email: string
}

// ─── ESTADÍSTICA ──────────────────────────────────────────────────────────────

export interface StatsHoy {
  fecha: string
  turno_inicio: string
  facturacion_total: number
  pedidos_count: number
  ticket_promedio: number
  productos_vendidos: number
  gastos_total: number
  ultima_actualizacion: string | null
}

export interface StatsSucursal {
  location_key: string
  nombre: string
  turno_actual: string
  turno_desde: string | null
  facturacion_turno: number
  facturacion_cobrada: number
  total_mesas_abiertas: number
  facturacion_total: number
  facturacion_turno_manana: number | null
  pedidos_cobrados: number
  mesas_count: number
  pedidos_count: number
  pedidos_count_dia: number
  ticket_promedio: number
  productos_vendidos: number
  gastos_total: number
  mesas_abiertas: number
  mesas_en_cobro: number
  mesas_total: number
  mesas_libres: number
  ocupacion_pct: number
  comensales: number
  mesas_ok: boolean
  ultima_actualizacion: string | null
}

export interface StatsHoyPorSucursal {
  fecha: string
  turno_inicio: string
  sucursales: StatsSucursal[]
  totales: {
    facturacion_total: number
    mesas_abiertas: number
    pedidos_count: number
    gastos_total: number
    productos_vendidos: number
  }
}

export interface SheetsHistorialInfo {
  total: number
  desde: string | null
  hasta: string | null
  ingreso_total?: number
  cantidad_total?: number
}

export interface MetaEstadistica {
  ultima_actualizacion: string | null
  rango_disponible: { min_date: string | null; max_date: string | null }
  sheets_historial?: {
    ventas: SheetsHistorialInfo | null
    productos: SheetsHistorialInfo | null
  }
}

export interface OverviewMetrics {
  sales_total: number
  cost_total: number
  gain_total: number
  order_count: number
  ticket_average: number
  pending_balance: number
  payment_total: number
  payment_gap: number
  margin_pct: number
}

export interface TimeseriesPoint {
  period_start: string
  period_label: string
  sales_total: number
  orders_count?: number
  ticket_average?: number
  cost_total?: number
  gain_total?: number
}

export interface PaymentSummaryItem {
  payment_category: string
  payment_count: number
  amount_total: number
  share_amount: number
  share_count: number
}

export interface ProductSummaryItem {
  codigo_clean: string
  nombre_clean: string
  rubro: string
  quantity_total: number
  revenue_total: number
  avg_unit_revenue: number
  active_days: number
  revenue_share: number
}

export interface RubroSummaryItem {
  rubro: string
  quantity_total: number
  revenue_total: number
  active_products: number
  avg_unit_revenue: number
  revenue_share: number
}

export interface TurnoStats {
  orders_count: number
  sales_total: number
  ticket_average: number
  share_orders: number
  share_sales: number
}

export interface TurnoDiario {
  date: string
  manana_orders: number
  manana_sales: number
  noche_orders: number
  noche_sales: number
}

export interface TurnoBreakdown {
  summary: {
    manana: TurnoStats
    noche: TurnoStats
  }
  by_business_date: TurnoDiario[]
}

export interface InflationData {
  indices: Record<string, number>   // { "YYYY-MM": factor }
  ipc_values: Record<string, number>
  base_month: string | null
  source: string
}

export interface StatsCompletas {
  location_key: string
  date_range: { start_date: string | null; end_date: string | null }
  overview: OverviewMetrics
  sales_timeseries_daily: TimeseriesPoint[]
  sales_timeseries_weekly: TimeseriesPoint[]
  sales_timeseries_monthly: TimeseriesPoint[]
  finance_timeseries_daily: TimeseriesPoint[]
  payment_summary: PaymentSummaryItem[]
  product_summary: ProductSummaryItem[]
  rubro_summary: RubroSummaryItem[]
  top_products_by_revenue: ProductSummaryItem[]
  top_products_by_quantity: ProductSummaryItem[]
  expense_summary: Array<{ tipo_gasto_clean: string; expense_count: number; cost_total: number; share_amount: number }>
  raw_counts: { orders: number; payments: number; products: number; expenses: number }
  customer_summary: {
    anonymous_share: number
    identified_sales: number
    identified_orders: number
    identified_customers: number
    repeat_customer_rate: number
  }
  turno_breakdown?: TurnoBreakdown
}

export interface ActualizarStatsResult {
  success: boolean
  period: string
  resultados: Array<{
    sucursal: string
    location_key: string
    pedidos: number
    facturacion: number
    period_start: string
    period_end: string
    actualizado_en: string
  }>
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  error?: string
}

// ─── API RESPONSE ──────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  error?: string
}

// ─── BARRILES ──────────────────────────────────────────────────────────────────

export type EstadoBarril = 'Pinchada' | 'En Camara' | 'Para Retirar' | 'Retirada'

export interface Barril {
  row: number
  ingreso: string
  proveedor: string
  estilo: string
  codigo: string
  fecha_pinchado: string
  nombre_pincho: string
  turno_pinchado: string
  fecha_despinchado: string
  nombre_despincho: string
  turno_despinchado: string
  fecha_retirado: string
  dias_pinchado: string
  estado: EstadoBarril
  dias_retirado: string
  canilla: string
  tp: string
  // Campos adicionales para visor (columnas D, E, F del sheet BARRILES)
  amargor?: number | string  // 1-5
  abv?: string  // e.g., "4.5%"
  precio?: string  // e.g., "$6.600"
  palabras_destacar?: string  // palabras separadas por coma para efecto neon
}

export interface CatalogoBirra {
  estilo: string
  productor: string
  tipo: string
}

// ─── AUDITORÍA ─────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: number
  username: string
  action: 'create' | 'update' | 'delete'
  entity_type: string
  entity_id: string | null
  changes: Record<string, any> | null
  timestamp: string
  ip_address: string | null
  sucursal_id: string | null
}

export interface AuditStats {
  total: number
  by_entity_type: Record<string, number>
  by_user: Record<string, number>
  by_action: Record<string, number>
}

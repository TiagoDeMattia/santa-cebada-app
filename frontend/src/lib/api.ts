import axios from 'axios'
import type {
  LoginRequest,
  TokenResponse,
  Producto,
  PrecioUpdate,
  ActualizarDesdeSheetRequest,
  ActualizacionResultado,
  Sucursal,
  ApiResponse,
  StatsHoy,
  StatsHoyPorSucursal,
  StatsCompletas,
  ActualizarStatsResult,
  MetaEstadistica,
  Barril,
  CatalogoBirra,
  AuditLog,
  AuditStats,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor: agrega token JWT a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor: maneja 401 globalmente
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('rememberMe')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── AUTH ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (data: LoginRequest & { remember_me?: boolean }): Promise<TokenResponse> => {
    const res = await api.post<TokenResponse>('/auth/login', data)
    return res.data
  },
  verify: async (token: string): Promise<ApiResponse> => {
    const res = await api.post<ApiResponse>('/auth/verify', null, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.data
  },
}

// ─── PRODUCTOS ─────────────────────────────────────────────────────────────────

export const productosApi = {
  listar: async (params?: {
    codigo?: string
    nombre?: string
    sucursal_id?: string
  }): Promise<Producto[]> => {
    const res = await api.get<Producto[]>('/productos', { params })
    return res.data
  },

  obtener: async (id: number, sucursal_id = '1'): Promise<Producto> => {
    const res = await api.get<Producto>(`/productos/${id}`, {
      params: { sucursal_id },
    })
    return res.data
  },

  actualizarPrecio: async (data: PrecioUpdate): Promise<ApiResponse> => {
    const res = await api.post<ApiResponse>('/productos/actualizar-precio', data)
    return res.data
  },

  actualizarDesdeSheet: async (
    data: ActualizarDesdeSheetRequest
  ): Promise<ActualizacionResultado> => {
    const res = await api.post<ActualizacionResultado>(
      '/productos/actualizar-desde-sheet',
      data
    )
    return res.data
  },

}

// ─── SUCURSALES ────────────────────────────────────────────────────────────────

export const sucursalesApi = {
  listar: async (): Promise<Sucursal[]> => {
    const res = await api.get<Sucursal[]>('/sucursales')
    return res.data
  },

  obtener: async (id: string): Promise<Sucursal> => {
    const res = await api.get<Sucursal>(`/sucursales/${id}`)
    return res.data
  },
}

// ─── ESTADÍSTICA ──────────────────────────────────────────────────────────────

export const estadisticaApi = {
  hoy: async (sucursal_id = 'ambas'): Promise<StatsHoy> => {
    const res = await api.get<StatsHoy>('/estadistica/hoy', { params: { sucursal_id } })
    return res.data
  },

  hoyPorSucursal: async (include_open_orders = true): Promise<StatsHoyPorSucursal> => {
    const res = await api.get<StatsHoyPorSucursal>('/estadistica/hoy-por-sucursal', {
      params: { include_open_orders },
    })
    return res.data
  },

  completas: async (params?: {
    sucursal_id?: string
    start_date?: string
    end_date?: string
    force_refresh?: boolean
    turno?: 'manana' | 'noche'
  }): Promise<StatsCompletas> => {
    const res = await api.get<StatsCompletas>('/estadistica/completas', { params })
    return res.data
  },

  actualizar: async (params?: {
    sucursal_id?: string
    period?: string
    target_date?: string
    year?: number
    month?: number
  }): Promise<ActualizarStatsResult> => {
    const res = await api.post<ActualizarStatsResult>('/estadistica/actualizar', null, { params })
    return res.data
  },

  meta: async (): Promise<MetaEstadistica> => {
    const res = await api.get<MetaEstadistica>('/estadistica/meta')
    return res.data
  },

  inflation: async (): Promise<import('../types').InflationData> => {
    const res = await api.get('/estadistica/inflation')
    return res.data
  },

  vales: async () => {
    const res = await api.get('/estadistica/vales')
    return res.data as {
      vales1: { nombre: string; semanal: number; mensual: number }
      vales2: { nombre: string; semanal: number; mensual: number }
      semana_desde: string
      mes_desde: string
      hasta: string
    }
  },

}

// ─── BARRILES ──────────────────────────────────────────────────────────────────

export const barrilesApi = {
  listar: async (filtro?: string, sucursal_id: string = "1"): Promise<Barril[]> => {
    const params: Record<string, string> = { sucursal_id }
    if (filtro) params.filtro = filtro
    const res = await api.get<Barril[]>('/barriles', { params })
    return res.data
  },

  personal: async (sucursal_id: string = "1"): Promise<string[]> => {
    const res = await api.get<string[]>('/barriles/personal', { params: { sucursal_id } })
    return res.data
  },

  visor: async (sucursal_id: string = "1"): Promise<Barril[]> => {
    const res = await api.get<Barril[]>('/barriles/visor', { params: { sucursal_id } })
    return res.data
  },

  actualizarBarril: async (data: {
    row: number
    sucursal_id: string
    fecha_pinchado?: string
    nombre_pincho?: string
    fecha_despinchado?: string
    nombre_despincho?: string
    fecha_retirado?: string
    canilla?: string
    estilo?: string
    mover_a_vacios?: boolean
    reordenar_auto?: boolean
  }): Promise<{ success: boolean }> => {
    const res = await api.patch('/barriles/update', data)
    return res.data
  },

  reordenar: async (): Promise<{ success: boolean }> => {
    const res = await api.post('/barriles/reordenar')
    return res.data
  },

  catalogo: async (sucursal_id: string = "1"): Promise<CatalogoBirra[]> => {
    const res = await api.get<CatalogoBirra[]>('/barriles/catalogo', { params: { sucursal_id } })
    return res.data
  },

  infoBirras: async (sucursal_id: string = "1"): Promise<{
    birras: { estilo: string; precio: string; codigo: string }[]
    hora_santa_precio: string
  }> => {
    const res = await api.get('/barriles/info-birras', { params: { sucursal_id } })
    return res.data
  },

  visor2: async (sucursal_id: string = "1"): Promise<{
    groups: {
      id: string
      nombre: string
      horario: string
      items: { nombre: string; precio: string }[]
      visible?: boolean
    }[]
    menu_ejecutivo: { label: string; value: string }[]
  }> => {
    const res = await api.get('/barriles/visor2', { params: { sucursal_id } })
    return res.data
  },
}

// ─── AUDITORÍA ─────────────────────────────────────────────────────────────────

export const auditApi = {
  obtenerHistorial: async (params?: {
    limit?: number
    offset?: number
    entity_type?: string
    username?: string
    sucursal_id?: string
  }): Promise<{ success: boolean; data: AuditLog[]; count: number; limit: number; offset: number }> => {
    const res = await api.get('/audit/log', { params })
    return res.data
  },

  obtenerEstadisticas: async (): Promise<{ success: boolean; data: AuditStats }> => {
    const res = await api.get('/audit/stats')
    return res.data
  },
}

// ─── STOCK GENERAL ────────────────────────────────────────────────────────────

export const stockGeneralApi = {
  // Rubros
  getRubros: async (incluirInactivos = false) => {
    const res = await api.get('/stock-general/rubros', { params: { incluir_inactivos: incluirInactivos } })
    return res.data
  },
  createRubro: async (data: { codigo: string; nombre: string; descripcion?: string; orden?: number }) => {
    const res = await api.post('/stock-general/rubros', data)
    return res.data
  },
  updateRubro: async (id: number, data: { codigo?: string; nombre?: string; descripcion?: string; orden?: number; activo?: boolean }) => {
    const res = await api.put(`/stock-general/rubros/${id}`, data)
    return res.data
  },
  deleteRubro: async (id: number) => {
    const res = await api.delete(`/stock-general/rubros/${id}`)
    return res.data
  },

  // Productos
  getProductos: async (params?: { incluir_inactivos?: boolean; busqueda?: string }) => {
    const res = await api.get('/stock-general/productos', { params })
    return res.data
  },
  createProducto: async (data: { codigo: string; nombre: string; nombre_proveedor?: string; descripcion?: string; proveedor_id?: number; unidad_stock?: string; unidad_pedido?: string }) => {
    const res = await api.post('/stock-general/productos', data)
    return res.data
  },
  updateProducto: async (id: number, data: { codigo?: string; nombre?: string; nombre_proveedor?: string; descripcion?: string; proveedor_id?: number; unidad_stock?: string; unidad_pedido?: string; activo?: boolean }) => {
    const res = await api.put(`/stock-general/productos/${id}`, data)
    return res.data
  },
  deleteProducto: async (id: number) => {
    const res = await api.delete(`/stock-general/productos/${id}`)
    return res.data
  },

  // Planilla Items (configuración por área)
  getPlanillaItems: async (area: 'salon' | 'cocina') => {
    const res = await api.get('/stock-general/planilla-items', { params: { area } })
    return res.data
  },
  addPlanillaItem: async (data: { area: string; producto_id: number; rubro_id?: number }) => {
    const res = await api.post('/stock-general/planilla-items', data)
    return res.data
  },
  updatePlanillaItem: async (id: number, data: { rubro_id?: number; orden?: number }) => {
    const res = await api.put(`/stock-general/planilla-items/${id}`, data)
    return res.data
  },
  removePlanillaItem: async (id: number) => {
    const res = await api.delete(`/stock-general/planilla-items/${id}`)
    return res.data
  },

  // Planilla (valores por fecha)
  getPlanilla: async (fecha: string, area: 'salon' | 'cocina') => {
    const res = await api.get('/stock-general/planilla', { params: { fecha, area } })
    return res.data
  },
  savePlanilla: async (data: { fecha: string; area: string; entries: Array<{ producto_id: number; stock?: number | null; pedido?: number | null; notas?: string }>; creado_por?: string; es_modificacion?: boolean; nota_edicion?: string }) => {
    const res = await api.post('/stock-general/planilla', data)
    return res.data
  },

  // Otros (6 filas libres por fecha y área)
  getOtros: async (fecha: string, area: 'salon' | 'cocina') => {
    const res = await api.get('/stock-general/otros', { params: { fecha, area } })
    return res.data
  },
  saveOtros: async (data: { fecha: string; area: string; rows: Array<{ fila: number; nombre?: string; u_stock?: string; u_pedido?: string; stock?: number | null; pedido?: number | null }> }) => {
    const res = await api.post('/stock-general/otros', data)
    return res.data
  },

  // Pedidos del día (para Central de Pedidos)
  getPedidos: async (fecha: string) => {
    const res = await api.get('/stock-general/pedidos', { params: { fecha } })
    return res.data
  },
  // Períodos con stock registrado
  getPeriodos: async (): Promise<string[]> => {
    const res = await api.get('/stock-general/periodos')
    return res.data
  },

  // Umbrales de alerta por estilo de cerveza
  getUmbrales: async (): Promise<{ estilo: string; umbral: string }[]> => {
    const res = await api.get('/stock-general/umbrales')
    return res.data
  },
  saveUmbral: async (estilo: string, umbral: string) => {
    const res = await api.put(`/stock-general/umbrales/${encodeURIComponent(estilo)}`, { umbral })
    return res.data
  },

  // Último stock enviado
  getPedidosUltimo: async () => {
    const res = await api.get('/stock-general/pedidos/ultimo')
    return res.data as { fecha: string | null; pedidos: any[] }
  },

  // Canillas de cervezas
  getCanillas: async (sucursal_id = "1") => {
    const res = await api.get('/stock-general/canillas', { params: { sucursal_id } })
    return res.data as { id: number | null; sucursal_id: string; canilla_num: number; estilo_actual: string | null; estilo_proximo: string | null; stock_camara: number | null; stock_camara_proximo: number | null }[]
  },
  updateCanilla: async (canilla_num: number, data: { sucursal_id?: string; estilo_actual?: string | null; estilo_proximo?: string | null; stock_camara?: number | null; stock_camara_proximo?: number | null }) => {
    const res = await api.put(`/stock-general/canillas/${canilla_num}`, data)
    return res.data
  },
  swapCanillas: async (canilla_a: number, canilla_b: number, sucursal_id = "1", estilo_a?: string | null, estilo_b?: string | null) => {
    const res = await api.post('/stock-general/canillas/swap', { sucursal_id, canilla_a, canilla_b, estilo_a, estilo_b })
    return res.data
  },

  // Historial
  getHistorial: async (params?: { area?: string; producto_id?: number; desde?: string; hasta?: string; limit?: number }) => {
    const res = await api.get('/stock-general/historial', { params })
    return res.data
  },

  // Estadísticas
  getEstadisticas: async (
    modo: 'historico' | 'primer_dia' = 'historico',
    excludeRubros: string[] = [],
    excludeProductos: number[] = [],
    desde?: string,
    hasta?: string,
  ) => {
    const params: Record<string, string> = { modo }
    if (excludeRubros.length) params.exclude_rubros = excludeRubros.join(',')
    if (excludeProductos.length) params.exclude_productos = excludeProductos.join(',')
    if (desde) params.desde = desde
    if (hasta) params.hasta = hasta
    const res = await api.get('/stock-general/estadisticas', { params })
    return res.data
  },

  getProductoSerie: async (productoId: number) => {
    const res = await api.get('/stock-general/estadisticas/producto-serie', { params: { producto_id: productoId } })
    return res.data
  },

  // Historial cervezas
  saveCervezasHistorial: async (body: { fecha: string; sucursal_id: string; rows: any[] }) => {
    const res = await api.post('/stock-general/cervezas/historial', body)
    return res.data
  },
  getCervezasHistorial: async (fecha: string, sucursal_id = '1') => {
    const res = await api.get('/stock-general/cervezas/historial', { params: { fecha, sucursal_id } })
    return res.data as any[]
  },

  // Asignaciones de pedidos por fecha
  getPedidoAsignaciones: async (fecha: string): Promise<Record<number, number | null>> => {
    const res = await api.get('/stock-general/pedido-asignaciones', { params: { fecha } })
    return res.data
  },
  savePedidoAsignacion: async (fecha: string, producto_id: number, proveedor_id: number | null) => {
    await api.put('/stock-general/pedido-asignaciones', { fecha, producto_id, proveedor_id })
  },
  // Confirmaciones de pedido enviado
  getPedidoConfirmaciones: async (fecha: string): Promise<Record<number, boolean>> => {
    const res = await api.get('/stock-general/pedido-confirmaciones', { params: { fecha } })
    return res.data
  },
  savePedidoConfirmacion: async (fecha: string, proveedor_id: number, enviado: boolean) => {
    await api.put('/stock-general/pedido-confirmaciones', { fecha, proveedor_id, enviado })
  },

  // Proveedores
  getProveedores: async (params?: { incluir_inactivos?: boolean; busqueda?: string; categoria?: string }) => {
    const res = await api.get('/stock-general/proveedores', { params })
    return res.data
  },
  createProveedor: async (data: { nombre: string; categoria?: string; nombre_remitente?: string; info_reco?: string }) => {
    const res = await api.post('/stock-general/proveedores', data)
    return res.data
  },
  updateProveedor: async (id: number, data: { nombre?: string; categoria?: string; nombre_remitente?: string; info_reco?: string; activo?: boolean }) => {
    const res = await api.put(`/stock-general/proveedores/${id}`, data)
    return res.data
  },
  deleteProveedor: async (id: number) => {
    const res = await api.delete(`/stock-general/proveedores/${id}`)
    return res.data
  },
}

// ─── PANEL 85 & 86 ────────────────────────────────────────────────────────────

// ─── VALES MONITOR ───────────────────────────────────────────────────────────

export const valesApi = {
  getTurno: async () => {
    const res = await api.get('/estadistica/vales-turno')
    return res.data as {
      turno: string
      is_noche: boolean
      desde: string
      hasta: string
      total_cobrado: number
      vales: {
        vales1: { nombre: string; total: number }
        vales2: { nombre: string; total: number }
        vales3: { nombre: string; total: number }
      }
      total_vales: number
      objetivo_pct: number
      objetivo_monto: number
      porcentaje_vales: number
      diferencia: number
      en_objetivo: boolean
    }
  },
  getComidaTurno: async () => {
    const res = await api.get('/estadistica/comida-turno')
    return res.data as {
      turno: string
      business_date: string
      platos_vendidos: number
      pedidos: number
      ratio: number
      ratio_por_10: number
      en_objetivo: boolean
      error?: string
    }
  },
}

// ─── PANEL 85 & 86 ────────────────────────────────────────────────────────────

export const panel8586Api = {
  getAlertas: async () => {
    const res = await api.get('/panel-alertas')
    return res.data as any[]
  },
  setAlerta: async (productoId: number, tipo: number | null, updatedBy?: string, nota?: string | null) => {
    const res = await api.post(`/panel-alertas/${productoId}`, { tipo, updated_by: updatedBy ?? null, nota: nota ?? null })
    return res.data
  },
  setAlertaNucleo: async (codigo: string, nombre: string, tipo: number | null, updatedBy?: string, nota?: string | null) => {
    const res = await api.post(`/panel-alertas/nucleo/${encodeURIComponent(codigo)}`, { nombre, tipo, updated_by: updatedBy ?? null, nota: nota ?? null })
    return res.data
  },
  setPriorizado: async (productoId: number, priorizado: boolean, updatedBy?: string) => {
    const res = await api.post(`/panel-alertas/priorizar/${productoId}`, { priorizado, updated_by: updatedBy ?? null })
    return res.data
  },
  setPriorizadoNucleo: async (codigo: string, nombre: string, priorizado: boolean, updatedBy?: string) => {
    const res = await api.post(`/panel-alertas/priorizar/nucleo/${encodeURIComponent(codigo)}`, { nombre, priorizado, updated_by: updatedBy ?? null })
    return res.data
  },
}

// ─── CARTA IA ────────────────────────────────────────────────────────────────

export const cartaIaApi = {
  getDocs: async () => {
    const res = await api.get('/carta-ia/docs')
    return res.data as any[]
  },
  getDoc: async (id: number) => {
    const res = await api.get(`/carta-ia/docs/${id}`)
    return res.data as any
  },
  createDoc: async (titulo: string, tipo: string, file?: File) => {
    const fd = new FormData()
    fd.append('titulo', titulo)
    fd.append('tipo', tipo)
    if (file) fd.append('file', file)
    const res = await api.post('/carta-ia/docs', fd, {
      headers: { 'Content-Type': undefined },
    })
    return res.data
  },
  updateDoc: async (id: number, body: { titulo?: string; tipo?: string; contenido?: string }) => {
    const res = await api.put(`/carta-ia/docs/${id}`, body)
    return res.data
  },
  replaceFile: async (id: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post(`/carta-ia/docs/${id}/file`, fd, {
      headers: { 'Content-Type': undefined },
    })
    return res.data
  },
  toggleActive: async (id: number) => {
    const res = await api.post(`/carta-ia/docs/${id}/toggle`)
    return res.data
  },
  deleteDoc: async (id: number) => {
    const res = await api.delete(`/carta-ia/docs/${id}`)
    return res.data
  },
  chat: async (pregunta: string) => {
    const res = await api.post('/carta-ia/chat', { pregunta })
    return res.data as { respuesta: string }
  },
}

// ─── BARRILES V2 ─────────────────────────────────────────────────────────────

export const barrilesV2Api = {
  // Proveedores
  getProveedores: async (includeInactive = false) => {
    const res = await api.get('/barriles-v2/proveedores', { params: { include_inactive: includeInactive } })
    return res.data as any[]
  },
  createProveedor: async (nombre: string) => {
    const res = await api.post('/barriles-v2/proveedores', { nombre })
    return res.data
  },
  updateProveedor: async (id: number, data: Record<string, any>) => {
    const res = await api.patch(`/barriles-v2/proveedores/${id}`, data)
    return res.data
  },

  // Birras
  getBirras: async (includeInactive = false) => {
    const res = await api.get('/barriles-v2/birras', { params: { include_inactive: includeInactive } })
    return res.data as any[]
  },
  createBirra: async (data: Record<string, any>) => {
    const res = await api.post('/barriles-v2/birras', data)
    return res.data
  },
  updateBirra: async (id: number, data: Record<string, any>) => {
    const res = await api.patch(`/barriles-v2/birras/${id}`, data)
    return res.data
  },

  // Personal
  getPersonal: async (includeInactive = false) => {
    const res = await api.get('/barriles-v2/personal', { params: { include_inactive: includeInactive } })
    return res.data as any[]
  },
  createPersonal: async (nombre: string) => {
    const res = await api.post('/barriles-v2/personal', { nombre })
    return res.data
  },
  updatePersonal: async (id: number, data: Record<string, any>) => {
    const res = await api.patch(`/barriles-v2/personal/${id}`, data)
    return res.data
  },

  // Precios
  getPrecios: async () => {
    const res = await api.get('/barriles-v2/precios')
    return res.data as any[]
  },
  upsertPrecio: async (tipo: string, precio_normal: number, precio_hora_santa: number) => {
    const res = await api.put('/barriles-v2/precios', { tipo, precio_normal, precio_hora_santa })
    return res.data
  },
  syncPrecios: async () => {
    const res = await api.post('/barriles-v2/precios/sync')
    return res.data
  },

  // Barriles
  getBarriles: async (filtro?: string) => {
    const res = await api.get('/barriles-v2/barriles', { params: filtro ? { filtro } : undefined })
    return res.data as any[]
  },
  getBarril: async (id: number) => {
    const res = await api.get(`/barriles-v2/barriles/${id}`)
    return res.data
  },
  createBarril: async (data: Record<string, any>) => {
    const res = await api.post('/barriles-v2/barriles', data)
    return res.data
  },
  updateBarril: async (id: number, data: Record<string, any>) => {
    const res = await api.patch(`/barriles-v2/barriles/${id}`, data)
    return res.data
  },
  deleteBarril: async (id: number) => {
    const res = await api.delete(`/barriles-v2/barriles/${id}`)
    return res.data
  },
  getAudit: async (limit = 500, barrilId?: number) => {
    const params: Record<string, any> = { limit }
    if (barrilId !== undefined) params.barril_id = barrilId
    const res = await api.get('/barriles-v2/audit', { params })
    return res.data as any[]
  },

  // Visor
  getVisorBarriles: async () => {
    const res = await api.get('/barriles-v2/visor')
    return res.data as any[]
  },
  getVisor2: async () => {
    const res = await api.get('/barriles-v2/visor2')
    return res.data
  },
  upsertGrupo: async (data: Record<string, any>) => {
    const res = await api.put('/barriles-v2/visor/grupo', data)
    return res.data
  },
  upsertItem: async (data: Record<string, any>) => {
    const res = await api.put('/barriles-v2/visor/item', data)
    return res.data
  },
  deleteItem: async (id: number) => {
    const res = await api.delete(`/barriles-v2/visor/item/${id}`)
    return res.data
  },
  upsertMenuItem: async (data: Record<string, any>) => {
    const res = await api.put('/barriles-v2/visor2/menu', data)
    return res.data
  },
  deleteMenuItem: async (id: number) => {
    const res = await api.delete(`/barriles-v2/visor2/menu/${id}`)
    return res.data
  },

  // Migración
  migrar: async () => {
    const res = await api.post('/barriles-v2/migrar')
    return res.data
  },

  // Info
  getInfo: async () => {
    const res = await api.get('/barriles-v2/info')
    return res.data as { max_canillas: number; turnos: string[]; estados: string[] }
  },
}

// ─── APP CONFIG ──────────────────────────────────────────────────────────────

// ─── VOUCHER ─────────────────────────────────────────────────────────────────

type VEntrada = { id: number; empleado_id: number; periodo: string; producto_nombre: string; producto_precio: number; cantidad: number; tipo: string; fecha: string | null; created_at: string }
type VResumen = { empleado_id: number; periodo: string; presupuesto_base: number; extra: number; presupuesto_total: number; total_consumos: number; total_descuentos: number; total_gastado: number; diferencia: number; excedido: boolean }
export type VProductoCatalogo = { codigo: string; nombre: string; precio: number; categoria: string; habilitado: boolean }
export type VRubroConfig = { rubro: string; habilitado: boolean }

export const voucherApi = {
  // Config global
  getConfigPresupuesto: async () => {
    const res = await api.get('/voucher/config/presupuesto')
    return res.data as { presupuesto_base: number }
  },
  setConfigPresupuesto: async (presupuesto: number) => {
    const res = await api.put('/voucher/config/presupuesto', { presupuesto })
    return res.data as { presupuesto_base: number }
  },

  // Empleados
  getEmpleados: async (includeInactive = true) => {
    const res = await api.get('/voucher/empleados', { params: { include_inactive: includeInactive } })
    return res.data as { id: number; nombre: string; apellido: string; activo: number; created_at: string }[]
  },
  createEmpleado: async (nombre: string, apellido: string) => {
    const res = await api.post('/voucher/empleados', { nombre, apellido })
    return res.data as { id: number; nombre: string; apellido: string; activo: number; created_at: string }
  },
  updateEmpleado: async (id: number, fields: { nombre?: string; apellido?: string; activo?: number }) => {
    const res = await api.patch(`/voucher/empleados/${id}`, fields)
    return res.data as { id: number; nombre: string; apellido: string; activo: number; created_at: string }
  },

  // Productos del catálogo
  getProductos: async (q?: string) => {
    const res = await api.get('/voucher/productos', { params: q ? { q } : {} })
    return res.data as { codigo: string; nombre: string; precio: number; categoria: string }[]
  },
  getProductosConfig: async () => {
    const res = await api.get('/voucher/productos/config')
    return res.data as VProductoCatalogo[]
  },
  setProductoHabilitado: async (codigo: string, habilitado: boolean) => {
    const res = await api.patch(`/voucher/productos/${encodeURIComponent(codigo)}/habilitado`, { habilitado })
    return res.data as { codigo: string; habilitado: boolean }
  },
  getRubrosConfig: async () => {
    const res = await api.get('/voucher/rubros/config')
    return res.data as VRubroConfig[]
  },
  setRubroHabilitado: async (rubro: string, habilitado: boolean) => {
    const res = await api.patch(`/voucher/rubros/${encodeURIComponent(rubro)}/habilitado`, { habilitado })
    return res.data as VRubroConfig
  },

  // Presupuesto extra individual
  getPresupuesto: async (empleadoId: number, periodo: string) => {
    const res = await api.get(`/voucher/presupuesto/${empleadoId}`, { params: { periodo } })
    return res.data as { id: number; empleado_id: number; periodo: string; extra: number }
  },
  updatePresupuesto: async (empleadoId: number, periodo: string, extra: number) => {
    const res = await api.put(`/voucher/presupuesto/${empleadoId}`, { periodo, extra })
    return res.data as { id: number; empleado_id: number; periodo: string; extra: number }
  },

  // Entradas
  getEntradasPeriodo: async (periodo: string) => {
    const res = await api.get('/voucher/entradas', { params: { periodo } })
    return res.data as VEntrada[]
  },
  getEntradas: async (empleadoId: number, periodo: string) => {
    const res = await api.get(`/voucher/entradas/${empleadoId}`, { params: { periodo } })
    return res.data as VEntrada[]
  },
  addEntrada: async (empleadoId: number, body: { periodo: string; producto_nombre: string; producto_precio: number; cantidad: number; tipo?: string; fecha?: string }) => {
    const res = await api.post(`/voucher/entradas/${empleadoId}`, body)
    return res.data as VEntrada
  },
  deleteEntrada: async (entradaId: number) => {
    await api.delete(`/voucher/entradas/${entradaId}`)
  },

  // Resumen
  getResumenPeriodo: async (periodo: string) => {
    const res = await api.get('/voucher/resumen', { params: { periodo } })
    return res.data as VResumen[]
  },
  getResumenEmpleado: async (empleadoId: number, periodo: string) => {
    const res = await api.get(`/voucher/resumen/${empleadoId}`, { params: { periodo } })
    return res.data as VResumen
  },
}

// ─── APP CONFIG ──────────────────────────────────────────────────────────────

export const appConfigApi = {
  getValesObjetivoPct: async (): Promise<number> => {
    const res = await api.get('/app-config/vales-objetivo-pct')
    return (res.data as { value: number }).value
  },
  setValesObjetivoPct: async (value: number): Promise<void> => {
    await api.put('/app-config/vales-objetivo-pct', { value })
  },
}

export default api

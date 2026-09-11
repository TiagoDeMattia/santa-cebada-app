// ── Configuración local del Visor (persiste en localStorage) ─────────────────

export interface CanillaFija {
  canilla: string
  enabled: boolean
  estilo?: string   // nombre de la cerveza a mostrar cuando está agotada
  precio?: string   // precio a mostrar cuando está agotada
}

export interface VisorConfig {
  canillas_fijas: CanillaFija[]
  beer_photos: Record<string, string>  // canilla -> base64 data URL
}

const STORAGE_KEY = 'santa_cebada_visor_config'

const DEFAULT_CONFIG: VisorConfig = { canillas_fijas: [], beer_photos: {} }

export function loadVisorConfig(): VisorConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CONFIG, beer_photos: {} }
    const parsed = JSON.parse(raw) as Partial<VisorConfig>
    return {
      canillas_fijas: parsed.canillas_fijas ?? [],
      beer_photos: parsed.beer_photos ?? {},
    }
  } catch {
    return { ...DEFAULT_CONFIG, beer_photos: {} }
  }
}

export function saveVisorConfig(config: VisorConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    if (e instanceof DOMException) {
      console.warn('[visorConfig] localStorage quota exceeded; config not saved.', e)
    } else {
      throw e
    }
  }
}

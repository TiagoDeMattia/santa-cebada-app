import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function arToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())
}

export function getErrorMessage(error: unknown): string {
  // Check axios/fetch response detail before falling back to error.message,
  // since AxiosError extends Error and would match instanceof first otherwise.
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>
    if (e.response && typeof e.response === 'object') {
      const res = e.response as Record<string, unknown>
      if (res.data && typeof res.data === 'object') {
        const data = res.data as Record<string, unknown>
        if (typeof data.detail === 'string') return data.detail
        if (typeof data.message === 'string') return data.message
      }
      if (typeof res.data === 'string' && res.data) return res.data
    }
    if (error instanceof Error) return error.message
  }
  if (error instanceof Error) return error.message
  return 'Ocurrió un error inesperado'
}

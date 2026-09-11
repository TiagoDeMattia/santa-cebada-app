import type { User } from '../types'

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const user = JSON.parse(raw) as User
    // Migrar rol viejo 'vales' → 'cajero'
    if ((user as any).role === 'vales') user.role = 'cajero'
    return user
  } catch {
    return null
  }
}

export function storeUser(user: User, token: string, rememberMe: boolean = false) {
  localStorage.setItem('user', JSON.stringify(user))
  localStorage.setItem('token', token)
  // rememberMe persiste en localStorage para que el próximo init lo pueda leer
  if (rememberMe) {
    localStorage.setItem('rememberMe', 'true')
  } else {
    localStorage.removeItem('rememberMe')
  }
}

export function clearAuth() {
  localStorage.removeItem('user')
  localStorage.removeItem('token')
  localStorage.removeItem('rememberMe')
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token')
}

export function shouldRememberMe(): boolean {
  return localStorage.getItem('rememberMe') === 'true'
}


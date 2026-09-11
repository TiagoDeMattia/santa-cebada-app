import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { User } from '../types'
import { getStoredUser, storeUser, clearAuth } from '../lib/auth'
import { authApi } from '../lib/api'

interface AuthContextType {
  user: User | null
  login: (username: string, password: string, rememberMe: boolean) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser())

  const login = useCallback(async (username: string, password: string, rememberMe: boolean = false) => {
    try {
      const tokenRes = await authApi.login({
        username,
        password,
        remember_me: rememberMe,
      })
      
      // Decodificar el JWT para obtener el rol y nombre
      try {
        const parts = tokenRes.access_token.split('.')
        if (parts.length === 3) {
          const decoded = JSON.parse(atob(parts[1]))
          // Mapear roles correctamente: admin, visor, user
          const role = decoded.role === 'admin' ? 'admin' : decoded.role === 'visor' ? 'visor' : (decoded.role === 'cajero' || decoded.role === 'vales') ? 'cajero' : decoded.role === 'salon' ? 'salon' : decoded.role === 'cocina' ? 'cocina' : 'user'
          const nombre = decoded.nombre || username
          
          const userData: User = {
            username,
            nombre,
            role,
            rememberMe,
          }
          
          storeUser(userData, tokenRes.access_token, rememberMe)
          setUser(userData)
        } else {
          throw new Error('Token inválido')
        }
      } catch (e) {
        throw new Error('Error al procesar el token')
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error al iniciar sesión')
    }
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

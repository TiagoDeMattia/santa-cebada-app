import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { ReactNode } from 'react'

type UserRole = 'admin' | 'user' | 'visor' | 'cajero' | 'salon' | 'cocina'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: UserRole
  allowedRoles?: UserRole[]
}

function defaultRedirect(role: string | undefined): string {
  if (role === 'user')   return '/barriles'
  if (role === 'salon')  return '/barriles'
  if (role === 'cocina') return '/panel-8586'
  if (role === 'visor')  return '/visor/1'
  if (role === 'cajero') return '/cajero'
  return '/dashboard'
}

export function ProtectedRoute({ children, requiredRole, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={defaultRedirect(user?.role)} replace />
  }

  if (allowedRoles && !allowedRoles.includes((user?.role ?? 'user') as UserRole)) {
    return <Navigate to={defaultRedirect(user?.role)} replace />
  }

  return <>{children}</>
}

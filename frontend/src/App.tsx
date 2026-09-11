import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Layout } from './components/layout/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Productos } from './pages/Productos'
import { Actualizar } from './pages/Actualizar'
import { Sucursales } from './pages/Sucursales'
import { Estadistica } from './pages/Estadistica'
import { Barriles } from './pages/Barriles'
import { Usuarios } from './pages/Usuarios'
import { CervezasVisor1 } from './pages/CervezasVisor1'
import { CervezasVisor2 } from './pages/CervezasVisor2'
import { StockCervezas } from './pages/StockCervezas'
import { StockGeneral, CentralPedidos, HistorialStocks, ConfiguracionStock } from './pages/StockGeneral'
import Panel8586 from './pages/Panel8586'
import ValesMonitor from './pages/ValesMonitor'
import CartaIA from './pages/CartaIA'
import { Prediccion } from './pages/Prediccion'
import { ModificarVisor } from './pages/ModificarVisor'
import BarrilesV2 from './pages/BarrilesV2'
import MetasVenta from './pages/MetasVenta'
import Voucher from './pages/Voucher'
import { useAuth } from './context/AuthContext'

// Componente para redirigir según rol
function RoleBasedRedirect() {
  const { user } = useAuth()

  if (user?.role === 'cajero') return <Navigate to="/cajero" replace />
  if (user?.role === 'user')   return <Navigate to="/barriles" replace />
  if (user?.role === 'salon')  return <Navigate to="/barriles-v2" replace />
  if (user?.role === 'cocina') return <Navigate to="/panel-8586" replace />
  if (user?.role === 'visor')  return <Navigate to="/visor/1" replace />
  return <Navigate to="/dashboard" replace />
}

// Componente interno que usa el contexto
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected - ADMIN only */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/productos"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Productos />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/actualizar"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Actualizar />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/sucursales"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Sucursales />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/estadistica"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Estadistica />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock-cervezas"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <StockCervezas />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock-general"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <StockGeneral />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/central-pedidos"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <CentralPedidos />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock-historial"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <HistorialStocks />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock-configuracion"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <ConfiguracionStock />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel-8586"
        element={
          <ProtectedRoute allowedRoles={['admin', 'salon', 'cocina']}>
            <Layout>
              <Panel8586 />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/prediccion"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Prediccion />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Usuarios />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/modificar-visor"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <ModificarVisor />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected - admin, user, salon */}
      <Route
        path="/barriles"
        element={
          <ProtectedRoute allowedRoles={['admin', 'user', 'salon']}>
            <Layout>
              <Barriles />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/barriles-v2"
        element={
          <ProtectedRoute allowedRoles={['admin', 'user', 'salon']}>
            <Layout>
              <BarrilesV2 />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Visor fullscreen - Solo para rol "visor" */}
      <Route
        path="/visor/1"
        element={
          <ProtectedRoute allowedRoles={['visor']}>
            <CervezasVisor1 />
          </ProtectedRoute>
        }
      />
      <Route
        path="/visor/2"
        element={
          <ProtectedRoute allowedRoles={['visor']}>
            <CervezasVisor2 />
          </ProtectedRoute>
        }
      />

      {/* Asistente IA */}
      <Route
        path="/carta-ia"
        element={
          <ProtectedRoute allowedRoles={['admin', 'user', 'salon', 'cocina']}>
            <Layout>
              <CartaIA />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/metas-venta"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <MetasVenta />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/voucher"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Voucher />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Cajero monitor - Solo para rol "cajero" (y admin para testing) */}
      <Route
        path="/cajero"
        element={
          <ProtectedRoute allowedRoles={['cajero', 'admin']}>
            <ValesMonitor />
          </ProtectedRoute>
        }
      />

      {/* Redirects */}
      <Route path="/" element={<RoleBasedRedirect />} />
      <Route path="*" element={<RoleBasedRedirect />} />
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

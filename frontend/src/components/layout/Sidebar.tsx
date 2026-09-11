import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, RefreshCw, BarChart2, Beer,
  Users, Droplets, TrendingUp,
  SlidersHorizontal, LogOut, X, Menu,
  ChevronDown, ChevronRight, ClipboardList, ShoppingCart, AlertTriangle, Bot,
  History, Settings2, Truck, FolderOpen, Target, Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'

// ─── Estructura de navegación ────────────────────────────────────────────────

interface NavItem {
  to?: string
  label: string
  icon: React.ElementType
  children?: { to: string; label: string; icon: React.ElementType }[]
}

const adminNav: NavItem[] = [
  { to: '/dashboard',       label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/panel-8586',      label: 'Panel 85 & 86', icon: AlertTriangle },
  {
    label: 'Estadística',
    icon: BarChart2,
    children: [
      { to: '/estadistica',  label: 'Métricas',       icon: BarChart2 },
      { to: '/prediccion',   label: 'Predicción',     icon: TrendingUp },
      { to: '/metas-venta',  label: 'Metas de Venta', icon: Target },
    ],
  },
  { to: '/barriles-v2',    label: 'Barriles',            icon: Beer },
  { to: '/stock-cervezas', label: 'Control de Cervezas', icon: Droplets },
  {
    label: 'Stock',
    icon: ClipboardList,
    children: [
      { to: '/stock-general',        label: 'Stock General',    icon: ClipboardList },
      { to: '/central-pedidos',      label: 'Central Pedidos',  icon: ShoppingCart },
      { to: '/stock-historial',      label: 'Historial',        icon: History },
      { to: '/stock-configuracion',  label: 'Configuraciones',  icon: Settings2 },
    ],
  },
  {
    label: 'Productos',
    icon: Package,
    children: [
      { to: '/productos',  label: 'Catálogo',   icon: Package },
      { to: '/actualizar', label: 'Actualizar', icon: RefreshCw },
    ],
  },
  { to: '/voucher',          label: 'Voucher',      icon: Wallet },
  { to: '/carta-ia',        label: 'Asistente IA', icon: Bot },
  { to: '/usuarios',        label: 'Usuarios',     icon: Users },
  { to: '/modificar-visor', label: 'Visor',        icon: SlidersHorizontal },
]

const userNav: NavItem[] = [
  { to: '/barriles-v2', label: 'Barriles', icon: Beer },
]

const salonNav: NavItem[] = [
  { to: '/barriles-v2', label: 'Barriles',      icon: Beer },
  { to: '/panel-8586',  label: 'Panel 85 & 86', icon: AlertTriangle },
  { to: '/carta-ia',    label: 'Asistente IA',  icon: Bot },
]

const cocinaNav: NavItem[] = [
  { to: '/panel-8586', label: 'Panel 85 & 86', icon: AlertTriangle },
  { to: '/carta-ia',   label: 'Asistente IA',  icon: Bot },
]

// ─── Item individual ─────────────────────────────────────────────────────────

function SidebarItem({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const { pathname } = useLocation()
  const childActive = item.children?.some(c => pathname.startsWith(c.to)) ?? false
  const [open, setOpen] = useState(childActive)

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
            childActive
              ? 'text-accent font-semibold'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
            'hover:bg-surface-tertiary dark:hover:bg-dark-elevated'
          )}
        >
          <item.icon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {open
            ? <ChevronDown className="w-3.5 h-3.5 transition-transform" />
            : <ChevronRight className="w-3.5 h-3.5 transition-transform" />
          }
        </button>
        {open && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 dark:border-dark-border pl-3">
            {item.children.map(child => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                    isActive
                      ? 'font-semibold text-accent bg-accent/8 dark:bg-accent/12'
                      : 'font-medium text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-surface-tertiary dark:hover:bg-dark-elevated'
                  )
                }
              >
                <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.to!}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
          isActive
            ? 'font-semibold text-accent bg-accent/8 dark:bg-accent/12'
            : 'font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-surface-tertiary dark:hover:bg-dark-elevated'
        )
      }
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      {item.label}
    </NavLink>
  )
}

// ─── Contenido del sidebar ───────────────────────────────────────────────────

function SidebarContent({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const navItems =
    isAdmin            ? adminNav  :
    user?.role === 'salon'  ? salonNav  :
    user?.role === 'cocina' ? cocinaNav :
    userNav

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.username?.[0]?.toUpperCase() ?? 'U'
  const rolLabel =
    isAdmin                  ? 'Admin'   :
    user?.role === 'visor'   ? 'Visor'   :
    user?.role === 'salon'   ? 'Salón'   :
    user?.role === 'cocina'  ? 'Cocina'  :
    user?.role === 'cajero'  ? 'Cajero'  :
    'Usuario'

  return (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3 border-b border-gray-100 dark:border-dark-border">
        <img src="/logo.png" alt="Santa Cebada" className="h-9 w-9 object-contain" />
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 font-display tracking-tight leading-none">
            Santa Cebada
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5 uppercase tracking-widest">
            Recoleta
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item, i) => (
          <SidebarItem key={i} item={item} onClose={onClose} />
        ))}
      </nav>

      {/* Usuario + logout */}
      <div className="px-3 py-4 border-t border-gray-100 dark:border-dark-border space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-secondary dark:bg-dark-elevated">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
            <span className="text-accent text-sm font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase truncate leading-none">
              {user?.username}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{rolLabel}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-500 hover:text-danger dark:hover:text-danger hover:bg-danger/5 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

// ─── Sidebar principal (desktop + mobile drawer) ──────────────────────────────

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop: sidebar fija */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-gray-100 dark:border-dark-border bg-white dark:bg-dark-surface h-screen sticky top-0 overflow-y-auto">
        <SidebarContent onClose={() => {}} />
      </aside>

      {/* Mobile: overlay + drawer */}
      {mobileOpen && (
        <>
          <div className="sidebar-overlay lg:hidden" onClick={onClose} />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-dark-surface shadow-large dark:shadow-dark-large flex flex-col animate-slide-in-left">
            <div className="flex items-center justify-end px-4 py-3 border-b border-gray-100 dark:border-dark-border">
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-surface-secondary dark:hover:bg-dark-elevated transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent onClose={onClose} />
          </aside>
        </>
      )}
    </>
  )
}

// ─── Botón hamburguesa para mobile ───────────────────────────────────────────

export function MenuToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-surface-secondary dark:hover:bg-dark-elevated transition-all"
      aria-label="Abrir menú"
    >
      <Menu className="w-5 h-5" />
    </button>
  )
}

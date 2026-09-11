import { useState, type ReactNode } from 'react'
import { Sidebar, MenuToggle } from './Sidebar'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex min-h-screen bg-surface-secondary dark:bg-dark-bg transition-colors duration-300">

      {/* Sidebar */}
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">

        {/* Top bar — solo visible en mobile */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white dark:bg-dark-surface border-b border-gray-100 dark:border-dark-border">
          <MenuToggle onClick={() => setSidebarOpen(true)} />
          <img src="/logo.png" alt="Santa Cebada" className="h-7 w-7 object-contain" />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-surface-secondary dark:hover:bg-dark-elevated transition-all"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </header>

        {/* Theme toggle desktop — flotante top-right */}
        <div className="hidden lg:block fixed top-4 right-6 z-10">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-dark-elevated shadow-soft dark:shadow-dark-soft border border-gray-100 dark:border-dark-border transition-all"
            title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Contenido de la página */}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

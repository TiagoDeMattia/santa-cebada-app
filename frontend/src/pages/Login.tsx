import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Spinner } from '../components/ui/Spinner'

export function Login() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Completá todos los campos')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(username, password, rememberMe)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-secondary dark:bg-dark-bg flex transition-colors duration-300">

      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex flex-col w-[420px] flex-shrink-0 bg-dark-bg relative overflow-hidden">
        {/* Grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '200px',
          }}
        />
        {/* Amber glow top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-accent/8 rounded-full blur-3xl" />

        <div className="relative flex flex-col h-full px-10 py-12">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Santa Cebada" className="h-14 w-14 object-contain brightness-0 invert" />
          </div>

          {/* Hero text */}
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-xs font-semibold text-accent uppercase tracking-[0.2em] mb-4">
              Sistema de Gestión
            </p>
            <h1 className="font-display text-4xl font-bold text-white leading-tight tracking-tight">
              Santa<br />Cebada
            </h1>
            <p className="mt-4 text-gray-500 text-sm leading-relaxed max-w-xs">
              Gestioná barriles, productos, estadísticas y el visor de la barra — todo desde un solo lugar.
            </p>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-700 font-medium">
            Recoleta · Buenos Aires
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5">
            <img src="/logo.png" alt="Santa Cebada" className="h-8 w-8 object-contain dark:brightness-0 dark:invert" />
            <span className="font-display font-bold text-gray-900 dark:text-gray-100 text-sm">Santa Cebada</span>
          </div>
          <div className="hidden lg:block" />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-dark-elevated border border-transparent hover:border-gray-200 dark:hover:border-dark-border transition-all"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        {/* Form center */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-sm animate-slide-up">

            <div className="mb-8">
              <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Bienvenido de vuelta
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                Ingresá con tu usuario y contraseña
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Username */}
              <div className="space-y-1.5">
                <label className="label-xs">Usuario</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError('') }}
                  placeholder="tu usuario"
                  className="input"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="label-xs">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="••••••••"
                    className="input pr-11"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-border transition-all"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <div
                  onClick={() => setRememberMe(v => !v)}
                  className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    rememberMe ? 'bg-accent border-accent' : 'border-gray-300 dark:border-dark-border group-hover:border-accent/60'
                  }`}
                >
                  {rememberMe && (
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-white fill-none stroke-current stroke-[2]">
                      <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Mantener sesión iniciada</span>
              </label>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-danger/5 dark:bg-danger/10 border border-danger/20 rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0" />
                  <p className="text-xs text-danger font-medium">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3"
              >
                {loading ? (
                  <><Spinner size="sm" className="text-white" /><span>Ingresando...</span></>
                ) : (
                  <><span>Ingresar</span><ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pb-6">
          Sistema de gestión · Santa Cebada
        </p>
      </div>
    </div>
  )
}

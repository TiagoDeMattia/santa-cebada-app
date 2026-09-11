import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, RefreshCw, Lock, User, Shield, BarChart2, UtensilsCrossed, Wine } from 'lucide-react'
import api from '../lib/api'
import { Spinner } from '../components/ui/Spinner'
import { useToast, ToastContainer } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { getErrorMessage } from '../lib/utils'

interface Usuario {
  id: number
  username: string
  nombre?: string
  role: string
  created_at: string
  updated_at: string
}

interface FormData {
  username: string
  nombre: string
  password: string
  role: 'ADMIN' | 'NORMAL' | 'SALON' | 'COCINA' | 'VISOR' | 'CAJERO'
}

export function Usuarios() {
  const { toasts, addToast, removeToast } = useToast()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<FormData>({
    username: '',
    nombre: '',
    password: '',
    role: 'NORMAL',
  })
  const [saving, setSaving] = useState(false)

  const cargarUsuarios = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get('/auth/users')
      setUsuarios(response.data)
    } catch (err) {
      addToast('error', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    cargarUsuarios()
  }, [cargarUsuarios])

  const handleOpenModal = (usuario?: Usuario) => {
    if (usuario) {
      setEditingId(usuario.id)
      setFormData({
        username: usuario.username,
        nombre: usuario.nombre || '',
        password: '',
        role: usuario.role as 'ADMIN' | 'NORMAL' | 'VISOR' | 'CAJERO',
      })
    } else {
      setEditingId(null)
      setFormData({
        username: '',
        nombre: '',
        password: '',
        role: 'NORMAL',
      })
    }
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setFormData({
      username: '',
      nombre: '',
      password: '',
      role: 'NORMAL',
    })
  }

  const handleSave = async () => {
    if (!formData.username.trim()) {
      addToast('error', 'El usuario es requerido')
      return
    }

    if (!editingId && !formData.password.trim()) {
      addToast('error', 'La contraseña es requerida para nuevos usuarios')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        // Actualizar usuario
        const updateData: any = { nombre: formData.nombre, role: formData.role }
        if (formData.password.trim()) {
          updateData.password = formData.password
        }
        await api.put(`/auth/users/${editingId}`, updateData)
        addToast('success', 'Usuario actualizado correctamente')
      } else {
        // Crear usuario
        await api.post('/auth/users', {
          username: formData.username,
          nombre: formData.nombre,
          password: formData.password,
          role: formData.role,
        })
        addToast('success', 'Usuario creado correctamente')
      }
      await cargarUsuarios()
      handleCloseModal()
    } catch (err) {
      addToast('error', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`¿Estás seguro de que querés eliminar a ${username}?`)) {
      return
    }

    try {
      await api.delete(`/auth/users/${id}`)
      addToast('success', 'Usuario eliminado correctamente')
      await cargarUsuarios()
    } catch (err) {
      addToast('error', getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Usuarios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Gestión de usuarios del sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => cargarUsuarios()} disabled={loading} className="btn-ghost text-xs gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nuevo usuario
          </button>
        </div>
      </div>

      {/* Tabla de usuarios */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500 dark:text-gray-500">Cargando usuarios...</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-border bg-surface-secondary dark:bg-dark-elevated/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide hidden sm:table-cell">Creado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="border-b border-gray-50 dark:border-dark-border/50 hover:bg-surface-secondary dark:hover:bg-dark-elevated/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent/10 dark:bg-accent/20 flex items-center justify-center">
                          <span className="text-accent text-xs font-semibold uppercase">{usuario.username[0]}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{usuario.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                        usuario.role === 'ADMIN'
                          ? 'bg-accent/10 dark:bg-accent/20 text-accent'
                          : usuario.role === 'VISOR'
                          ? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-500'
                          : usuario.role === 'CAJERO'
                          ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-500'
                          : usuario.role === 'SALON'
                          ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500'
                          : usuario.role === 'COCINA'
                          ? 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-500'
                          : 'bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-gray-400'
                      }`}>
                        {usuario.role === 'ADMIN' ? (
                          <Shield className="w-3 h-3" />
                        ) : usuario.role === 'VISOR' ? (
                          <span className="text-sm">📺</span>
                        ) : usuario.role === 'CAJERO' ? (
                          <BarChart2 className="w-3 h-3" />
                        ) : usuario.role === 'SALON' ? (
                          <Wine className="w-3 h-3" />
                        ) : usuario.role === 'COCINA' ? (
                          <UtensilsCrossed className="w-3 h-3" />
                        ) : (
                          <User className="w-3 h-3" />
                        )}
                        {usuario.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {new Date(usuario.created_at).toLocaleDateString('es-AR')}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(usuario)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(usuario.id, usuario.username)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-danger/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {usuarios.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <User className="w-8 h-8 text-gray-300 dark:text-gray-700" />
              <p className="text-sm text-gray-500 dark:text-gray-500">Sin usuarios para mostrar</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de crear/editar usuario */}
      <Modal open={modalOpen} onClose={handleCloseModal} title={editingId ? 'Editar usuario' : 'Nuevo usuario'} size="md">
        <div className="space-y-4">
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Usuario</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Ingresá el nombre de usuario"
              className="input text-sm"
              disabled={!!editingId}
            />
          </div>

          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Nombre del propietario</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: Juan (sin apellido)"
              className="input text-sm"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Lock className="w-3 h-3" /> Contraseña
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={editingId ? 'Dejar en blanco para no cambiar' : 'Ingresá la contraseña'}
              className="input text-sm"
            />
            {editingId && (
              <p className="text-xs text-gray-400 dark:text-gray-600">Dejar en blanco para mantener la contraseña actual</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Rol</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
                  formData.role === 'ADMIN'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:border-accent'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="text-xs font-medium">ADMIN</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'SALON' })}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
                  formData.role === 'SALON'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                    : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:border-emerald-500'
                }`}
              >
                <Wine className="w-4 h-4" />
                <span className="text-xs font-medium">SALON</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'COCINA' })}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
                  formData.role === 'COCINA'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                    : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:border-orange-500'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span className="text-xs font-medium">COCINA</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'VISOR' })}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
                  formData.role === 'VISOR'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                    : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:border-purple-500'
                }`}
              >
                <span className="text-base">📺</span>
                <span className="text-xs font-medium">VISOR</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'CAJERO' })}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
                  formData.role === 'CAJERO'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                    : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:border-blue-500'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span className="text-xs font-medium">CAJERO</span>
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              • ADMIN: Todo · SALON: Barriles + Panel · COCINA: Solo panel · VISOR: TV · CAJERO: Monitor
            </p>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-dark-border">
            <button onClick={handleCloseModal} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <><Spinner size="sm" className="text-white" /> Guardando...</> : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

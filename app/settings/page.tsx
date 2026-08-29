'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function save() {
    setErr(''); setMsg('')
    if (!username.trim()) { setErr('Escribe un usuario'); return }
    if (password && password !== confirmPassword) { setErr('Las contraseñas no coinciden'); return }
    if (password && password.length < 6) { setErr('La contraseña debe tener al menos 6 caracteres'); return }
    setSaving(true)
    const { error } = await supabase.rpc('set_app_login', {
      p_username: username.trim(),
      p_password: password ? password : null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setMsg('Guardado. La próxima vez que entres, usa estos datos.')
    setUsername(''); setPassword(''); setConfirmPassword('')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Ajustes</h1>
        <p className="text-gray-500 mt-1 mb-8">Cambiar el usuario y la contraseña para entrar al sistema.</p>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-gray-600 text-xs font-medium mb-2">Nuevo usuario</label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="infinityos"
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-gray-600 text-xs font-medium mb-2">Nueva contraseña <span className="text-gray-400 font-normal">(déjalo en blanco para no cambiarla)</span></label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-gray-600 text-xs font-medium mb-2">Confirmar nueva contraseña</label>
            <input
              type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {err && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">{err}</div>}
          {msg && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">{msg}</div>}

          <button
            onClick={save} disabled={saving}
            className="rounded-lg py-3 px-6 text-white text-sm font-bold transition-colors disabled:cursor-not-allowed"
            style={{ background: saving ? '#9ca3af' : 'linear-gradient(135deg,#ff6b00,#ff9500)' }}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ChatGPTToken {
  id: number
  token: string
  is_active: boolean
  created_at: string
  last_used_at: string | null
  notes: string | null
}

export default function SettingsPage() {
  // Login settings
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // ChatGPT API settings
  const [tokens, setTokens] = useState<ChatGPTToken[]>([])
  const [generatingToken, setGeneratingToken] = useState(false)
  const [tokenNotes, setTokenNotes] = useState('')
  const [newToken, setNewToken] = useState('')
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  useEffect(() => {
    loadTokens()
  }, [])

  async function loadTokens() {
    const { data, error } = await supabase
      .from('chatgpt_api_tokens')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) {
      setTokens(data)
    }
  }

  async function saveLogin() {
    setErr('')
    setMsg('')
    if (!username.trim()) {
      setErr('Escribe un usuario')
      return
    }
    if (password && password !== confirmPassword) {
      setErr('Las contraseñas no coinciden')
      return
    }
    if (password && password.length < 6) {
      setErr('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setSaving(true)
    const { error } = await supabase.rpc('set_app_login', {
      p_username: username.trim(),
      p_password: password ? password : null,
    })
    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    setMsg('Guardado. La próxima vez que entres, usa estos datos.')
    setUsername('')
    setPassword('')
    setConfirmPassword('')
  }

  async function generateToken() {
    setGeneratingToken(true)
    const { data, error } = await supabase.rpc('generate_chatgpt_token', {
      p_notes: tokenNotes || null
    })
    setGeneratingToken(false)
    if (error) {
      alert('Error: ' + error.message)
      return
    }
    setNewToken(data)
    setTokenNotes('')
    loadTokens()
  }

  async function revokeToken(token: string) {
    if (!confirm('¿Estás seguro? ChatGPT no podrá usar este token.')) return
    const { error } = await supabase.rpc('revoke_chatgpt_token', { p_token: token })
    if (error) {
      alert('Error: ' + error.message)
      return
    }
    loadTokens()
  }

  async function loadAuditLog() {
    setLoadingAudit(true)
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('user_agent', 'chatgpt')
      .order('timestamp', { ascending: false })
      .limit(50)
    setLoadingAudit(false)
    if (!error && data) {
      setAuditLog(data)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Ajustes</h1>
          <p className="text-gray-500">Gestiona tu cuenta, seguridad e integraciones</p>
        </div>

        {/* Login Settings */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Cambiar Usuario y Contraseña</h2>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <label className="block text-gray-600 text-xs font-medium mb-2">Nuevo usuario</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="infinityos"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-gray-600 text-xs font-medium mb-2">
                Nueva contraseña <span className="text-gray-400 font-normal">(déjalo en blanco para no cambiarla)</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-gray-600 text-xs font-medium mb-2">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {err && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">{err}</div>}
            {msg && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">{msg}</div>}

            <button
              onClick={saveLogin}
              disabled={saving}
              className="rounded-lg py-3 px-6 text-white text-sm font-bold transition-colors disabled:cursor-not-allowed"
              style={{ background: saving ? '#9ca3af' : 'linear-gradient(135deg,#ff6b00,#ff9500)' }}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </section>

        {/* ChatGPT API Settings */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">ChatGPT API Access</h2>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
            {/* New Token Generation */}
            <div className="pb-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Generar Nuevo Token</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-600 text-xs font-medium mb-2">Descripción (opcional)</label>
                  <input
                    value={tokenNotes}
                    onChange={e => setTokenNotes(e.target.value)}
                    placeholder="Ej: Token para ChatGPT"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500"
                  />
                </div>
                <button
                  onClick={generateToken}
                  disabled={generatingToken}
                  className="w-full rounded-lg py-3 px-6 text-white text-sm font-bold transition-colors disabled:cursor-not-allowed"
                  style={{ background: generatingToken ? '#9ca3af' : 'linear-gradient(135deg,#10b981,#059669)' }}
                >
                  {generatingToken ? 'Generando...' : 'Generar Nuevo Token'}
                </button>

                {newToken && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">✅ Token Generado</p>
                    <div className="bg-white border border-blue-300 rounded p-3 font-mono text-xs text-gray-900 break-all mb-3">
                      {newToken}
                    </div>
                    <p className="text-xs text-blue-800 mb-3">
                      Copia este token y úsalo para conectar ChatGPT. Solo lo ves una vez.
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newToken)
                        setNewToken('')
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Copiar y cerrar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Active Tokens */}
            <div className="pb-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tokens Activos</h3>
              {tokens.length === 0 ? (
                <p className="text-gray-600 text-sm">No hay tokens generados aún.</p>
              ) : (
                <div className="space-y-3">
                  {tokens.map(token => (
                    <div key={token.id} className={`border rounded-lg p-4 ${token.is_active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-300'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-mono text-gray-900">
                            {token.token.slice(0, 10)}...{token.token.slice(-10)}
                          </p>
                          {token.notes && <p className="text-xs text-gray-600 mt-1">{token.notes}</p>}
                          <p className="text-xs text-gray-500 mt-2">
                            Creado: {new Date(token.created_at).toLocaleDateString('es-ES')}
                            {token.last_used_at && ` • Último uso: ${new Date(token.last_used_at).toLocaleDateString('es-ES')}`}
                          </p>
                          <span className={`inline-block text-xs font-semibold mt-2 px-2 py-1 rounded ${token.is_active ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                            {token.is_active ? 'Activo' : 'Revocado'}
                          </span>
                        </div>
                        {token.is_active && (
                          <button
                            onClick={() => revokeToken(token.token)}
                            className="ml-4 text-xs font-semibold text-red-600 hover:text-red-700"
                          >
                            Revocar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit Log */}
            <div>
              <button
                onClick={() => {
                  if (!showAuditLog) {
                    loadAuditLog()
                  }
                  setShowAuditLog(!showAuditLog)
                }}
                className="text-sm font-semibold text-orange-600 hover:text-orange-700 mb-4"
              >
                {showAuditLog ? '▼ Ocultar Audit Log' : '▶ Ver Audit Log'}
              </button>

              {showAuditLog && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  {loadingAudit ? (
                    <p className="text-sm text-gray-600">Cargando...</p>
                  ) : auditLog.length === 0 ? (
                    <p className="text-sm text-gray-600">Sin actividad registrada.</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto text-xs">
                      {auditLog.map(entry => (
                        <div key={entry.id} className="border-b border-gray-300 pb-2">
                          <p className="font-mono text-gray-900">
                            <span className="font-bold text-orange-600">{entry.action}</span>
                            {entry.resource_type && <span className="text-gray-600"> • {entry.resource_type}</span>}
                          </p>
                          <p className="text-gray-600 mt-1">{new Date(entry.timestamp).toLocaleString('es-ES')}</p>
                          {entry.details && (
                            <pre className="text-gray-500 mt-1 bg-white p-2 rounded overflow-x-auto">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)

  async function doLogin() {
    // Read directly from the DOM first — Chrome autofill fills the input
    // without firing React onChange, so state can be stale/empty.
    const u = (userRef.current?.value ?? username).trim()
    const p = (passRef.current?.value ?? password).trim()
    if (!u || !p) { setError('Escribe tu usuario y contraseña'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'No se pudo entrar — intenta de nuevo.')
        setLoading(false)
        return
      }
      // Hand the session to the browser's Supabase client so every data
      // request (RLS-checked) carries the real JWT from here on — not just
      // the presence cookie the middleware checks on page loads.
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      window.location.replace('/dashboard')
    } catch {
      setError('Error de red — intenta de nuevo.')
      setLoading(false)
    }
  }

  // Expose for QA automation
  useEffect(() => {
    (window as any).__login = () => doLogin()
  }, [username, password])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center font-sans">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl px-10 py-12 w-full max-w-[400px]">
        <div className="text-center mb-10">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl text-white font-bold shadow-lg"
               style={{ background: 'linear-gradient(135deg,#ff6b00,#ff9500)', boxShadow: '0 8px 24px rgba(255,107,0,0.3)' }}>
            ∞
          </div>
          <h1 className="text-gray-900 text-xl font-extrabold m-0">Infinity Wrap</h1>
          <p className="text-gray-500 text-sm mt-1">Manager OS</p>
        </div>

        <div className="mb-5">
          <label className="block text-gray-600 text-xs font-medium mb-2">Usuario</label>
          <input
            ref={userRef} type="text" autoComplete="username" value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLogin()}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="mb-7">
          <label className="block text-gray-600 text-xs font-medium mb-2">Contraseña</label>
          <input
            ref={passRef} type="password" autoComplete="current-password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLogin()}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm mb-5">
            {error}
          </div>
        )}

        <button
          onClick={() => doLogin()} disabled={loading}
          className="w-full rounded-lg py-3.5 text-white text-[15px] font-bold transition-colors disabled:cursor-not-allowed"
          style={{
            background: loading ? '#9ca3af' : 'linear-gradient(135deg,#ff6b00,#ff9500)',
            boxShadow: loading ? 'none' : '0 4px 15px rgba(255,107,0,0.3)',
          }}
        >
          {loading ? 'Entrando...' : 'Entrar →'}
        </button>

        <p className="text-gray-400 text-xs text-center mt-7">
          Infinity Wrap Design — Internal System
        </p>
      </div>
    </div>
  )
}

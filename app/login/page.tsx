'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const emailRef    = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function doLogin(pwdOverride?: string) {
    // Read directly from the DOM first — Chrome autofill fills the input
    // without firing React onChange, so state can be stale/empty.
    const e = (emailRef.current?.value ?? email).trim()
    const p = (pwdOverride ?? passwordRef.current?.value ?? password).trim()
    if (!e || !p) { setError('Enter your email and password'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, password: p })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Login failed — please try again.')
        setLoading(false)
        return
      }
      window.location.replace('/dashboard')
    } catch {
      setError('Network error — please try again.')
      setLoading(false)
    }
  }

  // Expose for QA automation
  useEffect(() => {
    (window as any).__login = (pwd: string) => doLogin(pwd)
  }, [email])

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
          <label className="block text-gray-600 text-xs font-medium mb-2">Email</label>
          <input
            ref={emailRef} type="email" autoComplete="username" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLogin()}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="mb-7">
          <label className="block text-gray-600 text-xs font-medium mb-2">Password</label>
          <input
            ref={passwordRef} type="password" autoComplete="current-password" placeholder="••••••••"
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
            boxShadow: loading ? 'none' : '0 4px 15px rgba(255,107,0,0.3)'
          }}
        >
          {loading ? 'Signing in...' : 'Sign In →'}
        </button>

        <p className="text-gray-400 text-xs text-center mt-7">
          Infinity Wrap Design — Internal System
        </p>
      </div>
    </div>
  )
}

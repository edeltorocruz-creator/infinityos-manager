'use client'
export const dynamic = 'force-dynamic'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const doLogin = useCallback(async () => {
    const email    = (document.getElementById('login-email')    as HTMLInputElement)?.value?.trim() || ''
    const password = (document.getElementById('login-password') as HTMLInputElement)?.value?.trim() || ''

    if (!email || !password) { setError('Enter your email and password'); return }
    setLoading(true); setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }
    if (data?.session) window.location.replace('/dashboard')
    else { setError('Login failed — please try again.'); setLoading(false) }
  }, [])

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doLogin()
  }, [doLogin])

  const inp: React.CSSProperties = {
    width: '100%', background: '#0a0c13', border: '1px solid #1e2235',
    borderRadius: '10px', padding: '12px 16px', color: '#fff',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box', display: 'block'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c13', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: '#12151f', border: '1px solid #1e2235', borderRadius: '16px', padding: '48px 40px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ background: 'linear-gradient(135deg,#ff6b00,#ff9500)', borderRadius: '14px', width: '56px', height: '56px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '16px', boxShadow: '0 8px 24px rgba(255,107,0,0.3)' }}>∞</div>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>Infinity Wrap</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Manager OS</p>
        </div>

        {/* Email */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="login-email" style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            defaultValue="edeltorocruz@gmail.com"
            onKeyDown={handleKey}
            style={inp}
            onFocus={e => e.target.style.borderColor = '#ff6b00'}
            onBlur={e  => e.target.style.borderColor = '#1e2235'}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '28px' }}>
          <label htmlFor="login-password" style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            onKeyDown={handleKey}
            style={inp}
            onFocus={e => e.target.style.borderColor = '#ff6b00'}
            onBlur={e  => e.target.style.borderColor = '#1e2235'}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#f87171', fontSize: '13px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {/* Button — onClick, no form submit */}
        <button
          onClick={doLogin}
          disabled={loading}
          style={{ width: '100%', background: loading ? '#374151' : 'linear-gradient(135deg,#ff6b00,#ff9500)', border: 'none', borderRadius: '10px', padding: '14px', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 15px rgba(255,107,0,0.3)' }}
        >
          {loading ? 'Signing in...' : 'Sign In →'}
        </button>

        <p style={{ color: '#374151', fontSize: '12px', textAlign: 'center', marginTop: '28px' }}>
          Infinity Wrap Design — Internal System
        </p>
      </div>
    </div>
  )
}

'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'

export default function LoginPage() {
  const [email,    setEmail]    = useState('edeltorocruz@gmail.com')
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

  const inp: React.CSSProperties = {
    width: '100%', background: '#0a0c13', border: '1px solid #1e2235',
    borderRadius: '10px', padding: '12px 16px', color: '#fff',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box', display: 'block'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c13', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: '#12151f', border: '1px solid #1e2235', borderRadius: '16px', padding: '48px 40px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ background: 'linear-gradient(135deg,#ff6b00,#ff9500)', borderRadius: '14px', width: '56px', height: '56px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '16px', boxShadow: '0 8px 24px rgba(255,107,0,0.3)' }}>∞</div>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>Infinity Wrap</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Manager OS</p>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Email</label>
          <input ref={emailRef} type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key==='Enter' && doLogin()} style={inp}
            onFocus={e => e.target.style.borderColor='#ff6b00'} onBlur={e => e.target.style.borderColor='#1e2235'} />
        </div>
        <div style={{ marginBottom: '28px' }}>
          <label style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Password</label>
          <input ref={passwordRef} type="password" autoComplete="current-password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key==='Enter' && doLogin()} style={inp}
            onFocus={e => e.target.style.borderColor='#ff6b00'} onBlur={e => e.target.style.borderColor='#1e2235'} />
        </div>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#f87171', fontSize: '13px', marginBottom: '20px' }}>
            {error}
          </div>
        )}
        <button onClick={() => doLogin()} disabled={loading}
          style={{ width: '100%', background: loading?'#374151':'linear-gradient(135deg,#ff6b00,#ff9500)', border: 'none', borderRadius: '10px', padding: '14px', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: loading?'not-allowed':'pointer', boxShadow: loading?'none':'0 4px 15px rgba(255,107,0,0.3)' }}>
          {loading ? 'Signing in...' : 'Sign In →'}
        </button>
        <p style={{ color: '#374151', fontSize: '12px', textAlign: 'center', marginTop: '28px' }}>
          Infinity Wrap Design — Internal System
        </p>
      </div>
    </div>
  )
}

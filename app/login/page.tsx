'use client'
export const dynamic = 'force-dynamic'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const email = emailRef.current?.value || ''
    const password = passwordRef.current?.value || ''
    
    if (!email || !password) {
      setError('Please enter email and password')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (data?.session) {
        window.location.replace('/dashboard')
      } else {
        setError('Login failed — no session returned.')
        setLoading(false)
      }
    } catch (err: unknown) {
      setError('Error: ' + (err instanceof Error ? err.message : String(err)))
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0c13',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: '#12151f',
        border: '1px solid #1e2235',
        borderRadius: '16px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #ff6b00, #ff9500)',
            borderRadius: '14px',
            width: '56px',
            height: '56px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(255,107,0,0.3)'
          }}>∞</div>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            Infinity Wrap
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Manager OS</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
              Email
            </label>
            <input
              ref={emailRef}
              type="email"
              defaultValue=""
              placeholder="edeltorocruz@gmail.com"
              required
              autoComplete="email"
              style={{
                width: '100%', background: '#0a0c13', border: '1px solid #1e2235',
                borderRadius: '10px', padding: '12px 16px', color: '#fff',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = '#ff6b00'}
              onBlur={e => e.target.style.borderColor = '#1e2235'}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
              Password
            </label>
            <input
              ref={passwordRef}
              type="password"
              defaultValue=""
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{
                width: '100%', background: '#0a0c13', border: '1px solid #1e2235',
                borderRadius: '10px', padding: '12px 16px', color: '#fff',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = '#ff6b00'}
              onBlur={e => e.target.style.borderColor = '#1e2235'}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px', padding: '12px 16px', color: '#f87171',
              fontSize: '13px', marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#374151' : 'linear-gradient(135deg, #ff6b00, #ff9500)',
              border: 'none', borderRadius: '10px', padding: '14px',
              color: '#fff', fontSize: '15px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(255,107,0,0.3)'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        <p style={{ color: '#374151', fontSize: '12px', textAlign: 'center', marginTop: '28px' }}>
          Infinity Wrap Design — Internal System
        </p>
      </div>
    </div>
  )
}

'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      console.log('Auth attempt:', { data, error: authError })

      if (authError) {
        setError(authError.message)
        setLoading(false)
      } else if (data?.session) {
        window.location.href = '/dashboard'
      } else {
        setError('Login failed — no session returned. Check Supabase URL config.')
        setLoading(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError('Error: ' + msg)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: '#1a1d27',
        border: '1px solid #2a2d3a',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #ff6b00, #ff9500)',
            borderRadius: '10px',
            width: '48px',
            height: '48px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            marginBottom: '12px'
          }}>∞</div>
          <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, margin: 0 }}>
            Infinity Wrap
          </h1>
          <p style={{ color: '#8b8fa8', fontSize: '14px', margin: '4px 0 0' }}>
            Manager OS
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#8b8fa8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="edeltorocruz@gmail.com"
              required
              style={{
                width: '100%',
                background: '#0f1117',
                border: '1px solid #2a2d3a',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: '#8b8fa8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                background: '#0f1117',
                border: '1px solid #2a2d3a',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#2d1a1a',
              border: '1px solid #5c2a2a',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#ff6b6b',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#4a4d5a' : 'linear-gradient(135deg, #ff6b00, #ff9500)',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ color: '#4a4d5a', fontSize: '12px', textAlign: 'center', marginTop: '24px' }}>
          Infinity Wrap Design — Internal System
        </p>
      </div>
    </div>
  )
}

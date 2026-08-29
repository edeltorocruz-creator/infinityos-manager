'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentMsg, setSentMsg] = useState('')

  const emailRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  async function sendCode() {
    const e = (emailRef.current?.value ?? email).trim()
    if (!e) { setError('Enter an email'); return }
    setLoading(true); setError(''); setSentMsg('')
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not send the code — please try again.')
        setLoading(false)
        return
      }
      setSentMsg('Code sent — check the inbox.')
      setStep('code')
      setLoading(false)
    } catch {
      setError('Network error — please try again.')
      setLoading(false)
    }
  }

  async function verifyCode(codeOverride?: string) {
    const c = (codeOverride ?? codeRef.current?.value ?? code).trim()
    if (!c) { setError('Enter the code'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Invalid or expired code — please try again.')
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
      setError('Network error — please try again.')
      setLoading(false)
    }
  }

  // Expose for QA automation
  useEffect(() => {
    (window as any).__sendCode = () => sendCode()
    ;(window as any).__verifyCode = (c: string) => verifyCode(c)
  }, [email, code])

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

        {step === 'email' ? (
          <>
            <div className="mb-7">
              <label className="block text-gray-600 text-xs font-medium mb-2">Email</label>
              <input
                ref={emailRef} type="email" autoComplete="username" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendCode()}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm mb-5">
                {error}
              </div>
            )}

            <button
              onClick={() => sendCode()} disabled={loading}
              className="w-full rounded-lg py-3.5 text-white text-[15px] font-bold transition-colors disabled:cursor-not-allowed"
              style={{
                background: loading ? '#9ca3af' : 'linear-gradient(135deg,#ff6b00,#ff9500)',
                boxShadow: loading ? 'none' : '0 4px 15px rgba(255,107,0,0.3)',
              }}
            >
              {loading ? 'Sending...' : 'Send Code →'}
            </button>
          </>
        ) : (
          <>
            {sentMsg && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm mb-5">
                {sentMsg}
              </div>
            )}

            <div className="mb-7">
              <label className="block text-gray-600 text-xs font-medium mb-2">Verification code</label>
              <input
                ref={codeRef} type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
                value={code} onChange={e => setCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verifyCode()}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 transition-colors tracking-widest text-center text-lg"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm mb-5">
                {error}
              </div>
            )}

            <button
              onClick={() => verifyCode()} disabled={loading}
              className="w-full rounded-lg py-3.5 text-white text-[15px] font-bold transition-colors disabled:cursor-not-allowed"
              style={{
                background: loading ? '#9ca3af' : 'linear-gradient(135deg,#ff6b00,#ff9500)',
                boxShadow: loading ? 'none' : '0 4px 15px rgba(255,107,0,0.3)',
              }}
            >
              {loading ? 'Verifying...' : 'Verify →'}
            </button>

            <button
              onClick={() => { setStep('email'); setCode(''); setError(''); setSentMsg('') }}
              className="w-full text-center text-gray-400 text-xs mt-4 hover:text-gray-600"
            >
              ← Use a different email / resend
            </button>
          </>
        )}

        <p className="text-gray-400 text-xs text-center mt-7">
          Infinity Wrap Design — Internal System
        </p>
      </div>
    </div>
  )
}

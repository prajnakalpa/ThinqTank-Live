// app/(auth)/login/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [step, setStep]         = useState<'email' | 'otp'>('email')
  const [otp, setOtp]           = useState('')
  const [error, setError]       = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [redirect, setRedirect] = useState('/live')
  const [message, setMessage]   = useState<string | null>(null)

  const router   = useRouter()
  const supabase = createClient()

  // ✅ REPLACEMENT FOR useSearchParams
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setRedirect(params.get('redirect') || '/live')
      setMessage(params.get('message'))
    }
  }, [])

  const handleEmailSubmit = async () => {
    setError(''); setLoading(true)

    if (usePassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else { router.push(redirect); router.refresh() }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      if (error) setError(error.message)
      else setStep('otp')
    }

    setLoading(false)
  }

  const handleOTPVerify = async () => {
    setError(''); setLoading(true)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email'
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').upsert(
        { id: user.id, email: user.email! },
        { onConflict: 'id', ignoreDuplicates: true }
      )
    }

    router.push(redirect)
    router.refresh()
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 500, background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none', marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 14, color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>TQ</div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>
            ThinqTank <span style={{ color: '#818cf8' }}>Live</span>
          </span>
        </Link>

        {message === 'password_updated' && (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, color: '#4ade80', fontSize: '0.85rem', textAlign: 'center' }}>
            ✓ Password updated! Sign in with your new password.
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem', backdropFilter: 'blur(20px)' }}>
          <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6)', borderRadius: 99, marginBottom: 24 }} />

          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.4rem', color: '#f1f5f9', marginBottom: 6 }}>
            {step === 'otp' ? 'Check your email' : 'Sign in'}
          </h2>

          <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: 24 }}>
            {step === 'otp' ? `We sent a code to ${email}` : 'New here? An account is created automatically.'}
          </p>

          {step === 'email' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input-field" />
              <button onClick={handleEmailSubmit} className="btn-primary">
                {usePassword ? 'Sign In' : 'Send Code'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="000000" />
              <button onClick={handleOTPVerify} className="btn-primary">
                Verify
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

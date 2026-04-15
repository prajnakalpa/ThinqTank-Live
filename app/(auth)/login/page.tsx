// app/auth/reset-password/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { getURL } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState('')
  const [step, setStep]       = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const supabase = createClient()

  // STEP 1: send OTP
  const handleLogin = async () => {
    if (!email.trim()) return

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) setError(error.message)
    else setStep('otp')

    setLoading(false)
  }

  // STEP 2: verify OTP
  const handleVerify = async () => {
    if (!otp.trim()) return

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    if (error) setError(error.message)
    else window.location.href = '/'

    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', padding: '1rem' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 500, background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>

        {/* ✅ SAME ORIGINAL HEADER UI */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none', marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 14, color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>TQ</div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>
            ThinqTank <span style={{ color: '#818cf8' }}>Live</span>
          </span>
        </Link>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem', backdropFilter: 'blur(20px)' }}>

          <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6)', borderRadius: 99, marginBottom: 24 }} />

          {step === 'otp' ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.3rem', color: '#f1f5f9', marginBottom: 8 }}>
                Enter OTP
              </h2>

              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 20 }}>
                Enter the OTP sent to <strong style={{ color: '#e2e8f0' }}>{email}</strong>
              </p>

              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                placeholder="Enter OTP"
                className="input-field"
              />

              {error && (
                <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: 10 }}>
                  {error}
                </p>
              )}

              <button
                onClick={handleVerify}
                disabled={!otp || loading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: 16 }}
              >
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>

              <p style={{ marginTop: 16, fontSize: '0.8rem', color: '#475569' }}>
                Wrong email?{' '}
                <button
                  onClick={() => setStep('email')}
                  style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer' }}
                >
                  Go back
                </button>
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.4rem', color: '#f1f5f9', marginBottom: 6 }}>
                Login
              </h2>

              <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: 24 }}>
                Enter your email and we'll send an OTP.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Email
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="you@example.com"
                    className="input-field"
                    autoFocus
                  />
                </div>

                {error && (
                  <p style={{ color: '#f87171', fontSize: '0.85rem' }}>
                    {error}
                  </p>
                )}

                <button
                  onClick={handleLogin}
                  disabled={!email || loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px' }}
                >
                  {loading ? 'Sending…' : 'Send OTP'}
                </button>

                <Link href="/auth/reset-password" style={{ textAlign: 'center', color: '#475569', fontSize: '0.8rem', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

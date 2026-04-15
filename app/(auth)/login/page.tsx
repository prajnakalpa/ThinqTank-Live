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
  const handleSendOtp = async () => {
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
  const handleVerifyOtp = async () => {
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
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem' }}>

          {step === 'email' ? (
            <>
              <h2 style={{ color: '#f1f5f9' }}>Login</h2>

              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />

              {error && <p style={{ color: 'red' }}>{error}</p>}

              <button onClick={handleSendOtp} disabled={loading}>
                {loading ? 'Sending…' : 'Send OTP'}
              </button>

              <Link href="/auth/reset-password">
                <p style={{ marginTop: 10, color: '#818cf8' }}>
                  Forgot password?
                </p>
              </Link>
            </>
          ) : (
            <>
              <h2 style={{ color: '#f1f5f9' }}>Enter OTP</h2>

              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="Enter OTP"
              />

              {error && <p style={{ color: 'red' }}>{error}</p>}

              <button onClick={handleVerifyOtp} disabled={loading}>
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

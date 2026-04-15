// app/auth/reset-password/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { getURL } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const supabase = createClient()

  const handleLogin = async () => {
    if (!email.trim()) return

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${getURL()}auth/callback`,
      },
    })

    if (error) setError(error.message)
    else setSent(true)

    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem' }}>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: '#f1f5f9' }}>Check your email</h2>
              <p style={{ color: '#64748b' }}>
                OTP sent to <strong>{email}</strong>
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ color: '#f1f5f9' }}>Login</h2>

              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter email"
              />

              {error && <p style={{ color: 'red' }}>{error}</p>}

              <button onClick={handleLogin} disabled={loading}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>

              <p style={{ marginTop: 10 }}>
                Forgot password?{' '}
                <Link href="/auth/reset-password">
                  Reset
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

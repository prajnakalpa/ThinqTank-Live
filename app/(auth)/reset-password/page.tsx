// app/auth/reset-password/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { getURL } from '@/lib/utils'

export default function ResetPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const supabase = createClient()

  const handleReset = async () => {
    if (!email.trim()) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getURL()}auth/callback?type=recovery`,
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', padding: '1rem' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 500, background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        <Link href="/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none', marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 14, color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>TQ</div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>ThinqTank <span style={{ color: '#818cf8' }}>Live</span></span>
        </Link>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem', backdropFilter: 'blur(20px)' }}>
          <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6)', borderRadius: 99, marginBottom: 24 }} />

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📧</div>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.3rem', color: '#f1f5f9', marginBottom: 8 }}>Check your email</h2>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 20 }}>
                We sent a reset link to <strong style={{ color: '#e2e8f0' }}>{email}</strong>.<br />
                Click the link in the email to set a new password.
              </p>
              <p style={{ color: '#475569', fontSize: '0.78rem' }}>Didn't receive it? Check spam or{' '}
                <button onClick={() => setSent(false)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}>try again</button>.
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.4rem', color: '#f1f5f9', marginBottom: 6 }}>Reset password</h2>
              <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: 24 }}>Enter your email and we'll send a reset link.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Email</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    placeholder="you@example.com" className="input-field" autoFocus
                  />
                </div>
                {error && <p style={{ color: '#f87171', fontSize: '0.85rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</p>}
                <button onClick={handleReset} disabled={!email || loading} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
                <Link href="/login" style={{ textAlign: 'center', color: '#475569', fontSize: '0.8rem', textDecoration: 'none' }}>← Back to sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

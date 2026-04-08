'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') || '/live'
  const supabase     = createClient()

  const handleEmailSubmit = async () => {
    setError(''); setLoading(true)
    if (usePassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else { router.push(redirect); router.refresh() }
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
      if (error) setError(error.message)
      else setStep('otp')
    }
    setLoading(false)
  }

  const handleOTPVerify = async () => {
    setError(''); setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
    if (error) { setError(error.message); setLoading(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').upsert({ id: user.id, email: user.email! }, { onConflict: 'id', ignoreDuplicates: true })
    }
    router.push(redirect); router.refresh()
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#020617', padding: '1rem', position: 'relative', overflow: 'hidden',
    }}>
      {/* BG glow */}
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 500, background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none', marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 14, color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>TQ</div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>ThinqTank <span style={{ color: '#818cf8' }}>Live</span></span>
        </Link>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)',
          borderRadius: 20, padding: '2rem', backdropFilter: 'blur(20px)',
        }}>
          {/* Top accent */}
          <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6)', borderRadius: 99, marginBottom: 24 }} />

          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.4rem', color: '#f1f5f9', marginBottom: 6 }}>
            {step === 'otp' ? 'Check your email' : 'Sign in'}
          </h2>
          <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: 24 }}>
            {step === 'otp' ? `We sent a code to ${email}` : 'New here? An account is created automatically.'}
          </p>

          {step === 'email' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                  placeholder="you@example.com" className="input-field" autoFocus />
              </div>
              {usePassword && (
                <div>
                  <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                    placeholder="••••••••" className="input-field" />
                </div>
              )}
              {error && <p style={{ color: '#f87171', fontSize: '0.85rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</p>}
              <button onClick={handleEmailSubmit} disabled={!email || loading} className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: 4 }}>
                {loading ? 'Sending…' : usePassword ? 'Sign In' : 'Send Code'}
              </button>
              <button onClick={() => setUsePassword(!usePassword)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: '0.8rem', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                {usePassword ? '← Use email OTP (students)' : 'Admin? Sign in with password →'}
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>6-digit code</label>
                <input type="text" value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleOTPVerify()}
                  placeholder="000000" autoFocus
                  style={{
                    width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.12)',
                    borderRadius: 12, padding: '14px 16px', color: '#f1f5f9', fontSize: '1.6rem',
                    textAlign: 'center', letterSpacing: '0.4em', fontFamily: 'monospace', outline: 'none',
                  }} />
              </div>
              {error && <p style={{ color: '#f87171', fontSize: '0.85rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</p>}
              <button onClick={handleOTPVerify} disabled={otp.length < 6 || loading} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
                {loading ? 'Verifying…' : 'Verify & Continue →'}
              </button>
              <button onClick={() => { setStep('email'); setOtp(''); setError('') }} style={{ background: 'none', border: 'none', color: '#475569', fontSize: '0.8rem', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

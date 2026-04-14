'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'otp' | 'admin-password' | 'forgot-password'>('email')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [canResend, setCanResend] = useState(false)
  const [showMasterPassword, setShowMasterPassword] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/live'
  const supabase = createClient()

  // Timer for OTP expiration
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (step === 'otp' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setCanResend(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [step, timeLeft])

  const handleEmailSubmit = async () => {
    setError(''); setLoading(true)
    if (usePassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else { router.push(redirect); router.refresh() }
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
      if (error) setError(error.message)
      else {
        setStep('otp')
        setTimeLeft(600) // 10 minutes
        setCanResend(false)
      }
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

  const handleResendCode = async () => {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    if (error) {
      setError(error.message)
    } else {
      setOtp('')
      setCanResend(false)
      setTimeLeft(600) // 10 minutes
    }
    setLoading(false)
  }

  const handleForgotPassword = async () => {
    if (!email) { setError('Enter your email'); return }
    setError(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      setError(error.message)
    } else {
      setError('')
      setStep('email')
      alert('Password reset link sent to your email!')
    }
    setLoading(false)
  }

  const handleMasterPassword = async () => {
    if (!masterPassword) { setError('Enter master password'); return }
    if (!email) { setError('Enter admin email'); return }
    setError(''); setLoading(true)
    
    // Check against stored master password hash
    try {
      const response = await fetch('/api/auth/verify-master-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword, email }),
      })
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Invalid master password')
        setLoading(false)
        return
      }

      // Master password verified - now we need to sign in
      // Create a special auth session for master password override
      // For now, set admin bypass token (in real app, use proper JWT)
      sessionStorage.setItem('admin_master_override', 'true')
      sessionStorage.setItem('admin_email', email)
      
      // Redirect to admin panel
      router.push('/admin')
      router.refresh()
    } catch (err) {
      setError('Failed to verify master password')
    }
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
            {step === 'otp' ? 'Check your email' : step === 'admin-password' ? 'Admin Password' : step === 'forgot-password' ? 'Reset Password' : 'Sign in'}
          </h2>
          <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: 24 }}>
            {step === 'otp' ? `We sent a code to ${email}` : step === 'admin-password' ? 'Enter your admin password or master password' : step === 'forgot-password' ? 'Enter your email to reset your password' : 'New here? An account is created automatically.'}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem' }}>
                <button onClick={() => { setUsePassword(!usePassword); setError('') }} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                  {usePassword ? '← Use email OTP (students)' : 'Admin? Sign in with password →'}
                </button>
                {usePassword && (
                  <button onClick={() => { setStep('forgot-password'); setError('') }} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, textAlign: 'center', textDecoration: 'underline' }}>
                    Forgot password?
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'otp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>6-digit code</label>
                  <span style={{ fontSize: '0.7rem', color: timeLeft > 60 ? '#94a3b8' : timeLeft > 0 ? '#f59e0b' : '#ef4444' }}>
                    {timeLeft > 0 ? `Expires in ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : 'Code expired'}
                  </span>
                </div>
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
              <button onClick={handleOTPVerify} disabled={otp.length < 6 || loading || timeLeft === 0} className="btn-primary" style={{ width: '100%', padding: '12px', opacity: timeLeft === 0 ? 0.5 : 1 }}>
                {loading ? 'Verifying…' : 'Verify & Continue →'}
              </button>
              
              {canResend && (
                <button onClick={handleResendCode} disabled={loading} style={{
                  width: '100%', padding: '12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 12, color: '#22c55e', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
                }}>
                  {loading ? 'Sending new code…' : 'Resend code'}
                </button>
              )}

              <button onClick={() => { setStep('email'); setOtp(''); setError(''); setTimeLeft(0); setCanResend(false) }} style={{ background: 'none', border: 'none', color: '#475569', fontSize: '0.8rem', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                ← Back
              </button>
            </div>
          )}

          {step === 'forgot-password' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com" className="input-field" autoFocus />
              </div>
              {error && <p style={{ color: '#f87171', fontSize: '0.85rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</p>}
              <button onClick={handleForgotPassword} disabled={!email || loading} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <button onClick={() => { setStep('email'); setError(''); setEmail(''); setPassword('') }} style={{ background: 'none', border: 'none', color: '#475569', fontSize: '0.8rem', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                ← Back to login
              </button>
              <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 12, marginTop: 8 }}>
                <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 8 }}>No email access? Use master password:</p>
                <button onClick={() => { setStep('admin-password'); setError('') }} style={{ width: '100%', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, color: '#a78bfa', padding: '10px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                  Use Master Password
                </button>
              </div>
            </div>
          )}

          {step === 'admin-password' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Admin Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com" className="input-field" />
              </div>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Master Password</label>
                <input type="password" value={masterPassword} onChange={e => setMasterPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMasterPassword()}
                  placeholder="••••••••" className="input-field" autoFocus />
                <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6 }}>Emergency access only. This is a master override password set during setup.</p>
              </div>
              {error && <p style={{ color: '#f87171', fontSize: '0.85rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</p>}
              <button onClick={handleMasterPassword} disabled={!email || !masterPassword || loading} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
                {loading ? 'Verifying…' : 'Unlock as Admin'}
              </button>
              <button onClick={() => { setStep('email'); setError(''); setEmail(''); setMasterPassword('') }} style={{ background: 'none', border: 'none', color: '#475569', fontSize: '0.8rem', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

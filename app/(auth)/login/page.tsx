// app/(auth)/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Mode = 'otp' | 'admin' | 'master'
type OtpStep = 'email' | 'code'

// Shared style constants — matches reset-password page exactly
const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', padding: '1rem', position: 'relative' as const, overflow: 'hidden' },
  glow: { position: 'absolute' as const, top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 500, background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' as const },
  wrap: { width: '100%', maxWidth: 400, position: 'relative' as const },
  logo: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none', marginBottom: 32 },
  logoBox: { width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 14, color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' },
  logoText: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem', backdropFilter: 'blur(20px)' },
  accent: { height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6)', borderRadius: 99, marginBottom: 24 },
  label: { display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 },
  error: { color: '#f87171', fontSize: '0.85rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' },
  success: { color: '#4ade80', fontSize: '0.85rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '10px 14px', textAlign: 'center' as const },
  link: { background: 'none', border: 'none', color: '#475569', fontSize: '0.8rem', cursor: 'pointer', padding: 0, textAlign: 'center' as const },
}

export default function LoginPage() {
  const [mode, setMode]         = useState<Mode>('otp')
  const [otpStep, setOtpStep]   = useState<OtpStep>('email')

  // Shared fields
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp]           = useState('')
  const [master, setMaster]     = useState('')

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [message, setMessage]   = useState<string | null>(null)

  // Read search params client-side to avoid Suspense boundary
  const [redirectTo, setRedirectTo] = useState('/live')
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setRedirectTo(p.get('redirect') || '/live')
    setMessage(p.get('message'))
  }, [])

  const router   = useRouter()
  const supabase = createClient()

  // Reset error + fields when switching modes
  const switchMode = (m: Mode) => {
    setMode(m); setError(''); setOtpStep('email')
    setEmail(''); setPassword(''); setOtp(''); setMaster('')
  }

  // ── MODE 1: User OTP ──────────────────────────────────────
  const handleSendOTP = async () => {
    if (!email.trim()) return
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    if (error) setError(error.message)
    else setOtpStep('code')
    setLoading(false)
  }

  const handleVerifyOTP = async () => {
    if (otp.length < 6) return
    setError(''); setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: 'email',
    })
    if (error) { setError(error.message); setLoading(false); return }
    // Ensure user profile exists
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').upsert(
        { id: user.id, email: user.email! },
        { onConflict: 'id', ignoreDuplicates: true }
      )
    }
    router.push(redirectTo)
    router.refresh()
    setLoading(false)
  }

  // ── MODE 2: Admin email/password ─────────────────────────
  const handleAdminLogin = async () => {
    if (!email.trim() || !password) return
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) setError(error.message)
    else { router.push(redirectTo === '/live' ? '/admin' : redirectTo); router.refresh() }
    setLoading(false)
  }

  // ── MODE 3: Master password ───────────────────────────────
  const handleMasterUnlock = async () => {
    if (!master) return
    setError(''); setLoading(true)
    const res  = await fetch('/api/admin/verify-master', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: master }),
    })
    const data = await res.json()
    if (data.ok) {
      router.push('/admin')
      router.refresh()
    } else {
      setError(data.error || 'Incorrect master password')
      setLoading(false)
    }
  }

  // ── TAB STYLES ────────────────────────────────────────────
  const tabStyle = (m: Mode) => ({
    flex: 1, padding: '7px 0', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    background: mode === m ? 'rgba(99,102,241,0.2)' : 'transparent',
    color: mode === m ? '#e2e8f0' : '#475569',
    outline: mode === m ? '1px solid rgba(99,102,241,0.3)' : 'none',
  })

  return (
    <div style={S.page}>
      <div style={S.glow} />
      <div style={S.wrap}>

        {/* Logo */}
        <Link href="/" style={S.logo}>
          <div style={S.logoBox}>TQ</div>
          <span style={S.logoText}>ThinqTank <span style={{ color: '#818cf8' }}>Live</span></span>
        </Link>

        {/* Password updated banner */}
        {message === 'password_updated' && (
          <div style={{ ...S.success, marginBottom: 16 }}>
            ✓ Password updated! Sign in below.
          </div>
        )}

        {/* Card */}
        <div style={S.card}>
          <div style={S.accent} />

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, marginBottom: 24 }}>
            <button style={tabStyle('otp')}    onClick={() => switchMode('otp')}>User OTP</button>
            <button style={tabStyle('admin')}  onClick={() => switchMode('admin')}>Admin</button>
            <button style={tabStyle('master')} onClick={() => switchMode('master')}>🔐 Master</button>
          </div>

          {/* ── MODE 1: OTP ── */}
          {mode === 'otp' && otpStep === 'email' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.3rem', color: '#f1f5f9', marginBottom: 0 }}>Sign in</h2>
              <p style={{ color: '#475569', fontSize: '0.85rem', marginTop: -8 }}>Enter your email — we'll send a one-time code.</p>
              <div>
                <label style={S.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                  placeholder="you@example.com"
                  className="input-field"
                  autoFocus
                />
              </div>
              {error && <p style={S.error}>{error}</p>}
              <button
                onClick={handleSendOTP}
                disabled={!email.trim() || loading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                {loading ? 'Sending…' : 'Send Code →'}
              </button>
            </div>
          )}

          {mode === 'otp' && otpStep === 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.3rem', color: '#f1f5f9' }}>Check your email</h2>
              <p style={{ color: '#475569', fontSize: '0.85rem', marginTop: -8 }}>
                We sent a 6-digit code to <strong style={{ color: '#e2e8f0' }}>{email}</strong>
              </p>
              <div>
                <label style={S.label}>6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  className="input-field"
                  style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.4rem', fontFamily: 'monospace' }}
                />
              </div>
              {error && <p style={S.error}>{error}</p>}
              <button
                onClick={handleVerifyOTP}
                disabled={otp.length < 6 || loading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                {loading ? 'Verifying…' : 'Verify & Continue →'}
              </button>
              <button onClick={() => { setOtpStep('email'); setOtp(''); setError('') }} style={S.link}>
                ← Back / Resend code
              </button>
            </div>
          )}

          {/* ── MODE 2: Admin email/password ── */}
          {mode === 'admin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.3rem', color: '#f1f5f9' }}>Admin sign in</h2>
              <div>
                <label style={S.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  placeholder="admin@example.com"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label style={S.label}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  placeholder="••••••••"
                  className="input-field"
                />
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <Link href="/reset-password" style={{ color: '#64748b', fontSize: '0.75rem', textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                </div>
              </div>
              {error && <p style={S.error}>{error}</p>}
              <button
                onClick={handleAdminLogin}
                disabled={!email.trim() || !password || loading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>
            </div>
          )}

          {/* ── MODE 3: Master password ── */}
          {mode === 'master' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center', paddingBottom: 4 }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔐</div>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.2rem', color: '#f1f5f9', marginBottom: 4 }}>Admin Master Password</h2>
                <p style={{ color: '#475569', fontSize: '0.82rem' }}>Bypasses Supabase auth. Sets admin session cookie.</p>
              </div>
              <div>
                <label style={S.label}>Master Password</label>
                <input
                  type="password"
                  value={master}
                  onChange={e => setMaster(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMasterUnlock()}
                  placeholder="Enter master password"
                  className="input-field"
                  autoFocus
                />
              </div>
              {error && <p style={S.error}>{error}</p>}
              <button
                onClick={handleMasterUnlock}
                disabled={!master || loading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                {loading ? 'Verifying…' : 'Unlock Admin →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// app/auth/update-password/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [ready, setReady]         = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Verify the user has an active session from the reset link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login?error=invalid_reset_link')
      } else {
        setReady(true)
      }
    })
  }, [])

  const handleUpdate = async () => {
    if (!password || !confirm) return
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')

    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }

    // Sign out all other sessions after password change
    await supabase.auth.signOut({ scope: 'others' })
    router.replace('/login?message=password_updated')
  }

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617' }}>
      <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Verifying reset link…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', padding: '1rem' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 500, background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 14, color: '#fff' }}>TQ</div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>ThinqTank <span style={{ color: '#818cf8' }}>Live</span></span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem', backdropFilter: 'blur(20px)' }}>
          <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6)', borderRadius: 99, marginBottom: 24 }} />

          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.4rem', color: '#f1f5f9', marginBottom: 6 }}>Set new password</h2>
          <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: 24 }}>Choose a strong password for your account.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                placeholder="Min 8 characters" className="input-field" autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                placeholder="Re-enter password" className="input-field" />
            </div>
            {error && <p style={{ color: '#f87171', fontSize: '0.85rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</p>}
            <button onClick={handleUpdate} disabled={!password || !confirm || loading} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
              {loading ? 'Updating…' : 'Update Password →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

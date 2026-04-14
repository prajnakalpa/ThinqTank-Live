// app/admin/unlock/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminUnlockPage() {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  const handleUnlock = async () => {
    if (!password) return
    setLoading(true); setError('')
    const res  = await fetch('/api/admin/verify-master', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    if (data.ok) {
      router.replace('/admin')
      router.refresh()
    } else {
      setError(data.error || 'Incorrect password')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', padding: '1rem' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 500, background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 14, color: '#fff' }}>TQ</div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>Admin <span style={{ color: '#818cf8' }}>Access</span></span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem', backdropFilter: 'blur(20px)' }}>
          <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 99, marginBottom: 24 }} />
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔐</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.2rem', color: '#f1f5f9', marginBottom: 4 }}>Admin Master Password</h2>
            <p style={{ color: '#475569', fontSize: '0.82rem' }}>Enter the master password to continue.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              placeholder="Master password" className="input-field" autoFocus
            />
            {error && <p style={{ color: '#f87171', fontSize: '0.85rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</p>}
            <button onClick={handleUnlock} disabled={!password || loading} className="btn-primary" style={{ width: '100%', padding: '11px' }}>
              {loading ? 'Verifying…' : 'Unlock Admin →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

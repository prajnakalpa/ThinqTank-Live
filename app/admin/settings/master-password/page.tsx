export const dynamic = 'force-dynamic'

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function MasterPasswordSettingsPage() {
  const [currentMasterPassword, setCurrentMasterPassword] = useState('')
  const [newMasterPassword, setNewMasterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleUpdateMasterPassword = async () => {
    setError('')
    setSuccess('')

    if (!currentMasterPassword) {
      setError('Enter current master password to verify')
      return
    }
    if (!newMasterPassword) {
      setError('Enter new master password')
      return
    }
    if (newMasterPassword.length < 8) {
      setError('Master password must be at least 8 characters')
      return
    }
    if (newMasterPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/admin/update-master-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentMasterPassword,
          newPassword: newMasterPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to update master password')
        setLoading(false)
        return
      }

      setSuccess('Master password updated successfully!')
      setCurrentMasterPassword('')
      setNewMasterPassword('')
      setConfirmPassword('')
      
      setTimeout(() => router.push('/admin'), 2000)
    } catch (err) {
      setError('Error updating master password')
    }

    setLoading(false)
  }

  return (
    <div style={{ padding: '4rem 2rem' }}>
      <div className="page-container" style={{ maxWidth: 500 }}>
        <Link href="/admin" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none', marginBottom: 24, display: 'inline-block' }}>
          ← Back to Admin
        </Link>

        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)',
          borderRadius: 20, padding: '2rem',
        }}>
          <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 99, marginBottom: 24 }} />

          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.6rem', color: '#f1f5f9', marginBottom: 8 }}>
            Update Master Password
          </h1>
          <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: 28 }}>
            Change your emergency admin master password. Use this when you can't access regular authentication.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Current Master Password
              </label>
              <input
                type="password"
                value={currentMasterPassword}
                onChange={e => setCurrentMasterPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
                style={{
                  width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.12)',
                  borderRadius: 12, padding: '12px 16px', color: '#f1f5f9', fontSize: '1rem', outline: 'none',
                }}
              />
              <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6 }}>Enter the current master password to verify your identity</p>
            </div>

            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                New Master Password
              </label>
              <input
                type="password"
                value={newMasterPassword}
                onChange={e => setNewMasterPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
                style={{
                  width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.12)',
                  borderRadius: 12, padding: '12px 16px', color: '#f1f5f9', fontSize: '1rem', outline: 'none',
                }}
              />
              <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6 }}>Minimum 8 characters. Use a strong, memorable password.</p>
            </div>

            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleUpdateMasterPassword()}
                className="input-field"
                style={{
                  width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.12)',
                  borderRadius: 12, padding: '12px 16px', color: '#f1f5f9', fontSize: '1rem', outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 8, padding: '12px', color: '#f87171', fontSize: '0.85rem',
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 8, padding: '12px', color: '#4ade80', fontSize: '0.85rem',
              }}>
                {success}
              </div>
            )}

            <button
              onClick={handleUpdateMasterPassword}
              disabled={loading || !currentMasterPassword || !newMasterPassword || !confirmPassword}
              style={{
                padding: '12px', marginTop: 8,
                background: '#6366f1', color: '#fff', border: 'none', borderRadius: 12,
                fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Updating…' : 'Update Master Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

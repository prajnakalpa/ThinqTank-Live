'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const CMS_KEYS = [
  { key: 'hero_title',    label: 'Hero Title',       type: 'text' },
  { key: 'hero_subtitle', label: 'Hero Subtitle',    type: 'text' },
  { key: 'hero_cta',      label: 'CTA Button Text',  type: 'text' },
  { key: 'about_text',    label: 'About Text',       type: 'textarea' },
  { key: 'contact_email', label: 'Contact Email',    type: 'email' },
]

export default function SettingsPage() {
  const [cms, setCms]         = useState<Record<string, string>>({})
  const [saving, setSaving]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved]     = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('site_content').select('key, value').then(({ data }) => {
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value ?? '']))
      setCms(map)
      setLogoUrl(map.logo_url ?? '')
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const updates = CMS_KEYS.map(({ key }) => ({ key, value: cms[key] ?? '', updated_at: new Date().toISOString() }))
    await supabase.from('site_content').upsert(updates, { onConflict: 'key' })
    setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `logo/logo.${ext}`
    const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('assets').getPublicUrl(path)
      await supabase.from('site_content').upsert({ key: 'logo_url', value: data.publicUrl }, { onConflict: 'key' })
      setLogoUrl(data.publicUrl)
      setCms(p => ({ ...p, logo_url: data.publicUrl }))
    }
    setUploading(false)
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.8rem', color: '#f1f5f9', marginBottom: 4 }}>Site Settings</h1>
        <p style={{ color: '#475569', fontSize: '0.875rem' }}>Edit homepage content and branding.</p>
      </div>

      {/* Logo */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '1rem' }}>Logo</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 12, background: '#1e293b', border: '1px solid rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, color: '#818cf8', fontSize: '1.1rem' }}>TQ</span>
            }
          </div>
          <div>
            <label className="btn-ghost" style={{ cursor: 'pointer', display: 'inline-block', padding: '8px 16px', fontSize: '0.85rem' }}>
              {uploading ? 'Uploading…' : 'Upload Logo'}
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
            <p style={{ color: '#334155', fontSize: '0.72rem', marginTop: 6 }}>PNG, SVG or WebP. Max 2MB.</p>
          </div>
        </div>
      </div>

      {/* CMS */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: '#e2e8f0', fontSize: '0.95rem' }}>Homepage Content</h2>
        {CMS_KEYS.map(({ key, label, type }) => (
          <div key={key}>
            <label style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</label>
            {type === 'textarea'
              ? <textarea value={cms[key] ?? ''} onChange={e => setCms(p => ({ ...p, [key]: e.target.value }))} className="input-field" rows={3} style={{ resize: 'none' }} />
              : <input type={type} value={cms[key] ?? ''} onChange={e => setCms(p => ({ ...p, [key]: e.target.value }))} className="input-field" />
            }
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '10px 24px' }}>{saving ? 'Saving…' : 'Save Changes'}</button>
          {saved && <span style={{ color: '#4ade80', fontSize: '0.85rem', fontFamily: 'monospace' }}>✓ Saved!</span>}
        </div>
      </div>
    </div>
  )
}

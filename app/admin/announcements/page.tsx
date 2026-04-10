'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils'

interface Ann { id?: string; title: string; body: string; is_pinned: boolean; published: boolean }
const blank = (): Ann => ({ title: '', body: '', is_pinned: false, published: true })

export default function AnnouncementsAdminPage() {
  const [list, setList]       = useState<any[]>([])
  const [editing, setEditing] = useState<Ann | null>(null)
  const [saving, setSaving]   = useState(false)
  const supabase = createClient()

  const load = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setList(data ?? [])
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing?.title || !editing.body) return
    setSaving(true)
    if ((editing as any).id) {
      await supabase.from('announcements').update({ title: editing.title, body: editing.body, is_pinned: editing.is_pinned, published: editing.published }).eq('id', (editing as any).id)
    } else {
      await supabase.from('announcements').insert(editing)
    }
    await load(); setEditing(null); setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setList(p => p.filter(a => a.id !== id))
  }

  const F = (k: string, v: any) => setEditing(p => p ? { ...p, [k]: v } : null)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.8rem', color: '#f1f5f9' }}>Announcements</h1>
        <button onClick={() => setEditing(blank())} className="btn-primary" style={{ padding: '9px 20px', fontSize: '0.875rem' }}>+ New</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!list.length && !editing && <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: '3rem', textAlign: 'center', color: '#475569' }}>No announcements yet.</div>}
        {list.map(a => (
          <div key={a.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${a.is_pinned ? 'rgba(245,158,11,0.2)' : 'rgba(148,163,184,0.08)'}`, borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', gap: 12, opacity: a.published ? 1 : 0.5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {a.is_pinned && <p style={{ color: '#f59e0b', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>📌 Pinned</p>}
              <h3 style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>{a.title}</h3>
              <p style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.body}</p>
              <p style={{ color: '#334155', fontSize: '0.72rem', marginTop: 8, fontFamily: 'monospace' }}>{timeAgo(a.created_at)}</p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexShrink: 0 }}>
              <button onClick={() => setEditing(a)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
              <button onClick={() => remove(a.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>Del</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '1.75rem', width: '100%', maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#f1f5f9', fontSize: '1.2rem' }}>{(editing as any).id ? 'Edit' : 'New'} Announcement</h2>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Title</label>
                <input value={editing.title} onChange={e => F('title', e.target.value)} className="input-field" />
              </div>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Body</label>
                <textarea value={editing.body} onChange={e => F('body', e.target.value)} className="input-field" rows={5} style={{ resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                {[{ label: 'Pin to top', key: 'is_pinned' }, { label: 'Published', key: 'published' }].map(({ label, key }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#94a3b8', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={(editing as any)[key]} onChange={e => F(key, e.target.checked)} style={{ accentColor: '#6366f1' }} />
                    {label}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '10px' }}>{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={() => setEditing(null)} className="btn-ghost" style={{ padding: '10px 16px' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

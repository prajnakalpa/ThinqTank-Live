'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ActivityFormPage({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new'
  const [form, setForm] = useState({ title: '', description: '', status: 'upcoming', visibility: 'public', duration_minutes: 30, start_time: '', end_time: '' })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (isNew) return
    supabase.from('activities').select('*, quizzes(*)').eq('id', params.id).single().then(({ data }) => {
      if (data) setForm({
        title: data.title, description: data.description ?? '', status: data.status, visibility: data.visibility,
        duration_minutes: data.quizzes?.duration_minutes ?? 30,
        start_time: data.quizzes?.start_time?.slice(0, 16) ?? '',
        end_time:   data.quizzes?.end_time?.slice(0, 16)   ?? '',
      })
      setLoading(false)
    })
  }, [params.id])

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    if (isNew) {
      const { data: act, error: e } = await supabase.from('activities').insert({ title: form.title, description: form.description, status: form.status, visibility: form.visibility, type: 'quiz' }).select().single()
      if (e) { setError(e.message); setSaving(false); return }
      await supabase.from('quizzes').insert({ activity_id: act.id, duration_minutes: form.duration_minutes, start_time: form.start_time || null, end_time: form.end_time || null })
      router.push(`/admin/activities/${act.id}`)
    } else {
      const { error: e } = await supabase.from('activities').update({ title: form.title, description: form.description, status: form.status, visibility: form.visibility }).eq('id', params.id)
      if (e) { setError(e.message); setSaving(false); return }
      const { data: quiz } = await supabase.from('quizzes').select('id').eq('activity_id', params.id).single()
      if (quiz) await supabase.from('quizzes').update({ duration_minutes: form.duration_minutes, start_time: form.start_time || null, end_time: form.end_time || null }).eq('id', quiz.id)
      router.push('/admin/activities')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this activity and all its data?')) return
    await supabase.from('activities').delete().eq('id', params.id)
    router.push('/admin/activities')
  }

  const F = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  if (loading) return <div style={{ height: 300, background: '#1e293b', borderRadius: 16, animation: 'shimmer 1.5s infinite' }} />

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="admin-page-header">
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.8rem', color: '#f1f5f9' }}>{isNew ? 'New Activity' : 'Edit Activity'}</h1>
        {!isNew && <button onClick={handleDelete} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem', borderRadius: 8, padding: '8px 16px' }}>Delete</button>}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[
          { label: 'Title', key: 'title', type: 'text', placeholder: 'Weekly Quiz #1' },
        ].map(({ label, key, type, placeholder }) => (
          <Field key={key} label={label}>
            <input type={type} value={(form as any)[key]} onChange={e => F(key, e.target.value)} placeholder={placeholder} className="input-field" />
          </Field>
        ))}
        <Field label="Description">
          <textarea value={form.description} onChange={e => F('description', e.target.value)} className="input-field" rows={3} style={{ resize: 'none' }} />
        </Field>
        <div className="admin-grid-2">
          <Field label="Status">
            <select value={form.status} onChange={e => F('status', e.target.value)} className="input-field">
              {['upcoming','live','closed','archived'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Visibility">
            <select value={form.visibility} onChange={e => F('visibility', e.target.value)} className="input-field">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </Field>
        </div>
        <Field label="Duration (minutes)">
          <input type="number" value={form.duration_minutes} onChange={e => F('duration_minutes', Number(e.target.value))} className="input-field" min={1} max={360} />
        </Field>
        <div className="admin-grid-2">
          <Field label="Start Time"><input type="datetime-local" value={form.start_time} onChange={e => F('start_time', e.target.value)} className="input-field" /></Field>
          <Field label="End Time"><input type="datetime-local" value={form.end_time} onChange={e => F('end_time', e.target.value)} className="input-field" /></Field>
        </div>
        {error && <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '11px' }}>{saving ? 'Saving…' : isNew ? 'Create Activity' : 'Save Changes'}</button>
          <button onClick={() => router.back()} className="btn-ghost" style={{ padding: '11px 20px' }}>Cancel</button>
        </div>
      </div>

      {!isNew && (
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href={`/admin/questions/${params.id}`} className="btn-ghost" style={{ textDecoration: 'none', padding: '9px 16px', fontSize: '0.85rem' }}>Manage Questions →</a>
          <a href={`/admin/submissions/${params.id}`} className="btn-ghost" style={{ textDecoration: 'none', padding: '9px 16px', fontSize: '0.85rem' }}>View Submissions →</a>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  )
}

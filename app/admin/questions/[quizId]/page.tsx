'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Q { id?: string; text: string; correct_answer: string; accepted_keywords: string[]; synonyms: string[]; weightage: number; strictness_level: string; order_index: number }
const blank = (): Q => ({ text: '', correct_answer: '', accepted_keywords: [], synonyms: [], weightage: 1, strictness_level: 'medium', order_index: 0 })

export default function QuestionsPage({ params }: { params: { quizId: string } }) {
  const [questions, setQuestions] = useState<Q[]>([])
  const [editing, setEditing]     = useState<Q | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [title, setTitle]         = useState('')
  const supabase = createClient()

  const getRealQuizId = async () => {
    const { data } = await supabase.from('quizzes').select('id, activities(title)').eq('activity_id', params.quizId).single()
    if (data?.activities) setTitle((data.activities as any).title)
    return data?.id ?? params.quizId
  }

  useEffect(() => {
    const load = async () => {
      const qid = await getRealQuizId()
      const { data } = await supabase.from('questions').select('*').eq('quiz_id', qid).order('order_index')
      setQuestions(data ?? [])
      setLoading(false)
    }
    load()
  }, [params.quizId])

  const save = async () => {
    if (!editing?.text || !editing.correct_answer) return
    setSaving(true)
    const qid = await getRealQuizId()
    if ((editing as any).id) {
      const { data } = await supabase.from('questions').update({ text: editing.text, correct_answer: editing.correct_answer, accepted_keywords: editing.accepted_keywords, synonyms: editing.synonyms, weightage: editing.weightage, strictness_level: editing.strictness_level }).eq('id', (editing as any).id).select().single()
      setQuestions(p => p.map(q => (q as any).id === (editing as any).id ? data as Q : q))
    } else {
      const { data } = await supabase.from('questions').insert({ ...editing, quiz_id: qid, order_index: questions.length }).select().single()
      setQuestions(p => [...p, data as Q])
    }
    setEditing(null); setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Delete?')) return
    await supabase.from('questions').delete().eq('id', id)
    setQuestions(p => p.filter((q: any) => q.id !== id))
  }

  const F = (k: string, v: any) => setEditing(p => p ? { ...p, [k]: v } : null)
  const parseList = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean)

  if (loading) return <div style={{ height: 200, background: '#1e293b', borderRadius: 16 }} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.8rem', color: '#f1f5f9', marginBottom: 4 }}>Questions</h1>
          {title && <p style={{ color: '#475569', fontSize: '0.875rem' }}>{title}</p>}
        </div>
        <button onClick={() => setEditing(blank())} className="btn-primary" style={{ padding: '9px 20px', fontSize: '0.875rem' }}>+ Add Question</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {!questions.length && !editing && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: '3rem', textAlign: 'center', color: '#475569' }}>No questions yet.</div>
        )}
        {questions.map((q: any, i) => (
          <div key={q.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', borderRadius: 8, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#e2e8f0', fontSize: '0.875rem', marginBottom: 4 }}>{q.text}</p>
              <p style={{ color: '#4ade80', fontSize: '0.75rem', fontFamily: 'monospace' }}>✓ {q.correct_answer}</p>
              {q.accepted_keywords?.length > 0 && <p style={{ color: '#475569', fontSize: '0.72rem', marginTop: 4 }}>Keywords: {q.accepted_keywords.join(', ')}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 6, color: '#334155', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                <span>{q.weightage}pt</span><span>{q.strictness_level}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
              <button onClick={() => setEditing(q)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
              <button onClick={() => del(q.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>Del</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '1.75rem', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#f1f5f9', fontSize: '1.2rem' }}>{(editing as any).id ? 'Edit' : 'New'} Question</h2>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Question Text', key: 'text', type: 'textarea' },
                { label: 'Correct Answer', key: 'correct_answer', type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>
                  {type === 'textarea'
                    ? <textarea value={(editing as any)[key]} onChange={e => F(key, e.target.value)} className="input-field" rows={3} style={{ resize: 'none' }} />
                    : <input type="text" value={(editing as any)[key]} onChange={e => F(key, e.target.value)} className="input-field" />
                  }
                </div>
              ))}
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Accepted Keywords (comma separated)</label>
                <input value={editing.accepted_keywords.join(', ')} onChange={e => F('accepted_keywords', parseList(e.target.value))} className="input-field" placeholder="keyword1, keyword2" />
              </div>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Synonyms (comma separated)</label>
                <input value={editing.synonyms.join(', ')} onChange={e => F('synonyms', parseList(e.target.value))} className="input-field" placeholder="synonym1, synonym2" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Weightage</label>
                  <input type="number" value={editing.weightage} onChange={e => F('weightage', Number(e.target.value))} className="input-field" min={0} max={100} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Strictness</label>
                  <select value={editing.strictness_level} onChange={e => F('strictness_level', e.target.value)} className="input-field">
                    <option value="strict">Strict (92%)</option>
                    <option value="medium">Medium (80%)</option>
                    <option value="loose">Loose (70%)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '10px' }}>{saving ? 'Saving…' : 'Save Question'}</button>
                <button onClick={() => setEditing(null)} className="btn-ghost" style={{ padding: '10px 16px' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

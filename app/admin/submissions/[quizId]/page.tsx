'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDuration } from '@/lib/quiz-state'

export default function SubmissionsPage({ params }: { params: { quizId: string } }) {
  const [subs, setSubs]       = useState<any[]>([])
  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: string; score: string } | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [recalcing, setRecalcing] = useState(false)
  const [msg, setMsg]         = useState('')
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const [{ data: act }, { data: submissions }] = await Promise.all([
      supabase.from('activities').select('id, title').eq('id', params.quizId).single(),
      supabase.from('submissions').select('*').eq('activity_id', params.quizId).order('final_score', { ascending: false }),
    ])
    setActivity(act); setSubs(submissions ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [params.quizId])

  const saveScore = async () => {
    if (!editing) return
    const score = parseFloat(editing.score)
    if (isNaN(score)) return
    await supabase.from('submissions').update({ final_score: score, score_overridden: true }).eq('id', editing.id)
    setSubs(p => p.map(s => s.id === editing.id ? { ...s, final_score: score, score_overridden: true } : s))
    setEditing(null)
  }

  const handleRecalculate = async () => {
    setRecalcing(true)
    const res = await fetch('/api/admin/recalculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activityId: params.quizId, recalculateScores: true }) })
    const data = await res.json()
    setMsg(`Leaderboard updated. ${data.updated ?? 0} entries.`)
    await load(); setRecalcing(false)
  }

  const handleCSVImport = async () => {
    if (!csvFile) return
    setImporting(true)
    const text = await csvFile.text()
    const res = await fetch('/api/admin/import-scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activityId: params.quizId, csvData: text }) })
    const data = await res.json()
    setMsg(`Imported: ${data.updated} updated.`)
    setCsvFile(null); await load(); setImporting(false)
  }

  const exportCSV = () => {
    if (!subs.length) return
    const headers = ['email','username','score','time_taken','overridden']
    const rows = subs.map(s => [s.email, s.username ?? '', s.final_score ?? 0, s.time_taken_seconds ? formatDuration(s.time_taken_seconds) : '', s.score_overridden ? 'yes' : 'no'])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${activity?.title ?? 'submissions'}.csv`; a.click()
  }

  if (loading) return <div style={{ height: 300, background: '#1e293b', borderRadius: 16 }} />

  const completed = subs.filter(s => s.is_complete)
  const avgScore  = completed.length ? Math.round(completed.reduce((a, s) => a + (s.final_score ?? 0), 0) / completed.length * 10) / 10 : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.8rem', color: '#f1f5f9', marginBottom: 4 }}>Submissions</h1>
          <p style={{ color: '#475569', fontSize: '0.875rem' }}>{activity?.title}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportCSV} disabled={!subs.length} className="btn-ghost" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>↓ Export</button>
          <button onClick={handleRecalculate} disabled={recalcing} className="btn-ghost" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>{recalcing ? 'Updating…' : '↻ Recalculate'}</button>
        </div>
      </div>

      {/* CSV Import */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 10 }}>Import scores via CSV (columns: <code style={{ color: '#818cf8' }}>email</code>, <code style={{ color: '#818cf8' }}>score</code>)</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files?.[0] ?? null)} style={{ color: '#64748b', fontSize: '0.8rem', flex: 1 }} />
          <button onClick={handleCSVImport} disabled={!csvFile || importing} className="btn-primary" style={{ padding: '7px 16px', fontSize: '0.85rem' }}>{importing ? '…' : 'Import'}</button>
        </div>
        {msg && <p style={{ color: '#4ade80', fontSize: '0.8rem', marginTop: 8 }}>{msg}</p>}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[{ l: 'Total', v: subs.length }, { l: 'Completed', v: completed.length }, { l: 'Avg Score', v: avgScore }].map(({ l, v }) => (
          <div key={l} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.5rem', color: '#e2e8f0' }}>{v}</div>
            <div style={{ color: '#475569', fontSize: '0.75rem', marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      {!subs.length ? (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: '3rem', textAlign: 'center', color: '#475569' }}>No submissions yet.</div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  {['#','Player','Email','Score','Time','Status',''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.04)' }}>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.8rem', fontFamily: 'monospace' }}>{i + 1}</td>
                    <td style={{ padding: '12px 16px', color: '#e2e8f0', fontSize: '0.875rem' }}>{s.username ?? '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.75rem', fontFamily: 'monospace' }}>{s.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {editing?.id === s.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="number" value={editing?.score ?? ''} onChange={e => setEditing({ ...editing, score: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && saveScore()} className="input-field" style={{ width: 70, padding: '4px 8px', fontSize: '0.85rem' }} />
                          <button onClick={saveScore} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '1rem' }}>✓</button>
                          <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                        </div>
                      ) : (
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: s.score_overridden ? '#f59e0b' : '#e2e8f0' }}>
                          {s.final_score ?? 0}{s.score_overridden && <span style={{ color: '#475569', fontSize: '0.7rem', marginLeft: 4 }}>*</span>}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.78rem', fontFamily: 'monospace' }}>{s.time_taken_seconds ? formatDuration(s.time_taken_seconds) : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, background: s.is_complete ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: s.is_complete ? '#4ade80' : '#fbbf24', border: `1px solid ${s.is_complete ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                        {s.is_complete ? 'Done' : 'In Progress'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => setEditing({ id: s.id, score: String(s.final_score ?? 0) })} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem' }}>Edit Score</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

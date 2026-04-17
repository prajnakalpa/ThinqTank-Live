// app/admin/submissions/[quizId]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDuration } from '@/lib/quiz-state'
import { evaluateAnswer } from '@/lib/evaluation'

// ── Helpers ────────────────────────────────────────────────────────────────

function ScorePip({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0
  const color = pct === 1 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : '#ef4444'
  const bg    = pct === 1 ? 'rgba(34,197,94,0.12)' : pct >= 0.5 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 44, padding: '3px 8px',
      borderRadius: 6, fontSize: '0.8rem', fontWeight: 700,
      background: bg, color,
      fontFamily: 'monospace',
    }}>
      {score > 0 ? `+${score}` : '0'}
    </span>
  )
}

function TotalBadge({ score }: { score: number }) {
  const color = score > 0 ? '#818cf8' : '#475569'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '4px 12px', borderRadius: 8,
      background: score > 0 ? 'rgba(99,102,241,0.12)' : 'rgba(71,85,105,0.15)',
      border: `1px solid ${score > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(71,85,105,0.2)'}`,
      color, fontWeight: 700, fontSize: '0.875rem',
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {score ?? '—'}
    </span>
  )
}

function Btn({
  onClick, disabled = false, variant = 'ghost', children, danger = false
}: {
  onClick: () => void
  disabled?: boolean
  variant?: 'ghost' | 'primary' | 'danger'
  children: React.ReactNode
  danger?: boolean
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      color: '#fff', border: 'none',
      boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
    },
    ghost: {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(148,163,184,0.12)',
      color: '#94a3b8',
    },
    danger: {
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.2)',
      color: '#f87171',
    },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 8,
        fontSize: '0.8rem', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        ...styles[variant],
      }}
    >
      {children}
    </button>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SubmissionsPage({ params }: { params: { quizId: string } }) {
  const [subs,      setSubs]      = useState<any[]>([])
  const [activity,  setActivity]  = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState<{ id: string; score: string } | null>(null)
  const [csvFile,   setCsvFile]   = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [recalcing, setRecalcing] = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null)

  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const [{ data: act }, { data: submissions }, { data: qs }] = await Promise.all([
      supabase.from('activities').select('id, title').eq('id', params.quizId).single(),
      supabase.from('submissions').select('*').eq('activity_id', params.quizId).order('final_score', { ascending: false }),
      supabase.from('questions').select('*').eq('quiz_id', params.quizId).order('order_index'),
    ])
    setActivity(act)
    setSubs(submissions ?? [])
    setQuestions(qs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [params.quizId])

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  const toggleExpand = (id: string) =>
    setExpanded(prev => prev === id ? null : id)

  const saveScore = async () => {
    if (!editing) return
    const score = parseFloat(editing.score)
    if (isNaN(score)) return
    await supabase.from('submissions')
      .update({ final_score: score, score_overridden: true })
      .eq('id', editing.id)
    await load()
    setEditing(null)
    flash('Score updated.')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this submission? This also removes the leaderboard entry and cannot be undone.')) return
    setDeleting(id)
    const res = await fetch('/api/admin/delete-submission', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { await load(); flash('Submission deleted and leaderboard updated.') }
    else flash('Delete failed. Try again.', false)
    setDeleting(null)
  }

  const handleRecalculate = async () => {
    setRecalcing(true)
    const res = await fetch('/api/admin/recalculate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId: params.quizId, recalculateScores: true }),
    })
    const data = await res.json()
    flash(`Leaderboard updated — ${data.updated ?? 0} entries.`)
    await load()
    setRecalcing(false)
  }

  const handleCSVImport = async () => {
    if (!csvFile) return
    setImporting(true)
    const text = await csvFile.text()
    const res = await fetch('/api/admin/import-scores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId: params.quizId, csvData: text }),
    })
    const data = await res.json()
    flash(`Imported: ${data.updated} scores updated.`)
    setCsvFile(null)
    await load()
    setImporting(false)
  }

  const exportCSV = () => {
    if (!subs.length) return
    const hdrs = ['email', 'username', 'score', 'time_taken', 'overridden']
    const rows = subs.map(s => [
      s.email, s.username ?? '', s.final_score ?? 0,
      s.time_taken_seconds ? formatDuration(s.time_taken_seconds) : '',
      s.score_overridden ? 'yes' : 'no',
    ])
    const csv = [hdrs, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${activity?.title ?? 'submissions'}.csv`
    a.click()
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  const completed  = subs.filter(s => s.is_complete)
  const avgScore   = completed.length
    ? Math.round(completed.reduce((a, s) => a + (s.final_score ?? 0), 0) / completed.length * 10) / 10
    : 0
  const flagged    = subs.filter(s => s.cheat_flag).length

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ height: 72, borderRadius: 12, background: 'rgba(255,255,255,0.03)', animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <p style={{ color: '#6366f1', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Admin · Submissions
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.5rem', color: '#f1f5f9', marginBottom: 2 }}>
              {activity?.title ?? '…'}
            </h1>
            <p style={{ color: '#475569', fontSize: '0.8rem' }}>{subs.length} submission{subs.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn onClick={exportCSV} disabled={!subs.length}>↓ Export CSV</Btn>
            <Btn onClick={handleRecalculate} disabled={recalcing}>
              {recalcing ? '↻ Updating…' : '↻ Recalculate'}
            </Btn>
          </div>
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 16,
          background: msg.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${msg.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          color: msg.ok ? '#4ade80' : '#f87171',
          fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {msg.ok ? '✓' : '✗'} {msg.text}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total',     value: subs.length,       color: '#818cf8' },
          { label: 'Completed', value: completed.length,   color: '#22c55e' },
          { label: 'Avg Score', value: avgScore,           color: '#f59e0b' },
          { label: 'Flagged',   value: flagged,            color: flagged > 0 ? '#f87171' : '#475569' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.4rem', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* CSV Import strip */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: 10, padding: '12px 16px', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>Import scores via CSV</span>
        <input
          type="file" accept=".csv"
          onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
          style={{ flex: 1, color: '#94a3b8', fontSize: '0.78rem', minWidth: 0 }}
        />
        <Btn onClick={handleCSVImport} disabled={!csvFile || importing} variant="primary">
          {importing ? 'Importing…' : 'Import'}
        </Btn>
      </div>

      {/* Submissions list */}
      {!subs.length ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.07)',
          borderRadius: 14, padding: '3rem', textAlign: 'center', color: '#475569',
        }}>
          No submissions yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {subs.map((s, i) => {
            const isOpen    = expanded === s.id
            const rawAnswers: Record<string, string> =
              typeof s.answers === 'object' && !Array.isArray(s.answers)
                ? s.answers : {}

            const isDeleting = deleting === s.id

            return (
              <div
                key={s.id}
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(148,163,184,0.08)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  opacity: isDeleting ? 0.4 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {/* ── Submission row ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', flexWrap: 'wrap',
                }}>
                  {/* Rank */}
                  <span style={{ color: '#334155', fontSize: '0.75rem', fontFamily: 'monospace', minWidth: 24 }}>
                    #{i + 1}
                  </span>

                  {/* Avatar + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 150 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: 'rgba(99,102,241,0.15)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8rem', fontWeight: 700, color: '#818cf8',
                      flexShrink: 0,
                    }}>
                      {(s.username ?? s.email)?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <div style={{ color: '#e2e8f0', fontSize: '0.875rem', fontWeight: 600 }}>
                        {s.username ?? 'No username'}
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                        {s.email}
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {editing?.id === s.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          value={editing?.score || ''}
                          onChange={e => editing && setEditing({ ...editing, score: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && saveScore()}
                          style={{
                            width: 72, padding: '5px 8px', borderRadius: 7,
                            background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(99,102,241,0.4)',
                            color: '#f1f5f9', fontSize: '0.85rem', outline: 'none',
                          }}
                          autoFocus
                        />
                        <button onClick={saveScore} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '1rem', padding: '4px' }}>✓</button>
                        <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem', padding: '4px' }}>✕</button>
                      </div>
                    ) : (
                      <TotalBadge score={s.final_score ?? 0} />
                    )}
                    {s.score_overridden && (
                      <span style={{ fontSize: '0.65rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', borderRadius: 4, padding: '2px 5px' }}>
                        override
                      </span>
                    )}
                  </div>

                  {/* Time */}
                  <span style={{ color: '#475569', fontSize: '0.78rem', fontFamily: 'monospace', minWidth: 60 }}>
                    {s.time_taken_seconds ? formatDuration(s.time_taken_seconds) : '—'}
                  </span>

                  {/* Status */}
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: s.is_complete ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                    color: s.is_complete ? '#4ade80' : '#fbbf24',
                    border: `1px solid ${s.is_complete ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {s.is_complete ? 'Done' : 'Partial'}
                  </span>

                  {/* Cheat flag */}
                  {s.cheat_flag && (
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                      background: 'rgba(239,68,68,0.1)', color: '#f87171',
                      border: '1px solid rgba(239,68,68,0.2)',
                    }}>
                      ⚠ {s.cheat_violations ?? 1} flag{(s.cheat_violations ?? 1) !== 1 ? 's' : ''}
                    </span>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                    <button
                      onClick={() => setEditing({ id: s.id, score: String(s.final_score ?? 0) })}
                      style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem', padding: '4px 6px', borderRadius: 6 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleExpand(s.id)}
                      style={{
                        background: isOpen ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isOpen ? 'rgba(99,102,241,0.25)' : 'rgba(148,163,184,0.1)'}`,
                        color: isOpen ? '#818cf8' : '#94a3b8',
                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                        padding: '5px 10px', borderRadius: 7, transition: 'all 0.15s',
                      }}
                    >
                      {isOpen ? 'Hide ▲' : 'Answers ▼'}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={isDeleting}
                      style={{
                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                        color: '#f87171', cursor: 'pointer',
                        fontSize: '0.78rem', fontWeight: 600,
                        padding: '5px 10px', borderRadius: 7, transition: 'all 0.15s',
                        opacity: isDeleting ? 0.5 : 1,
                      }}
                    >
                      {isDeleting ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>

                {/* ── Expanded: Answers + Violations ── */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid rgba(148,163,184,0.07)', padding: '16px' }}>

                    {/* Question Blocks */}
                    <p style={{ color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 12 }}>
                      Answer Breakdown
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {questions.length === 0 ? (
                        <p style={{ color: '#334155', fontSize: '0.8rem' }}>No questions found for this quiz.</p>
                      ) : (
                        questions.map((q, idx) => {
                          const userAns = rawAnswers[q.id] ?? ''
                          const score   = evaluateAnswer(q, userAns)
                          const maxPts  = q.weightage ?? 1

                          return (
                            <div
                              key={q.id}
                              style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(148,163,184,0.06)',
                                borderLeft: `3px solid ${score >= maxPts ? '#22c55e' : score > 0 ? '#f59e0b' : '#374151'}`,
                                borderRadius: '0 10px 10px 0',
                                padding: '12px 14px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700 }}>
                                  Q{idx + 1} · {q.text}
                                </span>
                                <ScorePip score={score} max={maxPts} />
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div>
                                  <span style={{ display: 'block', color: '#475569', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>User's Answer</span>
                                  <span style={{ color: userAns ? '#e2e8f0' : '#334155', fontSize: '0.82rem', fontStyle: userAns ? 'normal' : 'italic' }}>
                                    {userAns || '(no answer)'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ display: 'block', color: '#475569', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Expected</span>
                                  <span style={{ color: '#4ade80', fontSize: '0.82rem' }}>{q.correct_answer}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>

                    {/* Violations block */}
                    {s.cheat_flag && (
                      <div style={{
                        marginTop: 14, padding: '12px 14px', borderRadius: 10,
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.15)',
                      }}>
                        <p style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                          ⚠ Integrity Violations
                        </p>
                        <p style={{ color: '#fca5a5', fontSize: '0.82rem' }}>
                          {s.cheat_violations ?? 1} suspicious event{(s.cheat_violations ?? 1) !== 1 ? 's' : ''} detected during this session
                          (e.g. tab switches, window focus loss).
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

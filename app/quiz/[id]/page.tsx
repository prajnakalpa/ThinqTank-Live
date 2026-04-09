'use client'
export const dynamic = 'force-dynamic'



import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSecondsRemaining, formatTime, formatDuration } from '@/lib/quiz-state'

interface Props { params: { id: string } }

export default function QuizPage({ params }: Props) {
  const [state, setState]         = useState<'loading'|'username'|'quiz'|'submitted'|'closed'|'error'>('loading')
  const [activity, setActivity]   = useState<any>(null)
  const [quiz, setQuiz]           = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers]     = useState<Record<string, string>>({})
  const [submission, setSubmission] = useState<any>(null)
  const [username, setUsername]   = useState('')
  const [timeLeft, setTimeLeft]   = useState(0)
  const [saving, setSaving]       = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [currentQ, setCurrentQ]   = useState(0)
  const router   = useRouter()
  const supabase = createClient()
  const timerRef    = useRef<NodeJS.Timeout>()
  const autosaveRef = useRef<NodeJS.Timeout>()

  const loadQuiz = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/login?redirect=/quiz/${params.id}`); return }
    const { data: act } = await supabase.from('activities').select('*, quizzes(*, questions(*))').eq('id', params.id).single()
    if (!act) { setState('error'); return }
    if (act.status === 'closed' || act.status === 'archived') { setState('closed'); return }
    setActivity(act)
    const q = act.quizzes; setQuiz(q)
    const qs = (q?.questions ?? []).sort((a: any, b: any) => a.order_index - b.order_index); setQuestions(qs)
    const { data: existingSub } = await supabase.from('submissions').select('*').eq('activity_id', params.id).eq('user_id', user.id).single()
    if (existingSub?.is_complete) { setState('submitted'); setSubmission(existingSub); return }
    const { data: profile } = await supabase.from('users').select('username, username_locked').eq('id', user.id).single()
    if (!profile?.username) { setState('username'); return }
    setUsername(profile.username)
    if (existingSub) {
      setSubmission(existingSub); setAnswers(existingSub.answers ?? {})
      const remaining = getSecondsRemaining(existingSub.start_time, q.duration_minutes * 60)
      if (remaining === 0) { await handleAutoSubmit(existingSub, qs, user.id); return }
      setTimeLeft(remaining)
    } else {
      const { data: newSub } = await supabase.from('submissions').insert({ activity_id: params.id, user_id: user.id, email: user.email, username: profile.username, start_time: new Date().toISOString() }).select().single()
      setSubmission(newSub); setTimeLeft(q.duration_minutes * 60)
    }
    setState('quiz')
  }, [params.id])

  useEffect(() => { loadQuiz() }, [loadQuiz])

  useEffect(() => {
    if (state !== 'quiz' || !submission) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { clearInterval(timerRef.current); handleAutoSubmit(submission, questions, undefined); return 0 } return prev - 1 })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [state, submission])

  useEffect(() => {
    if (state !== 'quiz') return
    autosaveRef.current = setInterval(() => autosave(), 30000)
    return () => clearInterval(autosaveRef.current)
  }, [state, answers, submission])

  const autosave = async () => {
    if (!submission?.id) return
    setSaving(true)
    await supabase.from('submissions').update({ answers }).eq('id', submission.id)
    setSaving(false)
  }

  const handleAutoSubmit = async (sub: any, qs: any[], userId?: string) => {
    await supabase.from('submissions').update({ answers: sub.answers ?? {}, is_complete: true, submission_time: new Date().toISOString(), time_taken_seconds: quiz?.duration_minutes * 60 }).eq('id', sub.id)
    await fetch('/api/quiz/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: sub.id }) })
    setState('submitted')
  }

  const handleSubmit = async () => {
    if (!submission?.id) return
    setSaving(true)
    const timeTaken = Math.floor((Date.now() - new Date(submission.start_time).getTime()) / 1000)
    await supabase.from('submissions').update({ answers, is_complete: true, submission_time: new Date().toISOString(), time_taken_seconds: timeTaken }).eq('id', submission.id)
    const res = await fetch('/api/quiz/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: submission.id }) })
    if (!res.ok) { setSubmitError('Submit failed. Try again.'); setSaving(false); return }
    const { score } = await res.json()
    setSubmission({ ...submission, final_score: score }); setState('submitted'); setSaving(false)
  }

  const handleSetUsername = async () => {
    if (!username.trim() || username.length < 3) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('users').update({ username: username.trim(), username_locked: true }).eq('id', user.id)
    if (error?.code === '23505') { setSubmitError('Username taken. Try another.'); return }
    setSubmitError(''); loadQuiz()
  }

  if (state === 'loading') return <Screen><div style={{ textAlign: 'center' }}><Spinner />Loading quiz…</div></Screen>
  if (state === 'error')   return <Screen><StatusCard icon="❌" title="Quiz not found" /></Screen>
  if (state === 'closed')  return <Screen><StatusCard icon="🔒" title="Quiz Closed" subtitle="This quiz is no longer accepting submissions." /></Screen>

  if (state === 'username') return (
    <Screen>
      <div style={{ width: '100%', maxWidth: 420, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem' }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 99, marginBottom: 24 }} />
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.3rem', color: '#f1f5f9', marginBottom: 6 }}>Choose your username</h2>
        <p style={{ color: '#475569', fontSize: '0.85rem', marginBottom: 20 }}>Appears on the leaderboard. <strong style={{ color: '#e2e8f0' }}>Cannot be changed later.</strong></p>
        <input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSetUsername()}
          placeholder="coolplayer42" className="input-field" maxLength={20} autoFocus style={{ marginBottom: 12 }} />
        {submitError && <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: 12 }}>{submitError}</p>}
        <button onClick={handleSetUsername} disabled={username.length < 3} className="btn-primary" style={{ width: '100%', padding: '11px' }}>Confirm →</button>
      </div>
    </Screen>
  )

  if (state === 'submitted') return (
    <Screen>
      <div style={{ width: '100%', maxWidth: 400, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem', textAlign: 'center' }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, #22c55e, #3b82f6)', borderRadius: 99, marginBottom: 24 }} />
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.4rem', color: '#f1f5f9', marginBottom: 6 }}>Submitted!</h2>
        <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: 20 }}>Your responses have been recorded.</p>
        {submission?.final_score !== undefined && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '1.25rem', marginBottom: 20 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '2.5rem', color: '#f59e0b' }}>{submission.final_score}</div>
            <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>Your score</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <a href={`/leaderboard?quiz=${params.id}`} className="btn-primary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '10px' }}>Leaderboard</a>
          <a href="/live" className="btn-ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '10px' }}>Back</a>
        </div>
      </div>
    </Screen>
  )

  const q       = questions[currentQ]
  const urgency = timeLeft < 120
  const answeredCount = Object.values(answers).filter(Boolean).length

  return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(2,6,23,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(148,163,184,0.08)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity?.title}</span>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem',
            color: urgency ? '#f87171' : '#f59e0b',
            background: urgency ? 'rgba(248,113,113,0.1)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${urgency ? 'rgba(248,113,113,0.2)' : 'rgba(245,158,11,0.2)'}`,
            borderRadius: 8, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: '0.9rem' }}>⏱</span> {formatTime(timeLeft)}
            {urgency && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', animation: 'pulse 1s infinite' }} />}
          </div>
          <span style={{ color: '#475569', fontSize: '0.8rem', fontFamily: 'monospace' }}>{currentQ + 1}/{questions.length}</span>
        </div>
        {/* Progress */}
        <div style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', transition: 'width 0.4s', width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingTop: 72, paddingBottom: 32, maxWidth: 720, margin: '0 auto', width: '100%', padding: '72px 1.5rem 2rem' }}>
        {q && (
          <div>
            {/* Question meta */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', borderRadius: 8, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}>Q{currentQ + 1}</span>
                <span style={{ color: '#475569', fontSize: '0.8rem' }}>{q.weightage} pt{q.weightage !== 1 ? 's' : ''}</span>
              </div>
              {saving && <span style={{ color: '#475569', fontSize: '0.75rem', fontFamily: 'monospace' }}>Saving…</span>}
            </div>

            {/* Question */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: '1.5rem', marginBottom: 20 }}>
              <p style={{ color: '#e2e8f0', fontSize: '1.05rem', lineHeight: 1.7 }}>{q.text}</p>
            </div>

            {/* Answer */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Your Answer</label>
              <textarea
                value={answers[q.id] ?? ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Type your answer here…"
                rows={4}
                className="input-field"
                style={{ resize: 'none', fontSize: '0.95rem', lineHeight: 1.6 }}
              />
            </div>

            {submitError && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: 16, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>{submitError}</p>}

            {/* Nav buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {currentQ > 0 && (
                <button onClick={() => setCurrentQ(p => p - 1)} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>← Prev</button>
              )}
              {currentQ < questions.length - 1 ? (
                <button onClick={() => setCurrentQ(p => p + 1)} className="btn-primary" style={{ flex: 1, padding: '11px' }}>Next →</button>
              ) : (
                <button onClick={handleSubmit} disabled={saving} style={{
                  flex: 1, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#fff', fontWeight: 700, fontSize: '0.95rem', fontFamily: "'Space Grotesk', sans-serif",
                  boxShadow: '0 4px 20px rgba(34,197,94,0.3)', transition: 'all 0.2s',
                  opacity: saving ? 0.6 : 1,
                }}>
                  {saving ? 'Submitting…' : '✓ Submit Quiz'}
                </button>
              )}
            </div>

            {/* Question dots */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 28 }}>
              {questions.map((_, i) => {
                const answered = !!answers[questions[i].id]
                const isCurrent = i === currentQ
                return (
                  <button key={i} onClick={() => setCurrentQ(i)} style={{
                    width: 32, height: 32, borderRadius: 8, fontSize: '0.75rem', fontFamily: 'monospace',
                    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                    background: isCurrent ? '#6366f1' : answered ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                    color: isCurrent ? '#fff' : answered ? '#4ade80' : '#475569',
                    fontWeight: isCurrent ? 700 : 400,
                    outline: isCurrent ? '2px solid rgba(99,102,241,0.4)' : 'none',
                    outlineOffset: 2,
                  }}>{i + 1}</button>
                )
              })}
            </div>

            {/* Progress summary */}
            <div style={{ textAlign: 'center', marginTop: 12, color: '#475569', fontSize: '0.78rem' }}>
              {answeredCount}/{questions.length} answered
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      {children}
    </div>
  )
}
function StatusCard({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>{icon}</div>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.4rem', color: '#f1f5f9', marginBottom: 8 }}>{title}</h2>
      {subtitle && <p style={{ color: '#475569', marginBottom: 20 }}>{subtitle}</p>}
      <a href="/live" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 24px' }}>Back to Live</a>
    </div>
  )
}
function Spinner() {
  return <div style={{ width: 20, height: 20, border: '2px solid rgba(148,163,184,0.2)', borderTop: '2px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', marginRight: 10 }} />
          }

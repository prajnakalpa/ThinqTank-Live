// app/quiz/[id]/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSecondsRemaining, formatTime } from '@/lib/quiz-state'

interface Props { params: { id: string } }

export default function QuizPage({ params }: Props) {
  const [state,         setState]         = useState<'loading'|'username'|'quiz'|'submitted'|'closed'|'error'>('loading')
  const [activity,      setActivity]      = useState<any>(null)
  const [quiz,          setQuiz]          = useState<any>(null)
  const [questions,     setQuestions]     = useState<any[]>([])
  const [answers,       setAnswers]       = useState<Record<string, string>>({})
  const [submission,    setSubmission]    = useState<any>(null)
  const [timeLeft,      setTimeLeft]      = useState(0)
  const [saving,        setSaving]        = useState(false)
  const [currentQ,      setCurrentQ]      = useState(0)
  const [newUsername,   setNewUsername]   = useState('')
  const [usernameError, setUsernameError] = useState('')

  const router   = useRouter()
  const supabase = createClient()

  // ── Refs (anti-stale-closure + Silent Sentinel scope) ──────────────────
  const timerRef       = useRef<NodeJS.Timeout>()
  const answersRef     = useRef<Record<string, string>>({})
  const submissionRef  = useRef<any>(null)
  const quizRef        = useRef<any>(null)
  const submittingRef  = useRef(false)

  useEffect(() => { answersRef.current   = answers    }, [answers])
  useEffect(() => { submissionRef.current = submission }, [submission])
  useEffect(() => { quizRef.current      = quiz       }, [quiz])

  // ── Auto-submit ────────────────────────────────────────────────────────
  const doAutoSubmit = async (subId: string, currentAnswers: Record<string, string>, duration: number) => {
    if (submittingRef.current) return
    submittingRef.current = true
    await supabase.from('submissions').update({
      answers: currentAnswers, is_complete: true,
      submission_time: new Date().toISOString(),
      time_taken_seconds: duration,
    }).eq('id', subId)
    await fetch('/api/quiz/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: subId }),
    })
    setState('submitted')
  }

  // ── Load quiz ──────────────────────────────────────────────────────────
  const loadQuiz = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/login?redirect=/quiz/${params.id}`); return }

    const { data: act } = await supabase
      .from('activities').select('*, quizzes(*, questions(*))')
      .eq('id', params.id).single()

    if (!act || act.status === 'closed') { setState('closed'); return }

    setActivity(act)
    const q  = act.quizzes; setQuiz(q)
    const qs = (q?.questions ?? []).sort((a: any, b: any) => a.order_index - b.order_index)
    setQuestions(qs)

    const { data: existingSub } = await supabase
      .from('submissions').select('*')
      .eq('activity_id', params.id).eq('user_id', user.id).single()

    if (existingSub?.is_complete) { setState('submitted'); setSubmission(existingSub); return }

    const { data: profile } = await supabase.from('users').select('username').eq('id', user.id).single()
    if (!profile?.username) { setState('username'); return }

    if (existingSub) {
      setSubmission(existingSub)
      setAnswers(existingSub.answers ?? {})
      const remaining = getSecondsRemaining(existingSub.start_time, q.duration_minutes * 60)
      if (remaining <= 0) { doAutoSubmit(existingSub.id, existingSub.answers ?? {}, q.duration_minutes * 60); return }
      setTimeLeft(remaining)
    } else {
      const { data: newSub } = await supabase.from('submissions').insert({
        activity_id: params.id, user_id: user.id, email: user.email,
        username: profile.username, start_time: new Date().toISOString()
      }).select().single()
      setSubmission(newSub)
      setTimeLeft(q.duration_minutes * 60)
    }
    setState('quiz')
  }, [params.id])

  useEffect(() => { loadQuiz() }, [loadQuiz])

  // ── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'quiz' || !submission) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          doAutoSubmit(submissionRef.current.id, answersRef.current, quizRef.current.duration_minutes * 60)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [state, submission])

  // ── ✅ SILENT SENTINEL — DO NOT MOVE OR REFACTOR ─────────────────────
  // Anti-cheat event listeners. submissionRef + answersRef must remain in parent scope.
  useEffect(() => {
    if (state !== 'quiz' || !submissionRef.current?.id) return

    const logViolation = async (type: string) => {
      try {
        await fetch('/api/quiz/log-event', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId: submissionRef.current.id,
            type,
            timestamp: new Date().toISOString()
          })
        })
      } catch { /* safe — non-critical */ }
    }

    const handleVisibilityChange = () => {
  if (document.hidden) logViolation('TAB_SWITCH')
}

const handleBlur = () => {
  logViolation('WINDOW_BLUR')
}

// NEW
const handleFocus = () => {
  logViolation('WINDOW_FOCUS')
}

const handleCopy = () => {
  logViolation('COPY')
}

const handlePaste = () => {
  logViolation('PASTE')
}

const handleContextMenu = (e: MouseEvent) => {
  e.preventDefault()
  logViolation('RIGHT_CLICK')
}

document.addEventListener('visibilitychange', handleVisibilityChange)
window.addEventListener('blur', handleBlur)
window.addEventListener('focus', handleFocus)

document.addEventListener('copy', handleCopy)
document.addEventListener('paste', handlePaste)
document.addEventListener('contextmenu', handleContextMenu)

return () => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('blur', handleBlur)
  window.removeEventListener('focus', handleFocus)

  document.removeEventListener('copy', handleCopy)
  document.removeEventListener('paste', handlePaste)
  document.removeEventListener('contextmenu', handleContextMenu)
}
  }, [state])
  // ── END SILENT SENTINEL ───────────────────────────────────────────────

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSaving(true)
    const timeTaken = Math.floor((Date.now() - new Date(submission.start_time).getTime()) / 1000)
    await supabase.from('submissions').update({
      answers: answersRef.current, is_complete: true,
      submission_time: new Date().toISOString(),
      time_taken_seconds: timeTaken,
    }).eq('id', submission.id)
    await fetch('/api/quiz/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: submission.id }),
    })
    setState('submitted')
  }

  // ── Username ───────────────────────────────────────────────────────────
  const handleSetUsername = async () => {
    const trimmed = newUsername.trim()
    if (trimmed.length < 3) { setUsernameError('At least 3 characters.'); return }
    setUsernameError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('users')
      .update({ username: trimmed, username_locked: true }).eq('id', user.id)
    if (error?.code === '23505') { setUsernameError('Username taken. Try another.'); return }
    loadQuiz()
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const urgent   = timeLeft > 0 && timeLeft < 60
  const answered = Object.values(answers).filter(Boolean).length
  const q        = questions[currentQ]
  const mins     = Math.floor(timeLeft / 60)
  const secs     = (timeLeft % 60).toString().padStart(2, '0')

  // ── State screens ──────────────────────────────────────────────────────

  if (state === 'loading') return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', margin: '0 auto 16px',
          border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366f1',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#475569', fontSize: '0.875rem' }}>Loading quiz…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (state === 'submitted') return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{
        maxWidth: 440, width: '100%', textAlign: 'center',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)',
        borderRadius: 20, padding: '2.5rem',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.5rem', color: '#f1f5f9', marginBottom: 8 }}>
          Quiz Submitted!
        </h1>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Your responses have been recorded. Good luck!</p>
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '10px 28px', borderRadius: 10,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
          }}
        >
          Back to Home
        </button>
      </div>
    </div>
  )

  if (state === 'closed') return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.4rem', color: '#f1f5f9', marginBottom: 8 }}>Quiz Closed</h1>
        <p style={{ color: '#475569', marginBottom: '1.5rem' }}>This quiz is no longer accepting submissions.</p>
        <button onClick={() => router.push('/live')} style={{ padding: '10px 24px', borderRadius: 9, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>Back to Live</button>
      </div>
    </div>
  )

  if (state === 'error') return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>❌</div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.4rem', color: '#f1f5f9', marginBottom: 8 }}>Quiz Not Found</h1>
        <button onClick={() => router.push('/live')} style={{ padding: '10px 24px', borderRadius: 9, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>Back to Live</button>
      </div>
    </div>
  )

  if (state === 'username') return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{
        maxWidth: 440, width: '100%',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)',
        borderRadius: 20, padding: '2rem',
      }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 99, marginBottom: '1.5rem' }} />
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.3rem', color: '#f1f5f9', marginBottom: 6 }}>
          Choose your username
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Displayed on the leaderboard. <strong style={{ color: '#e2e8f0' }}>Cannot be changed later.</strong>
        </p>
        <input
          placeholder="e.g. coolplayer42"
          value={newUsername}
          onChange={e => setNewUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSetUsername()}
          maxLength={20}
          autoFocus
          style={{
            width: '100%', background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(148,163,184,0.12)', borderRadius: 10,
            padding: '11px 14px', color: '#f1f5f9', fontSize: '0.95rem',
            outline: 'none', marginBottom: 10,
          }}
        />
        {usernameError && (
          <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: 10 }}>{usernameError}</p>
        )}
        <button
          onClick={handleSetUsername}
          disabled={newUsername.trim().length < 3}
          style={{
            width: '100%', padding: '11px', borderRadius: 10,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
            cursor: newUsername.trim().length < 3 ? 'not-allowed' : 'pointer',
            opacity: newUsername.trim().length < 3 ? 0.5 : 1,
            minHeight: 44,
          }}
        >
          Confirm & Start Quiz →
        </button>
      </div>
    </div>
  )

  // ── Main quiz UI ───────────────────────────────────────────────────────

  // True if the current question is MCQ
  const qIsMcq = q?.type?.includes('mcq') ?? false
  // Safely parse options array
  const qOptions: string[] = Array.isArray(q?.options) ? q.options : []

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9' }}>

      {/* ── STICKY HEADER BAR ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(2,6,23,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(148,163,184,0.08)',
        padding: '0 1rem',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>

          {/* Quiz name */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activity?.title}
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 1 }}>
              Q{currentQ + 1}/{questions.length} · {answered} answered
            </p>
          </div>

          {/* Timer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 10,
            background: urgent ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
            border: `1px solid ${urgent ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.2)'}`,
            transition: 'all 0.5s',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.85rem' }}>⏱</span>
            <span style={{
              fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem',
              color: urgent ? '#f87171' : '#818cf8',
              animation: urgent ? 'timerPulse 1s ease-in-out infinite' : 'none',
            }}>
              {mins}:{secs}
            </span>
          </div>

          {/* Progress fraction */}
          <span style={{ color: '#334155', fontSize: '0.72rem', fontFamily: 'monospace', flexShrink: 0 }}>
            {currentQ + 1}/{questions.length}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', margin: '0 1rem' }}>
          <div style={{
            height: '100%',
            background: urgent
              ? 'linear-gradient(90deg,#ef4444,#f87171)'
              : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
            width: `${((currentQ + 1) / Math.max(questions.length, 1)) * 100}%`,
            transition: 'width 0.3s ease, background 0.5s',
            borderRadius: 99,
          }} />
        </div>
      </div>

      {/* ── QUESTION CONTENT ── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem 6rem' }}>

        {q ? (
          <>
            {/* Question card */}
            <div style={{
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: 16, padding: '1.25rem',
              marginBottom: '1.25rem',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}>
              {/* Q badge + pts */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.875rem' }}>
                <span style={{
                  background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)',
                  color: '#818cf8', borderRadius: 7, padding: '3px 9px',
                  fontSize: '0.72rem', fontWeight: 700,
                }}>
                  Q{currentQ + 1}
                </span>
                {q.weightage > 1 && (
                  <span style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 600 }}>
                    {q.weightage} pts
                  </span>
                )}
                {qIsMcq && (
                  <span style={{
                    background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                    color: '#a78bfa', borderRadius: 5, padding: '2px 7px',
                    fontSize: '0.68rem', fontWeight: 700,
                  }}>
                    MCQ
                  </span>
                )}
              </div>

              {/* ── Image (if present) — rendered ABOVE question text ── */}
              {q.image_url && (
                <img
                  src={q.image_url}
                  alt="Question image"
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: 10,
                    marginBottom: '1rem',
                    display: 'block',
                    maxHeight: 360,
                    objectFit: 'contain',
                  }}
                />
              )}

              {/* Question text */}
              <p style={{
                fontSize: '1rem', lineHeight: 1.7,
                color: '#e2e8f0', fontWeight: 400,
                marginBottom: '1.25rem',
              }}>
                {q.text}
              </p>

              {/* ── ANSWER INPUT — conditional on type ── */}
              {qIsMcq ? (
                // ── MCQ: selectable option buttons ──
                // Answers stored as STRING index: '0', '1', '2', …
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {qOptions.map((opt: string, idx: number) => {
                    const idxStr  = String(idx)
                    const selected = answers[q.id] === idxStr
                    return (
                      <button
                        key={idx}
                        onClick={() => setAnswers(prev => ({ ...prev, [q.id]: idxStr }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 10,
                          background: selected ? 'rgba(99,102,241,0.15)' : 'rgba(2,6,23,0.5)',
                          border: selected
                            ? '1.5px solid rgba(99,102,241,0.55)'
                            : '1.5px solid rgba(148,163,184,0.1)',
                          color: selected ? '#e2e8f0' : '#94a3b8',
                          fontSize: '0.95rem', textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          width: '100%',
                        }}
                      >
                        {/* Option letter indicator */}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: selected ? '#6366f1' : 'rgba(148,163,184,0.1)',
                          color: selected ? '#fff' : '#64748b',
                          fontSize: '0.75rem', fontWeight: 700,
                          transition: 'all 0.15s',
                        }}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {opt}
                      </button>
                    )
                  })}
                  {qOptions.length === 0 && (
                    <p style={{ color: '#475569', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      No options configured for this question.
                    </p>
                  )}
                </div>
              ) : (
                // ── Objective: text textarea (unchanged) ──
                <textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Type your answer here…"
                  rows={4}
                  style={{
                    width: '100%', resize: 'vertical',
                    background: 'rgba(2,6,23,0.7)',
                    border: '1.5px solid rgba(148,163,184,0.1)',
                    borderRadius: 12, padding: '12px 14px',
                    color: '#f1f5f9', fontSize: '0.95rem', lineHeight: 1.6,
                    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'rgba(99,102,241,0.55)'
                    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'rgba(148,163,184,0.1)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              )}
            </div>

            {/* Navigation */}
            <div className="quiz-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>

              <button
                disabled={currentQ === 0}
                onClick={() => setCurrentQ(p => p - 1)}
                style={{
                  padding: '10px 16px', borderRadius: 10,
                  background: 'transparent',
                  border: '1px solid rgba(148,163,184,0.12)',
                  color: currentQ === 0 ? '#1e293b' : '#94a3b8',
                  cursor: currentQ === 0 ? 'default' : 'pointer',
                  fontSize: '0.875rem', fontWeight: 600,
                  transition: 'all 0.15s', minHeight: 44,
                  flexShrink: 0,
                }}
              >
                ← Prev
              </button>

              {/* Question dot navigator */}
              <div className="quiz-nav-dots" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', flex: 1 }}>
                {questions.map((_, i) => {
                  const isAnswered = !!answers[questions[i].id]
                  const isCurrent  = i === currentQ
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentQ(i)}
                      title={`Q${i + 1}`}
                      style={{
                        width: 30, height: 30, borderRadius: 8,
                        border: 'none', cursor: 'pointer',
                        fontSize: '0.7rem', fontWeight: 700,
                        background: isCurrent
                          ? '#6366f1'
                          : isAnswered
                            ? 'rgba(34,197,94,0.2)'
                            : 'rgba(255,255,255,0.05)',
                        color: isCurrent ? '#fff' : isAnswered ? '#4ade80' : '#475569',
                        outline: isCurrent ? '2px solid rgba(99,102,241,0.4)' : 'none',
                        outlineOffset: 2,
                        transition: 'all 0.15s',
                        minHeight: 30,
                      }}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>

              {currentQ < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQ(p => p + 1)}
                  style={{
                    padding: '10px 16px', borderRadius: 10,
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    color: '#818cf8', cursor: 'pointer',
                    fontSize: '0.875rem', fontWeight: 700,
                    transition: 'all 0.15s', minHeight: 44,
                    flexShrink: 0,
                  }}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  style={{
                    padding: '10px 18px', borderRadius: 10,
                    background: saving ? 'rgba(34,197,94,0.4)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                    border: 'none', color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem', fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(34,197,94,0.25)',
                    transition: 'all 0.15s', minHeight: 44,
                    opacity: saving ? 0.7 : 1,
                    flexShrink: 0,
                  }}
                >
                  {saving ? 'Submitting…' : '✓ Submit'}
                </button>
              )}
            </div>

            {/* Answered count */}
            <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.72rem', marginTop: '1rem' }}>
              {answered} of {questions.length} answered
            </p>
          </>
        ) : (
          <p style={{ color: '#475569', textAlign: 'center', paddingTop: '4rem' }}>No questions found.</p>
        )}
      </div>

      {/* ── Animations + responsive nav fix ── */}
      <style>{`
        @keyframes timerPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 540px) {
          .quiz-nav {
            flex-wrap: wrap;
            gap: 10px;
          }
          .quiz-nav-dots {
            flex-basis: 100%;
            order: -1;
            flex: none;
          }
        }
      `}</style>
    </div>
  )
}

// app/quiz/[id]/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSecondsRemaining, formatTime } from '@/lib/quiz-state'
import { evaluateAnswer } from '@/lib/evaluation'

interface Props { params: { id: string } }

// ── Per-question breakdown helpers ────────────────────────────────────────

/** Decode the user's raw stored answer into human-readable text. */
function decodeUserAnswer(q: any, rawAnswer: string | undefined): string {
  if (!rawAnswer && rawAnswer !== '0') return 'Not Answered'
  if (q.type?.includes('mcq')) {
    const idx = Number(rawAnswer)
    if (!isNaN(idx) && Array.isArray(q.options) && q.options[idx] != null) {
      return q.options[idx]
    }
    return 'Not Answered'
  }
  return rawAnswer || 'Not Answered'
}

/** Decode the correct answer into human-readable text. */
function decodeCorrectAnswer(q: any): string {
  if (q.type?.includes('mcq')) {
    const idx = q.correct_option ?? 0
    if (Array.isArray(q.options) && q.options[idx] != null) return q.options[idx]
    return '—'
  }
  return q.correct_answer || '—'
}

/** Return true if the raw stored answer is correct for this question. */
function checkIsCorrect(q: any, rawAnswer: string | undefined): boolean {
  if (!rawAnswer && rawAnswer !== '0') return false
  if (q.type?.includes('mcq')) {
    return rawAnswer === String(q.correct_option ?? -1)
  }
  try {
    return evaluateAnswer(q, rawAnswer) > 0
  } catch {
    return false
  }
}

function QTime({ you, stat }: { you?: number; stat?: any }) {
  if (you == null && !stat) return null
  const acc = stat?.accuracy ?? null
  const diff = acc == null ? null
    : acc >= 70 ? { l: '🟢 Easy', c: '#4ade80' }
    : acc >= 40 ? { l: '🟡 Medium', c: '#fbbf24' }
    : { l: '🔴 Hard', c: '#f87171' }
  const pill = (t: string, c = '#64748b') => (
    <span style={{ color: c, fontSize: '0.72rem', background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(148,163,184,0.08)', borderRadius: 5, padding: '2px 7px' }}>{t}</span>
  )
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      {pill(`You: ${you != null ? Math.round(you) : '—'} sec`, '#818cf8')}
      {stat?.avg_time != null && pill(`Average: ${Math.round(stat.avg_time)} sec`)}
      {acc != null && pill(`${Math.round(acc)}% correct`, acc >= 70 ? '#4ade80' : acc >= 40 ? '#fbbf24' : '#f87171')}
      {diff && pill(diff.l, diff.c)}
    </div>
  )
}

/**
 * Safely parse a TEXT column that might be a JSON string or already an object.
 * The answers and time_per_question columns in Supabase are TEXT, so when
 * fetched they come back as strings that need to be JSON.parsed.
 */
function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as T
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T } catch { return fallback }
  }
  return fallback
}

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
  const [qStats, setQStats] = useState<Record<string, any>>({})

  const router   = useRouter()
  // Stable Supabase client — must not be recreated on every render
  const supabaseRef = useRef(createClient())
  const supabase    = supabaseRef.current

  // ── Refs (anti-stale-closure) ──────────────────────────────────────────
  const timerRef       = useRef<NodeJS.Timeout>()
  const answersRef     = useRef<Record<string, string>>({})
  const submissionRef  = useRef<any>(null)
  const quizRef        = useRef<any>(null)
  const submittingRef  = useRef(false)

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: value }
      answersRef.current = next
      return next
    })
  }

  useEffect(() => { answersRef.current    = answers    }, [answers])
  useEffect(() => { submissionRef.current = submission }, [submission])
  useEffect(() => { quizRef.current       = quiz       }, [quiz])

  // ── TIME-PER-QUESTION TRACKING ─────────────────────────────────────────
  const timeMapRef        = useRef<Record<string, number>>({})
  const lastSwitchTimeRef = useRef<number>(Date.now())
  const currentQRef       = useRef<number>(0)
  const questionsRef      = useRef<any[]>([])

  useEffect(() => { questionsRef.current = questions }, [questions])

  useEffect(() => {
    if (state === 'quiz') {
      lastSwitchTimeRef.current = Date.now()
      currentQRef.current = 0
    }
  }, [state])

  useEffect(() => {
    if (state !== 'quiz' || questionsRef.current.length === 0) return
    const now = Date.now()
    const prevQ = questionsRef.current[currentQRef.current]
    if (prevQ?.id) {
      const delta = Math.floor((now - lastSwitchTimeRef.current) / 1000)
      if (delta > 0) {
        timeMapRef.current[prevQ.id] = (timeMapRef.current[prevQ.id] || 0) + delta
      }
    }
    currentQRef.current = currentQ
    lastSwitchTimeRef.current = now
  }, [currentQ]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-submit (timer expiry) ─────────────────────────────────────────
  const doAutoSubmit = async (subId: string, currentAnswers: Record<string, string>, duration: number) => {
    if (submittingRef.current) return
    submittingRef.current = true

    // Finalize time tracking
    const now = Date.now()
    const currentId = questionsRef.current[currentQRef.current]?.id
    if (currentId) {
      const delta = Math.floor((now - lastSwitchTimeRef.current) / 1000)
      if (delta > 0) {
        timeMapRef.current[currentId] = (timeMapRef.current[currentId] || 0) + delta
      }
    }
    const timePerQuestion = { ...timeMapRef.current }

    // ── CRITICAL DB UPDATE: answers + completion ───────────────────────
    // time_per_question is NOT included here — if that column doesn't exist
    // in the schema yet, including it would cause this entire update to fail,
    // leaving is_complete=false and losing the user's answers.
    const { error: criticalErr } = await supabase
      .from('submissions')
      .update({
        answers:            JSON.stringify(currentAnswers),
        // NOTE: is_complete intentionally NOT set here.
        // Setting is_complete=true before the API runs triggers the idempotency
        // check (is_complete=true + final_score=0 default) → API returns 0.
        // Only the API route sets is_complete=true, together with the real score.
        submission_time:    new Date().toISOString(),
        time_taken_seconds: duration,
      })
      .eq('id', subId)

    if (criticalErr) {
      console.error('[doAutoSubmit] CRITICAL update failed:', criticalErr.message)
    }

    // ── NON-CRITICAL: save time_per_question separately ────────────────
    if (Object.keys(timePerQuestion).length > 0) {
      const { error: tpqErr } = await supabase
        .from('submissions')
        .update({ time_per_question: JSON.stringify(timePerQuestion) })
        .eq('id', subId)
      if (tpqErr) {
        console.warn('[doAutoSubmit] time_per_question not saved (column may not exist):', tpqErr.message)
      }
    }

    // ── Call API for scoring ───────────────────────────────────────────
    const autoRes = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId:       subId,
        answers:            currentAnswers,
        submission_time:    new Date().toISOString(),
        time_taken_seconds: duration,
        time_per_question:  timePerQuestion,
      }),
    })

    // ── READ the score back from API response and apply to UI ──────────
    // BUG FIX: previously we never read the response, so final_score was
    // always the stale pre-submission value (null/0) from the initial DB
    // load. The DB had the correct score but the UI never showed it.
    let apiScore: number | null = null
    if (autoRes.ok) {
      try {
        const resData = await autoRes.json()
        apiScore = typeof resData.score === 'number' ? resData.score : null
      } catch (e) {
        console.error('[doAutoSubmit] failed to parse API response:', e)
      }
    } else {
      console.error('[doAutoSubmit] API submit failed:', autoRes.status)
    }

    // Sync submission state so the breakdown screen has the real answers + score
    setSubmission((prev: any) => ({
      ...prev,
      answers:           currentAnswers,
      time_per_question: timePerQuestion,
      final_score:       apiScore,   // ← the fix: show the real score immediately
    }))
    setState('submitted')
  }

  // ── Load quiz ──────────────────────────────────────────────────────────
  const loadQuiz = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/login?redirect=/quiz/${params.id}`)
      return
    }

    const { data: act } = await supabase
      .from('activities')
      .select('*, quizzes(*, questions(*))')
      .eq('id', params.id)
      .single()

    if (!act || act.status === 'closed') {
      setState('closed')
      return
    }

    setActivity(act)

    const q = act.quizzes
    setQuiz(q)

    const qs = (q?.questions ?? []).sort(
      (a: any, b: any) => a.order_index - b.order_index
    )
    setQuestions(qs)

    const { data: an } = await supabase
      .from('analytics').select('question_stats').eq('activity_id', params.id).single()
    const aStats = Array.isArray(an?.question_stats) ? an!.question_stats : []
    setQStats(Object.fromEntries(
      aStats.filter((s: any) => s?.question_id).map((s: any) => [s.question_id, s])
    ))
    

    const { data: existingSub } = await supabase
      .from('submissions')
      .select('*')
      .eq('activity_id', params.id)
      .eq('user_id', user.id)
      .single()

    // ── Already submitted — show breakdown ────────────────────────────
    if (existingSub?.is_complete) {
      // Parse JSON string answers from DB before storing in state
      const parsedAnswers = parseJsonField<Record<string, string>>(existingSub.answers, {})
      const parsedTpq     = parseJsonField<Record<string, number>>(existingSub.time_per_question, {})
      setSubmission({
        ...existingSub,
        answers:           parsedAnswers,
        time_per_question: parsedTpq,
      })
      setState('submitted')
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single()

    if (!profile?.username) {
      setState('username')
      return
    }

    if (existingSub) {
      // Parse stored answers for in-progress resume
      const parsedAnswers = parseJsonField<Record<string, string>>(existingSub.answers, {})
      setSubmission(existingSub)
      setAnswers(parsedAnswers)

      const remaining = getSecondsRemaining(
        existingSub.start_time,
        q.duration_minutes * 60
      )

      if (remaining <= 0) {
        doAutoSubmit(existingSub.id, parsedAnswers, q.duration_minutes * 60)
        return
      }

      setTimeLeft(remaining)
    } else {
      const { data: newSub } = await supabase
        .from('submissions')
        .insert({
          activity_id: params.id,
          user_id:     user.id,
          email:       user.email,
          username:    profile.username,
          start_time:  new Date().toISOString(),
        })
        .select()
        .single()

      setSubmission(newSub)
      setTimeLeft(q.duration_minutes * 60)
    }

    setState('quiz')
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadQuiz()
  }, [loadQuiz])

  // ── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'quiz' || !submission) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          doAutoSubmit(
            submissionRef.current.id,
            answersRef.current,
            quizRef.current.duration_minutes * 60
          )
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [state, submission]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SILENT SENTINEL (cheat detection) ─────────────────────────────────
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

    const handleVisibilityChange = () => { if (document.hidden) logViolation('TAB_SWITCH') }
    const handleBlur             = () => { logViolation('WINDOW_BLUR') }
    const handleFocus            = () => { logViolation('WINDOW_FOCUS') }
    const handleCopy             = () => { logViolation('COPY') }
    const handlePaste            = () => { logViolation('PASTE') }
    const handleContextMenu      = (e: MouseEvent) => { e.preventDefault(); logViolation('RIGHT_CLICK') }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur',            handleBlur)
    window.addEventListener('focus',           handleFocus)
    document.addEventListener('copy',          handleCopy)
    document.addEventListener('paste',         handlePaste)
    document.addEventListener('contextmenu',   handleContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur',           handleBlur)
      window.removeEventListener('focus',          handleFocus)
      document.removeEventListener('copy',         handleCopy)
      document.removeEventListener('paste',        handlePaste)
      document.removeEventListener('contextmenu',  handleContextMenu)
    }
  }, [state])

  // ── Manual submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSaving(true)

    const now = Date.now()
    const currentId = questions[currentQ]?.id
    if (currentId) {
      const delta = Math.floor((now - lastSwitchTimeRef.current) / 1000)
      if (delta > 0) {
        timeMapRef.current[currentId] = (timeMapRef.current[currentId] || 0) + delta
      }
    }

    const timePerQuestion = { ...timeMapRef.current }
    const finalAnswers    = { ...answersRef.current }
    const timeTaken       = Math.floor((now - new Date(submission.start_time).getTime()) / 1000)

    // ── CRITICAL DB UPDATE: answers + completion ───────────────────────
    // time_per_question is NOT included here — if that column doesn't exist
    // in the schema yet, including it would cause this entire update to fail,
    // losing the user's answers and leaving is_complete=false.
    const { error: criticalErr } = await supabase
      .from('submissions')
      .update({
        answers:            JSON.stringify(finalAnswers),
        // NOTE: is_complete intentionally NOT set here.
        // Setting is_complete=true before the API runs triggers the idempotency
        // check (is_complete=true + final_score=0 default) → API returns 0.
        // Only the API route sets is_complete=true, together with the real score.
        submission_time:    new Date().toISOString(),
        time_taken_seconds: timeTaken,
      })
      .eq('id', submission.id)

    if (criticalErr) {
      console.error('[handleSubmit] CRITICAL update failed:', criticalErr.message)
      // Still attempt the API call — it may succeed via adminClient
    }

    // ── NON-CRITICAL: save time_per_question separately ────────────────
    if (Object.keys(timePerQuestion).length > 0) {
      const { error: tpqErr } = await supabase
        .from('submissions')
        .update({ time_per_question: JSON.stringify(timePerQuestion) })
        .eq('id', submission.id)
      if (tpqErr) {
        console.warn('[handleSubmit] time_per_question not saved (column may not exist):', tpqErr.message)
      }
    }

    // ── Call API for authoritative scoring ─────────────────────────────
    const submitRes = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId:       submission.id,
        answers:            finalAnswers,
        submission_time:    new Date().toISOString(),
        time_taken_seconds: timeTaken,
        time_per_question:  timePerQuestion,
      }),
    })

    // ── READ the score back from API response and apply to UI ──────────
    // BUG FIX: previously we never read the response, so final_score was
    // always the stale pre-submission value (null/0) from the initial DB
    // load. The DB had the correct score but the UI never showed it.
    let apiScore: number | null = null
    if (submitRes.ok) {
      try {
        const resData = await submitRes.json()
        apiScore = typeof resData.score === 'number' ? resData.score : null
      } catch (e) {
        console.error('[handleSubmit] failed to parse API response:', e)
      }
    } else {
      console.error('[handleSubmit] API submit failed:', submitRes.status)
    }

    // Update local submission state with real answers + score
    setSubmission((prev: any) => ({
      ...prev,
      answers:           finalAnswers,
      time_per_question: timePerQuestion,
      final_score:       apiScore,   // ← the fix: show the real score immediately
    }))
    setSaving(false)
    setState('submitted')
  }

  // ── Username setup ─────────────────────────────────────────────────────
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

  // ── Loading ────────────────────────────────────────────────────────────
  if (state === 'loading') return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', margin: '0 auto 16px', border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366f1', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#475569', fontSize: '0.875rem' }}>Loading quiz…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ── SUBMITTED: full per-question breakdown ─────────────────────────────
  if (state === 'submitted') {
    // submission.answers may be a JS object (just submitted) OR a JSON string
    // (loaded from DB on refresh). Always parse safely.
    const subAnswers = parseJsonField<Record<string, string>>(submission?.answers, {})
    const timeMap    = parseJsonField<Record<string, number>>(submission?.time_per_question, {})

    const finalScore  = submission?.final_score ?? null
    const hasBreakdown = questions.length > 0

    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9' }}>

        {/* ── Top bar ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(2,6,23,0.95)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(148,163,184,0.08)',
          padding: '0 1rem',
        }}>
          <div style={{ maxWidth: 720, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ fontSize: '1.1rem' }}>🎉</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activity?.title ?? 'Quiz Submitted!'}
                </p>
                <p style={{ color: '#475569', fontSize: '0.72rem', marginTop: 1 }}>Results below</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/')}
              style={{
                padding: '7px 16px', borderRadius: 8,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                border: 'none', color: '#fff', fontWeight: 600,
                fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
              }}
            >
              Home
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>

          {/* ── Score summary card ── */}
          <div style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 16, padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem',
            }}>🎯</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Your Score
              </p>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.8rem', color: '#f1f5f9', lineHeight: 1 }}>
                {finalScore != null ? finalScore : '—'}
              </p>
            </div>
            {hasBreakdown && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Answered
                </p>
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.2rem', color: '#e2e8f0' }}>
                  {Object.values(subAnswers).filter(Boolean).length}
                  <span style={{ color: '#475569', fontSize: '0.875rem', fontWeight: 400 }}> / {questions.length}</span>
                </p>
              </div>
            )}
          </div>

          {/* ── Per-question breakdown ── */}
          {hasBreakdown ? (
            <>
              <p style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Question Breakdown
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {questions.map((qItem: any, idx: number) => {
                  const rawAnswer    = subAnswers[qItem.id]
                  const userDisplay  = decodeUserAnswer(qItem, rawAnswer)
                  const correctDisp  = decodeCorrectAnswer(qItem)
                  const isCorrect    = checkIsCorrect(qItem, rawAnswer)
                  const notAnswered  = !rawAnswer && rawAnswer !== '0'
                  const timeSpent    = timeMap[qItem.id] ?? 0
                  const qStat        = qStats[qItem.id]

                  const borderLeft = notAnswered
                    ? '3px solid rgba(245,158,11,0.5)'
                    : isCorrect
                      ? '3px solid rgba(34,197,94,0.5)'
                      : '3px solid rgba(239,68,68,0.4)'

                  return (
                    <div
                      key={qItem.id}
                      style={{
                        background: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(148,163,184,0.08)',
                        borderLeft,
                        borderRadius: '0 12px 12px 0',
                        padding: '14px 16px',
                      }}
                    >
                      {/* Q header row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                          <span style={{
                            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
                            color: '#818cf8', borderRadius: 5, padding: '2px 7px',
                            fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                          }}>
                            Q{idx + 1}
                          </span>
                          {qItem.type?.includes('mcq') && (
                            <span style={{
                              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                              color: '#a78bfa', borderRadius: 4, padding: '2px 6px',
                              fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                            }}>MCQ</span>
                          )}
                          <span style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5 }}>
                            {qItem.text}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span title={notAnswered ? 'Not answered' : isCorrect ? 'Correct' : 'Incorrect'} style={{ fontSize: '1rem' }}>
                            {notAnswered ? '⚪' : isCorrect ? '✅' : '❌'}
                          </span>
                          <span style={{
                            color: '#475569', fontSize: '0.72rem',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(148,163,184,0.08)',
                            borderRadius: 5, padding: '2px 7px',
                            fontFamily: 'monospace',
                          }}>
                            ⏱ {timeSpent}s
                            <QTime you={timeMap[qItem.id]} stat={qStat} />
                          </span>
                        </div>
                      </div>

                      {/* Answer comparison */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="breakdown-answer-grid">
                        <div style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${notAnswered ? 'rgba(245,158,11,0.15)' : isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                          borderRadius: 8, padding: '8px 10px',
                        }}>
                          <p style={{ color: '#475569', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                            Your Answer
                          </p>
                          <p style={{
                            fontSize: '0.82rem', fontWeight: 500,
                            color: notAnswered ? '#64748b' : isCorrect ? '#4ade80' : '#f87171',
                            fontStyle: notAnswered ? 'italic' : 'normal',
                            wordBreak: 'break-word',
                          }}>
                            {notAnswered ? 'Not Answered' : (isCorrect ? '✓ ' : '✗ ')}{notAnswered ? '' : userDisplay}
                          </p>
                        </div>
                        <div style={{
                          background: 'rgba(34,197,94,0.04)',
                          border: '1px solid rgba(34,197,94,0.12)',
                          borderRadius: 8, padding: '8px 10px',
                        }}>
                          <p style={{ color: '#475569', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                            Correct Answer
                          </p>
                          <p style={{ fontSize: '0.82rem', fontWeight: 500, color: '#4ade80', wordBreak: 'break-word' }}>
                            {correctDisp}
                          </p>
                        </div>
                      </div>

                      {/* MCQ: show all options */}
                      {qItem.type?.includes('mcq') && Array.isArray(qItem.options) && qItem.options.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {qItem.options.map((opt: string, optIdx: number) => {
                            const isCorrectOpt = optIdx === (qItem.correct_option ?? -1)
                            const isUserChoice  = rawAnswer === String(optIdx)
                            return (
                              <span key={optIdx} style={{
                                padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem',
                                background: isCorrectOpt
                                  ? 'rgba(34,197,94,0.1)'
                                  : isUserChoice && !isCorrectOpt
                                    ? 'rgba(239,68,68,0.08)'
                                    : 'rgba(255,255,255,0.03)',
                                border: isCorrectOpt
                                  ? '1px solid rgba(34,197,94,0.25)'
                                  : isUserChoice && !isCorrectOpt
                                    ? '1px solid rgba(239,68,68,0.2)'
                                    : '1px solid rgba(148,163,184,0.06)',
                                color: isCorrectOpt ? '#4ade80' : isUserChoice && !isCorrectOpt ? '#f87171' : '#475569',
                                fontWeight: isCorrectOpt || isUserChoice ? 600 : 400,
                              }}>
                                {String.fromCharCode(65 + optIdx)}. {opt}
                                {isCorrectOpt && ' ✓'}
                                {isUserChoice && !isCorrectOpt && ' ✗'}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
              <p style={{ fontSize: '1rem', color: '#e2e8f0', marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>Quiz Submitted!</p>
              <p>Your responses have been recorded. Good luck!</p>
            </div>
          )}

          {/* ── Bottom CTA ── */}
          <div style={{ display: 'flex', gap: 10, marginTop: '2rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/')}
              style={{
                flex: 1, padding: '11px', borderRadius: 10,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                border: 'none', color: '#fff', fontWeight: 700,
                fontSize: '0.9rem', cursor: 'pointer', minHeight: 44,
              }}
            >
              Back to Home
            </button>
            <button
              onClick={() => router.push('/leaderboard')}
              style={{
                padding: '11px 20px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(148,163,184,0.12)',
                color: '#94a3b8', fontWeight: 600,
                fontSize: '0.9rem', cursor: 'pointer', minHeight: 44,
              }}
            >
              Leaderboard
            </button>
          </div>
        </div>

        <style>{`
          @media (max-width: 480px) {
            .breakdown-answer-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    )
  }

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
      <div style={{ maxWidth: 440, width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: '2rem' }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 99, marginBottom: '1.5rem' }} />
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.3rem', color: '#f1f5f9', marginBottom: 6 }}>Choose your username</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>Displayed on the leaderboard. <strong style={{ color: '#e2e8f0' }}>Cannot be changed later.</strong></p>
        <input placeholder="e.g. coolplayer42" value={newUsername} onChange={e => setNewUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSetUsername()} maxLength={20} autoFocus style={{ width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 10, padding: '11px 14px', color: '#f1f5f9', fontSize: '0.95rem', outline: 'none', marginBottom: 10 }} />
        {usernameError && <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: 10 }}>{usernameError}</p>}
        <button onClick={handleSetUsername} disabled={newUsername.trim().length < 3} style={{ width: '100%', padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: newUsername.trim().length < 3 ? 'not-allowed' : 'pointer', opacity: newUsername.trim().length < 3 ? 0.5 : 1, minHeight: 44 }}>Confirm & Start Quiz →</button>
      </div>
    </div>
  )

  // ── Main quiz UI ───────────────────────────────────────────────────────
  const qIsMcq = q?.type?.includes('mcq') ?? false
  const qOptions: string[] = Array.isArray(q?.options) ? q.options : []

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9' }}>

      {/* ── STICKY HEADER BAR ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(2,6,23,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(148,163,184,0.08)', padding: '0 1rem' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity?.title}</p>
            <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 1 }}>Q{currentQ + 1}/{questions.length} · {answered} answered</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 10, background: urgent ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)', border: `1px solid ${urgent ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.2)'}`, transition: 'all 0.5s', flexShrink: 0 }}>
            <span style={{ fontSize: '0.85rem' }}>⏱</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: urgent ? '#f87171' : '#818cf8', animation: urgent ? 'timerPulse 1s ease-in-out infinite' : 'none' }}>{mins}:{secs}</span>
          </div>
          <span style={{ color: '#334155', fontSize: '0.72rem', fontFamily: 'monospace', flexShrink: 0 }}>{currentQ + 1}/{questions.length}</span>
        </div>
        <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', margin: '0 1rem' }}>
          <div style={{ height: '100%', background: urgent ? 'linear-gradient(90deg,#ef4444,#f87171)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)', width: `${((currentQ + 1) / Math.max(questions.length, 1)) * 100}%`, transition: 'width 0.3s ease, background 0.5s', borderRadius: 99 }} />
        </div>
      </div>

      {/* ── QUESTION CONTENT ── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem 6rem' }}>
        {q ? (
          <>
            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 16, padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.875rem' }}>
                <span style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', borderRadius: 7, padding: '3px 9px', fontSize: '0.72rem', fontWeight: 700 }}>Q{currentQ + 1}</span>
                {q.weightage > 1 && <span style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 600 }}>{q.weightage} pts</span>}
                {qIsMcq && <span style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', borderRadius: 5, padding: '2px 7px', fontSize: '0.68rem', fontWeight: 700 }}>MCQ</span>}
              </div>
              {q.image_url && <img src={q.image_url} alt="Question image" style={{ width: '100%', height: 'auto', borderRadius: 10, marginBottom: '1rem', display: 'block', maxHeight: 360, objectFit: 'contain' }} />}
              <p style={{ fontSize: '1rem', lineHeight: 1.7, color: '#e2e8f0', fontWeight: 400, marginBottom: '1.25rem' }}>{q.text}</p>
              {qIsMcq ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {qOptions.map((opt: string, idx: number) => {
                    const idxStr = String(idx)
                    const selected = answers[q.id] === idxStr
                    return (
                      <button key={idx} onClick={() => updateAnswer(q.id, idxStr)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: selected ? 'rgba(99,102,241,0.15)' : 'rgba(2,6,23,0.5)', border: selected ? '1.5px solid rgba(99,102,241,0.55)' : '1.5px solid rgba(148,163,184,0.1)', color: selected ? '#e2e8f0' : '#94a3b8', fontSize: '0.95rem', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', width: '100%' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: selected ? '#6366f1' : 'rgba(148,163,184,0.1)', color: selected ? '#fff' : '#64748b', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.15s' }}>{String.fromCharCode(65 + idx)}</span>
                        {opt}
                      </button>
                    )
                  })}
                  {qOptions.length === 0 && <p style={{ color: '#475569', fontSize: '0.85rem', fontStyle: 'italic' }}>No options configured for this question.</p>}
                </div>
              ) : (
                <textarea value={answers[q.id] || ''}
                  onChange={e => updateAnswer(q.id, e.target.value)}
                  placeholder="Type your answer here…" rows={4}
                  style={{ width: '100%', resize: 'vertical', background: 'rgba(2,6,23,0.7)', border: '1.5px solid rgba(148,163,184,0.1)', borderRadius: 12, padding: '12px 14px', color: '#f1f5f9', fontSize: '0.95rem', lineHeight: 1.6, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(148,163,184,0.1)'; e.target.style.boxShadow = 'none' }}
                />
              )}
            </div>

            <div className="quiz-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <button disabled={currentQ === 0} onClick={() => setCurrentQ(p => p - 1)} style={{ padding: '10px 16px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(148,163,184,0.12)', color: currentQ === 0 ? '#1e293b' : '#94a3b8', cursor: currentQ === 0 ? 'default' : 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s', minHeight: 44, flexShrink: 0 }}>← Prev</button>
              <div className="quiz-nav-dots" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', flex: 1 }}>
                {questions.map((_, i) => {
                  const isAnswered = !!answers[questions[i].id]
                  const isCurrent = i === currentQ
                  return <button key={i} onClick={() => setCurrentQ(i)} title={`Q${i + 1}`} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, background: isCurrent ? '#6366f1' : isAnswered ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', color: isCurrent ? '#fff' : isAnswered ? '#4ade80' : '#475569', outline: isCurrent ? '2px solid rgba(99,102,241,0.4)' : 'none', outlineOffset: 2, transition: 'all 0.15s', minHeight: 30 }}>{i + 1}</button>
                })}
              </div>
              {currentQ < questions.length - 1 ? (
                <button onClick={() => setCurrentQ(p => p + 1)} style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, transition: 'all 0.15s', minHeight: 44, flexShrink: 0 }}>Next →</button>
              ) : (
                <button onClick={handleSubmit} disabled={saving} style={{ padding: '10px 18px', borderRadius: 10, background: saving ? 'rgba(34,197,94,0.4)' : 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 700, boxShadow: '0 4px 16px rgba(34,197,94,0.25)', transition: 'all 0.15s', minHeight: 44, opacity: saving ? 0.7 : 1, flexShrink: 0 }}>{saving ? 'Submitting…' : '✓ Submit'}</button>
              )}
            </div>
            <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.72rem', marginTop: '1rem' }}>{answered} of {questions.length} answered</p>
          </>
        ) : (
          <p style={{ color: '#475569', textAlign: 'center', paddingTop: '4rem' }}>No questions found.</p>
        )}
      </div>

      <style>{`
        @keyframes timerPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 540px) {
          .quiz-nav { flex-wrap: wrap; gap: 10px; }
          .quiz-nav-dots { flex-basis: 100%; order: -1; flex: none; }
        }
      `}</style>
    </div>
  )
}

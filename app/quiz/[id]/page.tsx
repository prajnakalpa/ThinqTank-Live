// app/quiz/[id]/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSecondsRemaining, formatTime, formatDuration } from '@/lib/quiz-state'

interface Props { params: { id: string } }

export default function QuizPage({ params }: Props) {
  const [state, setState] = useState<'loading'|'username'|'quiz'|'submitted'|'closed'|'error'>('loading')
  const [activity, setActivity] = useState<any>(null)
  const [quiz, setQuiz] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submission, setSubmission] = useState<any>(null)
  const [username, setUsername] = useState('')
  const [timeLeft, setTimeLeft] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [currentQ, setCurrentQ] = useState(0)

  const router = useRouter()
  const supabase = createClient()

  const timerRef = useRef<NodeJS.Timeout>()
  const autosaveRef = useRef<NodeJS.Timeout>()
  const answersRef = useRef<Record<string, string>>({})
  const submissionRef = useRef<any>(null)
  const quizRef = useRef<any>(null)
  const submittingRef = useRef(false)

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { submissionRef.current = submission }, [submission])
  useEffect(() => { quizRef.current = quiz }, [quiz])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearInterval(autosaveRef.current)
    }
  }, [])

  const loadQuiz = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/login?redirect=/quiz/${params.id}`); return }

    const { data: act } = await supabase
      .from('activities')
      .select('*, quizzes(*, questions(*))')
      .eq('id', params.id)
      .single()

    if (!act) { setState('error'); return }
    if (act.status === 'closed' || act.status === 'archived') { setState('closed'); return }

    setActivity(act)
    const q = act.quizzes
    setQuiz(q)
    quizRef.current = q

    const qs = (q?.questions ?? []).sort((a: any, b: any) => a.order_index - b.order_index)
    setQuestions(qs)

    const { data: existingSub } = await supabase
      .from('submissions')
      .select('*')
      .eq('activity_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (existingSub?.is_complete) { setState('submitted'); setSubmission(existingSub); return }

    const { data: profile } = await supabase
      .from('users')
      .select('username, username_locked')
      .eq('id', user.id)
      .single()

    if (!profile?.username) { setState('username'); return }
    setUsername(profile.username)

    if (existingSub) {
      setSubmission(existingSub)
      submissionRef.current = existingSub
      const savedAnswers = existingSub.answers ?? {}
      setAnswers(savedAnswers)
      answersRef.current = savedAnswers
      const remaining = getSecondsRemaining(existingSub.start_time, q.duration_minutes * 60)
      if (remaining === 0) {
        await doAutoSubmit(existingSub.id, savedAnswers, q.duration_minutes * 60)
        return
      }
      setTimeLeft(remaining)
    } else {
      const { data: newSub } = await supabase
        .from('submissions')
        .insert({
          activity_id: params.id,
          user_id: user.id,
          email: user.email,
          username: profile.username,
          start_time: new Date().toISOString(),
        })
        .select()
        .single()

      setSubmission(newSub)
      submissionRef.current = newSub
      setTimeLeft(q.duration_minutes * 60)
    }

    setState('quiz')
  }, [params.id])

  useEffect(() => { loadQuiz() }, [loadQuiz])

  useEffect(() => {
    if (state !== 'quiz' || !submission) return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)

          const sub = submissionRef.current
          const q = quizRef.current

          if (sub?.id) {
            doAutoSubmit(sub.id, answersRef.current, q?.duration_minutes * 60)
          }

          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [state, submission?.id])

  useEffect(() => {
    if (state !== 'quiz') return

    autosaveRef.current = setInterval(async () => {
      const sub = submissionRef.current
      if (!sub?.id || sub?.is_complete) return

      setSaving(true)
      await supabase.from('submissions')
        .update({ answers: answersRef.current })
        .eq('id', sub.id)
      setSaving(false)
    }, 30000)

    return () => clearInterval(autosaveRef.current)
  }, [state])

  const doAutoSubmit = async (subId: string, currentAnswers: Record<string, string>, durationSeconds: number) => {
    if (submittingRef.current) return
    submittingRef.current = true

    await supabase.from('submissions').update({
      answers: currentAnswers,
      is_complete: true,
      submission_time: new Date().toISOString(),
      time_taken_seconds: durationSeconds,
    }).eq('id', subId)

    await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: subId }),
    })

    setState('submitted')
  }

  const handleSubmit = async () => {
    const sub = submissionRef.current
    if (!sub?.id) return
    if (submittingRef.current) return
    submittingRef.current = true

    setSaving(true)

    const timeTaken = Math.floor((Date.now() - new Date(sub.start_time).getTime()) / 1000)

    await supabase.from('submissions').update({
      answers: answersRef.current,
      is_complete: true,
      submission_time: new Date().toISOString(),
      time_taken_seconds: timeTaken,
    }).eq('id', sub.id)

    const res = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: sub.id }),
    })

    if (!res.ok) {
      setSubmitError('Submit failed. Try again.')
      setSaving(false)
      submittingRef.current = false
      return
    }

    const { score } = await res.json()
    setSubmission((prev: any) => ({ ...prev, final_score: score }))
    setState('submitted')
    setSaving(false)
  }

  // UI untouched below ↓↓↓
  return <div />
}

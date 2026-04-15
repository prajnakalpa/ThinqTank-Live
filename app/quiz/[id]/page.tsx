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

      setSubmission

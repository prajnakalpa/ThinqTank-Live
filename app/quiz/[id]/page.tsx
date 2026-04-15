// app/quiz/[id]/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSecondsRemaining, formatTime } from '@/lib/quiz-state'

interface Props { params: { id: string } }

export default function QuizPage({ params }: Props) {
  const [state, setState] = useState<'loading'|'username'|'quiz'|'submitted'|'closed'|'error'>('loading')
  // FIX: added activity state so we can show the title (quiz row has no title field)
  const [activity, setActivity] = useState<any>(null)
  const [quiz, setQuiz] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submission, setSubmission] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [saving, setSaving] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  // FIX: username field for the username-entry state
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')

  const router = useRouter()
  const supabase = createClient()

  // Refs to prevent stale closures (The "Critical Bug" Fix)
  const timerRef = useRef<NodeJS.Timeout>()
  const answersRef = useRef<Record<string, string>>({})
  const submissionRef = useRef<any>(null)
  const quizRef = useRef<any>(null)
  const submittingRef = useRef(false)

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { submissionRef.current = submission }, [submission])
  useEffect(() => { quizRef.current = quiz }, [quiz])

  const doAutoSubmit = async (subId: string, currentAnswers: Record<string, string>, duration: number) => {
    if (submittingRef.current) return
    submittingRef.current = true
    
    await supabase.from('submissions').update({
      answers: currentAnswers,
      is_complete: true,
      submission_time: new Date().toISOString(),
      time_taken_seconds: duration,
    }).eq('id', subId)

    await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: subId }),
    })
    setState('submitted')
  }

  const loadQuiz = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/login?redirect=/quiz/${params.id}`); return }

    const { data: act } = await supabase
      .from('activities').select('*, quizzes(*, questions(*))')
      .eq('id', params.id).single()

    if (!act || act.status === 'closed') { setState('closed'); return }

    // FIX: store the activity so we can show its title
    setActivity(act)

    const q = act.quizzes
    setQuiz(q)
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
      if (remaining <= 0) {
        doAutoSubmit(existingSub.id, existingSub.answers ?? {}, q.duration_minutes * 60)
        return
      }
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

  // Timer loop
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

  const handleSubmit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSaving(true)
    
    const timeTaken = Math.floor((Date.now() - new Date(submission.start_time).getTime()) / 1000)
    await supabase.from('submissions').update({
      answers: answersRef.current,
      is_complete: true,
      submission_time: new Date().toISOString(),
      time_taken_seconds: timeTaken,
    }).eq('id', submission.id)

    await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: submission.id }),
    })
    setState('submitted')
  }

  // FIX: username submission handler
  const handleSetUsername = async () => {
    const trimmed = newUsername.trim()
    if (trimmed.length < 3) { setUsernameError('Username must be at least 3 characters.'); return }
    setUsernameError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('users')
      .update({ username: trimmed, username_locked: true })
      .eq('id', user.id)
    if (error?.code === '23505') { setUsernameError('Username taken. Try another.'); return }
    // Re-run load so quiz starts with the newly set username
    loadQuiz()
  }

  // --- UI RENDERING ---

  if (state === 'loading') return <div className="p-20 text-center">Loading Quiz...</div>

  if (state === 'submitted') return (
    <div className="p-20 text-center">
      <h1 className="text-3xl font-bold mb-4">Quiz Submitted!</h1>
      <p>Thank you for participating.</p>
      <button onClick={() => router.push('/')} className="mt-6 bg-blue-600 px-6 py-2 rounded">Go Home</button>
    </div>
  )

  // FIX: handle 'closed' state
  if (state === 'closed') return (
    <div className="p-20 text-center">
      <h1 className="text-3xl font-bold mb-4">Quiz Closed</h1>
      <p className="text-gray-400">This quiz is no longer accepting submissions.</p>
      <button onClick={() => router.push('/live')} className="mt-6 bg-blue-600 px-6 py-2 rounded">Back to Live</button>
    </div>
  )

  // FIX: handle 'error' state
  if (state === 'error') return (
    <div className="p-20 text-center">
      <h1 className="text-3xl font-bold mb-4">Quiz Not Found</h1>
      <p className="text-gray-400">This quiz does not exist or is unavailable.</p>
      <button onClick={() => router.push('/live')} className="mt-6 bg-blue-600 px-6 py-2 rounded">Back to Live</button>
    </div>
  )

  // FIX: handle 'username' state — user must choose a username before starting
  if (state === 'username') return (
    <div className="min-h-screen bg-[#050a18] text-white flex items-center justify-center p-6">
      <div className="bg-[#0f172a] border border-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">Choose your username</h1>
        <p className="text-gray-400 text-sm mb-6">
          This will appear on the leaderboard.{' '}
          <strong className="text-white">Cannot be changed later.</strong>
        </p>
        <input
          className="w-full bg-black/50 border border-gray-700 rounded-xl p-3 focus:border-blue-500 outline-none transition mb-3"
          placeholder="e.g. coolplayer42"
          value={newUsername}
          onChange={e => setNewUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSetUsername()}
          maxLength={20}
          autoFocus
        />
        {usernameError && <p className="text-red-400 text-sm mb-3">{usernameError}</p>}
        <button
          onClick={handleSetUsername}
          disabled={newUsername.trim().length < 3}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-2 rounded-lg font-bold transition"
        >
          Confirm & Start Quiz
        </button>
      </div>
    </div>
  )

  const q = questions[currentQ]

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        
        {/* Header — FIX: use activity?.title instead of quiz?.title */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-xl font-bold">Question {currentQ + 1} of {questions.length}</h1>
            <p className="text-gray-400 text-sm">{activity?.title}</p>
          </div>
          <div className={`text-xl font-mono ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        </div>

        {/* Question Area */}
        {q && (
          <div className="bg-[#0f172a] border border-gray-800 p-8 rounded-2xl shadow-xl">
            <h2 className="text-2xl mb-8 leading-relaxed">{q.text}</h2>
            
            <textarea
              className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 h-40 focus:border-blue-500 outline-none transition"
              placeholder="Type your answer here..."
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <button
            disabled={currentQ === 0}
            onClick={() => setCurrentQ(prev => prev - 1)}
            className="px-6 py-2 text-gray-400 disabled:opacity-0"
          >
            Previous
          </button>

          {currentQ < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQ(prev => prev + 1)}
              className="bg-blue-600 hover:bg-blue-500 px-8 py-2 rounded-lg font-bold transition"
            >
              Next Question
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-green-600 hover:bg-green-500 px-10 py-2 rounded-lg font-bold transition shadow-lg shadow-green-900/20"
            >
              {saving ? 'Submitting...' : 'Finish & Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

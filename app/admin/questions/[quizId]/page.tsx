'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Q {
  id?: string
  text: string
  correct_answer: string
  accepted_keywords: string[]
  synonyms: string[]
  weightage: number
  strictness_level: string
  order_index: number
  type?: string
}

const blank = (): Q => ({
  text: '',
  correct_answer: '',
  accepted_keywords: [],
  synonyms: [],
  weightage: 1,
  strictness_level: 'medium',
  order_index: 0,
  type: 'objective_text',
})

export default function QuestionsPage({ params }: { params: { quizId: string } }) {
  const [questions, setQuestions] = useState<Q[]>([])
  const [editing, setEditing]     = useState<Q | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [title, setTitle]         = useState('')
  const supabase = createClient()

  const getRealQuizId = async () => {
    const { data } = await supabase
      .from('quizzes')
      .select('id, activities(title)')
      .eq('activity_id', params.quizId)
      .single()

    if (data?.activities) setTitle((data.activities as any).title)
    return data?.id ?? params.quizId
  }

  useEffect(() => {
    const load = async () => {
      const qid = await getRealQuizId()
      const { data } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', qid)
        .order('order_index')

      setQuestions(data ?? [])
      setLoading(false)
    }
    load()
  }, [params.quizId])

  const save = async () => {
    if (!editing?.text) return

    setSaving(true)
    const qid = await getRealQuizId()

    if (editing.id) {
      const { data } = await supabase
        .from('questions')
        .update(editing)
        .eq('id', editing.id)
        .select()
        .single()

      setQuestions(p => p.map(q => q.id === editing.id ? data as Q : q))
    } else {
      const { data } = await supabase
        .from('questions')
        .insert({ ...editing, quiz_id: qid, order_index: questions.length })
        .select()
        .single()

      setQuestions(p => [...p, data as Q])
    }

    setEditing(null)
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Delete?')) return
    await supabase.from('questions').delete().eq('id', id)
    setQuestions(p => p.filter(q => q.id !== id))
  }

  const F = (k: string, v: any) =>
    setEditing(p => p ? { ...p, [k]: v } : null)

  const parseList = (v: string) =>
    v.split(',').map(s => s.trim()).filter(Boolean)

  if (loading) return <div />

  return (
    <div>
      <h1>Questions</h1>

      <button onClick={() => setEditing(blank())}>
        + Add Question
      </button>

      {questions.map((q, i) => (
        <div key={q.id}>
          <p>{i + 1}. {q.text}</p>
          <p>{q.type}</p>

          <button onClick={() => setEditing(q)}>Edit</button>
          <button onClick={() => del(q.id!)}>Delete</button>
        </div>
      ))}

      {editing && (
        <div>

          <textarea
            value={editing.text}
            onChange={e => F('text', e.target.value)}
          />

          {/* QUIZ TYPE DROPDOWN */}
          <select
            value={editing.type}
            onChange={e => F('type', e.target.value)}
          >
            <option value="objective_text">Objective Text</option>
            <option value="objective_media">Objective Media</option>
            <option value="mcq_text">MCQ Text</option>
            <option value="mcq_media">MCQ Media</option>
          </select>

          {/* CONDITIONAL UI */}
          {editing.type?.includes('mcq') ? (
            <div>MCQ options coming next</div>
          ) : (
            <input
              value={editing.correct_answer}
              onChange={e => F('correct_answer', e.target.value)}
              placeholder="Correct answer"
            />
          )}

          <input
            value={editing.accepted_keywords.join(',')}
            onChange={e => F('accepted_keywords', parseList(e.target.value))}
          />

          <button onClick={save}>Save</button>
        </div>
      )}
    </div>
  )
}

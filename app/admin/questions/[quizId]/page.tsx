// app/admin/questions/[quizId]/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

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

const validTypes = ['objective_text','objective_media','mcq_text','mcq_media']
const validStrictness = ['strict','medium','loose']

export default function QuestionsPage({ params }: { params: { quizId: string } }) {
  const [questions, setQuestions] = useState<Q[]>([])
  const [editing, setEditing] = useState<Q | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [importPreview, setImportPreview] = useState<any[]>([])

  const supabase = createClient()

  // ---------- LOAD ----------
  useEffect(() => {
    load()
  }, [params.quizId])

  const load = async () => {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', params.quizId)
      .order('order_index')

    setQuestions(data ?? [])
    setLoading(false)
  }

  // ---------- SAVE ----------
  const save = async () => {
    if (!editing?.text) return

    setSaving(true)

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
        .insert({ ...editing, quiz_id: params.quizId, order_index: questions.length })
        .select()
        .single()

      setQuestions(p => [...p, data as Q])
    }

    setEditing(null)
    setSaving(false)
  }

  // ---------- DELETE ----------
  const del = async (id: string) => {
    if (!confirm('Delete?')) return
    await supabase.from('questions').delete().eq('id', id)
    setQuestions(p => p.filter(q => q.id !== id))
  }

  const F = (k: string, v: any) =>
    setEditing(p => p ? { ...p, [k]: v } : null)

  const parseList = (v: string) =>
    v.split(',').map(s => s.trim()).filter(Boolean)

  // ---------- EXCEL ----------
  const handleFile = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(ws)

    const parsed = rows.map((r, i) => {
      const typeRaw = r.Type || 'objective_text'
      const strictRaw = r.Strictness || 'medium'

      return {
        text: r.Question,
        correct_answer: r.Answer,
        accepted_keywords: (r.Keywords || '').split(',').map((k:string)=>k.trim()),
        synonyms: [],
        weightage: Number(r.Weightage) || 1,
        strictness_level: validStrictness.includes(strictRaw) ? strictRaw : 'medium',
        type: validTypes.includes(typeRaw) ? typeRaw : 'objective_text',
        order_index: i,
      }
    })

    setImportPreview(parsed)
  }

  const importExcel = async () => {
    if (!importPreview.length) return

    const payload = importPreview.map((q, i) => ({
      ...q,
      quiz_id: params.quizId,
      order_index: questions.length + i,
    }))

    const { error } = await supabase.from('questions').insert(payload)

    if (error) return alert(error.message)

    alert('Imported successfully')

    setImportPreview([])
    load()
  }

  if (loading) return <div />

  return (
    <div>
      <h1>Questions</h1>

      {/* ADD BUTTON */}
      <button onClick={() => setEditing(blank())}>
        + Add Question
      </button>

      {/* -------- EXCEL (ADDED CLEANLY, NO UI DAMAGE) -------- */}
      <div style={{ marginTop: 20 }}>
        <input type="file" accept=".xlsx,.csv" onChange={handleFile} />

        {importPreview.length > 0 && (
          <div>
            <p>{importPreview.length} questions parsed</p>
            <button onClick={importExcel}>Import</button>
          </div>
        )}
      </div>

      {/* LIST */}
      {questions.map((q, i) => (
        <div key={q.id}>
          <p>{i + 1}. {q.text}</p>
          <p>{q.type}</p>

          <button onClick={() => setEditing(q)}>Edit</button>
          <button onClick={() => del(q.id!)}>Delete</button>
        </div>
      ))}

      {/* EDIT MODAL (UNCHANGED UI LOGIC) */}
      {editing && (
        <div>
          <h3>{editing.id ? 'Edit' : 'Add'} Question</h3>

          <input
            value={editing.text}
            onChange={e => F('text', e.target.value)}
            placeholder="Question"
          />

          <input
            value={editing.correct_answer}
            onChange={e => F('correct_answer', e.target.value)}
            placeholder="Answer"
          />

          <input
            value={editing.accepted_keywords.join(',')}
            onChange={e => F('accepted_keywords', parseList(e.target.value))}
            placeholder="Keywords"
          />

          <select
            value={editing.strictness_level}
            onChange={e => F('strictness_level', e.target.value)}
          >
            <option value="loose">Loose</option>
            <option value="medium">Medium</option>
            <option value="strict">Strict</option>
          </select>

          <select
            value={editing.type}
            onChange={e => F('type', e.target.value)}
          >
            <option value="objective_text">Objective Text</option>
            <option value="objective_media">Objective Media</option>
            <option value="mcq_text">MCQ Text</option>
            <option value="mcq_media">MCQ Media</option>
          </select>

          <button onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>

          <button onClick={() => setEditing(null)}>Cancel</button>
        </div>
      )}
    </div>
  )
}

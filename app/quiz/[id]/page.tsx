// app/quiz/[id]/page.tsx
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

const validTypes = ['objective_text', 'objective_media', 'mcq_text', 'mcq_media']
const validStrictness = ['strict', 'medium', 'loose']

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
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Q | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [importPreview, setImportPreview] = useState<Q[]>([])

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

  useEffect(() => { load() }, [params.quizId])

  const save = async () => {
    if (!editing?.text) return
    setSaving(true)
    const qid = await getRealQuizId()

    const payload = { ...editing, quiz_id: qid }
    delete payload.id // Don't send ID for inserts

    if (editing.id) {
      const { data } = await supabase
        .from('questions')
        .update(payload)
        .eq('id', editing.id)
        .select().single()
      setQuestions(p => p.map(q => q.id === editing.id ? data as Q : q))
    } else {
      const { data } = await supabase
        .from('questions')
        .insert({ ...payload, order_index: questions.length })
        .select().single()
      setQuestions(p => [...p, data as Q])
    }
    setEditing(null)
    setSaving(false)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(ws)

    const parsed: Q[] = rows.map((r, i) => ({
      text: r.Question || '',
      correct_answer: r.Answer || '',
      accepted_keywords: r.Keywords ? r.Keywords.split(',').map((s: string) => s.trim()) : [],
      synonyms: r.Synonyms ? r.Synonyms.split(',').map((s: string) => s.trim()) : [],
      type: validTypes.includes(r.Type) ? r.Type : 'objective_text',
      strictness_level: validStrictness.includes(r.Strictness) ? r.Strictness : 'medium',
      weightage: Number(r.Weightage) || 1,
      order_index: questions.length + i,
    }))
    setImportPreview(parsed)
  }

  const bulkUpload = async () => {
    setSaving(true)
    const qid = await getRealQuizId()
    const { data } = await supabase.from('questions').insert(importPreview.map(q => ({ ...q, quiz_id: qid }))).select()
    if (data) setQuestions(p => [...p, ...(data as Q[])])
    setImportPreview([]); setSaving(false)
  }

  if (loading) return <div className="p-8 text-white">Loading...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Questions for {title}</h1>
        <div className="flex gap-4">
          <button onClick={() => setEditing(blank())} className="bg-blue-600 px-4 py-2 rounded font-semibold">+ Add Question</button>
          <div className="bg-gray-800 p-2 rounded border border-gray-700">
            <input type="file" onChange={handleFile} className="text-xs" />
          </div>
        </div>
      </div>

      {importPreview.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-500 p-4 mb-6 rounded flex justify-between items-center">
          <span>{importPreview.length} questions ready.</span>
          <div className="flex gap-2">
            <button onClick={bulkUpload} className="bg-green-600 px-3 py-1 rounded text-sm">Confirm Bulk Upload</button>
            <button onClick={() => setImportPreview([])} className="bg-gray-700 px-3 py-1 rounded text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-gray-900 border border-gray-800 p-4 rounded-lg flex justify-between items-center">
            <div>
              <span className="text-gray-500 mr-2">{i + 1}.</span>
              <span className="font-medium">{q.text}</span>
              <div className="text-xs text-gray-400 mt-1 flex gap-4">
                <span>Type: {q.type}</span>
                <span>Weight: {q.weightage}</span>
                <span>Strictness: {q.strictness_level}</span>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setEditing(q)} className="text-blue-400 hover:underline">Edit</button>
              <button onClick={async () => { if(confirm('Delete?')) { await supabase.from('questions').delete().eq('id', q.id); setQuestions(p => p.filter(x => x.id !== q.id)) }}} className="text-red-400 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-xl w-full max-w-2xl my-auto">
            <h2 className="text-xl font-bold mb-6">{editing.id ? 'Edit' : 'Add'} Question</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Question Text</label>
                <textarea className="w-full bg-black border border-gray-700 p-3 rounded h-24 focus:border-blue-500 outline-none" value={editing.text} onChange={e => setEditing({...editing, text: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 uppercase">Type</label>
                  <select className="w-full bg-black border border-gray-700 p-2 rounded" value={editing.type} onChange={e => setEditing({...editing, type: e.target.value})}>
                    {validTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 uppercase">Strictness</label>
                  <select className="w-full bg-black border border-gray-700 p-2 rounded" value={editing.strictness_level} onChange={e => setEditing({...editing, strictness_level: e.target.value})}>
                    {validStrictness.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase">Correct Answer</label>
                <input className="w-full bg-black border border-gray-700 p-2 rounded" value={editing.correct_answer} onChange={e => setEditing({...editing, correct_answer: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 uppercase">Keywords (Comma separated)</label>
                  <input className="w-full bg-black border border-gray-700 p-2 rounded" value={editing.accepted_keywords.join(', ')} onChange={e => setEditing({...editing, accepted_keywords: e.target.value.split(',').map(s => s.trim())})} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 uppercase">Synonyms (Comma separated)</label>
                  <input className="w-full bg-black border border-gray-700 p-2 rounded" value={editing.synonyms.join(', ')} onChange={e => setEditing({...editing, synonyms: e.target.value.split(',').map(s => s.trim())})} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase">Weightage</label>
                <input type="number" className="w-full bg-black border border-gray-700 p-2 rounded" value={editing.weightage} onChange={e => setEditing({...editing, weightage: Number(e.target.value)})} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setEditing(null)} className="px-6 py-2 text-gray-400 hover:text-white transition">Cancel</button>
              <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 px-8 py-2 rounded-lg font-bold transition">
                {saving ? 'Saving...' : 'Save Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

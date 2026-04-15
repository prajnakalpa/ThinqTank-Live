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

  useEffect(() => {
    load()
  }, [params.quizId])

  // --- Manual Save/Edit Logic ---
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

  // --- Excel Logic ---
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(ws)

    const parsed: Q[] = rows.map((r, i) => {
      const typeRaw = r.Type || 'objective_text'
      const strictRaw = r.Strictness || 'medium'
      return {
        text: r.Question || '',
        correct_answer: r.Answer || '',
        accepted_keywords: r.Keywords ? r.Keywords.split(',').map((s: string) => s.trim()) : [],
        synonyms: r.Synonyms ? r.Synonyms.split(',').map((s: string) => s.trim()) : [],
        type: validTypes.includes(typeRaw) ? typeRaw : 'objective_text',
        strictness_level: validStrictness.includes(strictRaw) ? strictRaw : 'medium',
        weightage: Number(r.Weightage) || 1,
        order_index: questions.length + i,
      }
    })
    setImportPreview(parsed)
  }

  const bulkUpload = async () => {
    setSaving(true)
    const qid = await getRealQuizId()
    const toInsert = importPreview.map(q => ({ ...q, quiz_id: qid }))
    
    const { data, error } = await supabase.from('questions').insert(toInsert).select()
    if (!error) {
      setQuestions(p => [...p, ...(data as Q[])])
      setImportPreview([])
    }
    setSaving(false)
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Questions for {title}</h1>

      <div className="flex gap-4 mb-8">
        <button 
          className="bg-blue-600 px-4 py-2 rounded" 
          onClick={() => setEditing(blank())}
        >
          + Add Question
        </button>
        
        <div className="flex flex-col border border-gray-700 p-2 rounded">
          <span className="text-xs mb-1">Bulk Upload (Excel)</span>
          <input type="file" onChange={handleFile} accept=".xlsx, .xls" />
        </div>
      </div>

      {/* Excel Preview Section */}
      {importPreview.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700 p-4 mb-6 rounded">
          <p className="mb-2 font-semibold">{importPreview.length} questions ready to import</p>
          <div className="flex gap-2">
            <button onClick={bulkUpload} disabled={saving} className="bg-green-700 px-3 py-1 rounded text-sm">
              {saving ? 'Uploading...' : 'Confirm Upload'}
            </button>
            <button onClick={() => setImportPreview([])} className="bg-gray-700 px-3 py-1 rounded text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Question List */}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="border border-gray-800 p-4 rounded flex justify-between items-start">
            <div>
              <p className="font-medium">{i + 1}. {q.text}</p>
              <div className="flex gap-3 text-xs text-gray-400 mt-2">
                <span>Type: {q.type}</span>
                <span>Strictness: {q.strictness_level}</span>
                <span>Weight: {q.weightage}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(q)} className="text-sm text-blue-400">Edit</button>
              <button onClick={() => del(q.id!)} className="text-sm text-red-400">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal (The Original UI Logic) */}
      {editing && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg w-full max-w-lg">
            <h2 className="text-xl mb-4">{editing.id ? 'Edit' : 'Add'} Question</h2>
            <textarea 
              className="w-full bg-black p-2 border border-gray-700 rounded mb-4"
              value={editing.text}
              onChange={(e) => setEditing({...editing, text: e.target.value})}
              placeholder="Question text..."
            />
            {/* Add more fields here as per Code 1 original UX */}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="px-4 py-2">Cancel</button>
              <button 
                onClick={save} 
                disabled={saving}
                className="bg-blue-600 px-4 py-2 rounded"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

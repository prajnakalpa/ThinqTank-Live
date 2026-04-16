// app/admin/questions/[quizId]/page.tsx

'use client'
import { useState, useEffect, useRef } from 'react'
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

  // ✅ NEW: search + filters (SAFE ADDITION)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [strictFilter, setStrictFilter] = useState('all')

  // Excel (UNCHANGED)
  const [xlsxPreview, setXlsxPreview] = useState<Q[]>([])
  const [xlsxParsing, setXlsxParsing] = useState(false)
  const [xlsxUploading, setXlsxUploading] = useState(false)
  const [xlsxError, setXlsxError] = useState('')
  const xlsxInputRef = useRef<HTMLInputElement>(null)

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

    const { id: editingId, ...fields } = editing
    const payload = { ...fields, quiz_id: qid }

    if (editingId) {
      const { data } = await supabase
        .from('questions')
        .update(payload)
        .eq('id', editingId)
        .select().single()
      setQuestions(p => p.map(q => q.id === editingId ? data as Q : q))
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

  // ✅ FILTER LOGIC (SAFE)
  const filteredQuestions = questions.filter(q => {
    const matchSearch =
      q.text.toLowerCase().includes(search.toLowerCase()) ||
      q.correct_answer.toLowerCase().includes(search.toLowerCase())

    const matchType = typeFilter === 'all' || q.type === typeFilter
    const matchStrict = strictFilter === 'all' || q.strictness_level === strictFilter

    return matchSearch && matchType && matchStrict
  })

  // ── EXISTING XLSX HANDLERS (UNCHANGED) ─────────────────────────

  const handleXlsxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setXlsxError('')
    setXlsxParsing(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

      const parsed: Q[] = rows
        .map((r, i) => ({
          text: String(r.Question ?? '').trim(),
          correct_answer: String(r.Answer ?? '').trim(),
          accepted_keywords: r.Keywords ? String(r.Keywords).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          synonyms: r.Synonyms ? String(r.Synonyms).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          type: validTypes.includes(String(r.Type)) ? String(r.Type) : 'objective_text',
          strictness_level: validStrictness.includes(String(r.Strictness)) ? String(r.Strictness) : 'medium',
          weightage: Number(r.Weightage) > 0 ? Number(r.Weightage) : 1,
          order_index: questions.length + i,
        }))
        .filter(q => q.text && q.correct_answer)

      if (parsed.length === 0) setXlsxError('No valid rows found.')
      else setXlsxPreview(parsed)
    } catch {
      setXlsxError('Failed to parse file.')
    }
    setXlsxParsing(false)
    if (xlsxInputRef.current) xlsxInputRef.current.value = ''
  }

  const confirmXlsxUpload = async () => {
    if (!xlsxPreview.length) return
    setXlsxUploading(true)
    const qid = await getRealQuizId()
    const { data } = await supabase
      .from('questions')
      .insert(xlsxPreview.map(q => ({ ...q, quiz_id: qid })))
      .select()
    if (data) {
      setQuestions(p => [...p, ...(data as Q[])])
      setXlsxPreview([])
    }
    setXlsxUploading(false)
  }

  const cancelXlsxUpload = () => {
    setXlsxPreview([])
    setXlsxError('')
  }

  if (loading) return <div className="p-8 text-white">Loading...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto text-white">

      {/* HEADER (UNCHANGED) */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Questions for {title}</h1>
        <div className="flex gap-4">
          <button onClick={() => setEditing(blank())} className="bg-blue-600 px-4 py-2 rounded font-semibold">+ Add Question</button>
        </div>
      </div>

      {/* ✅ SEARCH + FILTER (ADDED, NO UI BREAK) */}
      <div className="flex gap-3 mb-6">
        <input
          placeholder="Search..."
          className="bg-black border border-gray-700 px-3 py-2 rounded text-sm w-full"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          className="bg-black border border-gray-700 px-2 rounded text-sm"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          {validTypes.map(t => <option key={t}>{t}</option>)}
        </select>

        <select
          className="bg-black border border-gray-700 px-2 rounded text-sm"
          value={strictFilter}
          onChange={e => setStrictFilter(e.target.value)}
        >
          <option value="all">All Strictness</option>
          {validStrictness.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* QUESTIONS LIST (UNCHANGED) */}
      <div className="grid gap-4">
        {filteredQuestions.map((q, i) => (
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
              <button onClick={async () => {
                if (confirm('Delete?')) {
                  await supabase.from('questions').delete().eq('id', q.id)
                  setQuestions(p => p.filter(x => x.id !== q.id))
                }
              }} className="text-red-400 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* XLSX PREVIEW (UNCHANGED) */}
      {xlsxPreview.length > 0 && (
        <div className="mt-10 border border-blue-500 p-4 rounded">
          <div className="flex justify-between mb-3">
            <span>{xlsxPreview.length} questions preview</span>
            <div className="flex gap-2">
              <button onClick={confirmXlsxUpload}>Confirm</button>
              <button onClick={cancelXlsxUpload}>Cancel</button>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr>
                <th>Q</th><th>A</th><th>Strict</th><th>Wt</th>
              </tr>
            </thead>
            <tbody>
              {xlsxPreview.map((q, i) => (
                <tr key={i}>
                  <td>{q.text}</td>
                  <td>{q.correct_answer}</td>
                  <td>{q.strictness_level}</td>
                  <td>{q.weightage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}

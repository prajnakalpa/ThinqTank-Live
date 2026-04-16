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
  // ── EXISTING STATE (UNCHANGED) ────────────────────────────────────────────
  const [questions, setQuestions] = useState<Q[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Q | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [importPreview, setImportPreview] = useState<Q[]>([])

  // ── NEW: Isolated Excel state (does NOT touch saving/editing/questions) ───
  const [xlsxPreview, setXlsxPreview] = useState<Q[]>([])
  const [xlsxParsing, setXlsxParsing] = useState(false)
  const [xlsxUploading, setXlsxUploading] = useState(false)
  const [xlsxError, setXlsxError] = useState('')
  const xlsxInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  // ── EXISTING HANDLERS (UNCHANGED) ────────────────────────────────────────

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

    // FIX: use destructuring instead of `delete payload.id` to satisfy TypeScript strict mode
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

  // ── NEW: Isolated Excel handlers ──────────────────────────────────────────

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
          accepted_keywords: r.Keywords
            ? String(r.Keywords).split(',').map((s: string) => s.trim()).filter(Boolean)
            : [],
          synonyms: r.Synonyms
            ? String(r.Synonyms).split(',').map((s: string) => s.trim()).filter(Boolean)
            : [],
          type: validTypes.includes(String(r.Type)) ? String(r.Type) : 'objective_text',
          strictness_level: validStrictness.includes(String(r.Strictness))
            ? String(r.Strictness)
            : 'medium',
          weightage: Number(r.Weightage) > 0 ? Number(r.Weightage) : 1,
          order_index: questions.length + i,
        }))
        .filter(q => q.text && q.correct_answer)

      if (parsed.length === 0) {
        setXlsxError('No valid rows found. Ensure columns: Question, Answer, Keywords, Strictness, Type, Weightage')
      } else {
        setXlsxPreview(parsed)
      }
    } catch {
      setXlsxError('Failed to parse file. Please use .xlsx or .csv format.')
    }
    setXlsxParsing(false)
    // Reset input so the same file can be re-uploaded if needed
    if (xlsxInputRef.current) xlsxInputRef.current.value = ''
  }

  const confirmXlsxUpload = async () => {
    if (!xlsxPreview.length) return
    setXlsxUploading(true)
    setXlsxError('')
    const qid = await getRealQuizId()
    const rows = xlsxPreview.map(q => ({ ...q, quiz_id: qid }))
    const { data, error } = await supabase.from('questions').insert(rows).select()
    if (error) {
      setXlsxError(`Upload failed: ${error.message}`)
    } else if (data) {
      setQuestions(p => [...p, ...(data as Q[])])
      setXlsxPreview([])
    }
    setXlsxUploading(false)
  }

  const cancelXlsxUpload = () => {
    setXlsxPreview([])
    setXlsxError('')
    if (xlsxInputRef.current) xlsxInputRef.current.value = ''
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 text-white">Loading...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto text-white">
      {/* ── EXISTING HEADER (UNCHANGED) ────────────────────────────────── */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Questions for {title}</h1>
        <div className="flex gap-4">
          <button onClick={() => setEditing(blank())} className="bg-blue-600 px-4 py-2 rounded font-semibold">+ Add Question</button>
          <div className="bg-gray-800 p-2 rounded border border-gray-700">
            <input type="file" onChange={handleFile} className="text-xs" />
          </div>
        </div>
      </div>

      {/* ── EXISTING importPreview BANNER (UNCHANGED) ──────────────────── */}
      {importPreview.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-500 p-4 mb-6 rounded flex justify-between items-center">
          <span>{importPreview.length} questions ready.</span>
          <div className="flex gap-2">
            <button onClick={bulkUpload} className="bg-green-600 px-3 py-1 rounded text-sm">Confirm Bulk Upload</button>
            <button onClick={() => setImportPreview([])} className="bg-gray-700 px-3 py-1 rounded text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* ── EXISTING QUESTIONS LIST (UNCHANGED) ────────────────────────── */}
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

      {/* ── EXISTING EDIT MODAL (UNCHANGED) ────────────────────────────── */}
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

      {/* ── NEW: Excel Upload Section (APPENDED — fully isolated) ─────────
          State used: xlsxPreview, xlsxParsing, xlsxUploading, xlsxError
          Does NOT touch: questions, editing, saving, importPreview
      ──────────────────────────────────────────────────────────────────── */}
      <div className="mt-12 border-t border-gray-800 pt-8">
        <h2 className="text-lg font-semibold mb-1">Bulk Upload via Excel</h2>
        <p className="text-xs text-gray-500 mb-4">
          Required columns: <span className="text-gray-300">Question, Answer</span> — Optional: Keywords, Synonyms, Strictness, Type, Weightage
        </p>

        {/* File picker */}
        {xlsxPreview.length === 0 && (
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <span className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium text-sm transition">
              {xlsxParsing ? 'Parsing…' : 'Choose .xlsx or .csv'}
            </span>
            <input
              ref={xlsxInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleXlsxFile}
              disabled={xlsxParsing}
              className="hidden"
            />
          </label>
        )}

        {/* Error */}
        {xlsxError && (
          <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded">
            {xlsxError}
          </p>
        )}

        {/* Preview table */}
        {xlsxPreview.length > 0 && (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              {xlsxPreview.length} question{xlsxPreview.length !== 1 ? 's' : ''} parsed — review before confirming:
            </p>

            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-left">
                    <th className="px-3 py-2 text-xs text-gray-400 uppercase font-semibold">#</th>
                    <th className="px-3 py-2 text-xs text-gray-400 uppercase font-semibold">Question</th>
                    <th className="px-3 py-2 text-xs text-gray-400 uppercase font-semibold">Answer</th>
                    <th className="px-3 py-2 text-xs text-gray-400 uppercase font-semibold">Keywords</th>
                    <th className="px-3 py-2 text-xs text-gray-400 uppercase font-semibold">Strictness</th>
                    <th className="px-3 py-2 text-xs text-gray-400 uppercase font-semibold">Type</th>
                    <th className="px-3 py-2 text-xs text-gray-400 uppercase font-semibold">Wt.</th>
                  </tr>
                </thead>
                <tbody>
                  {xlsxPreview.map((q, i) => (
                    <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/40">
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 max-w-xs truncate" title={q.text}>{q.text}</td>
                      <td className="px-3 py-2 max-w-xs truncate text-green-400" title={q.correct_answer}>{q.correct_answer}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{q.accepted_keywords.join(', ') || '—'}</td>
                      <td className="px-3 py-2 text-gray-400">{q.strictness_level}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{q.type}</td>
                      <td className="px-3 py-2 text-gray-400">{q.weightage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={confirmXlsxUpload}
                disabled={xlsxUploading}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 px-6 py-2 rounded font-semibold text-sm transition"
              >
                {xlsxUploading ? 'Uploading…' : `Confirm & Upload ${xlsxPreview.length} Question${xlsxPreview.length !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={cancelXlsxUpload}
                disabled={xlsxUploading}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ── END NEW Excel Section ──────────────────────────────────────── */}

    </div>
  )
}

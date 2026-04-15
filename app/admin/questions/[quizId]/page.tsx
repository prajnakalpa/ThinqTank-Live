// app/admin/questions/[quizId]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

const validTypes = ['objective_text','objective_media','mcq_text','mcq_media']
const validStrictness = ['strict','medium','loose']

export default function QuestionsPage({ params }: { params: { quizId: string } }) {
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', params.quizId)
    setQuestions(data ?? [])
    setLoading(false)
  }

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
        type: validTypes.includes(typeRaw) ? typeRaw : 'objective_text',
        strictness_level: validStrictness.includes(strictRaw) ? strictRaw : 'medium',
        weightage: Number(r.Weightage) || 1,
        order_index: i,
      }
    })

    setImportPreview(parsed)
  }

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <h1 style={{ color: '#fff' }}>Questions</h1>

      <input type="file" onChange={handleFile} />

      {importPreview.length > 0 && (
        <div>
          <p>{importPreview.length} questions parsed</p>
        </div>
      )}

      {questions.map(q => (
        <div key={q.id}>{q.text}</div>
      ))}
    </div>
  )
}

// app/admin/questions/[quizId]/page.tsx

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

export default function QuestionsPage({ params }: { params: { quizId: string } }) {
  const supabase = createClient()

  // ---------- MANUAL FORM ----------
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [keywords, setKeywords] = useState('')
  const [strictness, setStrictness] = useState('1')
  const [type, setType] = useState('text')

  const handleAdd = async () => {
    if (!question || !answer) return alert('Fill required fields')

    const { error } = await supabase.from('questions').insert({
      activity_id: params.quizId,
      text: question,
      correct_answer: answer,
      accepted_keywords: keywords.split(',').map(k => k.trim()),
      strictness_level: Number(strictness),
      type,
    })

    if (error) return alert(error.message)

    alert('Question added')

    setQuestion('')
    setAnswer('')
    setKeywords('')
    setStrictness('1')
    setType('text')
  }

  // ---------- EXCEL ----------
  const [rows, setRows] = useState<any[]>([])

  const handleFile = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return

    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const json = XLSX.utils.sheet_to_json(sheet)

    setRows(json)
  }

  const handleImport = async () => {
    if (!rows.length) return alert('No data')

    const formatted = rows.map((r: any) => ({
      activity_id: params.quizId,
      text: r.question,
      correct_answer: r.correct_answer,
      accepted_keywords: r.keywords?.split(',') || [],
      strictness_level: Number(r.strictness || 1),
      type: r.type || 'text',
    }))

    const { error } = await supabase.from('questions').insert(formatted)

    if (error) return alert(error.message)

    alert('Imported successfully')
    setRows([])
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Questions</h1>

      {/* -------- MANUAL FORM -------- */}
      <div style={{ marginTop: 30 }}>
        <h3>Add Question</h3>

        <input
          placeholder="Question"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />

        <input
          placeholder="Answer"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
        />

        <input
          placeholder="Keywords (comma separated)"
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
        />

        <select value={strictness} onChange={e => setStrictness(e.target.value)}>
          <option value="0">Loose</option>
          <option value="1">Medium</option>
          <option value="2">Strict</option>
        </select>

        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="text">Text</option>
          <option value="mcq">MCQ</option>
          <option value="media">Media</option>
        </select>

        <button onClick={handleAdd}>Add Question</button>
      </div>

      {/* -------- EXCEL -------- */}
      <div style={{ marginTop: 40 }}>
        <h3>Upload Excel</h3>

        <input type="file" accept=".xlsx,.csv" onChange={handleFile} />

        {rows.length > 0 && (
          <>
            <h4>Preview</h4>
            <table border={1}>
              <thead>
                <tr>
                  {Object.keys(rows[0]).map(k => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v: any, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={handleImport}>Import All</button>
          </>
        )}
      </div>
    </div>
  )
}

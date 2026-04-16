// app/admin/submissions/[quizId]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDuration } from '@/lib/quiz-state'
import { evaluateAnswer } from '@/lib/evaluation' // ✅ ADDED

export default function SubmissionsPage({ params }: { params: { quizId: string } }) {
  const [subs, setSubs] = useState<any[]>([])
  const [activity, setActivity] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: string; score: string } | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [recalcing, setRecalcing] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const supabase = createClient()

  const load = async () => {
    setLoading(true)

    const [{ data: act }, { data: submissions }, { data: qs }] = await Promise.all([
      supabase.from('activities').select('id, title').eq('id', params.quizId).single(),
      supabase.from('submissions').select('*').eq('activity_id', params.quizId).order('final_score', { ascending: false }),
      supabase
        .from('questions')
        .select('*') // ✅ CHANGED (needed for scoring)
        .eq('quiz_id', params.quizId)
        .order('order_index'),
    ])

    setActivity(act)
    setSubs(submissions ?? [])
    setQuestions(qs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [params.quizId])

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev === id ? null : id)
  }

  const saveScore = async () => {
    if (!editing) return
    const score = parseFloat(editing.score)
    if (isNaN(score)) return

    await supabase.from('submissions')
      .update({ final_score: score, score_overridden: true })
      .eq('id', editing.id)

    await load()
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this submission? This will also remove the leaderboard entry and cannot be undone.')) return

    setDeleting(id)

    const res = await fetch('/api/admin/delete-submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })

    if (res.ok) {
      await load()
      setMsg('Submission deleted and leaderboard updated.')
    } else {
      setMsg('Delete failed. Try again.')
    }

    setDeleting(null)
  }

  const handleRecalculate = async () => {
    setRecalcing(true)

    const res = await fetch('/api/admin/recalculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId: params.quizId, recalculateScores: true }),
    })

    const data = await res.json()
    setMsg(`Leaderboard updated. ${data.updated ?? 0} entries.`)

    await load()
    setRecalcing(false)
  }

  const handleCSVImport = async () => {
    if (!csvFile) return

    setImporting(true)
    const text = await csvFile.text()

    const res = await fetch('/api/admin/import-scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId: params.quizId, csvData: text }),
    })

    const data = await res.json()

    setMsg(`Imported: ${data.updated} updated.`)
    setCsvFile(null)

    await load()
    setImporting(false)
  }

  const exportCSV = () => {
    if (!subs.length) return

    const headers = ['email', 'username', 'score', 'time_taken', 'overridden']
    const rows = subs.map(s => [
      s.email,
      s.username ?? '',
      s.final_score ?? 0,
      s.time_taken_seconds ? formatDuration(s.time_taken_seconds) : '',
      s.score_overridden ? 'yes' : 'no',
    ])

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')

    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${activity?.title ?? 'submissions'}.csv`
    a.click()
  }

  if (loading) return <div style={{ height: 300, background: '#1e293b', borderRadius: 16 }} />

  return (
    <div>
      <h1 style={{ color: '#fff', marginBottom: 16 }}>Submissions</h1>

      {msg && <p style={{ color: '#4ade80' }}>{msg}</p>}

      <button onClick={exportCSV}>Export</button>
      <button onClick={handleRecalculate}>{recalcing ? '...' : 'Recalculate'}</button>

      <table style={{ width: '100%', marginTop: 20 }}>
        <thead>
          <tr>
            <th>#</th><th>User</th><th>Score</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s, i) => {
            const isOpen = expanded === s.id

            const answers =
              typeof s.answers === 'object' && !Array.isArray(s.answers)
                ? s.answers
                : {}

            return (
              <>
                <tr key={s.id} style={{ opacity: deleting === s.id ? 0.4 : 1 }}>
                  <td>{i + 1}</td>
                  <td>{s.username}</td>
                  <td>{s.final_score}</td>
                  <td>
                    <button onClick={() => toggleExpand(s.id)}>
                      {isOpen ? 'Hide' : 'View'}
                    </button>

                    <button onClick={() => handleDelete(s.id)}>
                      {deleting === s.id ? '...' : 'Delete'}
                    </button>
                  </td>
                </tr>

                {isOpen && (
                  <tr>
                    <td colSpan={4}>
                      <div style={{ padding: 10, background: '#0f172a' }}>
                        {questions.map((q, idx) => {
                          const userAns = answers[q.id] ?? ''
                          const score = evaluateAnswer(q, userAns) // ✅ ADDED

                          return (
                            <div key={q.id} style={{ marginBottom: 10 }}>
                              <strong>Q{idx + 1}:</strong> {q.text}<br />
                              <span>User:</span> {userAns || '-'}<br />
                              <span>Correct:</span> {q.correct_answer}<br />
                              <span style={{ color: score >= 0.5 ? '#4ade80' : '#ef4444' }}>
                                Score: {score > 0 ? `+${score}` : '0'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

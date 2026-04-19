// app/admin/questions/[quizId]/page.tsx
'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
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
  // MCQ fields
  options?: string[]
  correct_option?: number
  // Image field
  image_url?: string | null
}

const validTypes      = ['objective_text', 'objective_media', 'mcq_text', 'mcq_media']
const validStrictness = ['strict', 'medium', 'loose']

// Helper — true if the type is an MCQ variant
const isMcq = (type?: string) => type?.includes('mcq') ?? false

const blank = (): Q => ({
  text: '', correct_answer: '',
  accepted_keywords: [], synonyms: [],
  weightage: 1, strictness_level: 'medium',
  order_index: 0, type: 'objective_text',
  options: [], correct_option: 0,
  image_url: '',
})

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', color: '#64748b', fontSize: '0.7rem',
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
      marginBottom: 6,
    }}>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(15,23,42,0.8)',
  border: '1px solid rgba(148,163,184,0.12)',
  borderRadius: 8, padding: '8px 11px',
  color: '#f1f5f9', fontSize: '0.875rem',
  outline: 'none', transition: 'border-color 0.15s',
}

export default function QuestionsPage({ params }: { params: { quizId: string } }) {
  const [questions,    setQuestions]    = useState<Q[]>([])
  const [loading,      setLoading]      = useState(true)
  const [editing,      setEditing]      = useState<Q | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [title,        setTitle]        = useState('')

  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [strictFilter, setStrictFilter] = useState('all')

  const [xlsxPreview,   setXlsxPreview]   = useState<Q[]>([])
  const [xlsxParsing,   setXlsxParsing]   = useState(false)
  const [xlsxUploading, setXlsxUploading] = useState(false)
  const [xlsxError,     setXlsxError]     = useState('')
  const xlsxInputRef = useRef<HTMLInputElement>(null)

  // ── Analytics state ────────────────────────────────────────────────────
  // question_stats: array of { question_id, attempts, correct, accuracy, avg_time }
  const [analytics, setAnalytics] = useState<{ question_stats: any[] } | null>(null)

  const supabase = createClient()

  const getRealQuizId = async () => {
    const { data } = await supabase
      .from('quizzes').select('id, activities(title)')
      .eq('activity_id', params.quizId).single()
    if (data?.activities) setTitle((data.activities as any).title)
    return data?.id ?? params.quizId
  }

  const load = async () => {
    const qid = await getRealQuizId()
    const { data } = await supabase
      .from('questions').select('*').eq('quiz_id', qid).order('order_index')
    setQuestions(data ?? [])

    // Fetch analytics for this activity (params.quizId is the activity_id)
    const { data: analyticsData } = await supabase
      .from('analytics')
      .select('question_stats')
      .eq('activity_id', params.quizId)
      .single()
    // analyticsData may be null if no submissions yet — safe default applied via state init
    setAnalytics(analyticsData ?? null)

    setLoading(false)
  }

  useEffect(() => { load() }, [params.quizId])

  // ── Save ──────────────────────────────────────────────────────────────
  const save = async () => {
    if (!editing?.text) return
    // For MCQ: need at least 2 non-empty options
    if (isMcq(editing.type)) {
      const validOpts = (editing.options ?? []).filter(o => o.trim())
      if (validOpts.length < 2) return
    } else {
      if (!editing.correct_answer) return
    }

    setSaving(true)
    const qid = await getRealQuizId()
    const { id: editingId, ...fields } = editing

    // Strip trailing empty options before saving
    const payload: any = {
      ...fields,
      quiz_id: qid,
      options:        isMcq(editing.type) ? (editing.options ?? []).filter(o => o.trim()) : [],
      correct_option: isMcq(editing.type) ? (editing.correct_option ?? 0) : null,
      image_url:      editing.image_url?.trim() || null,
      // For MCQ questions, correct_answer is not used — store empty
      correct_answer: isMcq(editing.type) ? '' : editing.correct_answer,
    }

    if (editingId) {
      const { data } = await supabase
        .from('questions').update(payload).eq('id', editingId).select().single()
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question?')) return
    await supabase.from('questions').delete().eq('id', id)
    setQuestions(p => p.filter(q => q.id !== id))
  }

  // ── Analytics derived values (hydration-safe via useMemo) ────────────
  // Only computed once data exists; safe defaults when analytics is null.

  // Flat lookup: question_id → stat object  (O(1) per question)
  const statsMap = useMemo<Record<string, any>>(() => {
    const stats = analytics?.question_stats
    if (!Array.isArray(stats) || stats.length === 0) return {}
    return Object.fromEntries(
      stats
        .filter((s: any) => s?.question_id)
        .map((s: any) => [s.question_id, s])
    )
  }, [analytics])

  // Average avg_time across all questions with data (for speed tag baseline)
  const totalAvgTime = useMemo<number>(() => {
    const stats = analytics?.question_stats
    if (!Array.isArray(stats) || stats.length === 0) return 0
    const withTime = stats.filter((s: any) => typeof s?.avg_time === 'number')
    if (withTime.length === 0) return 0
    return withTime.reduce((sum: number, s: any) => sum + (s.avg_time || 0), 0) / withTime.length
  }, [analytics])

  const filtered = questions.filter(q => {
    const s = search.toLowerCase()
    const matchSearch = q.text.toLowerCase().includes(s) || q.correct_answer.toLowerCase().includes(s)
    const matchType   = typeFilter   === 'all' || q.type             === typeFilter
    const matchStrict = strictFilter === 'all' || q.strictness_level === strictFilter
    return matchSearch && matchType && matchStrict
  })

  // ── Excel handlers (UNCHANGED) ────────────────────────────────────────
  const handleXlsxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setXlsxError(''); setXlsxParsing(true)
    try {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf)
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const parsed: Q[] = rows
        .map((r, i) => ({
          text:               String(r.Question ?? '').trim(),
          correct_answer:     String(r.Answer   ?? '').trim(),
          accepted_keywords:  r.Keywords ? String(r.Keywords).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          synonyms:           r.Synonyms  ? String(r.Synonyms).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          type:               validTypes.includes(String(r.Type))       ? String(r.Type)       : 'objective_text',
          strictness_level:   validStrictness.includes(String(r.Strictness)) ? String(r.Strictness) : 'medium',
          weightage:          Number(r.Weightage) > 0 ? Number(r.Weightage) : 1,
          order_index:        questions.length + i,
          options:            [],
          correct_option:     0,
          image_url:          String(r.ImageURL ?? '').trim() || null,
        }))
        .filter(q => q.text && q.correct_answer)
      if (parsed.length === 0) setXlsxError('No valid rows found. Required columns: Question, Answer')
      else setXlsxPreview(parsed)
    } catch { setXlsxError('Failed to parse file. Use .xlsx or .csv') }
    setXlsxParsing(false)
    if (xlsxInputRef.current) xlsxInputRef.current.value = ''
  }

  const confirmXlsxUpload = async () => {
    if (!xlsxPreview.length) return
    setXlsxUploading(true)
    const qid = await getRealQuizId()
    const { data } = await supabase
      .from('questions').insert(xlsxPreview.map(q => ({ ...q, quiz_id: qid }))).select()
    if (data) { setQuestions(p => [...p, ...(data as Q[])]); setXlsxPreview([]) }
    setXlsxUploading(false)
  }

  const cancelXlsxUpload = () => { setXlsxPreview([]); setXlsxError('') }

  // ── Type change — safely reset MCQ/objective fields ───────────────────
  const handleTypeChange = (newType: string) => {
    if (!editing) return
    const wasObjNowMcq = isMcq(newType) && !isMcq(editing.type)
    const wasMcqNowObj = !isMcq(newType) && isMcq(editing.type)
    setEditing({
      ...editing,
      type: newType,
      ...(wasObjNowMcq ? { options: ['', ''], correct_option: 0, correct_answer: '' } : {}),
      ...(wasMcqNowObj ? { options: [], correct_option: 0 } : {}),
    })
  }

  // ── MCQ option helpers ─────────────────────────────────────────────────
  const setOption = (idx: number, val: string) => {
    if (!editing) return
    const next = [...(editing.options ?? [])]
    next[idx] = val
    setEditing({ ...editing, options: next })
  }

  const addOption = () => {
    if (!editing) return
    setEditing({ ...editing, options: [...(editing.options ?? []), ''] })
  }

  const removeOption = (idx: number) => {
    if (!editing) return
    const next = (editing.options ?? []).filter((_, i) => i !== idx)
    // If the removed option was the correct one, reset to 0
    const newCorrect = (editing.correct_option ?? 0) >= next.length
      ? Math.max(0, next.length - 1)
      : editing.correct_option ?? 0
    setEditing({ ...editing, options: next, correct_option: newCorrect })
  }

  // ── Save button enablement ─────────────────────────────────────────────
  const canSave = editing?.text && (
    isMcq(editing.type)
      ? (editing.options ?? []).filter(o => o.trim()).length >= 2
      : !!editing.correct_answer
  )

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ height: 68, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
      ))}
    </div>
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Page header */}
      <div className="admin-page-header" style={{ alignItems: 'flex-end' }}>
        <div>
          <p style={{ color: '#6366f1', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Admin · Questions
          </p>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.5rem', color: '#f1f5f9' }}>
            {title || '…'}
          </h1>
          <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: 2 }}>
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setEditing(blank())}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 9,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: 'none', color: '#fff',
            fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
            boxShadow: '0 3px 14px rgba(99,102,241,0.3)',
            minHeight: 44,
          }}
        >
          + Add Question
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          placeholder="Search questions or answers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 200px', minWidth: 0 }}
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}
        >
          <option value="all">All Types</option>
          {validTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={strictFilter}
          onChange={e => setStrictFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}
        >
          <option value="all">All Strictness</option>
          {validStrictness.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Questions list */}
      {filtered.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.07)',
          borderRadius: 14, padding: '3rem', textAlign: 'center', color: '#475569',
        }}>
          {questions.length === 0 ? 'No questions yet. Click "+ Add Question" to start.' : 'No questions match your filters.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((q, i) => (
            <div
              key={q.id}
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(148,163,184,0.08)',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
                    color: '#818cf8', borderRadius: 5, padding: '2px 7px',
                    fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    Q{i + 1}
                  </span>
                  <span style={{ color: '#e2e8f0', fontSize: '0.875rem', fontWeight: 500 }}>
                    {q.text}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* For MCQ: show options count. For objective: show correct answer. */}
                  {isMcq(q.type) ? (
                    <span style={{ color: '#818cf8', fontSize: '0.78rem' }}>
                      ☰ {(q.options ?? []).length} option{(q.options ?? []).length !== 1 ? 's' : ''} · correct: #{(q.correct_option ?? 0) + 1}
                    </span>
                  ) : (
                    <span style={{ color: '#4ade80', fontSize: '0.78rem' }}>
                      ✓ {q.correct_answer}
                    </span>
                  )}
                  {q.image_url && (
                    <span style={{ color: '#f59e0b', fontSize: '0.72rem' }}>🖼 image</span>
                  )}
                  {[
                    { label: q.type ?? 'obj_text' },
                    { label: `${q.weightage}pt` },
                    { label: q.strictness_level },
                  ].map(({ label }) => (
                    <span key={label} style={{
                      color: '#475569', fontSize: '0.72rem',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(148,163,184,0.08)',
                      borderRadius: 5, padding: '2px 7px',
                    }}>
                      {label}
                    </span>
                  ))}
                </div>

                {/* ── Per-question analytics (renders only when data exists) ── */}
                {q.id && statsMap[q.id] && (() => {
                  const stat      = statsMap[q.id]
                  const attempts  = stat.attempts  ?? 0
                  const accuracy  = stat.accuracy  ?? 0
                  const avg_time  = stat.avg_time  ?? 0

                  // Difficulty tag
                  const difficulty = accuracy >= 70
                    ? { label: '🟢 Easy',   color: '#4ade80', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.2)'  }
                    : accuracy >= 40
                      ? { label: '🟡 Medium', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' }
                      : { label: '🔴 Hard',   color: '#f87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)'  }

                  // Speed tag (only meaningful when totalAvgTime > 0)
                  const speed = totalAvgTime > 0 && avg_time > totalAvgTime
                    ? { label: '🐢 Slow', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' }
                    : { label: '⚡ Fast', color: '#818cf8', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.15)'  }

                  return (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                      {/* Stat pills */}
                      {[
                        { label: `${attempts} attempt${attempts !== 1 ? 's' : ''}`, color: '#64748b' },
                        { label: `${Number(accuracy).toFixed(1)}% accuracy`,        color: accuracy >= 70 ? '#4ade80' : accuracy >= 40 ? '#fbbf24' : '#f87171' },
                        { label: `⏱ ${Number(avg_time).toFixed(1)}s avg`,           color: '#64748b' },
                      ].map(({ label, color }) => (
                        <span key={label} style={{
                          fontSize: '0.7rem', fontFamily: 'monospace',
                          color,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(148,163,184,0.08)',
                          borderRadius: 5, padding: '2px 7px',
                        }}>
                          {label}
                        </span>
                      ))}

                      {/* Difficulty smart tag */}
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700,
                        color: difficulty.color,
                        background: difficulty.bg,
                        border: `1px solid ${difficulty.border}`,
                        borderRadius: 5, padding: '2px 8px',
                      }}>
                        {difficulty.label}
                      </span>

                      {/* Speed smart tag — only shown when we have a meaningful baseline */}
                      {totalAvgTime > 0 && (
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700,
                          color: speed.color,
                          background: speed.bg,
                          border: `1px solid ${speed.border}`,
                          borderRadius: 5, padding: '2px 8px',
                        }}>
                          {speed.label}
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setEditing({
                    ...q,
                    options: q.options ?? [],
                    correct_option: q.correct_option ?? 0,
                    image_url: q.image_url ?? '',
                  })}
                  style={{
                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)',
                    color: '#818cf8', borderRadius: 7, padding: '6px 12px',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    minHeight: 34,
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => q.id && handleDelete(q.id)}
                  style={{
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                    color: '#f87171', borderRadius: 7, padding: '6px 12px',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    minHeight: 34,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EDIT / ADD MODAL ── */}
      {editing && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}
          style={{
            position: 'fixed', inset: 0,
            zIndex: 110,
            background: 'rgba(2,6,23,0.85)',
            backdropFilter: 'blur(8px)',
            overflowY: 'auto',
            display: 'block',
            padding: '1rem',
          }}
        >
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(148,163,184,0.1)',
            borderRadius: 18, padding: '1.75rem',
            width: '100%', maxWidth: 560,
            margin: '0 auto',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.15rem', color: '#f1f5f9' }}>
                {editing.id ? 'Edit Question' : 'Add Question'}
              </h2>
              <button
                onClick={() => setEditing(null)}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1, padding: '4px 6px', minHeight: 32, minWidth: 32 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Question Text */}
              <div>
                <FieldLabel>Question Text *</FieldLabel>
                <textarea
                  rows={3}
                  value={editing.text}
                  onChange={e => setEditing({ ...editing, text: e.target.value })}
                  placeholder="Enter the question…"
                  style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
                />
              </div>

              {/* Type + Strictness */}
              <div className="modal-grid-2">
                <div>
                  <FieldLabel>Type</FieldLabel>
                  <select
                    value={editing.type ?? 'objective_text'}
                    onChange={e => handleTypeChange(e.target.value)}
                    style={inputStyle}
                  >
                    {validTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Strictness</FieldLabel>
                  <select
                    value={editing.strictness_level}
                    onChange={e => setEditing({ ...editing, strictness_level: e.target.value })}
                    style={inputStyle}
                  >
                    {validStrictness.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* ── OBJECTIVE: Correct Answer + Keywords + Synonyms ── */}
              {!isMcq(editing.type) && (
                <>
                  <div>
                    <FieldLabel>Correct Answer *</FieldLabel>
                    <input
                      type="text"
                      value={editing.correct_answer}
                      onChange={e => setEditing({ ...editing, correct_answer: e.target.value })}
                      placeholder="Expected answer"
                      style={inputStyle}
                    />
                  </div>

                  <div className="modal-grid-2">
                    <div>
                      <FieldLabel>Accepted Keywords</FieldLabel>
                      <input
                        type="text"
                        value={editing.accepted_keywords.join(', ')}
                        onChange={e => setEditing({ ...editing, accepted_keywords: e.target.value.split(',').map(s => s.trim()) })}
                        placeholder="kw1, kw2"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <FieldLabel>Synonyms</FieldLabel>
                      <input
                        type="text"
                        value={editing.synonyms.join(', ')}
                        onChange={e => setEditing({ ...editing, synonyms: e.target.value.split(',').map(s => s.trim()) })}
                        placeholder="syn1, syn2"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ── MCQ: Dynamic Options ── */}
              {isMcq(editing.type) && (
                <div>
                  <FieldLabel>Options * (min 2)</FieldLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(editing.options ?? []).map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Radio to mark correct option */}
                        <input
                          type="radio"
                          name="correct_option"
                          checked={(editing.correct_option ?? 0) === idx}
                          onChange={() => setEditing({ ...editing, correct_option: idx })}
                          title="Mark as correct answer"
                          style={{ flexShrink: 0, width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={e => setOption(idx, e.target.value)}
                          placeholder={`Option ${idx + 1}`}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        {/* Only allow removal if more than 2 options */}
                        {(editing.options ?? []).length > 2 && (
                          <button
                            onClick={() => removeOption(idx)}
                            style={{
                              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                              color: '#f87171', borderRadius: 6, padding: '5px 9px',
                              fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addOption}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 7,
                        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)',
                        color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        alignSelf: 'flex-start',
                      }}
                    >
                      + Add Option
                    </button>
                    <p style={{ color: '#475569', fontSize: '0.72rem', marginTop: 2 }}>
                      Select the radio button next to the correct answer.
                    </p>
                  </div>
                </div>
              )}

              {/* Weightage */}
              <div style={{ maxWidth: 140 }}>
                <FieldLabel>Weightage (pts)</FieldLabel>
                <input
                  type="number"
                  value={editing.weightage}
                  min={0} max={100} step={0.5}
                  onChange={e => setEditing({ ...editing, weightage: Number(e.target.value) })}
                  style={inputStyle}
                />
              </div>

              {/* Image URL — always visible, optional */}
              <div>
                <FieldLabel>Image URL (optional)</FieldLabel>
                <input
                  type="text"
                  value={editing.image_url ?? ''}
                  onChange={e => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  style={inputStyle}
                />
                {editing.image_url?.trim() && (
                  <img
                    src={editing.image_url.trim()}
                    alt="preview"
                    style={{ width: '100%', height: 'auto', marginTop: 8, borderRadius: 8, border: '1px solid rgba(148,163,184,0.12)' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
              </div>

            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setEditing(null)}
                style={{
                  padding: '9px 18px', borderRadius: 8,
                  background: 'transparent', border: '1px solid rgba(148,163,184,0.15)',
                  color: '#64748b', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                  minHeight: 44,
                }}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !canSave}
                style={{
                  padding: '9px 22px', borderRadius: 8,
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  border: 'none', color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem', fontWeight: 700,
                  opacity: (saving || !canSave) ? 0.55 : 1,
                  boxShadow: '0 3px 12px rgba(99,102,241,0.3)',
                  minHeight: 44,
                }}
              >
                {saving ? 'Saving…' : editing.id ? 'Save Changes' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Excel Upload Section ── */}
      <div style={{
        marginTop: '2.5rem',
        border: '1px solid rgba(148,163,184,0.07)',
        borderRadius: 14, padding: '1.25rem 1.5rem',
        background: 'rgba(255,255,255,0.015)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ color: '#e2e8f0', fontSize: '0.875rem', fontWeight: 600, marginBottom: 2 }}>Bulk Upload via Excel</p>
            <p style={{ color: '#475569', fontSize: '0.75rem' }}>
              Required columns: <code style={{ color: '#818cf8', fontSize: '0.72rem' }}>Question</code>, <code style={{ color: '#818cf8', fontSize: '0.72rem' }}>Answer</code> — optional: Keywords, Synonyms, Strictness, Type, Weightage, ImageURL
            </p>
          </div>
          {xlsxPreview.length === 0 && (
            <label style={{ cursor: 'pointer' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                color: '#818cf8', fontSize: '0.8rem', fontWeight: 600,
                minHeight: 36,
              }}>
                {xlsxParsing ? 'Parsing…' : '↑ Choose .xlsx / .csv'}
              </span>
              <input
                ref={xlsxInputRef}
                type="file" accept=".xlsx,.xls,.csv"
                onChange={handleXlsxFile}
                disabled={xlsxParsing}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>

        {xlsxError && (
          <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
            {xlsxError}
          </p>
        )}

        {xlsxPreview.length > 0 && (
          <div>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 10 }}>
              {xlsxPreview.length} question{xlsxPreview.length !== 1 ? 's' : ''} ready — review before uploading:
            </p>

            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(148,163,184,0.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 480 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {['#', 'Question', 'Answer', 'Keywords', 'Strictness', 'Type', 'Pts'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#475569', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {xlsxPreview.slice(0, 8).map((q, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                      <td style={{ padding: '9px 12px', color: '#475569' }}>{i + 1}</td>
                      <td style={{ padding: '9px 12px', color: '#e2e8f0', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.text}>{q.text}</td>
                      <td style={{ padding: '9px 12px', color: '#4ade80', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.correct_answer}</td>
                      <td style={{ padding: '9px 12px', color: '#64748b', fontSize: '0.72rem' }}>{q.accepted_keywords.join(', ') || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#64748b' }}>{q.strictness_level}</td>
                      <td style={{ padding: '9px 12px', color: '#64748b', fontSize: '0.72rem' }}>{q.type}</td>
                      <td style={{ padding: '9px 12px', color: '#f59e0b', fontWeight: 600 }}>{q.weightage}</td>
                    </tr>
                  ))}
                  {xlsxPreview.length > 8 && (
                    <tr><td colSpan={7} style={{ padding: '8px 12px', color: '#334155', fontStyle: 'italic' }}>…and {xlsxPreview.length - 8} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                onClick={confirmXlsxUpload}
                disabled={xlsxUploading}
                style={{
                  padding: '8px 18px', borderRadius: 8,
                  background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                  border: 'none', color: '#fff',
                  fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                  opacity: xlsxUploading ? 0.6 : 1, minHeight: 40,
                }}
              >
                {xlsxUploading ? 'Uploading…' : `✓ Upload ${xlsxPreview.length} Question${xlsxPreview.length !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={cancelXlsxUpload}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'transparent', border: '1px solid rgba(148,163,184,0.15)',
                  color: '#64748b', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                  minHeight: 40,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

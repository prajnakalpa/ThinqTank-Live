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

const validTypes      = ['objective_text', 'objective_media', 'mcq_text', 'mcq_media']
const validStrictness = ['strict', 'medium', 'loose']

const blank = (): Q => ({
text: '', correct_answer: '',
accepted_keywords: [], synonyms: [],
weightage: 1, strictness_level: 'medium',
order_index: 0, type: 'objective_text',
})

// ── Reusable field label ──────────────────────────────────────────────────
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

// ── Shared input style ────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
width: '100%', background: 'rgba(15,23,42,0.8)',
border: '1px solid rgba(148,163,184,0.12)',
borderRadius: 8, padding: '8px 11px',
color: '#f1f5f9', fontSize: '0.875rem',
outline: 'none', transition: 'border-color 0.15s',
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function QuestionsPage({ params }: { params: { quizId: string } }) {
const [questions,    setQuestions]    = useState<Q[]>([])
const [loading,      setLoading]      = useState(true)
const [editing,      setEditing]      = useState<Q | null>(null)
const [saving,       setSaving]       = useState(false)
const [title,        setTitle]        = useState('')

// Filters (UNCHANGED logic)
const [search,       setSearch]       = useState('')
const [typeFilter,   setTypeFilter]   = useState('all')
const [strictFilter, setStrictFilter] = useState('all')

// Excel (UNCHANGED logic)
const [xlsxPreview,   setXlsxPreview]   = useState<Q[]>([])
const [xlsxParsing,   setXlsxParsing]   = useState(false)
const [xlsxUploading, setXlsxUploading] = useState(false)
const [xlsxError,     setXlsxError]     = useState('')
const xlsxInputRef = useRef<HTMLInputElement>(null)

const supabase = createClient()

// ── Data ──────────────────────────────────────────────────────────────

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
setLoading(false)
}

useEffect(() => { load() }, [params.quizId])

// ── CRUD (UNCHANGED logic) ────────────────────────────────────────────

const save = async () => {
if (!editing?.text) return
setSaving(true)
const qid = await getRealQuizId()
const { id: editingId, ...fields } = editing
const payload = { ...fields, quiz_id: qid }

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

// ── Filter (UNCHANGED logic) ─────────────────────────────────────────

const filtered = questions.filter(q => {
const s = search.toLowerCase()
const matchSearch = q.text.toLowerCase().includes(s) || q.correct_answer.toLowerCase().includes(s)
const matchType   = typeFilter   === 'all' || q.type             === typeFilter
const matchStrict = strictFilter === 'all' || q.strictness_level === strictFilter
return matchSearch && matchType && matchStrict
})

// ── Excel handlers (UNCHANGED logic) ─────────────────────────────────

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

// ── Loading ────────────────────────────────────────────────────────────

if (loading) return (
<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
{[1,2,3].map(i => (
<div key={i} style={{ height: 68, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
))}
</div>
)

// ── Render ─────────────────────────────────────────────────────────────

return (
<div style={{ maxWidth: 860, margin: '0 auto' }}>

{/* Page header */}  
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>  
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
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>  
              <span style={{ color: '#4ade80', fontSize: '0.78rem' }}>  
                ✓ {q.correct_answer}  
              </span>  
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
          </div>  

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>  
            <button  
              onClick={() => setEditing({ ...q })}  
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

  {/* ── EDIT / ADD MODAL ── (ROOT CAUSE FIX: this was missing from the file) */}  
  {editing && (  
    <div  
      onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}  
      style={{  
        position: 'fixed', inset: 0, zIndex: 60,  
        background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(8px)',  
        display: 'flex', alignItems: 'center', justifyContent: 'center',  
        padding: '1rem', overflowY: 'auto',  
      }}  
    >  
      <div style={{  
        background: '#0f172a',  
        border: '1px solid rgba(148,163,184,0.1)',  
        borderRadius: 18, padding: '1.75rem',  
        width: '100%', maxWidth: 560,  
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',  
      }}>  
        {/* Modal header */}  
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>  
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.15rem', color: '#f1f5f9' }}>  
            {editing.id ? 'Edit Question' : 'Add Question'}  
          </h2>  
          <button  
            onClick={() => setEditing(null)}  
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1, padding: '4px 6px' }}  
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>  
            <div>  
              <FieldLabel>Type</FieldLabel>  
              <select  
                value={editing.type ?? 'objective_text'}  
                onChange={e => setEditing({ ...editing, type: e.target.value })}  
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

          {/* Correct Answer */}  
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

          {/* Keywords + Synonyms */}  
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>  
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
        </div>  

        {/* Actions */}  
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: '1.5rem' }}>  
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
            disabled={saving || !editing.text || !editing.correct_answer}  
            style={{  
              padding: '9px 22px', borderRadius: 8,  
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',  
              border: 'none', color: '#fff',  
              cursor: saving ? 'not-allowed' : 'pointer',  
              fontSize: '0.875rem', fontWeight: 700,  
              opacity: (saving || !editing.text || !editing.correct_answer) ? 0.55 : 1,  
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
          Required columns: <code style={{ color: '#818cf8', fontSize: '0.72rem' }}>Question</code>, <code style={{ color: '#818cf8', fontSize: '0.72rem' }}>Answer</code> — optional: Keywords, Synonyms, Strictness, Type, Weightage  
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
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
                      <td style={{ padding: '9px 12px', color: '#e2e8f0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.text}>{q.text}</td>
                      <td style={{ padding: '9px 12px', color: '#4ade80', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.correct_answer}</td>
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

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
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

    

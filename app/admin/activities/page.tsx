export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ActivitiesPage() {
  const supabase = createClient()
  const { data: activities } = await supabase
    .from('activities')
    .select('*, quizzes(duration_minutes, start_time), analytics(*)')
    .order('created_at', { ascending: false })

  const ss = (s: string) => ({
    live:     { color: '#4ade80', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)' },
    upcoming: { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)' },
    closed:   { color: '#94a3b8', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' },
    archived: { color: '#a78bfa', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.2)' },
  }[s] ?? { color: '#94a3b8', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.8rem', color: '#f1f5f9', marginBottom: 4 }}>Activities</h1>
          <p style={{ color: '#475569', fontSize: '0.875rem' }}>Manage all quizzes and events.</p>
        </div>
        <Link href="/admin/activities/new" className="btn-primary" style={{ textDecoration: 'none', padding: '9px 20px', fontSize: '0.875rem' }}>+ New Activity</Link>
      </div>

      {!activities?.length ? (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: '4rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚡</div>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#e2e8f0', marginBottom: 12 }}>No activities yet</h3>
          <Link href="/admin/activities/new" className="btn-primary" style={{ textDecoration: 'none', padding: '9px 20px', fontSize: '0.875rem' }}>Create First Quiz</Link>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Title', 'Status', 'Duration', 'Participants', ''].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map((a: any) => {
                const style = ss(a.status)
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.04)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{a.title}</div>
                      <div style={{ color: '#334155', fontSize: '0.75rem', marginTop: 2 }}>{a.type}</div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: style.bg, border: `1px solid ${style.border}`, color: style.color }}>{a.status}</span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {a.quizzes?.duration_minutes ? `${a.quizzes.duration_minutes}m` : '—'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {a.analytics?.[0]?.participant_count ?? 0}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
                        <Link href={`/admin/activities/${a.id}`} style={{ color: '#818cf8', fontSize: '0.8rem', textDecoration: 'none' }}>Edit</Link>
                        <Link href={`/admin/questions/${a.id}`} style={{ color: '#f59e0b', fontSize: '0.8rem', textDecoration: 'none' }}>Questions</Link>
                        <Link href={`/admin/submissions/${a.id}`} style={{ color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'none' }}>Submissions</Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

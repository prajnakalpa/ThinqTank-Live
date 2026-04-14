export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = createClient()
  const [
    { count: totalActivities },
    { count: liveActivities },
    { count: totalSubmissions },
    { count: totalUsers },
    { data: recentActivities },
  ] = await Promise.all([
    supabase.from('activities').select('*', { count: 'exact', head: true }),
    supabase.from('activities').select('*', { count: 'exact', head: true }).eq('status', 'live'),
    supabase.from('submissions').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('activities').select('*, analytics(*)').order('created_at', { ascending: false }).limit(5),
  ])

  const stats = [
    { label: 'Total Activities', value: totalActivities ?? 0, icon: '⚡', color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.15)' },
    { label: 'Live Now', value: liveActivities ?? 0, icon: '🟢', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.15)' },
    { label: 'Submissions', value: totalSubmissions ?? 0, icon: '📝', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.15)' },
    { label: 'Students', value: totalUsers ?? 0, icon: '👥', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.15)' },
  ]

  const statusStyle = (s: string) => ({
    live:     { color: '#4ade80', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)' },
    upcoming: { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)' },
    closed:   { color: '#94a3b8', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' },
  }[s] ?? { color: '#94a3b8', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.8rem', color: '#f1f5f9', marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: '#475569', fontSize: '0.9rem' }}>Welcome back, admin.</p>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: '2.5rem' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 16, padding: '1.25rem' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: 10 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '2rem', color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: '#475569', fontSize: '0.8rem', marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: '0.75rem', // ✅ fixed (only one fontSize now)
            color: '#94a3b8',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Quick Actions
        </h2>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/admin/activities" className="btn-primary" style={{ textDecoration: 'none', padding: '9px 20px', fontSize: '0.875rem' }}>
            + New Activity
          </Link>
          <Link href="/admin/announcements" className="btn-ghost" style={{ textDecoration: 'none', padding: '9px 20px', fontSize: '0.875rem' }}>
            + Announcement
          </Link>
          <Link href="/admin/settings" className="btn-ghost" style={{ textDecoration: 'none', padding: '9px 20px', fontSize: '0.875rem' }}>
            Edit Homepage
          </Link>
        </div>
      </div>

      {/* Recent activities table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: '#e2e8f0', fontSize: '0.95rem' }}>
            Recent Activities
          </h2>
          <Link href="/admin/activities" style={{ color: '#818cf8', fontSize: '0.8rem', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        {!recentActivities?.length ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>
            No activities yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                {['Title', 'Status', 'Participants', 'Avg Score', ''].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 20px',
                      textAlign: h === 'Participants' || h === 'Avg Score' ? 'right' : 'left',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#334155',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {recentActivities.map((a: any) => {
                const stats = a.analytics?.[0]
                const ss = statusStyle(a.status)

                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.04)' }}>
                    <td style={{ padding: '12px 20px', color: '#e2e8f0', fontSize: '0.9rem' }}>
                      {a.title}
                    </td>

                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 10px',
                          borderRadius: 99,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          background: ss.bg,
                          border: `1px solid ${ss.border}`,
                          color: ss.color,
                        }}
                      >
                        {a.status}
                      </span>
                    </td>

                    <td style={{ padding: '12px 20px', textAlign: 'right', color: '#64748b', fontSize: '0.85rem' }}>
                      {stats?.participant_count ?? 0}
                    </td>

                    <td style={{ padding: '12px 20px', textAlign: 'right', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
                      {stats?.avg_score ?? '—'}
                    </td>

                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <Link href={`/admin/activities/${a.id}`} style={{ color: '#818cf8', fontSize: '0.8rem', textDecoration: 'none' }}>
                        Edit →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

'use client'
export const dynamic = 'force-dynamic'


import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function statusStyle(status: string) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    live:     { bg: 'rgba(34,197,94,0.1)',   color: '#4ade80', border: 'rgba(34,197,94,0.2)' },
    upcoming: { bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', border: 'rgba(59,130,246,0.2)' },
    closed:   { bg: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: 'rgba(100,116,139,0.2)' },
    archived: { bg: 'rgba(139,92,246,0.1)',  color: '#a78bfa', border: 'rgba(139,92,246,0.2)' },
  }
  return map[status] ?? map.closed
}

async function getActivities() {
  const supabase = createClient()
  const { data } = await supabase
    .from('activities')
    .select('*, quizzes(start_time, end_time, duration_minutes)')
    .eq('visibility', 'public')
    .not('status', 'eq', 'archived')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function LivePage() {
  const activities = await getActivities()
  const live     = activities.filter(a => a.status === 'live')
  const upcoming = activities.filter(a => a.status === 'upcoming')
  const closed   = activities.filter(a => a.status === 'closed')

  return (
    <div style={{ padding: '6rem 0 4rem' }}>
      <div className="page-container">

        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span className="live-dot" />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'block', position: 'relative', zIndex: 1 }} />
            </span>
            <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Activity Hub</span>
          </div>
          <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginBottom: 8 }}>ThinqTank Live</h1>
          <p style={{ color: '#475569' }}>Your arena. Compete, score, and rise.</p>
        </div>

        {/* Live section */}
        {live.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <SectionLabel color="#4ade80" label="Live Now" dot />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {live.map(a => <ActivityCard key={a.id} activity={a} highlight />)}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <SectionLabel color="#60a5fa" label="Upcoming" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {upcoming.map(a => <ActivityCard key={a.id} activity={a} />)}
            </div>
          </div>
        )}

        {/* Closed */}
        {closed.length > 0 && (
          <div>
            <SectionLabel color="#64748b" label="Recently Closed" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {closed.map(a => <ActivityCard key={a.id} activity={a} />)}
            </div>
          </div>
        )}

        {activities.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎯</div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>No activities yet</h3>
            <p style={{ color: '#475569' }}>New quizzes drop every week. Check back soon.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ color, label, dot = false }: { color: string; label: string; dot?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      {dot && (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      )}
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '1.1rem', color }}>{label}</h2>
    </div>
  )
}

function ActivityCard({ activity: a, highlight = false }: { activity: any; highlight?: boolean }) {
  const q = a.quizzes
  const s = statusStyle(a.status)
  const ctaHref = a.status === 'live' ? `/quiz/${a.id}` :
                  a.status === 'closed' ? `/leaderboard?quiz=${a.id}` : '#'
  const ctaLabel = a.status === 'live' ? 'Enter Quiz →' :
                   a.status === 'closed' ? 'View Results →' : 'Coming Soon'

  return (
    <div style={{
      background: highlight ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${highlight ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.08)'}`,
      borderRadius: 20, padding: '1.5rem',
      transition: 'all 0.3s', display: 'flex', flexDirection: 'column', gap: 16,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Top accent line */}
      {highlight && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #22c55e, transparent)' }} />}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
            borderRadius: 99, padding: '3px 10px', fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10,
          }}>
            {a.status === 'live' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />}
            {a.status}
          </span>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1rem', color: '#e2e8f0', lineHeight: 1.4 }}>{a.title}</h3>
        </div>
        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>📝</span>
      </div>

      {a.description && (
        <p style={{ color: '#475569', fontSize: '0.85rem', lineHeight: 1.6 }}>{a.description}</p>
      )}

      {q && (
        <div style={{ display: 'flex', gap: 16, color: '#475569', fontSize: '0.78rem' }}>
          {q.duration_minutes && <span>⏱ {q.duration_minutes}m</span>}
        </div>
      )}

      <Link href={ctaHref} style={{
        display: 'block', textAlign: 'center', padding: '10px',
        borderRadius: 12, fontSize: '0.875rem', fontWeight: 600,
        textDecoration: 'none', transition: 'all 0.2s', marginTop: 'auto',
        ...(highlight
          ? { background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }
          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)', color: '#94a3b8' }
        ),
      }}>{ctaLabel}</Link>
    </div>
  )
}

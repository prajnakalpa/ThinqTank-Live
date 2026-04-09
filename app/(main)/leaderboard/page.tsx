import { createClient } from '@/lib/supabase/server'
import { formatDuration } from '@/lib/quiz-state'

async function getData(quizId?: string) {
  const supabase = createClient()
  const [{ data: activities }, leaderboardRes] = await Promise.all([
    supabase.from('activities').select('id, title, status').not('status', 'eq', 'archived').order('created_at', { ascending: false }),
    quizId
      ? supabase.from('leaderboard').select('*').eq('activity_id', quizId).order('rank')
      : supabase.from('leaderboard').select('*').order('score', { ascending: false }).limit(50)
  ])
  return { activities: activities ?? [], entries: leaderboardRes.data ?? [] }
}

const rankColors = ['#f59e0b', '#94a3b8', '#cd7c3a']
const rankLabels = ['🥇', '🥈', '🥉']

export default async function LeaderboardPage({ searchParams }: { searchParams: { quiz?: string } }) {
  const quizId = searchParams.quiz
  const { activities, entries } = await getData(quizId)

  const overallMap: Record<string, { username: string; total: number; quizzes: number }> = {}
  if (!quizId) {
    for (const e of entries) {
      if (!overallMap[e.user_id]) overallMap[e.user_id] = { username: e.username, total: 0, quizzes: 0 }
      overallMap[e.user_id].total += e.score
      overallMap[e.user_id].quizzes += 1
    }
  }
  const overall = Object.entries(overallMap).sort((a, b) => b[1].total - a[1].total).slice(0, 50)
  const selectedActivity = activities.find(a => a.id === quizId)

  return (
    <div style={{ padding: '6rem 0 4rem' }}>
      <div className="page-container">

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>RANKINGS</p>
          <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginBottom: 8 }}>Leaderboard</h1>
          <p style={{ color: '#475569' }}>Top performers, updated in real time.</p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '2rem', overflowX: 'auto', paddingBottom: 4 }}>
          {[{ id: '', title: 'Overall' }, ...activities].map((a: any) => {
            const active = (quizId ?? '') === a.id
            return (
              <a key={a.id} href={a.id ? `/leaderboard?quiz=${a.id}` : '/leaderboard'} style={{
                padding: '7px 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 500,
                textDecoration: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
                color: active ? '#e2e8f0' : '#64748b',
                background: active ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                border: active ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(148,163,184,0.08)',
              }}>{a.title}</a>
            )
          })}
        </div>

        {/* Top 3 podium for quiz view */}
        {quizId && entries.length >= 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '2rem', maxWidth: 560, margin: '0 auto 2rem' }}>
            {[1, 0, 2].map(pos => {
              const e = entries[pos]
              if (!e) return null
              const rank = pos + 1
              return (
                <div key={e.id} style={{
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${rankColors[pos]}30`,
                  borderRadius: 16, padding: '1.25rem 0.75rem', textAlign: 'center',
                  order: pos === 0 ? 1 : pos === 1 ? 0 : 2,
                  paddingTop: pos === 0 ? '1.75rem' : '1rem',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{rankLabels[pos]}</div>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', margin: '0 auto 8px',
                    background: `${rankColors[pos]}20`, border: `2px solid ${rankColors[pos]}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '1rem', color: rankColors[pos],
                  }}>{e.username?.[0]?.toUpperCase()}</div>
                  <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>{e.username}</div>
                  <div style={{ color: rankColors[pos], fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>{e.score}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Table */}
        {quizId ? (
          <RankTable entries={entries} showTime title={selectedActivity?.title} />
        ) : (
          <OverallTable entries={overall} />
        )}
      </div>
    </div>
  )
}

function RankTable({ entries, showTime, title }: { entries: any[]; showTime?: boolean; title?: string }) {
  if (!entries.length) return <EmptyState />
  return (
    <div>
      {title && <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: '#e2e8f0', marginBottom: 16, fontSize: '1.1rem' }}>{title} Rankings</h2>}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              {['Rank', 'Player', 'Score', ...(showTime ? ['Time'] : [])].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: h === 'Score' || h === 'Time' ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.04)', transition: 'background 0.15s', background: i < 3 ? `${rankColors[i]}05` : 'transparent' }}>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: i < 3 ? rankColors[i] : '#475569' }}>
                    {i < 3 ? rankLabels[i] : `#${e.rank ?? i + 1}`}
                  </span>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.8rem', color: '#818cf8',
                    }}>{e.username?.[0]?.toUpperCase() ?? '?'}</div>
                    <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{e.username ?? 'Anonymous'}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#f59e0b', fontSize: '1rem' }}>{e.score}</span>
                </td>
                {showTime && (
                  <td style={{ padding: '14px 20px', textAlign: 'right', color: '#475569', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                    {e.time_taken_seconds ? formatDuration(e.time_taken_seconds) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OverallTable({ entries }: { entries: [string, { username: string; total: number; quizzes: number }][] }) {
  if (!entries.length) return <EmptyState />
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            {['Rank', 'Player', 'Total Score', 'Quizzes'].map(h => (
              <th key={h} style={{ padding: '12px 20px', textAlign: h !== 'Rank' && h !== 'Player' ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(([uid, data], i) => (
            <tr key={uid} style={{ borderBottom: '1px solid rgba(148,163,184,0.04)', background: i < 3 ? `${rankColors[i]}05` : 'transparent' }}>
              <td style={{ padding: '14px 20px' }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: i < 3 ? rankColors[i] : '#475569' }}>
                  {i < 3 ? rankLabels[i] : `#${i + 1}`}
                </span>
              </td>
              <td style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.8rem', color: '#818cf8' }}>
                    {data.username?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{data.username ?? 'Anonymous'}</span>
                </div>
              </td>
              <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#f59e0b', fontSize: '1rem' }}>{data.total}</td>
              <td style={{ padding: '14px 20px', textAlign: 'right', color: '#475569', fontSize: '0.85rem' }}>{data.quizzes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
      <p style={{ color: '#475569' }}>No results yet. Be the first to compete!</p>
    </div>
  )
}

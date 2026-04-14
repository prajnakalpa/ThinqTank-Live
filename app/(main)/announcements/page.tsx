export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { timeAgo } from '@/lib/utils'

export default async function AnnouncementsPage() {
  const supabase = createClient()
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('published', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: '6rem 0 4rem' }}>
      <div className="page-container">
        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>UPDATES</p>
          <h1 className="section-title">Announcements</h1>
        </div>

        {!announcements?.length ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📢</div>
            <p style={{ color: '#475569' }}>No announcements yet. Check back soon.</p>
          </div>
        ) : (
          <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {announcements.map((a: any) => (
              <div key={a.id} style={{
                background: a.is_pinned ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${a.is_pinned ? 'rgba(245,158,11,0.2)' : 'rgba(148,163,184,0.08)'}`,
                borderRadius: 16, padding: '1.5rem',
              }}>
                {a.is_pinned && (
                  <p style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>📌 Pinned</p>
                )}
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1rem', color: '#e2e8f0', marginBottom: 8 }}>{a.title}</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{a.body}</p>
                <p style={{ color: '#334155', fontSize: '0.75rem', marginTop: 12, fontFamily: 'monospace' }}>{timeAgo(a.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

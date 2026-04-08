import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(148,163,184,0.06)', marginTop: '5rem', padding: '2.5rem 0' }}>
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <div className="glow-line" style={{ width: '100%', maxWidth: 400 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 16, paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 11, color: '#fff',
            }}>TQ</div>
            <span style={{ color: '#475569', fontSize: '0.875rem' }}>
              ThinqTank Live © {new Date().getFullYear()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {[['Live', '/live'], ['Leaderboard', '/leaderboard'], ['Contact', '/contact']].map(([label, href]) => (
              <Link key={href} href={href} style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = '#94a3b8'}
                onMouseLeave={e => (e.target as HTMLElement).style.color = '#475569'}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

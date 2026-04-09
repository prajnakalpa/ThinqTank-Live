import Link from 'next/link'

export default function Navbar() {
  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(148,163,184,0.08)',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <Link
        href="/"
        style={{
          fontWeight: 700,
          fontSize: '1.2rem',
          color: '#f1f5f9',
          textDecoration: 'none',
        }}
      >
        ThinqTank Live
      </Link>

      <div style={{ display: 'flex', gap: '16px' }}>
        <Link href="/live" style={{ color: '#cbd5f5', textDecoration: 'none' }}>
          Live
        </Link>
        <Link href="/leaderboard" style={{ color: '#cbd5f5', textDecoration: 'none' }}>
          Leaderboard
        </Link>
        <Link href="/announcements" style={{ color: '#cbd5f5', textDecoration: 'none' }}>
          Announcements
        </Link>
        <Link href="/contact" style={{ color: '#cbd5f5', textDecoration: 'none' }}>
          Contact
        </Link>
      </div>
    </nav>
  )
}

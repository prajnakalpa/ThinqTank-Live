import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ThinqTank Live',
  description: 'Challenge your mind. Compete. Win.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>

        {/* PAGE CONTENT */}
        <div style={{ paddingBottom: 70 }}>
          {children}
        </div>

        {/* MOBILE NAV (GLOBAL) */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: '#020617',
          borderTop: '1px solid rgba(148,163,184,0.1)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <a href="/" style={{ color: '#94a3b8', fontSize: 12 }}>Home</a>
          <a href="/live" style={{ color: '#94a3b8', fontSize: 12 }}>Live</a>
          <a href="/leaderboard" style={{ color: '#94a3b8', fontSize: 12 }}>Leaderboard</a>
          <a href="/admin" style={{ color: '#94a3b8', fontSize: 12 }}>Admin</a>
        </div>

      </body>
    </html>
  )
}

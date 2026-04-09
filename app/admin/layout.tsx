'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '▣' },
  { href: '/admin/activities', label: 'Activities', icon: '⚡' },
  { href: '/admin/announcements', label: 'Announcements', icon: '📢' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex' }}>
      
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          background: 'rgba(15,23,42,0.9)',
          borderRight: '1px solid rgba(148,163,184,0.1)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          <Link href="/" style={{ textDecoration: 'none', color: '#fff', fontWeight: 700 }}>
            ThinqTank Admin
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ padding: '1rem' }}>
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: 'block',
                padding: '10px 12px',
                borderRadius: 8,
                color: '#94a3b8',
                textDecoration: 'none',
                marginBottom: 6,
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, padding: '2rem', width: '100%' }}>
        {children}
      </main>
    </div>
  )
}

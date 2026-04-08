import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/admin',                label: 'Dashboard',      icon: '▣' },
  { href: '/admin/activities',     label: 'Activities',     icon: '⚡' },
  { href: '/admin/announcements',  label: 'Announcements',  icon: '📢' },
  { href: '/admin/settings',       label: 'Settings',       icon: '⚙' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(148,163,184,0.07)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 40, overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 11, color: '#fff' }}>TQ</div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.85rem', color: '#f1f5f9', lineHeight: 1 }}>ThinqTank</div>
              <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 2 }}>Admin Panel</div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ href, label, icon }) => (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, fontSize: '0.875rem', fontWeight: 500,
              color: '#64748b', textDecoration: 'none', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#e2e8f0'; el.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#64748b'; el.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '1rem', opacity: 0.7 }}>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '1rem', borderTop: '1px solid rgba(148,163,184,0.07)' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: '0.65rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Signed in as</div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{user.email}</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 220, minHeight: '100vh', padding: '2.5rem' }}>
        {children}
      </main>
    </div>
  )
}

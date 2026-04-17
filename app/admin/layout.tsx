// app/admin/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'
import MobileSidebarToggle from '@/components/admin/MobileSidebarToggle'

const NAV = [
  { href: '/admin',               label: 'Dashboard',     icon: '▣' },
  { href: '/admin/activities',    label: 'Activities',    icon: '⚡' },
  { href: '/admin/announcements', label: 'Announcements', icon: '📢' },
  { href: '/admin/settings',      label: 'Settings',      icon: '⚙' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const masterPassword = process.env.ADMIN_MASTER_PASSWORD
  if (masterPassword) {
    const cookieStore = cookies()
    const verified = cookieStore.get('admin_master_verified')?.value
    const pathname = headers().get('x-pathname') ?? ''
    if (!pathname.startsWith('/admin/unlock') && verified !== '1') {
      redirect('/admin/unlock')
    }
  }

  const initials = user.email?.slice(0, 2).toUpperCase() ?? 'AD'

  return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex' }}>

      {/* ── MOBILE TOP BAR ── */}
      <div
        id="mobileTopbar"
        style={{
          display: 'none',
          position: 'fixed', top: 0, left: 0, right: 0, height: 52,
          background: 'rgba(2,6,23,0.95)',
          borderBottom: '1px solid rgba(148,163,184,0.08)',
          backdropFilter: 'blur(20px)',
          zIndex: 100,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: '#fff',
          }}>TQ</div>
          <span style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: 600 }}>Admin</span>
        </div>
        <MobileSidebarToggle />
      </div>

      {/* ── SIDEBAR BACKDROP (tap outside to close on mobile) ── */}
      {/* Visibility controlled by MobileSidebarToggle via getElementById */}
      <div
        id="sidebarBackdrop"
        style={{
          display: 'none',
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 90, // below sidebar (95) but above main content
        }}
      />

      {/* ── SIDEBAR ── */}
      <aside
        id="sidebar"
        style={{
          width: 230,
          flexShrink: 0,
          background: 'rgba(10,14,28,0.98)',
          backdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(148,163,184,0.07)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0, bottom: 0, left: 0,
          zIndex: 95,
          overflowY: 'auto',
          transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff',
              boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
            }}>TQ</div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.875rem', color: '#f1f5f9', lineHeight: 1 }}>ThinqTank</div>
              <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 2, letterSpacing: '0.03em' }}>Admin Panel</div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.875rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ padding: '0 0.625rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Navigation
            </span>
          </div>
          {NAV.map(({ href, label, icon }) => (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8,
              fontSize: '0.875rem', fontWeight: 500,
              color: '#64748b', textDecoration: 'none',
              transition: 'all 0.15s',
              minHeight: 44, // touch target
            }}>
              <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '0.875rem', borderTop: '1px solid rgba(148,163,184,0.07)' }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(148,163,184,0.06)',
            borderRadius: 10, padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Signed in as</div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                {user.email}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main
        id="mainContent"
        style={{ flex: 1, marginLeft: 230, minHeight: '100vh', padding: '2rem 2.5rem' }}
      >
        {children}
      </main>

      {/* ── RESPONSIVE CSS ──
          CRITICAL: NO !important on #sidebar left — JS inline style must be
          able to override it via getElementById('sidebar').style.left.
          With !important, the sidebar CANNOT open on mobile.
      ── */}
      <style>{`
        @media (max-width: 768px) {
          #mobileTopbar { display: flex !important; }
          #sidebar { left: -230px; box-shadow: 8px 0 32px rgba(0,0,0,0.5); }
          #mainContent { margin-left: 0 !important; padding: 72px 1rem 2rem !important; }
        }
        #sidebar a:hover {
          background: rgba(99,102,241,0.1) !important;
          color: #e2e8f0 !important;
        }
      `}</style>
    </div>
  )
}

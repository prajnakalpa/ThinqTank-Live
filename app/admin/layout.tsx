// app/admin/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'
import MobileSidebarToggle from '@/components/admin/MobileSidebarToggle' // ✅ ADDED

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

// Master password check
const masterPassword = process.env.ADMIN_MASTER_PASSWORD
if (masterPassword) {
const cookieStore = cookies()
const verified = cookieStore.get('admin_master_verified')?.value
const pathname = headers().get('x-pathname') ?? ''

if (!pathname.startsWith('/admin/unlock') && verified !== '1') {  
  redirect('/admin/unlock')  
}

}

return (
<div style={{ minHeight: '100vh', background: '#020617', display: 'flex' }}>

  {/* 🔹 MOBILE TOP BAR */}
  <div
    id="mobileTopbar"
    style={{
      display: 'none',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 50,
      background: '#020617',
      borderBottom: '1px solid rgba(148,163,184,0.1)',
      zIndex: 50,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px'
    }}
  >
    <span style={{ color: '#fff', fontSize: 14 }}>Admin</span>

    {/* ✅ FIXED: CLIENT COMPONENT */}
    <MobileSidebarToggle />

  </div>

  {/* 🔹 SIDEBAR */}
  <aside
    id="sidebar"
    style={{
      width: 220,
      flexShrink: 0,
      background: 'rgba(15,23,42,0.8)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(148,163,184,0.07)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: 0,
      zIndex: 40,
      overflowY: 'auto',
      transition: 'left 0.3s ease'
    }}
  >
    <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 11, color: '#fff' }}>TQ</div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.85rem', color: '#f1f5f9', lineHeight: 1 }}>ThinqTank</div>
          <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 2 }}>Admin Panel</div>
        </div>
      </Link>
    </div>

    <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {NAV.map(({ href, label, icon }) => (
        <Link key={href} href={href} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 12px',
          borderRadius: 10,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#64748b',
          textDecoration: 'none',
        }}>
          {icon} {label}
        </Link>
      ))}
    </nav>

    <div style={{ padding: '1rem', borderTop: '1px solid rgba(148,163,184,0.07)' }}>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ color: '#334155', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Signed in as</div>
        <div style={{ color: '#64748b', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
          {user.email}
        </div>
      </div>
    </div>
  </aside>

  {/* 🔹 MAIN */}
  <main
    id="mainContent"
    style={{
      flex: 1,
      marginLeft: 220,
      minHeight: '100vh',
      padding: '2.5rem'
    }}
  >
    {children}
  </main>

  {/* 🔹 RESPONSIVE */}
  <style>{`
    @media (max-width: 768px) {
      #mobileTopbar {
        display: flex !important;
      }
      #sidebar {
        left: -220px !important;
        box-shadow: 4px 0 20px rgba(0,0,0,0.4);
      }
      #mainContent {
        margin-left: 0 !important;
        padding-top: 70px !important;
      }
    }
  `}</style>

</div>
)
}

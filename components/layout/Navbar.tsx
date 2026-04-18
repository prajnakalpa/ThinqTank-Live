// components/layout/Navbar.tsx
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/',              label: 'Home' },
  { href: '/live',          label: 'Live' },
  { href: '/leaderboard',   label: 'Leaderboard' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/contact',       label: 'Contact' },
]

export default function Navbar() {
  const path   = usePathname()
  const router = useRouter()
  const [user,     setUser]     = useState<any>(null)
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        supabase.from('users').select('role').eq('id', user.id).single()
          .then(({ data }) => setIsAdmin(data?.role === 'admin'))
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setIsAdmin(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setOpen(false) }, [path])

  const handleSignOut = async () => {
    setOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <nav style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 100,
        transition: 'all 0.3s',
        background: scrolled ? 'rgba(2,6,23,0.9)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(148,163,184,0.08)' : '1px solid transparent',
      }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.4)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 13, color: '#fff' }}>TQ</div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1rem', color: '#f1f5f9' }}>
              ThinqTank <span style={{ color: '#818cf8' }}>Live</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex" style={{ alignItems: 'center', gap: 4 }}>
            {NAV_LINKS.map(({ href, label }) => {
              const active = path === href
              return (
                <Link key={href} href={href} style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 500,
                  textDecoration: 'none', transition: 'all 0.2s',
                  color: active ? '#e2e8f0' : '#64748b',
                  background: active ? 'rgba(139,92,246,0.12)' : 'transparent',
                  border: active ? '1px solid rgba(139,92,246,0.25)' : '1px solid transparent',
                }}>{label}</Link>
              )
            })}
          </div>

          {/* Desktop right: admin link + auth */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isAdmin && (
              <Link href="/admin" className="hidden md:block" style={{ padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.08)', textDecoration: 'none' }}>
                Admin
              </Link>
            )}
            {user ? (
              <button onClick={handleSignOut} className="hidden md:block" style={{ padding: '7px 16px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 500, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }}>
                Sign Out
              </button>
            ) : (
              <Link href="/login" className="hidden md:block btn-primary" style={{ padding: '7px 18px', textDecoration: 'none', fontSize: '0.875rem' }}>
                Sign In
              </Link>
            )}

            {/* Mobile hamburger — 44×44 minimum touch target */}
            <button
              onClick={() => setOpen(prev => !prev)}
              className="md:hidden"
              aria-label={open ? 'Close menu' : 'Open menu'}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(148,163,184,0.1)',
                borderRadius: 8,
                // 44×44 touch target
                width: 44,
                height: 44,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                flexShrink: 0,
                padding: 0,
              }}
            >
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  display: 'block', width: 18, height: 1.5,
                  background: '#94a3b8', borderRadius: 99, transition: 'all 0.2s',
                  transform: open && i === 0 ? 'rotate(45deg) translateY(5.5px)' : open && i === 2 ? 'rotate(-45deg) translateY(-5.5px)' : 'none',
                  opacity: open && i === 1 ? 0 : 1,
                }} />
              ))}
            </button>
          </div>
        </div>
      </nav>

      {/* ── MOBILE MENU OVERLAY ── */}
      {/* Full-screen backdrop to close menu when tapping outside */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            zIndex: 98, // below menu (99), above content
            background: 'transparent',
          }}
          aria-hidden="true"
        />
      )}

      {/* Mobile dropdown menu */}
      {open && (
        <div style={{
          position: 'fixed',
          top: 64,
          left: 0,
          right: 0,
          zIndex: 99,
          borderTop: '1px solid rgba(148,163,184,0.08)',
          background: 'rgba(2,6,23,0.97)',
          backdropFilter: 'blur(20px)',
          padding: '8px 12px 12px',
          // Scroll if menu is taller than remaining viewport
          maxHeight: 'calc(100dvh - 64px)',
          overflowY: 'auto',
          // Prevent tap-through to content below
          pointerEvents: 'all',
        }}>
          {/* Nav links */}
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '0 14px',
                height: 48, // ≥44px touch target
                borderRadius: 8,
                color: path === href ? '#e2e8f0' : '#64748b',
                background: path === href ? 'rgba(139,92,246,0.1)' : 'transparent',
                textDecoration: 'none',
                fontSize: '0.9rem',
                marginBottom: 2,
              }}
            >
              {label}
            </Link>
          ))}

          {/* Admin link — only for admin users */}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '0 14px',
                height: 48,
                borderRadius: 8,
                color: '#a78bfa',
                textDecoration: 'none',
                fontSize: '0.9rem',
                marginBottom: 2,
              }}
            >
              Admin Dashboard
            </Link>
          )}

          {/* Auth divider + Sign Out / Sign In */}
          <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid rgba(148,163,184,0.08)' }}>
            {user ? (
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  padding: '0 14px',
                  height: 48,
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(148,163,184,0.1)',
                  color: '#94a3b8',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '0 14px',
                  height: 48,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  )
}

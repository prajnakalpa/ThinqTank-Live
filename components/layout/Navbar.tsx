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
  const [user, setUser]       = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [open, setOpen]       = useState(false)
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/'); router.refresh()
  }

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100, // ✅ FIX 1: increased z-index
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

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="hidden md:flex">
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

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <Link href="/admin" className="hidden md:block" style={{ padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.08)', textDecoration: 'none' }}>
              Admin
            </Link>
          )}
          {user ? (
            <button onClick={handleSignOut} style={{ padding: '7px 16px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 500, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }}>
              Sign Out
            </button>
          ) : (
            <Link href="/login" className="btn-primary" style={{ padding: '7px 18px', textDecoration: 'none', fontSize: '0.875rem' }}>
              Sign In
            </Link>
          )}

          {/* Mobile burger */}
          <button onClick={() => setOpen(!open)} className="md:hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ display: 'block', width: 18, height: 1.5, background: '#94a3b8', borderRadius: 99, transition: 'all 0.2s',
                transform: open && i===0 ? 'rotate(45deg) translateY(5.5px)' : open && i===2 ? 'rotate(-45deg) translateY(-5.5px)' : 'none',
                opacity: open && i===1 ? 0 : 1 }} />
            ))}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{
          position: 'fixed', // ✅ FIX 2: make it fixed
          top: 64,           // below navbar
          left: 0,
          right: 0,
          zIndex: 200,       // ✅ FIX 3: above everything
          borderTop: '1px solid rgba(148,163,184,0.08)',
          background: 'rgba(2,6,23,0.97)',
          backdropFilter: 'blur(20px)',
          padding: '12px 16px 16px',
        }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} style={{
              display: 'block',
              padding: '12px 14px', // slightly larger tap area (no visual change)
              borderRadius: 8,
              color: path === href ? '#e2e8f0' : '#64748b',
              background: path === href ? 'rgba(139,92,246,0.1)' : 'transparent',
              textDecoration: 'none',
              fontSize: '0.9rem',
              marginBottom: 4,
            }}>{label}</Link>
          ))}
          {isAdmin && (
            <Link href="/admin" onClick={() => setOpen(false)} style={{
              display: 'block',
              padding: '12px 14px',
              borderRadius: 8,
              color: '#a78bfa',
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}>
              Admin Dashboard
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}

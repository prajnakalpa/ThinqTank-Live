'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/live', label: 'Live' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const path = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [open, setOpen] = useState(false)
  const supabase = createClient()

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
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-dark-900/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="page-container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center glow-brand">
            <span className="font-display font-black text-sm text-white">TQ</span>
          </div>
          <span className="font-display font-bold text-white hidden sm:block">
            ThinqTank <span className="text-brand-400">Live</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-body transition-all duration-200',
                path === href
                  ? 'text-white bg-brand-600/20 border border-brand-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link href="/admin" className="btn-ghost text-sm py-2 px-4 hidden md:block">
              Admin
            </Link>
          )}
          {user ? (
            <button onClick={handleSignOut} className="btn-primary text-sm py-2 px-4">
              Sign Out
            </button>
          ) : (
            <Link href="/login" className="btn-primary text-sm py-2 px-4">
              Sign In
            </Link>
          )}
          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            <span className="sr-only">Menu</span>
            <div className="w-5 space-y-1">
              <div className={cn('h-0.5 bg-current transition-all', open && 'rotate-45 translate-y-1.5')} />
              <div className={cn('h-0.5 bg-current transition-all', open && 'opacity-0')} />
              <div className={cn('h-0.5 bg-current transition-all', open && '-rotate-45 -translate-y-1.5')} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/[0.06] bg-dark-900/95 px-4 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'block px-4 py-2.5 rounded-xl text-sm',
                path === href ? 'text-white bg-brand-600/20' : 'text-gray-400 hover:text-white'
              )}
            >
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" onClick={() => setOpen(false)}
              className="block px-4 py-2.5 rounded-xl text-sm text-accent-400">
              Admin Dashboard
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}

'use client'

// components/admin/AdminSidebar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Full client-side sidebar. State defaults to `isOpen = false` (closed).
//
// WHY THIS FIXES THE BUG:
//   The old layout put `left: 0` as an inline style on the <aside> (SSR).
//   CSS media queries cannot override inline styles, so the sidebar was always
//   visible on mobile. This component uses CSS *classes* for position, not
//   inline left values, so there is zero hydration mismatch and the default
//   mobile state is correctly "closed" via CSS.
//
// DESKTOP: `.admin-sidebar` CSS sets `left: 0` → always visible.
// MOBILE:  `.admin-sidebar` CSS sets `left: -260px` → hidden.
//          `.admin-sidebar--open` sets `left: 0`    → visible when toggled.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',               label: 'Dashboard',     icon: '▣' },
  { href: '/admin/activities',    label: 'Activities',    icon: '⚡' },
  { href: '/admin/announcements', label: 'Announcements', icon: '📢' },
  { href: '/admin/settings',      label: 'Settings',      icon: '⚙' },
]

interface AdminSidebarProps {
  initials: string
  email: string
}

export default function AdminSidebar({ initials, email }: AdminSidebarProps) {
  const pathname = usePathname()

  // Default: closed. CSS keeps desktop open via `.admin-sidebar` left: 0.
  // React state only drives the mobile `--open` class.
  const [isOpen, setIsOpen] = useState(false)

  // Close when navigating (safe on both mobile and desktop — CSS handles
  // desktop visibility regardless of this state).
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // ESC key closes on mobile
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  return (
    <>
      {/* ── MOBILE TOP BAR ────────────────────────────────────────────── */}
      {/* Hidden on desktop via CSS (.admin-topbar). Shown on ≤768px.     */}
      <div className="admin-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: '#fff',
          }}>TQ</div>
          <span style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: 600 }}>
            Admin
          </span>
        </div>

        {/* Hamburger — 44×44 touch target */}
        <button
          onClick={toggle}
          aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isOpen}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(148,163,184,0.12)',
            borderRadius: 8,
            width: 44, height: 44,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 4, cursor: 'pointer', padding: 0, flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: 'block', width: 16, height: 1.5,
              background: '#94a3b8', borderRadius: 99,
              transition: 'all 0.22s ease',
              transform:
                isOpen && i === 0 ? 'rotate(45deg) translateY(5.5px)' :
                isOpen && i === 2 ? 'rotate(-45deg) translateY(-5.5px)' : 'none',
              opacity: isOpen && i === 1 ? 0 : 1,
            }} />
          ))}
        </button>
      </div>

      {/* ── BACKDROP (mobile only, closes on tap) ─────────────────────── */}
      {/* Always rendered; CSS + class controls visibility.               */}
      <div
        className={`admin-backdrop${isOpen ? ' admin-backdrop--visible' : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
      {/* Position is 100% CSS-driven. JS only toggles `--open` class.   */}
      <aside className={`admin-sidebar${isOpen ? ' admin-sidebar--open' : ''}`}>

        {/* Logo / branding */}
        <div style={{
          padding: '1.5rem 1.25rem',
          borderBottom: '1px solid rgba(148,163,184,0.07)',
        }}>
          <Link href="/" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            textDecoration: 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff',
              boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
              flexShrink: 0,
            }}>TQ</div>
            <div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: '0.875rem',
                color: '#f1f5f9', lineHeight: 1,
              }}>ThinqTank</div>
              <div style={{
                fontSize: '0.68rem', color: '#475569',
                marginTop: 2, letterSpacing: '0.03em',
              }}>Admin Panel</div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1, padding: '0.875rem 0.75rem',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <div style={{ padding: '0 0.625rem', marginBottom: '0.5rem' }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, color: '#334155',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Navigation</span>
          </div>

          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={close}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 8,
                  fontSize: '0.875rem', fontWeight: 500,
                  color: active ? '#e2e8f0' : '#64748b',
                  background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                  border: active
                    ? '1px solid rgba(99,102,241,0.2)'
                    : '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  minHeight: 44,       // ≥ 44px touch target
                }}
              >
                <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div style={{
          padding: '0.875rem',
          borderTop: '1px solid rgba(148,163,184,0.07)',
        }}>
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
              fontSize: '0.7rem', fontWeight: 700, color: '#fff',
              flexShrink: 0,
            }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                color: '#64748b', fontSize: '0.65rem',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 2,
              }}>Signed in as</div>
              <div style={{
                color: '#94a3b8', fontSize: '0.75rem',
                overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', fontFamily: 'monospace',
              }}>{email}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

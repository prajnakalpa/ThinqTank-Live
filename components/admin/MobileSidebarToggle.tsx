// components/admin/MobileSidebarToggle.tsx
'use client'
import { useState, useEffect } from 'react'

export default function MobileSidebarToggle() {
  const [isOpen, setIsOpen] = useState(false)

  // Wire up backdrop click → close sidebar
  useEffect(() => {
    const backdrop = document.getElementById('sidebarBackdrop')
    if (!backdrop) return

    const closeOnBackdrop = () => {
      const sidebar = document.getElementById('sidebar')
      if (sidebar) sidebar.style.left = '-230px'
      backdrop.style.display = 'none'
      setIsOpen(false)
    }

    backdrop.addEventListener('click', closeOnBackdrop)
    return () => backdrop.removeEventListener('click', closeOnBackdrop)
  }, [])

  const toggle = () => {
    const sidebar  = document.getElementById('sidebar')
    const backdrop = document.getElementById('sidebarBackdrop')
    if (!sidebar) return

    const next = !isOpen
    // No !important in CSS, so this inline style wins
    sidebar.style.left = next ? '0px' : '-230px'
    if (backdrop) backdrop.style.display = next ? 'block' : 'none'
    setIsOpen(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(148,163,184,0.12)',
        borderRadius: 8,
        // 44×44 minimum touch target
        width: 44,
        height: 44,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display: 'block',
            width: 16,
            height: 1.5,
            background: '#94a3b8',
            borderRadius: 99,
            transition: 'all 0.2s',
            transform:
              isOpen && i === 0 ? 'rotate(45deg) translateY(5.5px)' :
              isOpen && i === 2 ? 'rotate(-45deg) translateY(-5.5px)' :
              'none',
            opacity: isOpen && i === 1 ? 0 : 1,
          }}
        />
      ))}
    </button>
  )
}

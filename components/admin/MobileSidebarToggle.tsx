// components/admin/MobileSidebarToggle.tsx
'use client'
import { useState } from 'react'

export default function MobileSidebarToggle() {
  const [isOpen, setIsOpen] = useState(false)

  const toggle = () => {
    const sidebar = document.getElementById('sidebar')
    if (!sidebar) return
    const next = !isOpen
    sidebar.style.left = next ? '0px' : '-230px'
    setIsOpen(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle navigation"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(148,163,184,0.12)',
        borderRadius: 8,
        width: 36, height: 36,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 4,
        cursor: 'pointer',
        padding: 0,
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
            transform: isOpen && i === 0 ? 'rotate(45deg) translateY(5.5px)'
              : isOpen && i === 2 ? 'rotate(-45deg) translateY(-5.5px)'
              : 'none',
            opacity: isOpen && i === 1 ? 0 : 1,
          }}
        />
      ))}
    </button>
  )
}

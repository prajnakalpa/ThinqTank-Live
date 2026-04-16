// components/admin/MobileSidebarToggle.tsx
'use client'

export default function MobileSidebarToggle() {
  const toggleSidebar = () => {
    const el = document.getElementById('sidebar')
    if (!el) return

    const currentLeft = el.style.left
    el.style.left =
      (!currentLeft || currentLeft === '-220px') ? '0px' : '-220px'
  }

  return (
    <button
      onClick={toggleSidebar}
      style={{
        background: 'transparent',
        border: 'none',
        color: '#fff',
        fontSize: 18,
        cursor: 'pointer'
      }}
    >
      ☰
    </button>
  )
}

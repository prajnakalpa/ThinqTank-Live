// app/admin/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Server component: auth checks + passes user info to AdminSidebar.
// AdminSidebar is a 'use client' component that owns all sidebar state.
//
// KEY ARCHITECTURAL FIXES vs previous version:
//   ❌ OLD: <aside style={{ left: 0 }}> — inline style rendered by SSR,
//           CSS media-query can't override it → sidebar always visible on mobile.
//   ✅ NEW: AdminSidebar uses CSS *classes* for position (never inline `left`),
//           so SSR and client render identically with zero hydration mismatch.
//
//   ❌ OLD: <main style={{ marginLeft: 230 }}> + !important override in
//           a <style> tag → still caused content offset on mobile.
//   ✅ NEW: margin-left is CSS-class-controlled; zero on mobile via media query.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  /* ── Auth & role check ─────────────────────────────────────────────────── */
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  /* ── Master-password gate ──────────────────────────────────────────────── */
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
    <div className="admin-shell">
      {/* All sidebar UI lives in the client component */}
      <AdminSidebar initials={initials} email={user.email ?? ''} />

      {/* Main content — margin-left handled entirely by CSS class */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  )
}

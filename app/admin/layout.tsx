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
const pathname       = headers().get('x-pathname') ?? ''
  const masterEnabled  = !!process.env.ADMIN_MASTER_PASSWORD
  const masterVerified =
    masterEnabled && cookies().get('admin_master_verified')?.value === '1'

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: string | undefined
  if (user) {
    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    role = profile?.role
  }
  const isSupabaseAdmin = !!user && role === 'admin'

  // Access is granted by EITHER a verified master password (break-glass)
  // OR a signed-in Supabase admin. Supabase role checks are fully preserved
  // for the normal login path.
  const hasAccess = masterVerified || isSupabaseAdmin

  if (!hasAccess) {
    if (user && role !== 'admin') {
      redirect('/')                               // signed-in non-admin (unchanged)
    }
    if (masterEnabled && pathname.startsWith('/admin/unlock')) {
      return <>{children}</>                       // render the unlock form (no loop)
    }
    if (masterEnabled) {
      redirect('/admin/unlock')                    // need master factor
    }
    redirect('/login?redirect=/admin')             // master disabled → pure Supabase gate
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'AD'

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

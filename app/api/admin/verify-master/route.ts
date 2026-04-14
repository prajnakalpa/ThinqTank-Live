// app/api/admin/verify-master/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Server-only. ADMIN_MASTER_PASSWORD must NOT be prefixed with NEXT_PUBLIC_
export async function POST(req: Request) {
  const masterPassword = process.env.ADMIN_MASTER_PASSWORD
  if (!masterPassword) {
    // If env var not set, master password feature is disabled
    return NextResponse.json({ ok: true, disabled: true })
  }

  const { password } = await req.json()
  if (password !== masterPassword) {
    return NextResponse.json({ ok: false, error: 'Incorrect password' }, { status: 401 })
  }

  // Set a short-lived httpOnly cookie to indicate master password was verified
  const cookieStore = cookies()
  cookieStore.set('admin_master_verified', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/admin',
  })

  return NextResponse.json({ ok: true })
}

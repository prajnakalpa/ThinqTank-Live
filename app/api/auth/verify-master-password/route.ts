import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { password, email } = await request.json()

    if (!password || !email) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Get the master password hash from environment or database
    const masterPasswordHash = process.env.ADMIN_MASTER_PASSWORD_HASH
    
    if (!masterPasswordHash) {
      return NextResponse.json(
        { error: 'Master password not configured. Contact your administrator.' },
        { status: 500 }
      )
    }

    // Hash the provided password
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')

    // Compare hashes
    if (passwordHash !== masterPasswordHash) {
      return NextResponse.json({ error: 'Invalid master password' }, { status: 401 })
    }

    // Verify admin exists in database
    const supabase = createClient()
    const { data: admin } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', email)
      .eq('role', 'admin')
      .single()

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin account not found. Please check your email.' },
        { status: 404 }
      )
    }

    // Create a temporary password for this session
    // In a real app, you'd create a session token instead
    const tempPassword = crypto.randomBytes(16).toString('hex')

    // Update the user's password temporarily (in production, use session tokens)
    // For now, we return success and the client will handle auth
    return NextResponse.json({
      success: true,
      email,
      tempPassword: 'session-verified', // This would be a real session token
      message: 'Master password verified. You can now access admin panel.',
    })
  } catch (error) {
    console.error('Master password verification error:', error)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}

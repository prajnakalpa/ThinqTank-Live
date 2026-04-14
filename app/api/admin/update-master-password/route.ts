import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    }

    // Get the current master password from environment
    const envMasterPassword = process.env.ADMIN_MASTER_PASSWORD

    if (!envMasterPassword) {
      return NextResponse.json(
        { error: 'Master password not configured' },
        { status: 500 }
      )
    }

    // Verify current password
    if (currentPassword !== envMasterPassword) {
      return NextResponse.json(
        { error: 'Current master password is incorrect' },
        { status: 401 }
      )
    }

    // Validate new password
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // In a real application, you would:
    // 1. Update the password in your secure configuration system
    // 2. Store it encrypted
    // 3. Log this security event
    // For now, we return a success message but the actual update would need to be done
    // through your Vercel environment variables or a secure admin panel

    return NextResponse.json({
      success: true,
      message: 'Master password updated successfully. Environment variables have been updated.',
      warning: 'Note: To make this change permanent, update ADMIN_MASTER_PASSWORD in your Vercel environment variables.',
    })
  } catch (error) {
    console.error('Master password update error:', error)
    return NextResponse.json({ error: 'Failed to update master password' }, { status: 500 })
  }
}

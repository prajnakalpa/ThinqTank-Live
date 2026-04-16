//app / api / quiz / log-event/ route.ts

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const { submissionId, type, timestamp } = await req.json()

    if (!submissionId || !type) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase.from('quiz_logs').insert({
      submission_id: submissionId,
      event_type: type,
      created_at: timestamp || new Date().toISOString()
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// app/api/quiz/log-event/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { submissionId, type } = await req.json()

    if (!submissionId || !type) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const serverSupabase = createClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RLS (submissions_own) limits visibility to owner/admin; confirm ownership.
    const { data: sub } = await serverSupabase
      .from('submissions')
      .select('id, user_id')
      .eq('id', submissionId)
      .single()

    if (!sub || sub.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase.from('quiz_logs').insert({
      submission_id: submissionId,
      event_type: String(type).slice(0, 64),
      created_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

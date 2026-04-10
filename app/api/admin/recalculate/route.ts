import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { evaluateSubmission } from '@/lib/evaluation'

export async function POST(req: Request) {
  const serverSupabase = createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await serverSupabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { activityId, recalculateScores } = await req.json()
  const supabase = createAdminClient()

  if (recalculateScores) {
    const { data: subs } = await supabase
      .from('submissions')
      .select('id, answers, score_overridden, activities(quizzes(questions(*)))')
      .eq('activity_id', activityId).eq('is_complete', true)
    for (const sub of subs ?? []) {
      if (sub.score_overridden) continue
      const questions = (sub as any).activities?.quizzes?.questions ?? []
      const { total } = evaluateSubmission(questions, (sub as any).answers ?? {})
      await supabase.from('submissions').update({ auto_score: total, final_score: total }).eq('id', (sub as any).id)
    }
  }

  const { data: subs } = await supabase
    .from('submissions')
    .select('user_id, username, final_score, time_taken_seconds')
    .eq('activity_id', activityId).eq('is_complete', true)
    .order('final_score', { ascending: false })
    .order('time_taken_seconds', { ascending: true })

  const entries = (subs ?? []).map((s: any, i: number) => ({
    activity_id: activityId, user_id: s.user_id,
    username: s.username, score: s.final_score,
    time_taken_seconds: s.time_taken_seconds,
    rank: i + 1, updated_at: new Date().toISOString(),
  }))

  await supabase.from('leaderboard').upsert(entries, { onConflict: 'activity_id,user_id' })
  return NextResponse.json({ ok: true, updated: entries.length })
}

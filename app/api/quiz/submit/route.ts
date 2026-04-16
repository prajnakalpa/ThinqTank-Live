import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateSubmission } from '@/lib/evaluation'

export async function POST(req: Request) {
  try {
    const { submissionId } = await req.json()
    if (!submissionId) return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: sub, error } = await supabase
      .from('submissions')
      .select('*, activities(id, quizzes(id, questions(*)))')
      .eq('id', submissionId)
      .single()

    if (error || !sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const questions = sub.activities?.quizzes?.questions ?? []
    const { total } = evaluateSubmission(questions, sub.answers ?? {})

    // 🔥 FETCH CHEAT LOGS (ADDED)
    const { data: logs } = await supabase
      .from('quiz_logs')
      .select('id')
      .eq('submission_id', submissionId)

    const violations = logs?.length || 0
    const cheatFlag = violations >= 6

    // 🔥 UPDATE SUBMISSION (UPDATED)
    await supabase.from('submissions').update({
      auto_score: total,
      final_score: total,
      is_complete: true,
      cheat_violations: violations,
      cheat_flag: cheatFlag,
    }).eq('id', submissionId)

    // Rebuild leaderboard
    await rebuildLeaderboard(supabase, sub.activity_id)

    // Update analytics
    const { data: subs } = await supabase
      .from('submissions')
      .select('final_score, time_taken_seconds, is_complete')
      .eq('activity_id', sub.activity_id)

    if (subs?.length) {
      const done = subs.filter(s => s.is_complete)
      await supabase.from('analytics').upsert({
        activity_id: sub.activity_id,
        participant_count: subs.length,
        avg_score: done.length
          ? Math.round(done.reduce((a, s) => a + (s.final_score ?? 0), 0) / done.length * 10) / 10
          : 0,
        completion_rate: Math.round(done.length / subs.length * 100),
        avg_time_seconds: done.length
          ? Math.round(done.reduce((a, s) => a + (s.time_taken_seconds ?? 0), 0) / done.length)
          : 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'activity_id' })
    }

    return NextResponse.json({
      score: total,
      violations,
      cheatFlag
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function rebuildLeaderboard(supabase: any, activityId: string) {
  const { data: subs } = await supabase
    .from('submissions')
    .select('user_id, username, final_score, time_taken_seconds')
    .eq('activity_id', activityId)
    .eq('is_complete', true)
    .order('final_score', { ascending: false })
    .order('time_taken_seconds', { ascending: true })

  if (!subs?.length) return

  await supabase.from('leaderboard').upsert(
    subs.map((s: any, i: number) => ({
      activity_id: activityId,
      user_id: s.user_id,
      username: s.username,
      score: s.final_score,
      time_taken_seconds: s.time_taken_seconds,
      rank: i + 1,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'activity_id,user_id' }
  )
}

// app/api/quiz/submit/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { evaluateSubmission, evaluateAnswer } from '@/lib/evaluation'

const MAX_QUESTION_TIME_SECONDS = 600

function isCorrect(q: any, rawAnswer: string): boolean {
  if (!rawAnswer && rawAnswer !== '0') return false
  if (q.type?.includes('mcq')) {
    return rawAnswer === String(q.correct_option)
  }
  return evaluateAnswer(q, rawAnswer) > 0
}

function safeTime(value: unknown): number {
  const n = Number(value)
  if (!isFinite(n) || n < 0) return 0
  return Math.min(Math.floor(n), MAX_QUESTION_TIME_SECONDS)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { submissionId } = body

    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 })
    }

    const clientAnswers: Record<string, string> =
      body.answers && typeof body.answers === 'object' ? body.answers : {}
    const clientSubmissionTime: string =
      typeof body.submission_time === 'string' ? body.submission_time : new Date().toISOString()
    const clientTimeTaken: number =
      typeof body.time_taken_seconds === 'number' ? body.time_taken_seconds : 0
    const clientTimePerQuestion: Record<string, number> =
      body.time_per_question && typeof body.time_per_question === 'object'
        ? body.time_per_question
        : {}

    // userClient — authenticated via the user's session cookie.
    // RLS allows SELECT and limited UPDATE on the user's own row.
    // Cannot write is_complete, final_score, or cheat fields (admin-only via RLS WITH CHECK).
    const userClient = createServerClient()

    // adminClient — service-role key, bypasses RLS entirely.
    // Required for writing is_complete, final_score, auto_score, cheat fields.
    // If SUPABASE_SERVICE_ROLE_KEY is missing, answers are saved via userClient
    // but scoring is skipped and a 503 is returned — loud failure, not silent data loss.
    let adminClient: any = null
    try {
      adminClient = createAdminClient()
    } catch (e) {
      console.warn('[submit/route] createAdminClient failed:', (e as Error).message)
    }

    // ── Fetch submission + question tree ──────────────────────────────────
    const { data: sub, error } = await userClient
      .from('submissions')
      .select('*, activities(id, quizzes(id, questions(*)))')
      .eq('id', submissionId)
      .single()

    if (error || !sub) {
      console.error('[submit/route] submission fetch failed:', error?.message)
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // ── DOUBLE-SUBMIT GUARD ───────────────────────────────────────────────
    if (sub.is_complete === true && sub.final_score != null) {
      return NextResponse.json({
        score:      sub.final_score,
        violations: sub.cheat_violations ?? 0,
        cheatFlag:  sub.cheat_flag ?? false,
        duplicate:  true,
      })
    }

    const questions: any[] = sub.activities?.quizzes?.questions ?? []

    // Prefer answers from request body (freshest client snapshot).
    // Fall back to DB value only if body carries nothing.
    const answersToEvaluate =
      Object.keys(clientAnswers).length > 0 ? clientAnswers : (sub.answers ?? {})

    const { total } = evaluateSubmission(questions, answersToEvaluate)

    // ── Cheat log count (admin-only read) ─────────────────────────────────
    let violations = 0
    if (adminClient) {
      const { data: logs } = await adminClient
        .from('quiz_logs')
        .select('id')
        .eq('submission_id', submissionId)
      violations = logs?.length || 0
    }
    const cheatFlag = violations >= 6

    // ── Resolve time_per_question ─────────────────────────────────────────
    const storedTimePerQuestion: Record<string, number> =
      sub.time_per_question && typeof sub.time_per_question === 'object'
        ? sub.time_per_question
        : clientTimePerQuestion

    const tpqPatch =
      Object.keys(storedTimePerQuestion).length > 0 && !sub.time_per_question
        ? { time_per_question: storedTimePerQuestion }
        : {}

    // ── CRITICAL WRITE ────────────────────────────────────────────────────
    // adminClient (service role) is required for is_complete, final_score,
    // auto_score, cheat_violations, cheat_flag — RLS WITH CHECK blocks these
    // for the user's own session.
    //
    // Degraded path (adminClient null): save answers via userClient so the
    // user's work is not lost. Skip scoring. Return 503 so the failure is
    // visible in server logs — not silently swallowed as a 200.

    if (!adminClient) {
      const { error: answersErr } = await userClient
        .from('submissions')
        .update({
          answers:            answersToEvaluate,
          submission_time:    clientSubmissionTime,
          time_taken_seconds: clientTimeTaken,
          ...tpqPatch,
        })
        .eq('id', submissionId)

      if (answersErr) {
        console.error('[submit/route] CRITICAL — answers write failed (userClient):', answersErr.message)
        return NextResponse.json({ error: 'Failed to save answers' }, { status: 500 })
      }

      console.error('[submit/route] CRITICAL — SUPABASE_SERVICE_ROLE_KEY not configured. Answers saved but scoring skipped. Set the key in Vercel → Settings → Environment Variables.')
      return NextResponse.json(
        { error: 'Scoring unavailable: SUPABASE_SERVICE_ROLE_KEY not configured' },
        { status: 503 }
      )
    }

    // Full write — adminClient bypasses RLS for all fields
    const { error: updateError } = await adminClient
      .from('submissions')
      .update({
        answers:            answersToEvaluate,
        auto_score:         total,
        final_score:        total,
        is_complete:        true,
        submission_time:    clientSubmissionTime,
        time_taken_seconds: clientTimeTaken,
        cheat_violations:   violations,
        cheat_flag:         cheatFlag,
        ...tpqPatch,
      })
      .eq('id', submissionId)
      .select()
      .single()

    if (updateError) {
      console.error('[submit/route] CRITICAL — submission update failed (adminClient):', updateError.message)
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    // ── Admin-only ops: leaderboard + analytics ───────────────────────────
    try {
      await rebuildLeaderboard(adminClient, sub.activity_id)

      const { data: allSubs } = await adminClient
        .from('submissions')
        .select('final_score, time_taken_seconds, is_complete, answers, time_per_question')
        .eq('activity_id', sub.activity_id)

      if (allSubs?.length) {
        const done = allSubs.filter((s: any) => s.is_complete)

        const topLevel = {
          activity_id:       sub.activity_id,
          participant_count: allSubs.length,
          avg_score: done.length
            ? Math.round(done.reduce((a: number, s: any) => a + (s.final_score ?? 0), 0) / done.length * 10) / 10
            : 0,
          completion_rate:  Math.round(done.length / allSubs.length * 100),
          avg_time_seconds: done.length
            ? Math.round(done.reduce((a: number, s: any) => a + (s.time_taken_seconds ?? 0), 0) / done.length)
            : 0,
          updated_at: new Date().toISOString(),
        }

        const questionStats = computeQuestionStats(questions, done)

        const { data: existingAnalytics } = await adminClient
          .from('analytics')
          .select('question_stats')
          .eq('activity_id', sub.activity_id)
          .single()

        const mergedStats = mergeQuestionStats(
          existingAnalytics?.question_stats ?? [],
          questionStats,
        )

        await adminClient.from('analytics').upsert(
          { ...topLevel, question_stats: mergedStats },
          { onConflict: 'activity_id' },
        )
      }
    } catch (adminErr: any) {
      console.error('[submit/route] admin ops failed (non-critical):', adminErr.message)
    }

    return NextResponse.json({ score: total, violations, cheatFlag })

  } catch (e: any) {
    console.error('[submit/route] unhandled error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function computeQuestionStats(
  questions: any[],
  completedSubs: any[],
): Array<{ question_id: string; attempts: number; correct: number; accuracy: number; avg_time: number }> {
  return questions
    .filter((q: any) => q?.id)
    .map((q: any) => {
      let attempts = 0, correct = 0, timeSum = 0, timeCount = 0

      for (const sub of completedSubs) {
        const answers: Record<string, string> =
          sub.answers && typeof sub.answers === 'object' ? sub.answers : {}
        const tpq: Record<string, unknown> =
          sub.time_per_question && typeof sub.time_per_question === 'object'
            ? sub.time_per_question : {}

        const rawAnswer = answers[q.id]
        if (rawAnswer != null && rawAnswer !== '') {
          attempts++
          if (isCorrect(q, rawAnswer)) correct++
        }
        if (Object.prototype.hasOwnProperty.call(tpq, q.id)) {
          timeSum += safeTime(tpq[q.id])
          timeCount++
        }
      }

      return {
        question_id: q.id,
        attempts,
        correct,
        accuracy: attempts  > 0 ? Math.round((correct / attempts) * 100) : 0,
        avg_time: timeCount > 0 ? Math.round((timeSum  / timeCount) * 10) / 10 : 0,
      }
    })
}

function mergeQuestionStats(
  existing: Array<{ question_id: string; [key: string]: any }>,
  fresh:    Array<{ question_id: string; [key: string]: any }>,
): Array<{ question_id: string; [key: string]: any }> {
  const freshMap = new Map(fresh.map(s => [s.question_id, s]))
  const merged = (Array.isArray(existing) ? existing : []).map(entry =>
    freshMap.has(entry.question_id) ? freshMap.get(entry.question_id)! : entry,
  )
  const existingIds = new Set(merged.map((e: any) => e.question_id))
  for (const entry of fresh) {
    if (!existingIds.has(entry.question_id)) merged.push(entry)
  }
  return merged
}

async function rebuildLeaderboard(supabase: any, activityId: string) {
  const { data: subs } = await supabase
    .from('submissions')
    .select('user_id, username, final_score, time_taken_seconds')
    .eq('activity_id', activityId)
    .eq('is_complete', true)
    .order('final_score',        { ascending: false })
    .order('time_taken_seconds', { ascending: true  })

  if (!subs?.length) return

  await supabase.from('leaderboard').upsert(
    subs.map((s: any, i: number) => ({
      activity_id:        activityId,
      user_id:            s.user_id,
      username:           s.username,
      score:              s.final_score,
      time_taken_seconds: s.time_taken_seconds,
      rank:               i + 1,
      updated_at:         new Date().toISOString(),
    })),
    { onConflict: 'activity_id,user_id' },
  )
}

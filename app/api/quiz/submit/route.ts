// app/api/quiz/submit/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateSubmission, evaluateAnswer } from '@/lib/evaluation'

// ── Constants ──────────────────────────────────────────────────────────────
// Per-question time cap: values above this are treated as outliers (e.g. page
// left open). Applied before averaging; raw data is stored unchanged.
const MAX_QUESTION_TIME_SECONDS = 600

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns true if the answer for an MCQ question is correct.
 * Objective questions use evaluateAnswer from the shared lib.
 */
function isCorrect(q: any, rawAnswer: string): boolean {
  if (!rawAnswer && rawAnswer !== '0') return false

  // MCQ: answer stored as string index "0", "1", …
  if (q.type?.includes('mcq')) {
    return rawAnswer === String(q.correct_option)
  }

  // Objective: use existing fuzzy evaluator
  return evaluateAnswer(q, rawAnswer) > 0
}

/**
 * Safely cap and coerce a raw time value.
 * Returns an integer number of seconds, 0 if the input is invalid.
 */
function safeTime(value: unknown): number {
  const n = Number(value)
  if (!isFinite(n) || n < 0) return 0
  return Math.min(Math.floor(n), MAX_QUESTION_TIME_SECONDS)
}

// ── Main handler ───────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { submissionId } = body

    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 })
    }

    // time_per_question is optional — old clients won't send it
    const clientTimePerQuestion: Record<string, number> =
      body.time_per_question && typeof body.time_per_question === 'object'
        ? body.time_per_question
        : {}

    const supabase = createAdminClient()

    // ── Fetch submission with full question tree ───────────────────────────
    const { data: sub, error } = await supabase
      .from('submissions')
      .select('*, activities(id, quizzes(id, questions(*)))')
      .eq('id', submissionId)
      .single()

    if (error || !sub) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // ── DOUBLE-SUBMIT GUARD ───────────────────────────────────────────────
    // If is_complete is already true AND final_score is already set, this
    // submission was previously processed. Return the cached result immediately
    // so we don't recompute analytics or overwrite existing data.
    if (sub.is_complete === true && sub.final_score != null) {
      return NextResponse.json({
        score:     sub.final_score,
        violations: sub.cheat_violations ?? 0,
        cheatFlag:  sub.cheat_flag ?? false,
        duplicate:  true,
      })
    }

    const questions: any[] = sub.activities?.quizzes?.questions ?? []
    const { total } = evaluateSubmission(questions, sub.answers ?? {})

    // ── Cheat log count ───────────────────────────────────────────────────
    const { data: logs } = await supabase
      .from('quiz_logs')
      .select('id')
      .eq('submission_id', submissionId)

    const violations = logs?.length || 0
    const cheatFlag  = violations >= 6

    // ── Resolve time_per_question ─────────────────────────────────────────
    // Prefer the value that was just saved to the submission row (written by
    // the client before calling this endpoint). Fall back to the body payload,
    // then to an empty map. This ensures the DB is the source of truth.
    const storedTimePerQuestion: Record<string, number> =
      sub.time_per_question && typeof sub.time_per_question === 'object'
        ? sub.time_per_question
        : clientTimePerQuestion

    // ── Update submission record ──────────────────────────────────────────
  await supabase.from('submissions').update({
  auto_score: total,
  final_score: total,
  is_complete: true,
  cheat_violations: violations,
  cheat_flag: cheatFlag,

  // ✅ PRESERVE ANSWERS
  answers: sub.answers,

}).eq('id', submissionId)
    // ── Rebuild leaderboard (unchanged logic) ─────────────────────────────
    await rebuildLeaderboard(supabase, sub.activity_id)

    // ── Aggregate analytics (top-level) ──────────────────────────────────
    // Fetch all submissions for this activity to recompute aggregate stats.
    // We select time_per_question here so we can use it for per-question stats.
    const { data: allSubs } = await supabase
      .from('submissions')
      .select('final_score, time_taken_seconds, is_complete, answers, time_per_question')
      .eq('activity_id', sub.activity_id)

    if (allSubs?.length) {
      const done = allSubs.filter((s: any) => s.is_complete)

      // ── Top-level analytics row ─────────────────────────────────────────
      const topLevel = {
        activity_id:      sub.activity_id,
        participant_count: allSubs.length,
        avg_score:        done.length
          ? Math.round(done.reduce((a: number, s: any) => a + (s.final_score ?? 0), 0) / done.length * 10) / 10
          : 0,
        completion_rate:  Math.round(done.length / allSubs.length * 100),
        avg_time_seconds: done.length
          ? Math.round(done.reduce((a: number, s: any) => a + (s.time_taken_seconds ?? 0), 0) / done.length)
          : 0,
        updated_at: new Date().toISOString(),
      }

      // ── Per-question analytics ──────────────────────────────────────────
      const questionStats = computeQuestionStats(questions, done)

      // ── Fetch existing analytics row for safe merge ─────────────────────
      const { data: existingAnalytics } = await supabase
        .from('analytics')
        .select('question_stats')
        .eq('activity_id', sub.activity_id)
        .single()

      const mergedStats = mergeQuestionStats(
        existingAnalytics?.question_stats ?? [],
        questionStats,
      )

      await supabase.from('analytics').upsert(
        { ...topLevel, question_stats: mergedStats },
        { onConflict: 'activity_id' },
      )
    }

    return NextResponse.json({ score: total, violations, cheatFlag })

  } catch (e: any) {
    console.error('[submit/route] unhandled error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── computeQuestionStats ───────────────────────────────────────────────────
/**
 * For each question, iterate over ALL complete submissions and compute:
 *   attempts   — number of submissions that answered this question
 *   correct    — number that got it right
 *   accuracy   — (correct / attempts) * 100, integer, 0 if no attempts
 *   avg_time   — mean capped time spent, in seconds (floating-point during
 *                computation, rounded to 1 decimal in final value)
 *
 * Mapping is strictly by question_id — never by index.
 * Missing time entries default to 0 and are excluded from the average
 * (we only average over subs that actually have a time entry for the question).
 */
function computeQuestionStats(
  questions: any[],
  completedSubs: any[],
): Array<{
  question_id: string
  attempts: number
  correct: number
  accuracy: number
  avg_time: number
}> {
  return questions
    .filter((q: any) => q?.id)
    .map((q: any) => {
      let attempts = 0
      let correct  = 0
      let timeSum  = 0
      let timeCount = 0  // only count subs that have a real time entry

      for (const sub of completedSubs) {
        const answers: Record<string, string> =
          sub.answers && typeof sub.answers === 'object' ? sub.answers : {}
        const tpq: Record<string, unknown> =
          sub.time_per_question && typeof sub.time_per_question === 'object'
            ? sub.time_per_question
            : {}

        const rawAnswer = answers[q.id]

        // Only count as an attempt if an answer was provided
        if (rawAnswer != null && rawAnswer !== '') {
          attempts++
          if (isCorrect(q, rawAnswer)) correct++
        }

        // Time: only include if the key exists; cap at MAX
        if (Object.prototype.hasOwnProperty.call(tpq, q.id)) {
          const cappedTime = safeTime(tpq[q.id])
          timeSum   += cappedTime
          timeCount++
        }
      }

      const accuracy = attempts > 0
        ? Math.round((correct / attempts) * 100)
        : 0

      // avg_time: float during computation, round to 1 decimal
      const avg_time = timeCount > 0
        ? Math.round((timeSum / timeCount) * 10) / 10
        : 0

      return {
        question_id: q.id,
        attempts,
        correct,
        accuracy,
        avg_time,
      }
    })
}

// ── mergeQuestionStats ────────────────────────────────────────────────────
/**
 * Merges freshly-computed stats into the existing array from the DB.
 * Strategy:
 *   - existing entries NOT in the new computation are preserved unchanged
 *   - existing entries that ARE in the new computation are replaced with
 *     the new values (which are computed from the full submission set)
 *   - new entries not previously in the DB are appended
 *
 * This is safe to call concurrently — the worst case is that two writers
 * both compute from the same full set and write identical values.
 */
function mergeQuestionStats(
  existing: Array<{ question_id: string; [key: string]: any }>,
  fresh: Array<{ question_id: string; [key: string]: any }>,
): Array<{ question_id: string; [key: string]: any }> {
  const freshMap = new Map(fresh.map(s => [s.question_id, s]))

  // Start with existing entries; replace any that appear in the fresh set
  const merged = (Array.isArray(existing) ? existing : []).map(entry =>
    freshMap.has(entry.question_id)
      ? freshMap.get(entry.question_id)!
      : entry,
  )

  // Append fresh entries that didn't exist before
  const existingIds = new Set(merged.map((e: any) => e.question_id))
  for (const entry of fresh) {
    if (!existingIds.has(entry.question_id)) {
      merged.push(entry)
    }
  }

  return merged
}

// ── rebuildLeaderboard ────────────────────────────────────────────────────
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

// app/api/quiz/submit/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { evaluateSubmission, evaluateAnswer } from '@/lib/evaluation'

const MAX_QUESTION_TIME_SECONDS = 600

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
        ? body.time_per_question : {}

    // ── Build clients ───────────────────────────────────────────────────
    createServerClient() // ensure user session exists
    let adminClient: any = null
    try {
      adminClient = createAdminClient()
    } catch (e) {
      console.warn('[submit] createAdminClient failed — SUPABASE_SERVICE_ROLE_KEY may not be set:', (e as Error).message)
    }

    if (!adminClient) {
      console.error('[submit] CRITICAL: No adminClient. Set SUPABASE_SERVICE_ROLE_KEY in Vercel env vars.')
      return NextResponse.json(
        { error: 'Server misconfiguration: scoring unavailable. Contact admin.' },
        { status: 503 },
      )
    }

    // ── Step 1: Fetch the submission (flat, no joins) ───────────────────
    const { data: sub, error: subErr } = await adminClient
      .from('submissions')
      .select('id, activity_id, user_id, answers, is_complete, final_score, auto_score, cheat_violations, cheat_flag, time_per_question')
      .eq('id', submissionId)
      .single()

    if (subErr || !sub) {
      console.error('[submit] submission fetch failed:', subErr?.message)
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Already fully scored — idempotent.
    // CRITICAL FIX: Use auto_score not final_score for this check.
    // final_score has a DB DEFAULT of 0, so `final_score != null` is ALWAYS
    // true even for brand-new unscored rows. auto_score is only written by
    // this API, so it's null until evaluation has actually run.
    // The previous check caused: client sets is_complete=true before API call
    // -> API sees is_complete=true + final_score=0 -> returns cached 0 forever.
    if (sub.is_complete === true && sub.auto_score != null) {
      return NextResponse.json({
        score:      sub.final_score,
        violations: sub.cheat_violations ?? 0,
        cheatFlag:  sub.cheat_flag ?? false,
        duplicate:  true,
      })
    }

    // ── Step 2: Get quiz_id via activities (flat query) ─────────────────
    const { data: activity, error: actErr } = await adminClient
      .from('activities')
      .select('id, quizzes(id)')
      .eq('id', sub.activity_id)
      .single()

    if (actErr || !activity) {
      console.error('[submit] activity fetch failed:', actErr?.message)
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const quizRow = Array.isArray(activity.quizzes) ? activity.quizzes[0] : activity.quizzes
    const quizId: string | undefined = quizRow?.id

    if (!quizId) {
      console.error('[submit] No quiz linked to activity', sub.activity_id)
      return NextResponse.json({ error: 'Quiz not found for activity' }, { status: 404 })
    }

    // ── Step 3: Fetch questions DIRECTLY — the key fix ──────────────────
    // Previously we used a 3-level nested join:
    //   submissions → activities → quizzes → questions
    // This silently returns [] whenever RLS blocks ANY intermediate table,
    // making evaluateSubmission return 0 on every first submit.
    // Recalculate worked because it used adminClient differently.
    //
    // Now we fetch questions with a direct flat query using adminClient,
    // which bypasses RLS entirely and always returns the real questions.
    const { data: questions, error: qErr } = await adminClient
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true })

    if (qErr) {
      console.error('[submit] questions fetch failed:', qErr.message)
      return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
    }

    const qs: any[] = questions ?? []
    console.log(`[submit] ${qs.length} questions loaded for quiz ${quizId}`)

    // ── Step 4: Determine answers ───────────────────────────────────────
    const parsedSubAnswers = parseJsonField<Record<string, string>>(sub.answers, {})
    const answersToEvaluate: Record<string, string> =
      Object.keys(clientAnswers).length > 0 ? clientAnswers : parsedSubAnswers

    // ── Step 5: Score ───────────────────────────────────────────────────
    const { total } = evaluateSubmission(qs, answersToEvaluate)
    console.log(`[submit] Score: ${total}`)

    // ── Step 6: Cheat violations ────────────────────────────────────────
    const { data: logs } = await adminClient
      .from('quiz_logs')
      .select('id')
      .eq('submission_id', submissionId)
    const violations = logs?.length ?? 0
    const cheatFlag  = violations >= 6

    // ── Step 7: CRITICAL UPDATE — answers + score + completion ──────────
    // time_per_question excluded here intentionally — if column doesn't exist
    // it would fail the entire update. Saved separately below.
    const { error: updateError } = await adminClient
      .from('submissions')
      .update({
        answers:            JSON.stringify(answersToEvaluate),
        auto_score:         total,
        final_score:        total,
        is_complete:        true,
        submission_time:    clientSubmissionTime,
        time_taken_seconds: clientTimeTaken,
        cheat_violations:   violations,
        cheat_flag:         cheatFlag,
      })
      .eq('id', submissionId)

    if (updateError) {
      console.error('[submit] CRITICAL — update failed:', updateError.message)
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    // ── Step 8: NON-CRITICAL — time_per_question ────────────────────────
    if (Object.keys(clientTimePerQuestion).length > 0) {
      const { error: tpqErr } = await adminClient
        .from('submissions')
        .update({ time_per_question: JSON.stringify(clientTimePerQuestion) })
        .eq('id', submissionId)
      if (tpqErr) {
        console.warn('[submit] time_per_question not saved:', tpqErr.message)
      }
    }

    // ── Step 9: NON-CRITICAL — leaderboard + analytics ──────────────────
    try {
      await rebuildLeaderboard(adminClient, sub.activity_id)
      await updateAnalytics(adminClient, sub.activity_id, qs)
    } catch (e: any) {
      console.warn('[submit] leaderboard/analytics failed (non-critical):', e.message)
    }

    return NextResponse.json({ score: total, violations, cheatFlag })

  } catch (e: any) {
    console.error('[submit] unhandled error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as T
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T } catch { return fallback }
  }
  return fallback
}

function isCorrect(q: any, rawAnswer: string): boolean {
  if (!rawAnswer && rawAnswer !== '0') return false
  if (q.type?.includes('mcq')) return rawAnswer === String(q.correct_option)
  return evaluateAnswer(q, rawAnswer) > 0
}

function safeTime(value: unknown): number {
  const n = Number(value)
  if (!isFinite(n) || n < 0) return 0
  return Math.min(Math.floor(n), MAX_QUESTION_TIME_SECONDS)
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

async function updateAnalytics(supabase: any, activityId: string, questions: any[]) {
  const { data: allSubs } = await supabase
    .from('submissions')
    .select('final_score, time_taken_seconds, is_complete, answers, time_per_question')
    .eq('activity_id', activityId)

  if (!allSubs?.length) return

  const done = allSubs.filter((s: any) => s.is_complete)

  const topLevel = {
    activity_id:       activityId,
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

  const questionStats = questions.filter(q => q?.id).map((q: any) => {
    let attempts = 0, correct = 0, timeSum = 0, timeCount = 0
    for (const sub of done) {
      const answers = parseJsonField<Record<string, string>>(sub.answers, {})
      const tpq     = parseJsonField<Record<string, unknown>>(sub.time_per_question, {})
      const raw     = answers[q.id]
      if (raw != null && raw !== '') {
        attempts++
        if (isCorrect(q, raw)) correct++
      }
      if (q.id in tpq) {
        timeSum += safeTime(tpq[q.id])
        timeCount++
      }
    }
    return {
      question_id: q.id,
      attempts,
      correct,
      accuracy: attempts  > 0 ? Math.round(correct / attempts * 100) : 0,
      avg_time: timeCount > 0 ? Math.round(timeSum  / timeCount * 10) / 10 : 0,
    }
  })

  // Merge with any existing stats for questions not in this quiz
  const { data: existing } = await supabase
    .from('analytics').select('question_stats')
    .eq('activity_id', activityId).single()

  const freshMap  = new Map(questionStats.map((s: any) => [s.question_id, s]))
  const merged    = (Array.isArray(existing?.question_stats) ? existing.question_stats : [])
    .map((e: any) => freshMap.has(e.question_id) ? freshMap.get(e.question_id) : e)
  const mergedIds = new Set(merged.map((e: any) => e.question_id))
  for (const s of questionStats) {
    if (!mergedIds.has(s.question_id)) merged.push(s)
  }

  await supabase.from('analytics').upsert(
    { ...topLevel, question_stats: merged },
    { onConflict: 'activity_id' },
  )
}

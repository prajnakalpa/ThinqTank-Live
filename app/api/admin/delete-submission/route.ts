// app/api/admin/delete-submission/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const serverSupabase = createClient()

    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await serverSupabase
      .from('users').select('role').eq('id', user.id).single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: sub } = await supabase
      .from('submissions')
      .select('activity_id, user_id')
      .eq('id', id)
      .single()

    await supabase.from('submissions').delete().eq('id', id)

    if (!sub) return NextResponse.json({ success: true })

    try {
      await supabase.from('leaderboard')
        .delete()
        .eq('activity_id', sub.activity_id)
        .eq('user_id', sub.user_id)

      const { data: remaining } = await supabase
        .from('submissions')
        .select('*')
        .eq('activity_id', sub.activity_id)
        .eq('is_complete', true)
        .order('final_score', { ascending: false })

      if (remaining) {
        await supabase.from('leaderboard').upsert(
          remaining.map((r: any, i: number) => ({
            activity_id: sub.activity_id,
            user_id: r.user_id,
            username: r.username,
            score: r.final_score,
            rank: i + 1,
          }))
        )
      }

    } catch (e) {
      console.error('Leaderboard rebuild failed', e)
    }

    return NextResponse.json({ success: true })

  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

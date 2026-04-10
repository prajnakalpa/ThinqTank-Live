import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const serverSupabase = createClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await serverSupabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { activityId, csvData } = await req.json()
  if (!activityId || !csvData) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  const supabase = createAdminClient()
  const lines: string[] = csvData.split('\n').filter((l: string) => l.trim())
  const header = lines[0].toLowerCase().split(',').map((h: string) => h.trim())
  const emailIdx = header.indexOf('email')
  const scoreIdx = header.indexOf('score')
  if (emailIdx === -1 || scoreIdx === -1) return NextResponse.json({ error: 'CSV must have email and score columns' }, { status: 400 })

  let updated = 0; const errors: string[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols  = lines[i].split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''))
    const email = cols[emailIdx]
    const score = parseFloat(cols[scoreIdx])
    if (!email || isNaN(score)) { errors.push(`Row ${i + 1}: invalid`); continue }
    const { error } = await supabase.from('submissions')
      .update({ final_score: score, score_overridden: true })
      .eq('activity_id', activityId).eq('email', email)
    if (error) errors.push(`${email}: ${error.message}`)
    else updated++
  }

  return NextResponse.json({ updated, errors })
}

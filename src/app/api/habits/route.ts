// @ts-nocheck
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const [{ data: habits }, { data: logs }] = await Promise.all([
    sb.from('user_habits').select('*').eq('user_id', session.user.id).eq('is_active', true).order('sort_order'),
    sb.from('user_habit_logs').select('habit_id').eq('user_id', session.user.id).eq('log_date', today),
  ])
  return NextResponse.json({ habits: habits || [], todayLogs: (logs || []).map(l => l.habit_id) })
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await req.json()
  const sb = createServiceClient()
  const { data, error } = await sb.from('user_habits').insert({ user_id: session.user.id, name: body.name, emoji: body.emoji||'✅', category: body.category||'Personal', frequency: body.frequency||'daily', time_of_day: body.time_of_day||null, is_active: true, sort_order: 0 }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ habit: data })
}
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { habitId, date } = await req.json()
  const sb = createServiceClient()
  const { error } = await sb.from('user_habit_logs').upsert({ user_id: session.user.id, habit_id: habitId, log_date: date||new Date().toISOString().slice(0,10), completed: true }, { onConflict: 'user_id,habit_id,log_date' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { habitId, date } = await req.json()
  await createServiceClient().from('user_habit_logs').delete().eq('user_id', session.user.id).eq('habit_id', habitId).eq('log_date', date||new Date().toISOString().slice(0,10))
  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const supabase = createServiceClient()
  const { data } = await supabase.from('financial_goals').select('*').eq('user_id', session.user.id).order('created_at')
  return NextResponse.json({ goals: data || [] })
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await req.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('financial_goals').insert({ ...body, user_id: session.user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ goal: data })
}
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const supabase = createServiceClient()
  const { data: goal } = await supabase.from('financial_goals').select('target_amount').eq('id', id).single()
  if (goal && updates.current_amount >= goal.target_amount) updates.is_completed = true
  const { data, error } = await supabase.from('financial_goals').update(updates).eq('id', id).eq('user_id', session.user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ goal: data })
}
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const supabase = createServiceClient()
  await supabase.from('financial_goals').delete().eq('id', id).eq('user_id', session.user.id)
  return NextResponse.json({ success: true })
}

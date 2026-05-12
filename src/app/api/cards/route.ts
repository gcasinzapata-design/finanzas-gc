import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const supabase = createServiceClient()
  const { data } = await supabase.from('credit_cards').select('*').eq('user_id', session.user.id).eq('is_active', true).order('created_at')
  return NextResponse.json({ cards: data || [] })
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await req.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('credit_cards').insert({ ...body, user_id: session.user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ card: data })
}
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const supabase = createServiceClient()
  await supabase.from('credit_cards').update({ is_active: false }).eq('id', id).eq('user_id', session.user.id)
  return NextResponse.json({ success: true })
}

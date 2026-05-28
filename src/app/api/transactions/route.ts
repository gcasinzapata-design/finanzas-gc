import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '500')
  const month = searchParams.get('month') // YYYY-MM
  const category = searchParams.get('category')
  const currency = searchParams.get('currency') || 'PEN'
  const type = searchParams.get('type')
  const recurring = searchParams.get('recurring')
  const source = searchParams.get('source') // 'eecc' | 'gmail' | null (all)
  const supabase = createServiceClient()

  let query = supabase
    .from('transactions')
    .select('id,bank,amount,currency,type,category,description,merchant,date,source,is_recurring,recurring_label,created_at')
    .eq('user_id', session.user.id)
    .eq('currency', currency)
    .order('date', { ascending: false })
    .limit(limit)

  if (month) {
    const start = `${month}-01`
    const end = new Date(parseInt(month.slice(0,4)), parseInt(month.slice(5,7)), 0).toISOString().slice(0,10)
    query = query.gte('date', start).lte('date', end)
  }
  if (category) query = query.eq('category', category)
  if (type) query = query.eq('type', type)
  if (recurring === 'true') query = query.eq('is_recurring', true)
  if (source) query = query.eq('source', source)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transactions: data || [], total: data?.length || 0 })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    const body = await req.json()
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('transactions').insert({ ...body, user_id: session.user.id }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ transaction: data })
  } catch (e: unknown) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const supabase = createServiceClient()
  await supabase.from('transactions').delete().eq('id', id).eq('user_id', session.user.id)
  return NextResponse.json({ success: true })
}

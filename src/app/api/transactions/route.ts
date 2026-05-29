// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '800')
  const month = searchParams.get('month')
  const category = searchParams.get('category')
  const currency = searchParams.get('currency')
  const type = searchParams.get('type')
  const recurring = searchParams.get('recurring')
  const source = searchParams.get('source') // if not provided, show all sources

  const supabase = createServiceClient()

  let query = supabase
    .from('transactions')
    .select('id,bank,amount,amount_pen,fx_rate,currency,type,category,description,merchant,date,source,is_recurring,recurring_label,created_at')
    .eq('user_id', session.user.id)
    .order('date', { ascending: false })
    .limit(limit)

  if (month) query = query.ilike('date', `${month}%`)
  if (category) query = query.eq('category', category)
  if (currency) query = query.eq('currency', currency)
  if (type) query = query.eq('type', type)
  if (recurring === 'true') query = query.eq('is_recurring', true)
  // Only filter by source if explicitly requested
  if (source) query = query.eq('source', source)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const transactions = (data || []).map(t => ({
    ...t,
    amount: Number(t.amount),
    amount_pen: Number(t.amount_pen || t.amount),
    fx_rate: Number(t.fx_rate || 1),
  }))

  return NextResponse.json({ transactions, total: transactions.length })
}

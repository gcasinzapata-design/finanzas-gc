// @ts-nocheck
// Manual transaction entry — for cash, Yape, or any tx not in EECCs
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'
import { createHash } from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const uid = session.user.id
  const body = await req.json()
  const {
    amount, currency = 'PEN', type, category, merchant, description, date, bank = 'Manual', notes,
  } = body

  if (!amount || !type || !category || !date)
    return NextResponse.json({ error: 'Faltan campos: amount, type, category, date' }, { status: 400 })

  const fxRate = currency === 'USD' ? 3.72 : 1.0
  const amtPen = Math.round(Number(amount) * fxRate * 100) / 100

  const hash = createHash('md5')
    .update(`${uid}|manual|${date}|${Math.round(Number(amount) * 100)}|${(merchant||description||'').slice(0,40)}|${Date.now()}`)
    .digest('hex')

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('transactions').insert({
    user_id: uid, bank, amount: Number(amount),
    currency, amount_pen: amtPen, fx_rate: fxRate,
    type, category,
    description: description || merchant || 'Ingreso manual',
    merchant: merchant || null,
    date: `${date}T12:00:00+00:00`,
    source: 'manual', is_recurring: false, eecc_hash: hash,
    // Store notes in description if provided
    ...(notes ? { description: `${description || merchant || ''} — ${notes}`.trim() } : {}),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, transaction: data })
}

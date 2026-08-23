// @ts-nocheck
// EECC smart validation — compares parsed transactions vs existing DB
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

// POST /api/eecc/validate — validate parsed EECC transactions
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = session.user.id
  const { transactions } = await req.json()
  if (!transactions?.length) return NextResponse.json({ error: 'No hay transacciones' }, { status: 400 })

  const supabase = createServiceClient()

  // Get existing txs for relevant months
  const dates = transactions.map(t => t.date?.slice(0, 10)).filter(Boolean).sort()
  const { data: existing } = await supabase
    .from('transactions').select('id,date,amount,currency,merchant,description,bank,eecc_hash,source')
    .eq('user_id', uid).gte('date', dates[0]).lte('date', dates[dates.length - 1] + 'T23:59:59')

  const rows = existing || []

  const results = transactions.map(tx => {
    const txAmt = Math.round(Number(tx.amount) * 100)
    const txDate = tx.date?.slice(0, 10)

    // Exact hash
    if (tx.eecc_hash && rows.some(e => e.eecc_hash === tx.eecc_hash))
      return { ...tx, status: 'duplicate_exact', reason: 'Hash idéntico en DB' }

    // Exact: date + amount + currency
    const exact = rows.find(e =>
      e.date?.slice(0, 10) === txDate &&
      Math.round(Number(e.amount) * 100) === txAmt &&
      (e.currency || 'PEN') === (tx.currency || 'PEN')
    )
    if (exact)
      return { ...tx, status: 'duplicate_exact', reason: `Ya existe: ${exact.merchant || exact.description?.slice(0,30)} (${exact.source})`, matchId: exact.id }

    // Fuzzy: ±1 day + same amount
    const d = new Date(txDate).getTime()
    const fuzzy = rows.find(e => {
      const dayDiff = Math.abs(new Date(e.date?.slice(0, 10)).getTime() - d) / 86400000
      return dayDiff <= 1 && Math.round(Number(e.amount) * 100) === txAmt
    })
    if (fuzzy)
      return { ...tx, status: 'duplicate_fuzzy', reason: `Posible duplicado: ${fuzzy.merchant || fuzzy.description?.slice(0,25)} el ${fuzzy.date?.slice(0,10)} (${fuzzy.source})`, matchId: fuzzy.id }

    return { ...tx, status: 'new' }
  })

  return NextResponse.json({
    summary: {
      total: results.length,
      new: results.filter(r => r.status === 'new').length,
      duplicate_exact: results.filter(r => r.status === 'duplicate_exact').length,
      duplicate_fuzzy: results.filter(r => r.status === 'duplicate_fuzzy').length,
    },
    transactions: results,
  })
}

// PUT /api/eecc/validate — confirm and insert selected transactions
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = session.user.id
  const { transactions } = await req.json()
  if (!transactions?.length) return NextResponse.json({ error: 'No hay transacciones' }, { status: 400 })

  const supabase = createServiceClient()
  let inserted = 0; const errors: any[] = []

  for (const tx of transactions) {
    const { error } = await supabase.from('transactions').upsert({
      user_id: uid, bank: tx.bank || 'Manual',
      amount: Number(tx.amount), currency: tx.currency || 'PEN',
      amount_pen: Number(tx.amount_pen || tx.amount), fx_rate: Number(tx.fx_rate || 1),
      type: tx.type, category: tx.category,
      description: tx.description || tx.merchant || '—', merchant: tx.merchant || null,
      date: `${tx.date?.slice(0, 10)}T12:00:00+00:00`,
      source: tx.source || 'eecc', is_recurring: false, eecc_hash: tx.eecc_hash,
    }, { onConflict: 'eecc_hash', ignoreDuplicates: true })

    if (error) errors.push({ tx: tx.merchant, err: error.message })
    else inserted++
  }

  return NextResponse.json({ success: true, inserted, errors })
}

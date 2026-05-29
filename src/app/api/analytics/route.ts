// @ts-nocheck
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const monthFilter = url.searchParams.get('month') || null // null = all months

  const supabase = createServiceClient()
  const uid = session.user.id

  let query = supabase
    .from('transactions')
    .select('id,bank,amount,amount_pen,currency,fx_rate,type,category,description,merchant,date,source,is_recurring,recurring_label')
    .eq('user_id', uid)
    .eq('source', 'eecc')
    .order('date', { ascending: false })
    .limit(1500)

  if (monthFilter) query = query.ilike('date', `${monthFilter}%`)

  const { data: tx } = await query
  const rows = tx || []

  const MONTHS = ['2026-02', '2026-03', '2026-04']

  // Monthly snapshots - use amount_pen for unified currency
  // Exclude: Ahorro (WARDA), transferencias, pagos de tarjeta
  const snapshots = MONTHS.map(m => {
    const month = rows.filter(t => t.date?.startsWith(m))
    const gastos = month.filter(t => t.type === 'gasto' && t.category !== 'Ahorro' && t.category !== 'Cuotas Préstamos')
    const ingresos = month.filter(t => t.type === 'ingreso' && t.category === 'Sueldo')
    const ahorro = month.filter(t => t.category === 'Ahorro')
    const fijos = gastos.filter(t => t.is_recurring)

    const totalGastos = gastos.reduce((s, t) => s + Number(t.amount_pen || t.amount), 0)
    const totalIngresos = ingresos.reduce((s, t) => s + Number(t.amount_pen || t.amount), 0)
    const totalAhorro = ahorro.reduce((s, t) => s + Number(t.amount_pen || t.amount), 0)
    const totalFijos = fijos.reduce((s, t) => s + Number(t.amount_pen || t.amount), 0)

    const byCat = {}
    gastos.forEach(t => {
      const c = t.category || 'Otros'
      byCat[c] = (byCat[c] || 0) + Number(t.amount_pen || t.amount)
    })

    const byMerch = {}
    gastos.forEach(t => {
      if (t.merchant) byMerch[t.merchant] = (byMerch[t.merchant] || 0) + Number(t.amount_pen || t.amount)
    })
    const topMerch = Object.entries(byMerch).sort(([,a],[,b]) => b-a).slice(0, 10)
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }))

    // USD transactions
    const usdTx = month.filter(t => t.currency === 'USD' && t.type !== 'transferencia')

    return {
      month: m,
      totalGastos: Math.round(totalGastos),
      totalIngresos: Math.round(totalIngresos),
      totalAhorro: Math.round(totalAhorro),
      fijos: Math.round(totalFijos),
      byCat,
      topMerch,
      count: gastos.length,
      usdCount: usdTx.length,
    }
  })

  // Category trend (all months)
  const allCats = [...new Set(rows.filter(t => t.type==='gasto' && t.category !== 'Ahorro').map(t => t.category || 'Otros'))]
  const categoryTrend = allCats.map(cat => {
    const monthly = MONTHS.map(m => {
      const items = rows.filter(t => t.date?.startsWith(m) && t.type==='gasto' && (t.category||'Otros')===cat)
      const total = items.reduce((s,t) => s + Number(t.amount_pen || t.amount), 0)
      const merchants = {}
      items.forEach(t => { if(t.merchant) merchants[t.merchant] = (merchants[t.merchant]||0) + Number(t.amount_pen||t.amount) })
      const topMerch = Object.entries(merchants).sort(([,a],[,b]) => b-a).slice(0,5)
        .map(([name,amount]) => ({ name, amount: Math.round(amount) }))
      return { month: m, total: Math.round(total), count: items.length, topMerch }
    })
    const prev = monthly[monthly.length-2]?.total || 0
    const last = monthly[monthly.length-1]?.total || 0
    const delta = prev > 0 ? ((last - prev) / prev) * 100 : 0

    // All merchants for this category (for drill-down)
    const allMerch = {}
    rows.filter(t => t.type==='gasto' && (t.category||'Otros')===cat).forEach(t => {
      if (t.merchant) {
        if (!allMerch[t.merchant]) allMerch[t.merchant] = { total: 0, count: 0, lastDate: t.date }
        allMerch[t.merchant].total += Number(t.amount_pen || t.amount)
        allMerch[t.merchant].count++
        if (t.date > allMerch[t.merchant].lastDate) allMerch[t.merchant].lastDate = t.date
      }
    })
    const merchantList = Object.entries(allMerch)
      .map(([name, d]) => ({ name, total: Math.round(d.total), count: d.count, lastDate: d.lastDate?.slice(0,10) }))
      .sort((a, b) => b.total - a.total)

    return { category: cat, monthly, delta: Math.round(delta), last, prev, merchantList }
  }).sort((a, b) => b.last - a.last)

  // Daily spending
  const targetMonth = monthFilter || '2026-04'
  const dailyMap = {}
  rows.filter(t => t.date?.startsWith(targetMonth) && t.type==='gasto' && t.category !== 'Ahorro').forEach(t => {
    const d = t.date?.slice(0,10)
    if (d) dailyMap[d] = (dailyMap[d]||0) + Number(t.amount_pen || t.amount)
  })
  const dailySpend = Object.entries(dailyMap).sort(([a],[b]) => a.localeCompare(b))
    .map(([date,amount]) => ({ date, amount: Math.round(amount) }))
  const avgDaily = dailySpend.length > 0 ? Math.round(dailySpend.reduce((s,d)=>s+d.amount,0) / dailySpend.length) : 0

  // USD summary
  const usdRows = rows.filter(t => t.currency === 'USD' && t.type === 'gasto')
  const usdSummary = usdRows.map(t => ({
    id: t.id,
    date: t.date?.slice(0,10),
    merchant: t.merchant,
    description: t.description?.slice(0,40),
    amount_usd: Number(t.amount),
    amount_pen: Number(t.amount_pen || 0),
    fx_rate: Number(t.fx_rate || 0),
    category: t.category,
    bank: t.bank,
    type: t.type,
  }))

  return NextResponse.json({
    snapshots,
    categoryTrend,
    dailySpend,
    avgDaily,
    usdSummary,
    transactions: rows.map(t => ({ ...t, amount: Number(t.amount), amount_pen: Number(t.amount_pen || t.amount) }))
  })
}

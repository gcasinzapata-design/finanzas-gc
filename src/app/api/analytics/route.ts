// @ts-nocheck
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(req.url)
  // month param ONLY used to choose which month's daily breakdown to show — never filters the DB query
  const selectedMonth = url.searchParams.get('month') || null

  const supabase = createServiceClient()
  const uid = session.user.id

  // Always load ALL months — never filter by month here
  const { data: tx } = await supabase
    .from('transactions')
    .select('id,bank,amount,amount_pen,currency,fx_rate,type,category,description,merchant,date,source,is_recurring,recurring_label')
    .eq('user_id', uid)
    .in('source', ['eecc', 'gmail'])
    .order('date', { ascending: false })
    .limit(2000)

  const rows = tx || []

  // Real expense: not Ahorro/WARDA, not transferencia
  const isGasto = (t) => t.type === 'gasto' && t.category !== 'Ahorro'
  const amtPen = (t) => Number(t.amount_pen || t.amount || 0)

  // Build month list from actual data
  const ALL_MONTHS = [...new Set(rows.map(t => t.date?.slice(0, 7)).filter(Boolean))].sort()

  // Monthly snapshots for ALL months
  const snapshots = ALL_MONTHS.map(m => {
    const mRows = rows.filter(t => t.date?.startsWith(m))
    const gastos = mRows.filter(isGasto)
    const ingresos = mRows.filter(t => t.type === 'ingreso' && t.category === 'Sueldo')
    const fijos = gastos.filter(t => t.is_recurring)
    const variables = gastos.filter(t => !t.is_recurring)

    const totalGastos = gastos.reduce((s, t) => s + amtPen(t), 0)
    const totalIngresos = ingresos.reduce((s, t) => s + amtPen(t), 0)
    const totalFijos = fijos.reduce((s, t) => s + amtPen(t), 0)
    const totalVariables = variables.reduce((s, t) => s + amtPen(t), 0)

    const byCat = {}
    gastos.forEach(t => { const c = t.category || 'Otros'; byCat[c] = (byCat[c] || 0) + amtPen(t) })

    const byMerch = {}
    gastos.forEach(t => { if (t.merchant) byMerch[t.merchant] = (byMerch[t.merchant] || 0) + amtPen(t) })
    const topMerch = Object.entries(byMerch).sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }))

    return {
      month: m,
      totalGastos: Math.round(totalGastos),
      totalIngresos: Math.round(totalIngresos),
      totalFijos: Math.round(totalFijos),
      fijos: Math.round(totalFijos), // alias
      totalVariables: Math.round(totalVariables),
      byCat,
      topMerch,
      count: gastos.length,
    }
  })

  // Category trend across all months
  const allCats = [...new Set(rows.filter(isGasto).map(t => t.category || 'Otros'))]
  const categoryTrend = allCats.map(cat => {
    const monthly = ALL_MONTHS.map(m => {
      const items = rows.filter(t => t.date?.startsWith(m) && isGasto(t) && (t.category || 'Otros') === cat)
      const total = items.reduce((s, t) => s + amtPen(t), 0)
      return { month: m, total: Math.round(total), count: items.length }
    })

    // MoM vs last 2 available months
    const nonZeroMonths = monthly.filter(m => m.total > 0)
    const last = monthly[monthly.length - 1]?.total || 0
    const prev = monthly[monthly.length - 2]?.total || 0
    const delta = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0

    // Merchant list across all history
    const allMerch = {}
    rows.filter(t => isGasto(t) && (t.category || 'Otros') === cat).forEach(t => {
      if (!t.merchant) return
      if (!allMerch[t.merchant]) allMerch[t.merchant] = { total: 0, count: 0, lastDate: '' }
      allMerch[t.merchant].total += amtPen(t)
      allMerch[t.merchant].count++
      if (!allMerch[t.merchant].lastDate || t.date > allMerch[t.merchant].lastDate)
        allMerch[t.merchant].lastDate = t.date
    })
    const merchantList = Object.entries(allMerch)
      .map(([name, d]) => ({ name, total: Math.round(d.total), count: d.count, lastDate: d.lastDate?.slice(0, 10) }))
      .sort((a, b) => b.total - a.total)

    const total = monthly.reduce((s, m) => s + m.total, 0)
    return { category: cat, monthly, delta, last, prev, merchantList, total }
  }).sort((a, b) => b.last - a.last)

  // Daily spending — use selectedMonth or most recent month
  const targetMonth = selectedMonth || ALL_MONTHS[ALL_MONTHS.length - 1] || ''
  const dailyMap = {}
  rows.filter(t => t.date?.startsWith(targetMonth) && isGasto(t)).forEach(t => {
    const d = t.date?.slice(0, 10)
    if (d) dailyMap[d] = (dailyMap[d] || 0) + amtPen(t)
  })
  const dailySpend = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount: Math.round(amount) }))
  const avgDaily = dailySpend.length > 0 ? Math.round(dailySpend.reduce((s, d) => s + d.amount, 0) / dailySpend.length) : 0

  // USD summary
  const usdSummary = rows
    .filter(t => t.currency === 'USD' && t.type === 'gasto')
    .map(t => ({
      id: t.id, date: t.date?.slice(0, 10), merchant: t.merchant,
      description: t.description?.slice(0, 40),
      amount_usd: Number(t.amount), amount_pen: Number(t.amount_pen || 0),
      fx_rate: Number(t.fx_rate || 0), category: t.category, bank: t.bank,
    }))

  return NextResponse.json({
    snapshots,
    categoryTrend,
    dailySpend,
    avgDaily,
    usdSummary,
    months: ALL_MONTHS,
    selectedMonth: targetMonth,
    transactions: rows.map(t => ({ ...t, amount: Number(t.amount), amount_pen: amtPen(t), fx_rate: Number(t.fx_rate || 1) })),
  })
}

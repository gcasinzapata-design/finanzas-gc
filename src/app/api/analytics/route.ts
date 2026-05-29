// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const uid = session.user.id

  const { data: tx } = await supabase
    .from('transactions')
    .select('id,bank,amount,currency,type,category,description,merchant,date,source,is_recurring,recurring_label')
    .eq('user_id', uid)
    .eq('source', 'eecc')
    .eq('currency', 'PEN')
    .order('date', { ascending: false })
    .limit(1000)

  const rows = (tx || [])

  const MONTHS = ['2026-02', '2026-03', '2026-04']

  // Monthly snapshots
  const snapshots = MONTHS.map(m => {
    const month = rows.filter(t => t.date?.startsWith(m))
    const gastos = month.filter(t => t.type === 'gasto')
    const ingresos = month.filter(t => t.type === 'ingreso')
    const totalGastos = gastos.reduce((s, t) => s + Number(t.amount), 0)
    const totalIngresos = ingresos.filter(t => t.category === 'Sueldo').reduce((s, t) => s + Number(t.amount), 0)
    const fijos = gastos.filter(t => t.is_recurring).reduce((s, t) => s + Number(t.amount), 0)
    const byCat = {}
    gastos.forEach(t => { const c = t.category || 'Otros'; byCat[c] = (byCat[c] || 0) + Number(t.amount) })
    const byMerch = {}
    gastos.forEach(t => { if (t.merchant) byMerch[t.merchant] = (byMerch[t.merchant] || 0) + Number(t.amount) })
    const topMerch = Object.entries(byMerch).sort(([,a],[,b]) => b-a).slice(0, 8).map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    return { month: m, totalGastos: Math.round(totalGastos), totalIngresos: Math.round(totalIngresos), fijos: Math.round(fijos), byCat, topMerch, count: gastos.length }
  })

  // Category trend
  const allCats = [...new Set(rows.filter(t => t.type==='gasto').map(t => t.category || 'Otros'))]
  const categoryTrend = allCats.map(cat => {
    const monthly = MONTHS.map(m => {
      const total = rows.filter(t => t.date?.startsWith(m) && t.type==='gasto' && (t.category||'Otros')===cat).reduce((s,t) => s+Number(t.amount), 0)
      return { month: m, total: Math.round(total) }
    })
    const prev = monthly[monthly.length-2]?.total || 0
    const last = monthly[monthly.length-1]?.total || 0
    const delta = prev > 0 ? ((last - prev) / prev) * 100 : 0
    return { category: cat, monthly, delta: Math.round(delta), last, prev }
  }).sort((a, b) => b.last - a.last)

  // Daily spending Apr
  const aprGastos = rows.filter(t => t.date?.startsWith('2026-04') && t.type==='gasto')
  const dailyMap = {}
  aprGastos.forEach(t => { const d = t.date?.slice(0,10); if (d) dailyMap[d] = (dailyMap[d]||0) + Number(t.amount) })
  const dailySpend = Object.entries(dailyMap).sort(([a],[b]) => a.localeCompare(b)).map(([date,amount]) => ({ date, amount: Math.round(amount) }))
  const avgDaily = dailySpend.length > 0 ? Math.round(dailySpend.reduce((s,d)=>s+d.amount,0) / dailySpend.length) : 0

  return NextResponse.json({ snapshots, categoryTrend, dailySpend, avgDaily, transactions: rows.map(t => ({ ...t, amount: Number(t.amount) })) })
}

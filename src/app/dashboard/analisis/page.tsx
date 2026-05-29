'use client'
import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line, ReferenceLine } from 'recharts'

const S = (n: number) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0 }).format(n || 0)}`
const S2 = (n: number) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n || 0)}`
const MN: Record<string,string> = { '2026-02':'Feb 26', '2026-03':'Mar 26', '2026-04':'Abr 26' }

function Stat({ label, value, sub, color = 'var(--text-1)' }: any) {
  return (
    <div className="p-4" style={{ borderRight: '1px solid var(--border)' }}>
      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-xl font-bold num" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>}
    </div>
  )
}

export default function AnalisisPage() {
  const [data, setData] = useState<any>(null)
  const [cards, setCards] = useState<any[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics').then(r => r.json()),
      fetch('/api/cards').then(r => r.json()),
      fetch('/api/debts').then(r => r.json()),
    ]).then(([a, c, d]) => {
      setData(a); setCards(c.cards || []); setDebts(d.debts || [])
      setLoading(false)
    })
  }, [])

  const snap = data?.snapshots || []
  const curr = snap[snap.length - 1] || {}
  const prev = snap[snap.length - 2] || {}

  // ── Cashflow waterfall data ──
  const waterfallData = useMemo(() => {
    if (!curr.totalIngresos) return []
    const items = [
      { name: 'Sueldo', value: curr.totalIngresos, type: 'ingreso' },
      { name: 'Seguros', value: -(curr.byCat?.Seguros || 0), type: 'gasto' },
      { name: 'Deudas', value: -(curr.byCat?.Deudas || 0), type: 'gasto' },
      { name: 'Delivery', value: -(curr.byCat?.Delivery || 0), type: 'gasto' },
      { name: 'Restaurantes', value: -(curr.byCat?.Restaurantes || 0), type: 'gasto' },
      { name: 'Transporte', value: -(curr.byCat?.Transporte || 0), type: 'gasto' },
      { name: 'Supermercados', value: -(curr.byCat?.Supermercados || 0), type: 'gasto' },
      { name: 'Otros gastos', value: -(Object.entries(curr.byCat || {}).filter(([k]) => !['Seguros','Deudas','Delivery','Restaurantes','Transporte','Supermercados'].includes(k)).reduce((s,[,v])=>s+Number(v),0)), type: 'gasto' },
    ].filter(i => i.value !== 0)
    let running = 0
    return items.map(item => {
      const start = item.type === 'ingreso' ? 0 : running + item.value
      running += item.value
      return { ...item, start: Math.max(0, start), end: running, abs: Math.abs(item.value) }
    })
  }, [curr])

  // ── Spending by day of week ──
  const byDow = useMemo(() => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const totals = new Array(7).fill(0)
    const counts = new Array(7).fill(0);
    (data?.transactions || []).filter((t: any) => t.type === 'gasto').forEach((t: any) => {
      const d = new Date(t.date)
      totals[d.getDay()] += Number(t.amount)
      counts[d.getDay()]++
    })
    return days.map((name, i) => ({ name, total: Math.round(totals[i]), avg: counts[i] > 0 ? Math.round(totals[i] / counts[i]) : 0 }))
  }, [data])

  // ── Category efficiency: cost per transaction ──
  const catEff = useMemo(() => {
    const byCat: Record<string, { total: number; count: number }> = {}
    ;(data?.transactions || []).filter((t: any) => t.type === 'gasto' && t.date?.startsWith('2026-04')).forEach((t: any) => {
      const c = t.category || 'Otros'
      if (!byCat[c]) byCat[c] = { total: 0, count: 0 }
      byCat[c].total += Number(t.amount)
      byCat[c].count++
    })
    return Object.entries(byCat).map(([cat, { total, count }]) => ({
      cat, total: Math.round(total), count, avg: Math.round(total / count)
    })).sort((a, b) => b.total - a.total).slice(0, 8)
  }, [data])

  // ── Debt paydown ──
  const debtAll = [...cards.filter(c=>Number(c.current_balance)>0), ...debts.filter(d=>Number(d.current_balance)>0)]
  const totalDebt = debtAll.reduce((s, d) => s + Number(d.current_balance || 0), 0)
  const monthlyPayment = debtAll.reduce((s, d) => s + Number(d.monthly_payment || d.minimum_payment || 0), 0)
  const avgRate = debtAll.length > 0
    ? debtAll.reduce((s,d) => s + Number(d.tcea||d.tea||0) * Number(d.current_balance||0), 0) / totalDebt
    : 0
  const monthlyInterest = totalDebt * (avgRate / 100) / 12
  const capitalPaid = Math.max(0, monthlyPayment - monthlyInterest)
  const monthsToFree = capitalPaid > 0 ? Math.ceil(totalDebt / capitalPaid) : 999

  // ── Debt projection 24 months ──
  const debtProj = useMemo(() => {
    let bal = totalDebt
    return Array.from({ length: 25 }, (_, i) => {
      const p = { month: i === 0 ? 'Hoy' : `+${i}m`, balance: Math.max(0, Math.round(bal)) }
      if (i > 0) {
        const interest = bal * (avgRate / 100) / 12
        bal = Math.max(0, bal - monthlyPayment + interest)
      }
      return p
    })
  }, [totalDebt, monthlyPayment, avgRate])

  // ── Daily spending ──
  const dailyData = data?.dailySpend || []

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-5 space-y-5 max-w-6xl mx-auto" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div>
        <h1 className="text-xl font-bold text-white">Análisis Financiero</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Métricas avanzadas · Abr 2026</p>
      </div>

      {/* KPI Strip */}
      <div className="card grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0" style={{ borderColor: 'var(--border)' }}>
        <Stat label="Gasto promedio/día" value={S(data?.avgDaily || 0)} sub="Abril 2026" color="#f97316"/>
        <Stat label="Interés mensual" value={S(monthlyInterest)} sub={`TEA prom. ${avgRate.toFixed(1)}%`} color="#ef4444"/>
        <Stat label="Capital pagado/mes" value={S(capitalPaid)} sub="Abono neto a capital" color="#10b981"/>
        <Stat label="Meses para liberarse" value={monthsToFree < 999 ? `${monthsToFree} meses` : '∞'} sub="Con pagos actuales" color="#8b5cf6"/>
      </div>

      {/* Cashflow Waterfall */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-white mb-1">Cascada de Gastos — Abr 2026</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>Cómo se distribuye el sueldo</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={waterfallData}>
            <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
            <Tooltip contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11 }} formatter={(v: any, name: any, props: any) => [S(props.payload?.abs || v), props.payload?.name]}/>
            <Bar dataKey="abs" radius={[4,4,0,0]}>
              {waterfallData.map((entry: any, i: number) => (
                <rect key={i} fill={entry.type === 'ingreso' ? '#10b981' : (i % 2 === 0 ? '#ef4444' : '#dc2626')}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grid: Daily + DoW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Daily spending */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Gasto Diario — Abr</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>Promedio: {S(data?.avgDaily || 0)}/día</p>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 9 }} tickFormatter={d => d?.slice(8)} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [S(v), 'Gasto']}/>
              <ReferenceLine y={data?.avgDaily || 0} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1}/>
              <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" strokeWidth={1.5}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Day of week */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Gasto por Día de Semana</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>Total histórico acumulado</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={byDow}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11 }} formatter={(v: any, name: any) => [S(v), name === 'total' ? 'Total' : 'Prom/tx']}/>
              <Bar dataKey="total" fill="#8b5cf6" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Debt paydown projection */}
      <div className="card p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Proyección de Deuda (24 meses)</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Deuda total: {S(totalDebt)} · Pago mensual: {S(monthlyPayment)} · Interés: {S(monthlyInterest)}/mes
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={debtProj}>
            <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={3}/>
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
            <Tooltip contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [S(v), 'Deuda restante']}/>
            <Area type="monotone" dataKey="balance" stroke="#ef4444" fill="rgba(239,68,68,0.08)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {debtAll.filter(d => Number(d.current_balance)>0).sort((a,b) => Number(b.current_balance)-Number(a.current_balance)).slice(0,3).map((d: any, i: number) => (
            <div key={i} className="p-3 rounded-xl text-xs" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
              <p className="font-medium truncate" style={{ color: 'var(--text-1)' }}>{d.name || d.bank + ' ' + d.name_}</p>
              <p className="text-red-400 font-bold num mt-0.5">{S(Number(d.current_balance))}</p>
              <p style={{ color: 'var(--text-3)' }}>{d.tcea || d.tea || '?'}% TCEA</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category efficiency */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold text-white">Eficiencia por Categoría — Abr</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Total, cantidad y monto promedio por transacción</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Categoría', 'Total', 'Transacciones', 'Promedio/tx', '% del total'].map(h => (
                <th key={h} className="text-left px-4 py-2.5" style={{ color: 'var(--text-3)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catEff.map(({ cat, total, count, avg }, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-1)' }}>{cat}</td>
                <td className="px-4 py-2.5 num font-semibold text-white">{S(total)}</td>
                <td className="px-4 py-2.5" style={{ color: 'var(--text-2)' }}>{count}x</td>
                <td className="px-4 py-2.5 num" style={{ color: 'var(--text-2)' }}>{S(avg)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${(total / catEff[0].total) * 100}%` }}/>
                    </div>
                    <span style={{ color: 'var(--text-3)' }}>{((total / curr.totalGastos) * 100).toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}

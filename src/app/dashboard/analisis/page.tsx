// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(n||0)}`
const MN = { '2026-01':'Ene','2026-02':'Feb','2026-03':'Mar','2026-04':'Abr','2026-05':'May' }

function Stat({ label, value, sub, color='var(--text-1)' }) {
  return (
    <div className="p-3 md:p-4">
      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-lg md:text-xl font-bold num" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>}
    </div>
  )
}

export default function AnalisisPage() {
  const [data, setData] = useState(null)
  const [cards, setCards] = useState([])
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState('')

  useEffect(() => {
    const params = month ? `?month=${month}` : ''
    Promise.all([
      fetch(`/api/analytics${params}`).then(r=>r.json()),
      fetch('/api/cards').then(r=>r.json()),
      fetch('/api/debts').then(r=>r.json()),
    ]).then(([a,c,d]) => {
      setData(a); setCards(c.cards||[]); setDebts(d.debts||[])
      setLoading(false)
    })
  }, [month])

  const snap = data?.snapshots || []
  const curr = snap[snap.length-1] || {}
  const months = data?.months || []
  const monthOptions = [{v:'',l:'Todos'}, ...months.map(m=>({v:m, l:MN[m]||m}))]

  // IMPORTANT: Exclude IBK Visa Access from cards — it's a loan (compra de deuda), shown in debts already
  const realCards = cards.filter(c => !(c.bank==='Interbank' && (c.name||'').toLowerCase().includes('access')))
  const allDebts = [...realCards.filter(c=>Number(c.current_balance)>0), ...debts.filter(d=>Number(d.current_balance)>0)]

  const totalDebt = allDebts.reduce((s,d)=>s+Number(d.current_balance||0),0)
  const monthlyPayment = allDebts.reduce((s,d)=>s+Number(d.monthly_payment||d.minimum_payment||0),0)
  const avgRate = allDebts.length > 0
    ? allDebts.reduce((s,d)=>s+Number(d.tcea||d.tea||0)*Number(d.current_balance||0),0) / totalDebt
    : 0
  const monthlyInterest = totalDebt * (avgRate/100) / 12
  const capitalPaid = Math.max(0, monthlyPayment - monthlyInterest)
  const monthsToFree = capitalPaid > 0 ? Math.ceil(totalDebt/capitalPaid) : 999

  // Day of week spending
  const byDow = useMemo(() => {
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    const totals = new Array(7).fill(0)
    const counts = new Array(7).fill(0)
    ;(data?.transactions||[]).filter(t=>t.type==='gasto'&&t.category!=='Ahorro').forEach(t => {
      const d = new Date(t.date)
      totals[d.getDay()] += Number(t.amount_pen||t.amount)
      counts[d.getDay()]++
    })
    return days.map((name,i) => ({ name, total: Math.round(totals[i]), avg: counts[i]>0?Math.round(totals[i]/counts[i]):0 }))
  }, [data])

  // Category efficiency
  const catEff = useMemo(() => {
    const targetMonth = month || months[months.length-1] || ''
    const byCat = {}
    ;(data?.transactions||[]).filter(t=>t.type==='gasto'&&t.category!=='Ahorro'&&(!targetMonth||t.date?.startsWith(targetMonth))).forEach(t => {
      const c = t.category||'Otros'
      if (!byCat[c]) byCat[c] = {total:0, count:0}
      byCat[c].total += Number(t.amount_pen||t.amount)
      byCat[c].count++
    })
    return Object.entries(byCat).map(([cat,{total,count}]) => ({
      cat, total:Math.round(total), count, avg:Math.round(total/count)
    })).sort((a,b)=>b.total-a.total).slice(0,8)
  }, [data, month, months])

  // Debt projection 24 months
  const debtProj = useMemo(() => {
    let bal = totalDebt
    return Array.from({length:25},(_,i) => {
      const p = { month: i===0?'Hoy':`+${i}m`, balance: Math.max(0,Math.round(bal)) }
      if (i>0) {
        const int = bal*(avgRate/100)/12
        bal = Math.max(0, bal - monthlyPayment + int)
      }
      return p
    })
  }, [totalDebt, monthlyPayment, avgRate])

  const dailyData = data?.dailySpend || []

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-6xl mx-auto" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white">Análisis Financiero</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Métricas avanzadas · moneda unificada PEN</p>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
          {monthOptions.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
      </div>

      {/* KPI strip */}
      <div className="card grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-x" style={{ borderColor: 'var(--border)' }}>
        <Stat label="Gasto prom/día" value={S(data?.avgDaily||0)} sub={`${month?MN[month]||month:'Último mes'}`} color="#f97316"/>
        <Stat label="Interés mensual" value={S(monthlyInterest)} sub={`TEA prom ${avgRate.toFixed(1)}%`} color="#ef4444"/>
        <Stat label="Capital pagado" value={S(capitalPaid)} sub="Abono neto/mes" color="#10b981"/>
        <Stat label="Meses para liberarse" value={monthsToFree<999?`${monthsToFree}m`:'∞'} sub="Con pagos actuales" color="#8b5cf6"/>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Daily spending */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Gasto Diario</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>Promedio: {S(data?.avgDaily||0)}/día</p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fill:'var(--text-3)', fontSize:9 }} tickFormatter={d=>d?.slice(8)} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{ background:'var(--bg-card2)', border:'1px solid var(--border2)', borderRadius:8, fontSize:11 }} formatter={v=>[S(v),'Gasto']}/>
              <ReferenceLine y={data?.avgDaily||0} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1}/>
              <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" strokeWidth={1.5}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Day of week */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Gasto por Día</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>Total histórico por día de la semana</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={byDow}>
              <XAxis dataKey="name" tick={{ fill:'var(--text-3)', fontSize:11 }} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{ background:'var(--bg-card2)', border:'1px solid var(--border2)', borderRadius:8, fontSize:11 }} formatter={v=>[S(v)]}/>
              <Bar dataKey="total" fill="#8b5cf6" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Debt projection */}
      <div className="card p-4">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Proyección de Deuda (24 meses)</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Total: {S(totalDebt)} · Pago/mes: {S(monthlyPayment)} · Interés/mes: {S(monthlyInterest)}
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={debtProj}>
            <XAxis dataKey="month" tick={{ fill:'var(--text-3)', fontSize:9 }} axisLine={false} tickLine={false} interval={3}/>
            <YAxis tick={{ fill:'var(--text-3)', fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
            <Tooltip contentStyle={{ background:'var(--bg-card2)', border:'1px solid var(--border2)', borderRadius:8, fontSize:11 }} formatter={v=>[S(v),'Deuda']}/>
            <Area type="monotone" dataKey="balance" stroke="#ef4444" fill="rgba(239,68,68,0.08)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>

        {/* Debt breakdown — only real cards + loans, NO IBK Access as card */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          {allDebts.sort((a,b)=>Number(b.current_balance)-Number(a.current_balance)).slice(0,6).map((d,i) => (
            <div key={i} className="p-3 rounded-xl" style={{ background:'var(--bg-card2)', border:'1px solid var(--border2)' }}>
              <p className="text-xs font-medium truncate" style={{ color:'var(--text-1)' }}>{d.name||`${d.bank} ${d.name}`}</p>
              <p className="text-sm font-bold num text-red-400 mt-0.5">{S(Number(d.current_balance))}</p>
              <p className="text-xs" style={{ color:'var(--text-3)' }}>{d.tcea||d.tea||'?'}% TCEA</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category efficiency */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor:'var(--border)' }}>
          <h2 className="text-sm font-semibold text-white">Eficiencia por Categoría</h2>
          <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>Total · transacciones · promedio por tx</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[400px]">
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['Categoría','Total','#','Prom/tx','% total'].map(h => (
                  <th key={h} className="text-left px-4 py-2" style={{ color:'var(--text-3)', fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catEff.map(({cat,total,count,avg},i) => (
                <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color:'var(--text-1)' }}>{cat}</td>
                  <td className="px-4 py-2.5 num font-semibold text-white">{S(total)}</td>
                  <td className="px-4 py-2.5" style={{ color:'var(--text-2)' }}>{count}x</td>
                  <td className="px-4 py-2.5 num" style={{ color:'var(--text-2)' }}>{S(avg)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 rounded-full overflow-hidden hidden md:block" style={{ background:'var(--border)' }}>
                        <div className="h-full bg-blue-500" style={{ width:`${catEff[0]?Math.round(total/catEff[0].total*100):0}%` }}/>
                      </div>
                      <span style={{ color:'var(--text-3)' }}>{curr.totalGastos > 0 ? ((total/curr.totalGastos)*100).toFixed(1)+'%' : '—'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, ArrowRight, RefreshCw, AlertTriangle, Repeat, ChevronDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(n||0)}`
const S2 = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:2}).format(n||0)}`
const MN = {'2026-01':'Ene','2026-02':'Feb','2026-03':'Mar','2026-04':'Abr','2026-05':'May'}
const CAT_CLR = {
  Seguros:'#f97316',Deudas:'#ef4444',Delivery:'#fb923c',Restaurantes:'#f59e0b',
  Transporte:'#3b82f6',Supermercados:'#84cc16',Entretenimiento:'#8b5cf6',
  Servicios:'#eab308',Alquiler:'#0ea5e9',Suscripciones:'#ec4899',Mascotas:'#14b8a6',
  Viajes:'#a78bfa',Sueldo:'#22c55e',Tecnología:'#06b6d4',Compras:'#f43f5e',Otros:'#64748b',
}
const TX_ICON = {
  Sueldo:'💰',Delivery:'🛵',Transporte:'🚗',Restaurantes:'🍽️',Seguros:'🔒',
  Supermercados:'🛒',Entretenimiento:'🎬',Deudas:'🏦',Mascotas:'🐾',Viajes:'✈️',
  Servicios:'⚡',Suscripciones:'📱',Alquiler:'🏠',Tecnología:'💻',Compras:'🛍️',Otros:'📦',
}

function Chip({ pct }) {
  const up = pct > 2, down = pct < -2
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${up?'text-red-400 bg-red-400/10':down?'text-green-400 bg-green-400/10':'text-slate-400 bg-slate-400/10'}`}>
      {up?'↑':down?'↓':'→'}{Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [cards, setCards] = useState([])
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')  // '' = latest

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [aR, cR, dR] = await Promise.all([
        fetch('/api/analytics').then(r => r.json()),
        fetch('/api/cards').then(r => r.json()),
        fetch('/api/debts').then(r => r.json()),
      ])
      setData(aR); setCards(cR.cards||[]); setDebts(dR.debts||[])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const snap = data?.snapshots || []
  const months = data?.months || []

  // Derive current snapshot from selectedMonth or latest
  const currSnap = useMemo(() => {
    if (!snap.length) return {}
    if (selectedMonth) return snap.find(s => s.month === selectedMonth) || snap[snap.length-1]
    return snap[snap.length-1]
  }, [snap, selectedMonth])

  const prevSnap = useMemo(() => {
    const idx = snap.findIndex(s => s.month === currSnap.month)
    return idx > 0 ? snap[idx-1] : {}
  }, [snap, currSnap])

  const currMonthLabel = MN[currSnap.month] || currSnap.month || '—'
  const prevMonthLabel = MN[prevSnap.month] || prevSnap.month || '—'

  const realCards = cards.filter(c => !(c.bank==='Interbank' && (c.name||'').toLowerCase().includes('access')))
  const totalDebt = realCards.reduce((s,c)=>s+Number(c.current_balance||0),0) + debts.reduce((s,d)=>s+Number(d.current_balance||0),0)
  const monthlyCommit = realCards.reduce((s,c)=>s+Number(c.minimum_payment||0),0) + debts.reduce((s,d)=>s+Number(d.monthly_payment||0),0)

  const balance = (currSnap.totalIngresos||0) - (currSnap.totalGastos||0)
  const prevBalance = (prevSnap.totalIngresos||0) - (prevSnap.totalGastos||0)
  const balancePct = prevBalance !== 0 ? ((balance - prevBalance) / Math.abs(prevBalance)) * 100 : 0

  // Cashflow chart — show all months or last 5
  const chartData = snap.slice(-5).map(s => ({
    month: MN[s.month]||s.month?.slice(5),
    Ingresos: s.totalIngresos,
    Fijos: s.totalFijos||s.fijos||0,
    Variables: s.totalVariables||Math.max(0,(s.totalGastos||0)-(s.totalFijos||s.fijos||0)),
    _active: s.month === currSnap.month,
  }))

  // Top 6 categories for current snapshot
  const topCats = useMemo(() => {
    if (!currSnap.byCat) return []
    return Object.entries(currSnap.byCat).sort(([,a],[,b])=>b-a).slice(0,6)
      .map(([cat,amt]) => {
        const prevAmt = prevSnap.byCat?.[cat] || 0
        const delta = prevAmt > 0 ? ((amt-prevAmt)/prevAmt)*100 : 0
        return { cat, amt, prevAmt, delta }
      })
  }, [currSnap, prevSnap])

  const recent = useMemo(() => (data?.transactions||[]).filter(t => !selectedMonth || t.date?.startsWith(selectedMonth)).slice(0,8), [data, selectedMonth])

  const monthOptions = [{ v:'', l:'Último mes' }, ...months.map(m => ({ v:m, l:(MN[m]||m)+' 2026' }))]

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{background:'var(--bg-base)'}}>
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-7xl mx-auto" style={{background:'var(--bg-base)',minHeight:'100vh'}}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white">Dashboard</h1>
          <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>
            {data?.transactions?.length||0} movimientos EECC · {months.length} meses
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Month selector */}
          <div className="relative">
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="text-sm pl-3 pr-8 py-2 rounded-xl appearance-none"
              style={{background:'var(--bg-card)',border:'1px solid var(--border)',color:'var(--text-1)'}}>
              {monthOptions.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:'var(--text-3)'}}/>
          </div>
          <button onClick={loadAll} className="p-2 rounded-xl" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
            <RefreshCw size={13} style={{color:'var(--text-3)'}}/>
          </button>
          <Link href="/dashboard/chat" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white"
            style={{background:'linear-gradient(135deg,#3b82f6,#8b5cf6)'}}>
            ✦ Copiloto
          </Link>
        </div>
      </div>

      {/* Balance Hero */}
      <div className="card p-4 md:p-5 relative overflow-hidden"
        style={{borderColor: balance>=0?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)'}}>
        <div className="absolute inset-0 opacity-5" style={{background:balance>=0?'radial-gradient(circle at 80% 50%,#10b981,transparent)':'radial-gradient(circle at 80% 50%,#ef4444,transparent)'}}/>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{color:'var(--text-3)'}}>
              Balance Neto — {currMonthLabel} {selectedMonth ? '2026' : ''}
            </p>
            <p className={`text-3xl md:text-4xl font-bold num ${balance>=0?'text-green-400':'text-red-400'}`}>{S2(balance)}</p>
            <div className="flex items-center gap-3 mt-2 text-sm flex-wrap" style={{color:'var(--text-2)'}}>
              <span className="flex items-center gap-1"><TrendingUp size={12} className="text-green-400"/> {S(currSnap.totalIngresos||0)}</span>
              <span className="text-slate-600">−</span>
              <span className="flex items-center gap-1"><TrendingDown size={12} className="text-red-400"/> {S(currSnap.totalGastos||0)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {prevBalance !== 0 && <Chip pct={balancePct}/>}
            <span className="text-xs hidden md:inline" style={{color:'var(--text-3)'}}>vs {prevMonthLabel}</span>
          </div>
        </div>
        {(currSnap.totalIngresos||0) > 0 && (currSnap.totalGastos||0) / (currSnap.totalIngresos||1) > 0.85 && (
          <div className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{background:'rgba(239,68,68,0.1)',color:'#fca5a5'}}>
            <AlertTriangle size={11}/>
            Gastos {(((currSnap.totalGastos||0)/(currSnap.totalIngresos||1))*100).toFixed(0)}% del ingreso
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {label:'Ingresos',value:currSnap.totalIngresos||0,prev:prevSnap.totalIngresos||0,sub:'Sueldo neto',color:'#10b981'},
          {label:'Gastos',value:currSnap.totalGastos||0,prev:prevSnap.totalGastos||0,sub:`${(currSnap.totalIngresos||0)>0?((currSnap.totalGastos||0)/(currSnap.totalIngresos||1)*100).toFixed(0):0}% del ingreso`,color:'#ef4444'},
          {label:'Gastos Fijos',value:currSnap.totalFijos||currSnap.fijos||0,prev:prevSnap.totalFijos||prevSnap.fijos||0,sub:`${(currSnap.totalGastos||0)>0?(((currSnap.totalFijos||currSnap.fijos||0)/(currSnap.totalGastos||1))*100).toFixed(0):0}% del total`,color:'#f97316'},
          {label:'Deuda Total',value:totalDebt,prev:0,sub:`Cuota: ${S(monthlyCommit)}/mes`,color:'#8b5cf6'},
        ].map((kpi,i) => (
          <div key={i} className="card p-3 md:p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide" style={{color:'var(--text-3)'}}>{kpi.label}</span>
              {kpi.prev>0 && <Chip pct={(kpi.value-kpi.prev)/kpi.prev*100}/>}
            </div>
            <p className="text-lg md:text-2xl font-bold num" style={{color:kpi.color}}>{S(kpi.value)}</p>
            <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Cashflow {months.length > 1 ? `${MN[months[0]]||months[0]}–${MN[months[months.length-1]]||months[months.length-1]}` : ''}</h2>
              <p className="text-xs" style={{color:'var(--text-3)'}}>Ingresos vs Fijos + Variables</p>
            </div>
            <Link href="/dashboard/analisis" className="text-xs flex items-center gap-1" style={{color:'var(--blue)'}}>
              Análisis <ArrowRight size={11}/>
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={155}>
            <BarChart data={chartData} barGap={3}>
              <XAxis dataKey="month" tick={{fill:'var(--text-3)',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'var(--text-3)',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip contentStyle={{background:'var(--bg-card2)',border:'1px solid var(--border2)',borderRadius:8,fontSize:11}} formatter={v=>[S(v)]}/>
              <Bar dataKey="Ingresos" fill="#10b981" radius={[4,4,0,0]}/>
              <Bar dataKey="Fijos" stackId="g" fill="#ef4444" radius={[0,0,0,0]}/>
              <Bar dataKey="Variables" stackId="g" fill="#f97316" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-1 justify-center">
            {[['Ingresos','#10b981'],['Fijos','#ef4444'],['Variables','#f97316']].map(([l,c])=>(
              <div key={l} className="flex items-center gap-1 text-xs" style={{color:'var(--text-3)'}}>
                <div className="w-2 h-2 rounded-sm" style={{background:c}}/>{l}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Categorías — {currMonthLabel}</h2>
            <Link href="/dashboard/categorias" className="text-xs flex items-center gap-1" style={{color:'var(--blue)'}}>
              Ver todas <ArrowRight size={11}/>
            </Link>
          </div>
          <div className="space-y-2">
            {topCats.map(({cat,amt,delta})=>(
              <div key={cat} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:CAT_CLR[cat]||'#64748b'}}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs truncate" style={{color:'var(--text-2)'}}>{cat}</span>
                    <div className="flex items-center gap-1.5">
                      {Math.abs(delta)>2 && <Chip pct={delta}/>}
                      <span className="text-xs font-semibold text-white num">{S(amt)}</span>
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full" style={{background:'var(--border)'}}>
                    <div className="h-full rounded-full" style={{width:`${Math.min(((currSnap.totalGastos||1))>0?(amt/(currSnap.totalGastos||1))*100:0,100)}%`,background:CAT_CLR[cat]||'#64748b'}}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{borderColor:'var(--border)'}}>
          <h2 className="text-sm font-semibold text-white">Últimos movimientos {selectedMonth?`— ${MN[selectedMonth]||selectedMonth}`:''}</h2>
          <Link href="/dashboard/transactions" className="text-xs flex items-center gap-1" style={{color:'var(--blue)'}}>
            Ver todos <ArrowRight size={11}/>
          </Link>
        </div>
        <div className="divide-y" style={{borderColor:'var(--border)'}}>
          {recent.map((t,i)=>(
            <Link key={t.id||i} href={`/dashboard/transactions?id=${t.id}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                style={{background:(CAT_CLR[t.category]||'#64748b')+'22'}}>
                {TX_ICON[t.category]||'📋'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{color:'var(--text-1)'}}>{t.merchant||t.description?.slice(0,28)||'—'}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{background:(CAT_CLR[t.category]||'#64748b')+'22',color:CAT_CLR[t.category]||'#94a3b8',fontSize:10}}>
                    {t.category||'Otros'}
                  </span>
                  <span className="text-xs" style={{color:'var(--text-3)'}}>{t.date?.slice(0,10)}</span>
                  {t.is_recurring && <Repeat size={9} style={{color:'#f97316'}}/>}
                </div>
              </div>
              <p className={`text-sm font-bold num flex-shrink-0 ${t.type==='ingreso'?'text-green-400':t.type==='transferencia'?'text-blue-400':'text-white'}`}>
                {t.type==='ingreso'?'+':t.type==='gasto'?'−':'↔'}{S2(Number(t.amount_pen||t.amount))}
              </p>
            </Link>
          ))}
          {recent.length===0 && <div className="px-4 py-8 text-center text-sm" style={{color:'var(--text-3)'}}>Sin movimientos{selectedMonth?` en ${MN[selectedMonth]||selectedMonth}`:''}</div>}
        </div>
      </div>
    </div>
  )
}

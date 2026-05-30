// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { Zap, TrendingDown, Calculator, Target, AlertTriangle, ChevronRight, Info, ArrowRight } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(Math.round(n)||0)}`
const S2 = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:2}).format(n||0)}`
const pct = (n) => `${(n*100).toFixed(1)}%`

// Colors for debts
const DEBT_COLORS = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#10b981']

function simulateDebt(balance, rateAnnual, minPay, extraPay) {
  const mRate = rateAnnual / 12
  const payment = minPay + extraPay
  let bal = balance, totalInt = 0, months = 0
  const sched = []
  while (bal > 1 && months < 600) {
    const interest = bal * mRate
    const principal = Math.min(payment - interest, bal)
    if (principal <= 0) break
    bal -= principal; totalInt += interest; months++
    if (months <= 60) sched.push({ m: months, bal: Math.max(0, Math.round(bal)) })
  }
  return { months, totalInt: Math.round(totalInt), schedule: sched }
}

function simulateAll(debts, extraBudget, strategy) {
  // Sort by strategy
  const sorted = strategy === 'avalanche'
    ? [...debts].sort((a,b) => b.rate - a.rate)
    : [...debts].sort((a,b) => a.balance - b.balance)
  
  let states = sorted.map(d => ({ ...d, remaining: d.balance }))
  let month = 0, totalInt = 0
  const timeline = [{ month: 0, total: Math.round(sorted.reduce((s,d)=>s+d.balance,0)) }]
  
  while (states.some(d => d.remaining > 1) && month < 600) {
    month++
    let extra = extraBudget
    for (let i = 0; i < states.length; i++) {
      const d = states[i]
      if (d.remaining <= 0) continue
      const mRate = d.rate / 12
      const interest = d.remaining * mRate
      totalInt += interest
      let payment = d.minPayment
      if (i === 0 && extra > 0) { payment += extra; extra = 0 }
      payment = Math.min(payment, d.remaining + interest)
      d.remaining = Math.max(0, d.remaining + interest - payment)
      if (d.remaining < 1) { d.remaining = 0; extra += d.minPayment }
    }
    if (month % 3 === 0 || month === 1) {
      timeline.push({ month, total: Math.round(states.reduce((s,d)=>s+d.remaining,0)) })
    }
  }
  return { months: month, totalInt: Math.round(totalInt), timeline }
}

export default function DeudaPage() {
  const [cards, setCards] = useState([])
  const [debts, setDebts] = useState([])
  const [tx, setTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [extraPay, setExtraPay] = useState(500)
  const [strategy, setStrategy] = useState('avalanche')
  const [activeTab, setActiveTab] = useState('plan') // plan | costo | refinanciar

  useEffect(() => {
    Promise.all([
      fetch('/api/cards').then(r=>r.json()),
      fetch('/api/debts').then(r=>r.json()),
      fetch('/api/analytics').then(r=>r.json()),
    ]).then(([c,d,a]) => {
      setCards(c.cards||[])
      setDebts(d.debts||[])
      setTx(a.transactions||[])
      setLoading(false)
    })
  }, [])

  // Build debt objects
  const allDebts = useMemo(() => {
    const realCards = (cards||[]).filter(c => 
      !(c.bank==='Interbank' && (c.name||'').toLowerCase().includes('access')) &&
      Number(c.current_balance) > 0
    )
    const cardDebts = realCards.map(c => ({
      id: c.id, name: `${c.bank} ${c.name}`, institution: c.bank,
      balance: Number(c.current_balance), rate: Number(c.tcea||c.tea||40)/100,
      minPayment: Number(c.minimum_payment||0), type: 'tarjeta',
    }))
    const loanDebts = (debts||[]).filter(d=>Number(d.current_balance)>0).map(d => ({
      id: d.id, name: d.name, institution: d.institution,
      balance: Number(d.current_balance), rate: Number(d.tea||d.tcea||13)/100,
      minPayment: Number(d.monthly_payment||0), type: 'prestamo',
    }))
    return [...cardDebts, ...loanDebts].sort((a,b)=>b.rate-a.rate)
  }, [cards, debts])

  const totalDebt = useMemo(() => allDebts.reduce((s,d)=>s+d.balance,0), [allDebts])
  const totalMinPay = useMemo(() => allDebts.reduce((s,d)=>s+d.minPayment,0), [allDebts])
  
  // Simulation WITHOUT extra payment
  const baseResult = useMemo(() => simulateAll(allDebts, 0, strategy), [allDebts, strategy])
  // Simulation WITH extra payment
  const boostResult = useMemo(() => simulateAll(allDebts, extraPay, strategy), [allDebts, extraPay, strategy])
  
  // Savings
  const monthsSaved = baseResult.months - boostResult.months
  const interestSaved = baseResult.totalInt - boostResult.totalInt

  // Interest paid this year (from tx data)
  const interestThisYear = useMemo(() => 
    tx.filter(t => t.category==='Intereses' && t.type==='gasto').reduce((s,t)=>s+Number(t.amount_pen||t.amount),0),
    [tx])

  // Cost per card (interest estimate)
  const debtCosts = useMemo(() => allDebts.map(d => ({
    ...d,
    monthlyInterest: Math.round(d.balance * d.rate / 12),
    yearlyInterest: Math.round(d.balance * d.rate),
    payoffNoExtra: simulateDebt(d.balance, d.rate, d.minPayment, 0),
    payoffExtra: simulateDebt(d.balance, d.rate, d.minPayment, extraPay * (d.rate / allDebts.reduce((s,x)=>s+x.rate,0.001))),
  })), [allDebts, extraPay])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{background:'var(--bg-base)'}}>
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const payoffDate = (m) => {
    const d = new Date(); d.setMonth(d.getMonth()+m)
    return d.toLocaleDateString('es-PE',{month:'short',year:'numeric'})
  }

  return (
    <div className="p-4 md:p-5 space-y-5 max-w-5xl mx-auto" style={{background:'var(--bg-base)',minHeight:'100vh'}}>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingDown size={20} className="text-red-400"/> Plan de Eliminación de Deuda
        </h1>
        <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>
          Simulador financiero · Técnica avalancha (mayor TCEA) recomendada para tu perfil
        </p>
      </div>

      {/* Total debt hero */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {label:'Deuda Total',value:S(totalDebt),color:'#ef4444',sub:`${allDebts.length} productos`},
          {label:'Cuotas/mes',value:S(totalMinPay),color:'#f97316',sub:'Pago mínimo'},
          {label:'Interés est./año',value:S(allDebts.reduce((s,d)=>s+d.balance*d.rate,0)),color:'#fbbf24',sub:'Costo de mantener la deuda'},
          {label:'Sin extra: libre en',value:`${boostResult.months}m`,color:'#22c55e',sub:payoffDate(boostResult.months)},
        ].map((k,i)=>(
          <div key={i} className="card p-3 md:p-4">
            <p className="text-xs uppercase tracking-wide mb-1" style={{color:'var(--text-3)'}}>{k.label}</p>
            <p className="text-lg md:text-2xl font-bold num" style={{color:k.color}}>{k.value}</p>
            <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--bg-card)'}}>
        {[{v:'plan',l:'🎯 Plan de Pago'},{v:'costo',l:'💸 Costo Real'},{v:'refinanciar',l:'🔄 Refinanciar'}].map(t=>(
          <button key={t.v} onClick={()=>setActiveTab(t.v)}
            className="flex-1 py-2 text-sm font-medium rounded-xl transition-all"
            style={{background:activeTab===t.v?'var(--blue)':'transparent',color:activeTab===t.v?'#fff':'var(--text-3)'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* TAB: Plan de Pago */}
      {activeTab==='plan' && (
        <div className="space-y-4">
          {/* Strategy selector */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Estrategia de Pago</h2>
                <p className="text-xs" style={{color:'var(--text-3)'}}>Para tu perfil con AMEX al 81.5%, la avalancha ahorra más dinero</p>
              </div>
              <div className="flex gap-2">
                {[{v:'avalanche',l:'⚡ Avalancha (TCEA)','desc':'Ahorra más en intereses'},{v:'snowball',l:'❄️ Bola de Nieve (saldo)','desc':'Más motivador psicológicamente'}].map(s=>(
                  <button key={s.v} onClick={()=>setStrategy(s.v)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{background:strategy===s.v?'var(--blue)':'var(--bg-card2)',border:`1px solid ${strategy===s.v?'var(--blue)':'var(--border)'}`,color:strategy===s.v?'#fff':'var(--text-2)'}}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra payment slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-white font-medium">Pago extra mensual</label>
                <span className="text-lg font-bold num" style={{color:'var(--blue)'}}>{S(extraPay)}/mes</span>
              </div>
              <input type="range" min={0} max={5000} step={100} value={extraPay}
                onChange={e=>setExtraPay(Number(e.target.value))}
                className="w-full" style={{accentColor:'var(--blue)'}}/>
              <div className="flex justify-between text-xs mt-1" style={{color:'var(--text-3)'}}>
                <span>S/ 0</span><span>S/ 1,000</span><span>S/ 2,500</span><span>S/ 5,000</span>
              </div>
            </div>

            {/* Impact cards */}
            {extraPay > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl text-center" style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.3)'}}>
                  <p className="text-xs mb-1" style={{color:'var(--text-3)'}}>Libre en</p>
                  <p className="text-xl font-bold text-green-400 num">{boostResult.months}m</p>
                  <p className="text-xs text-green-400">{payoffDate(boostResult.months)}</p>
                </div>
                <div className="p-3 rounded-xl text-center" style={{background:'rgba(249,115,22,0.1)',border:'1px solid rgba(249,115,22,0.3)'}}>
                  <p className="text-xs mb-1" style={{color:'var(--text-3)'}}>Meses ahorrados</p>
                  <p className="text-xl font-bold text-orange-400 num">{monthsSaved}</p>
                  <p className="text-xs text-orange-400">{(monthsSaved/12).toFixed(1)} años menos</p>
                </div>
                <div className="p-3 rounded-xl text-center" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)'}}>
                  <p className="text-xs mb-1" style={{color:'var(--text-3)'}}>Interés ahorrado</p>
                  <p className="text-xl font-bold text-red-400 num">{S(interestSaved)}</p>
                  <p className="text-xs text-red-400">Se queda en tu bolsillo</p>
                </div>
              </div>
            )}
          </div>

          {/* Debt payoff chart */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-white mb-1">Proyección de Deuda Total</h2>
            <p className="text-xs mb-3" style={{color:'var(--text-3)'}}>
              Sin extra (línea base) vs Con {S(extraPay)}/mes extra
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart>
                <XAxis tick={{fill:'var(--text-3)',fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'var(--text-3)',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={{background:'var(--bg-card2)',border:'1px solid var(--border2)',borderRadius:8,fontSize:11}} formatter={v=>[S(v)]}/>
                <Area type="monotone" data={baseResult.timeline} dataKey="total" stroke="#64748b" fill="rgba(100,116,139,0.1)" strokeDasharray="4 4" name="Sin extra"/>
                {extraPay > 0 && <Area type="monotone" data={boostResult.timeline} dataKey="total" stroke="#22c55e" fill="rgba(34,197,94,0.1)" name="Con extra"/>}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Debt priority order */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b" style={{borderColor:'var(--border)'}}>
              <h2 className="text-sm font-semibold text-white">Orden de Ataque — Estrategia {strategy==='avalanche'?'Avalancha':'Bola de Nieve'}</h2>
            </div>
            <div className="divide-y" style={{borderColor:'var(--border)'}}>
              {allDebts.sort((a,b)=>strategy==='avalanche'?b.rate-a.rate:a.balance-b.balance).map((d,i)=>{
                const info = debtCosts.find(x=>x.id===d.id)||d
                const monthly = Math.round(d.balance * d.rate / 12)
                return (
                  <div key={d.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{background:DEBT_COLORS[i]||'#64748b'}}>
                      {i+1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{d.name}</p>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>
                        TCEA {(d.rate*100).toFixed(1)}% · Mín {S(d.minPayment)}/mes · <span className="text-red-400">Interés: {S(monthly)}/mes</span>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold num text-white">{S(d.balance)}</p>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>
                        {simulateDebt(d.balance,d.rate,d.minPayment,i===0?extraPay:0).months}m
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Costo Real */}
      {activeTab==='costo' && (
        <div className="space-y-4">
          <div className="card p-4 border" style={{borderColor:'rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.04)'}}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-semibold text-red-400 mb-1">El costo real de tu deuda este año</p>
                <p className="text-sm" style={{color:'var(--text-2)'}}>
                  Si no pagas nada extra, pagarás aproximadamente <strong className="text-white">{S(allDebts.reduce((s,d)=>s+d.balance*d.rate,0))}</strong> solo en intereses durante los próximos 12 meses. Eso es dinero que no compra nada — solo cubre el costo de haber pedido prestado.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {debtCosts.map((d,i)=>{
              const monthsLeft = d.payoffNoExtra.months
              const totalCost = d.balance + d.payoffNoExtra.totalInt
              const interestRatio = d.payoffNoExtra.totalInt / d.balance
              return (
                <div key={d.id} className="card p-4">
                  <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-white">{d.name}</p>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>TCEA {(d.rate*100).toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{color:'var(--text-3)'}}>Deuda actual</p>
                      <p className="font-bold text-white num">{S(d.balance)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-xl" style={{background:'var(--bg-card2)'}}>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>Interés/mes</p>
                      <p className="font-bold text-red-400 num text-sm">{S(d.monthlyInterest)}</p>
                    </div>
                    <div className="p-2 rounded-xl" style={{background:'var(--bg-card2)'}}>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>Total intereses</p>
                      <p className="font-bold text-red-400 num text-sm">{S(d.payoffNoExtra.totalInt)}</p>
                    </div>
                    <div className="p-2 rounded-xl" style={{background:'var(--bg-card2)'}}>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>Pagarás en total</p>
                      <p className="font-bold text-orange-400 num text-sm">{S(totalCost)}</p>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>{(interestRatio*100).toFixed(0)}% extra</p>
                    </div>
                  </div>
                  {monthsLeft > 0 && (
                    <div className="mt-3 p-2 rounded-xl" style={{background:'var(--bg-card2)'}}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs" style={{color:'var(--text-3)'}}>Libre en {monthsLeft}m ({payoffDate(monthsLeft)}) pagando solo mínimo</span>
                        <span className="text-xs font-medium" style={{color:'var(--text-3)'}}>{d.minPayment>0?`${S(d.minPayment)}/mes`:'-'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB: Refinanciar */}
      {activeTab==='refinanciar' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-white mb-2">¿Conviene consolidar deuda?</h2>
            <p className="text-sm mb-4" style={{color:'var(--text-2)'}}>
              Tienes deuda en tarjetas a tasas muy altas (AMEX 81.5%, BBVA 69.99%). El préstamo BCP Grande está al 13.5%. La diferencia es enorme — consolidar puede ahorrar mucho dinero.
            </p>
            {allDebts.filter(d=>d.type==='tarjeta' && d.rate>0.30).map((d,i)=>{
              const currentYearlyCost = d.balance * d.rate
              const newRate = 0.135 // TEA préstamo BCP
              const newYearlyCost = d.balance * newRate
              const savings = currentYearlyCost - newYearlyCost
              return (
                <div key={i} className="mb-3 p-4 rounded-xl" style={{background:'var(--bg-card2)',border:'1px solid var(--border2)'}}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-white">{d.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(239,68,68,0.2)',color:'#fca5a5'}}>{(d.rate*100).toFixed(0)}% TCEA</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>Costo actual/año</p>
                      <p className="font-bold text-red-400 num">{S(currentYearlyCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>A 13.5% (préstamo BCP)</p>
                      <p className="font-bold text-green-400 num">{S(newYearlyCost)}</p>
                    </div>
                  </div>
                  <div className="mt-2 p-2 rounded-xl" style={{background:'rgba(34,197,94,0.1)'}}>
                    <p className="text-xs text-green-400 font-semibold">💰 Ahorro potencial/año: {S(savings)}</p>
                  </div>
                </div>
              )
            })}
            <div className="mt-3 p-3 rounded-xl" style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)'}}>
              <p className="text-xs" style={{color:'#93c5fd'}}>
                ⚠️ <strong>Consideración:</strong> Refinanciar con préstamo amplía el plazo. La ventaja es la tasa; el riesgo es volver a usar las tarjetas y acumular más deuda. Usa el Copiloto IA para un análisis personalizado.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

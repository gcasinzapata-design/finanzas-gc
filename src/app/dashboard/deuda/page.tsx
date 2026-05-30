// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { TrendingDown, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(Math.round(n)||0)}`
const S2 = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:2}).format(n||0)}`
const COLORS = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#10b981']

function simulate(balance, rateAnnual, minPay, extra = 0) {
  if (balance <= 0) return { months: 0, totalInt: 0, schedule: [] }
  const mRate = rateAnnual / 12
  const payment = minPay + extra
  if (payment <= balance * mRate) return { months: 999, totalInt: Infinity, schedule: [] }
  let bal = balance, totalInt = 0, months = 0
  const schedule = []
  while (bal > 0.01 && months < 480) {
    const interest = bal * mRate
    const principal = Math.min(payment - interest, bal)
    if (principal <= 0) { months = 999; break }
    bal = Math.max(0, bal - principal)
    totalInt += interest; months++
    if (months <= 72) schedule.push({ m: months, bal: Math.round(bal) })
  }
  return { months, totalInt: Math.round(totalInt), schedule }
}

function simulateAll(debts, extraByDebt, strategy) {
  const sorted = strategy === 'avalanche'
    ? [...debts].sort((a,b) => b.rate - a.rate)
    : [...debts].sort((a,b) => a.balance - b.balance)

  let states = sorted.map(d => ({
    ...d,
    remaining: d.balance,
    extra: extraByDebt[d.id] || 0
  }))
  let month = 0, totalInt = 0
  const timeline = [{ month: 0, total: Math.round(sorted.reduce((s,d)=>s+d.balance,0)) }]
  const debtLines = {}
  sorted.forEach(d => { debtLines[d.id] = [{ month: 0, bal: Math.round(d.balance) }] })

  while (states.some(d => d.remaining > 1) && month < 480) {
    month++
    // Apply cascaded minimums + per-debt extras
    for (let i = 0; i < states.length; i++) {
      const d = states[i]
      if (d.remaining <= 0) continue
      const mRate = d.rate / 12
      const interest = d.remaining * mRate
      totalInt += interest
      let payment = d.minPayment + d.extra
      payment = Math.min(payment, d.remaining + interest)
      d.remaining = Math.max(0, d.remaining + interest - payment)
      if (d.remaining < 1) {
        d.remaining = 0
        // Cascade freed payment to next highest-priority debt
        const nextDebt = states.find((x,j) => j > i && x.remaining > 0)
        if (nextDebt) nextDebt.extra += d.minPayment
      }
    }

    if (month % 3 === 0 || month === 1) {
      const total = Math.round(states.reduce((s,d)=>s+d.remaining,0))
      timeline.push({ month, total })
      states.forEach(d => {
        if (debtLines[d.id]) debtLines[d.id].push({ month, bal: Math.round(d.remaining) })
      })
    }
  }

  return { months: month, totalInt: Math.round(totalInt), timeline, debtLines }
}

function payoffDate(months) {
  if (months >= 480) return 'Sin fin'
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })
}

export default function DeudaPage() {
  const [cards, setCards] = useState([])
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [strategy, setStrategy] = useState('avalanche')
  const [activeTab, setActiveTab] = useState('plan')
  // Per-debt extra payments
  const [extraByDebt, setExtraByDebt] = useState({})
  const [globalExtra, setGlobalExtra] = useState(0)

  useEffect(() => {
    Promise.all([
      fetch('/api/cards').then(r=>r.json()),
      fetch('/api/debts').then(r=>r.json()),
    ]).then(([c,d]) => {
      setCards(c.cards||[])
      setDebts(d.debts||[])
      setLoading(false)
    })
  }, [])

  const allDebts = useMemo(() => {
    const realCards = (cards||[]).filter(c =>
      !(c.bank==='Interbank' && (c.name||'').toLowerCase().includes('access')) &&
      Number(c.current_balance) > 0
    )
    return [
      ...realCards.map(c => ({
        id: c.id, name: `${c.bank} ${c.name}`, shortName: c.name,
        institution: c.bank, balance: Number(c.current_balance),
        rate: Number(c.tcea||c.tea||40)/100,
        minPayment: Number(c.minimum_payment||0), type: 'tarjeta',
        cutDate: c.cut_date, payDate: c.payment_due_date,
      })),
      ...(debts||[]).filter(d=>Number(d.current_balance)>0).map(d => ({
        id: d.id, name: d.name, shortName: d.name.replace(/Préstamo /,''),
        institution: d.institution, balance: Number(d.current_balance),
        rate: Number(d.tea||d.tcea||13)/100,
        minPayment: Number(d.monthly_payment||0), type: 'prestamo',
        remaining: d.remaining_installments,
      })),
    ].sort((a,b) => b.rate - a.rate)
  }, [cards, debts])

  const totalDebt = useMemo(() => allDebts.reduce((s,d)=>s+d.balance,0), [allDebts])
  const totalMinPay = useMemo(() => allDebts.reduce((s,d)=>s+d.minPayment,0), [allDebts])
  const totalExtra = useMemo(() => Object.values(extraByDebt).reduce((s,v)=>s+(v||0),0) + globalExtra, [extraByDebt, globalExtra])

  // Build extraByDebt with global extra applied to top debt
  const effectiveExtras = useMemo(() => {
    const sorted = strategy === 'avalanche'
      ? [...allDebts].sort((a,b) => b.rate - a.rate)
      : [...allDebts].sort((a,b) => a.balance - b.balance)
    const result = { ...extraByDebt }
    // Apply global extra to the #1 priority debt
    if (globalExtra > 0 && sorted.length > 0) {
      result[sorted[0].id] = (result[sorted[0].id] || 0) + globalExtra
    }
    return result
  }, [extraByDebt, globalExtra, allDebts, strategy])

  const baseResult = useMemo(() => simulateAll(allDebts, {}, strategy), [allDebts, strategy])
  const boostResult = useMemo(() => simulateAll(allDebts, effectiveExtras, strategy), [allDebts, effectiveExtras, strategy])

  const monthsSaved = Math.max(0, baseResult.months - boostResult.months)
  const interestSaved = Math.max(0, baseResult.totalInt - boostResult.totalInt)

  const orderedDebts = useMemo(() =>
    strategy === 'avalanche'
      ? [...allDebts].sort((a,b) => b.rate - a.rate)
      : [...allDebts].sort((a,b) => a.balance - b.balance),
    [allDebts, strategy])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{background:'var(--bg-base)'}}>
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-4 md:p-5 space-y-5 max-w-5xl mx-auto" style={{background:'var(--bg-base)',minHeight:'100vh'}}>

      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingDown size={20} className="text-red-400"/> Plan de Eliminación de Deuda
        </h1>
        <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>
          Simulador interactivo · Asigna pagos extra por producto · Estrategia avalancha recomendada
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {l:'Deuda Total',v:S(totalDebt),c:'#ef4444',sub:`${allDebts.length} productos`},
          {l:'Cuotas/mes',v:S(totalMinPay),c:'#f97316',sub:'Pago mínimo total'},
          {l:'Interés anual est.',v:S(allDebts.reduce((s,d)=>s+d.balance*d.rate,0)),c:'#fbbf24',sub:'Costo de mantener deuda'},
          {l:'Libre en (con extra)',v:boostResult.months<480?`${boostResult.months}m`:'480m+',c:'#22c55e',sub:payoffDate(boostResult.months)},
        ].map((k,i)=>(
          <div key={i} className="card p-3 md:p-4">
            <p className="text-xs uppercase tracking-wide mb-1" style={{color:'var(--text-3)'}}>{k.l}</p>
            <p className="text-xl md:text-2xl font-bold num" style={{color:k.c}}>{k.v}</p>
            <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--bg-card)'}}>
        {[{v:'plan',l:'🎯 Simulador'},{v:'costo',l:'💸 Costo Real'},{v:'refinanciar',l:'🔄 Refinanciar'}].map(t=>(
          <button key={t.v} onClick={()=>setActiveTab(t.v)}
            className="flex-1 py-2 text-sm font-medium rounded-xl transition-all"
            style={{background:activeTab===t.v?'var(--blue)':'transparent',color:activeTab===t.v?'#fff':'var(--text-3)'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── TAB: SIMULADOR ── */}
      {activeTab==='plan' && (
        <div className="space-y-4">
          {/* Strategy + Global extra */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <h2 className="text-sm font-semibold text-white flex-1">Estrategia y Presupuesto Extra</h2>
              <div className="flex gap-2">
                {[{v:'avalanche',l:'⚡ Avalancha'},{v:'snowball',l:'❄️ Bola de Nieve'}].map(s=>(
                  <button key={s.v} onClick={()=>setStrategy(s.v)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{background:strategy===s.v?'var(--blue)':'var(--bg-card2)',border:`1px solid ${strategy===s.v?'var(--blue)':'var(--border)'}`,color:strategy===s.v?'#fff':'var(--text-2)'}}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Global extra slider */}
            <div className="p-3 rounded-xl mb-4" style={{background:'var(--bg-card2)'}}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-white">💰 Pago extra global (al deuda #1)</label>
                <span className="text-base font-bold num" style={{color:'var(--blue)'}}>{S(globalExtra)}/mes</span>
              </div>
              <input type="range" min={0} max={5000} step={100} value={globalExtra}
                onChange={e=>setGlobalExtra(Number(e.target.value))}
                className="w-full" style={{accentColor:'var(--blue)'}}/>
              <div className="flex justify-between text-xs mt-1" style={{color:'var(--text-3)'}}>
                <span>S/ 0</span><span>S/ 1k</span><span>S/ 2.5k</span><span>S/ 5k</span>
              </div>
              <p className="text-xs mt-2" style={{color:'var(--text-3)'}}>
                Se aplica a la deuda prioritaria ({orderedDebts[0]?.shortName}) y cuando se pague se cascadea a la siguiente.
              </p>
            </div>

            {/* Per-debt extra payments */}
            <div>
              <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{color:'var(--text-3)'}}>
                Pago extra por producto (puedes combinar con el global)
              </h3>
              <div className="space-y-3">
                {orderedDebts.map((d,i) => {
                  const extra = extraByDebt[d.id] || 0
                  const withExtra = simulate(d.balance, d.rate, d.minPayment, extra + (d.id===orderedDebts[0]?.id?globalExtra:0))
                  const noExtra = simulate(d.balance, d.rate, d.minPayment, 0)
                  const saved = noExtra.totalInt - withExtra.totalInt
                  return (
                    <div key={d.id} className="p-3 rounded-xl" style={{background:'var(--bg-card2)',border:`1px solid ${COLORS[i]||'#64748b'}33`}}>
                      <div className="flex items-start justify-between mb-2 flex-wrap gap-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{background:COLORS[i]||'#64748b',minWidth:20}}>{i+1}</div>
                            <span className="font-semibold text-white text-sm">{d.name}</span>
                            {d.type==='tarjeta' && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:'rgba(239,68,68,0.15)',color:'#fca5a5'}}>{(d.rate*100).toFixed(0)}% TCEA</span>}
                            {d.type==='prestamo' && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:'rgba(34,197,94,0.15)',color:'#86efac'}}>{(d.rate*100).toFixed(0)}% TEA</span>}
                          </div>
                          <p className="text-xs mt-0.5 ml-7" style={{color:'var(--text-3)'}}>
                            Saldo: {S(d.balance)} · Mín: {S(d.minPayment)}/mes · {noExtra.months<480?`${noExtra.months}m solo mínimo`:'no termina solo con mínimo'}
                          </p>
                        </div>
                        <div className="text-right">
                          {extra > 0 && saved > 0 && (
                            <p className="text-xs text-green-400 font-semibold">Ahorras {S(saved)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{color:'var(--text-3)'}}>Extra:</span>
                        <input type="range" min={0} max={3000} step={50} value={extra}
                          onChange={e => setExtraByDebt(prev=>({...prev,[d.id]:Number(e.target.value)}))}
                          className="flex-1" style={{accentColor:COLORS[i]||'#64748b'}}/>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold num w-20 text-right" style={{color:extra>0?COLORS[i]:'var(--text-3)'}}>
                            {S(extra)}/mes
                          </span>
                          {extra > 0 && (
                            <button onClick={()=>setExtraByDebt(prev=>({...prev,[d.id]:0}))}
                              className="text-xs px-1.5 py-0.5 rounded" style={{color:'var(--text-3)'}}>✕</button>
                          )}
                        </div>
                      </div>
                      {extra > 0 && (
                        <p className="text-xs mt-1.5" style={{color:COLORS[i]}}>
                          Con {S(extra)}/mes extra → libre en {withExtra.months<480?withExtra.months:'480+'}m ({payoffDate(withExtra.months)})
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Total extra summary */}
            {totalExtra > 0 && (
              <div className="mt-4 p-3 rounded-xl" style={{background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)'}}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">Resumen del plan</span>
                  <span className="text-sm font-bold text-green-400 num">+{S(totalExtra)}/mes extra</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>Libre en</p>
                    <p className="font-bold text-green-400 num">{boostResult.months<480?`${boostResult.months}m`:'480m+'}</p>
                    <p className="text-xs text-green-400">{payoffDate(boostResult.months)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>Meses ahorrados</p>
                    <p className="font-bold text-orange-400 num">{monthsSaved}</p>
                    <p className="text-xs text-orange-400">{(monthsSaved/12).toFixed(1)} años</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>Interés ahorrado</p>
                    <p className="font-bold text-red-400 num">{S(interestSaved)}</p>
                    <p className="text-xs text-red-400">se queda tuyo</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Projection chart */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-white mb-1">Proyección de deuda total</h2>
            <p className="text-xs mb-3" style={{color:'var(--text-3)'}}>
              Base (solo mínimos) vs Plan actual ({S(totalExtra)}/mes extra)
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart>
                <XAxis tick={{fill:'var(--text-3)',fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'var(--text-3)',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={{background:'var(--bg-card2)',border:'1px solid var(--border2)',borderRadius:8,fontSize:11}} formatter={v=>[S(v)]}/>
                <Area type="monotone" data={baseResult.timeline} dataKey="total" stroke="#64748b" fill="rgba(100,116,139,0.08)" strokeDasharray="4 4" name="Solo mínimos"/>
                {totalExtra > 0 && <Area type="monotone" data={boostResult.timeline} dataKey="total" stroke="#22c55e" fill="rgba(34,197,94,0.08)" name="Con extra"/>}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* "Next month" projection */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Próximo mes — ¿cómo quedan los saldos?</h2>
            <div className="space-y-2">
              {orderedDebts.map((d,i) => {
                const extra = effectiveExtras[d.id] || 0
                const mRate = d.rate / 12
                const interest = d.balance * mRate
                const payment = d.minPayment + extra
                const newBal = Math.max(0, d.balance + interest - payment)
                const reduction = d.balance - newBal
                const pctPaid = d.balance > 0 ? (reduction/d.balance)*100 : 0
                return (
                  <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{background:'var(--bg-card2)'}}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{background:COLORS[i]||'#64748b',minWidth:20}}>{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white truncate">{d.shortName}</span>
                        <span className="text-xs" style={{color:'var(--text-3)'}}>
                          {S(d.balance)} → <span className="font-semibold text-white">{S(newBal)}</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full" style={{background:'var(--border)'}}>
                        <div className="h-full rounded-full" style={{width:`${Math.min(pctPaid*5,100)}%`,background:COLORS[i]}}/>
                      </div>
                      <div className="flex justify-between mt-0.5 text-xs" style={{color:'var(--text-3)'}}>
                        <span>Pago: {S(payment)}</span>
                        <span className="text-red-400">Int: {S(Math.round(interest))}</span>
                        <span className="text-green-400">Capital: {S(Math.round(Math.max(0,reduction)))}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: COSTO REAL ── */}
      {activeTab==='costo' && (
        <div className="space-y-4">
          <div className="card p-4 border" style={{borderColor:'rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.04)'}}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-semibold text-red-400 mb-1">Tu costo real anual de deuda</p>
                <p className="text-sm" style={{color:'var(--text-2)'}}>
                  Si no pagas nada extra, pagarás aprox. <strong className="text-white">{S(allDebts.reduce((s,d)=>s+d.balance*d.rate,0))}</strong> solo en intereses este año. Es dinero que no compra nada.
                </p>
              </div>
            </div>
          </div>

          {allDebts.sort((a,b)=>b.rate-a.rate).map((d,i) => {
            const noExtra = simulate(d.balance, d.rate, d.minPayment, 0)
            const monthlyInt = Math.round(d.balance * d.rate / 12)
            const interestRatio = d.balance > 0 ? noExtra.totalInt/d.balance : 0
            return (
              <div key={d.id} className="card p-4">
                <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{background:COLORS[i],minWidth:20}}>{i+1}</div>
                      <p className="font-semibold text-white">{d.name}</p>
                    </div>
                    <p className="text-xs mt-0.5 ml-7" style={{color:'var(--text-3)'}}>
                      {d.type==='tarjeta'?'TCEA':'TEA'} {(d.rate*100).toFixed(1)}%
                    </p>
                  </div>
                  <p className="font-bold text-white num">{S(d.balance)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl" style={{background:'var(--bg-card2)'}}>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>Interés/mes</p>
                    <p className="font-bold text-red-400 num text-sm">{S(monthlyInt)}</p>
                  </div>
                  <div className="p-2 rounded-xl" style={{background:'var(--bg-card2)'}}>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>Total intereses</p>
                    <p className="font-bold text-red-400 num text-sm">{noExtra.months<480?S(noExtra.totalInt):'∞'}</p>
                  </div>
                  <div className="p-2 rounded-xl" style={{background:'var(--bg-card2)'}}>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>Pagas en total</p>
                    <p className="font-bold text-orange-400 num text-sm">{noExtra.months<480?S(d.balance+noExtra.totalInt):'∞'}</p>
                    {interestRatio > 0 && noExtra.months < 480 && <p className="text-xs" style={{color:'var(--text-3)'}}>{(interestRatio*100).toFixed(0)}% extra</p>}
                  </div>
                </div>
                <div className="mt-2 p-2 rounded-xl" style={{background:'var(--bg-card2)'}}>
                  <p className="text-xs" style={{color:'var(--text-3)'}}>
                    Libre en: {noExtra.months<480?`${noExtra.months} meses (${payoffDate(noExtra.months)}) pagando solo S/${d.minPayment}/mes`:'⚠️ El pago mínimo no cubre los intereses — la deuda CRECE'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: REFINANCIAR ── */}
      {activeTab==='refinanciar' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-white mb-2">¿Conviene consolidar deuda en el préstamo BCP (13.5% TEA)?</h2>
            <p className="text-sm mb-4" style={{color:'var(--text-2)'}}>
              Comparativa: costo actual de tus tarjetas caras vs refinanciarlas al 13.5% del préstamo BCP Grande.
            </p>
            {allDebts.filter(d=>d.type==='tarjeta'&&d.rate>0.20).map((d,i) => {
              const currentYearly = d.balance * d.rate
              const newRate = 0.135
              const newYearly = d.balance * newRate
              const savings = currentYearly - newYearly
              return (
                <div key={d.id} className="mb-3 p-4 rounded-xl" style={{background:'var(--bg-card2)',border:'1px solid var(--border2)'}}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-white">{d.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(239,68,68,0.2)',color:'#fca5a5'}}>{(d.rate*100).toFixed(0)}% TCEA</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <p style={{color:'var(--text-3)'}}>Costo actual/año</p>
                      <p className="font-bold text-red-400 num">{S(currentYearly)}</p>
                    </div>
                    <div>
                      <p style={{color:'var(--text-3)'}}>A 13.5% (préstamo BCP)</p>
                      <p className="font-bold text-green-400 num">{S(newYearly)}</p>
                    </div>
                    <div>
                      <p style={{color:'var(--text-3)'}}>Ahorro/año</p>
                      <p className="font-bold text-green-400 num">{S(savings)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="p-3 rounded-xl" style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)'}}>
              <p className="text-xs" style={{color:'#93c5fd'}}>
                ⚠️ <strong>Riesgo:</strong> Refinanciar baja la tasa pero amplía el plazo. El riesgo real es volver a usar las tarjetas y acumular deuda nueva encima del préstamo. Úsalo solo si puedes comprometerte a NO usar las tarjetas refinanciadas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

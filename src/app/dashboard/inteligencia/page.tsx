// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { Brain, TrendingUp, TrendingDown, AlertCircle, Lightbulb, Target, DollarSign, Zap, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(Math.round(n)||0)}`

const SEVERITY = { high:'#ef4444', medium:'#f97316', low:'#eab308', positive:'#22c55e', info:'#3b82f6' }
const SEV_BG = { high:'rgba(239,68,68,0.1)', medium:'rgba(249,115,22,0.1)', low:'rgba(234,179,8,0.1)', positive:'rgba(34,197,94,0.1)', info:'rgba(59,130,246,0.1)' }

export default function InteligenciaPage() {
  const [data, setData] = useState(null)
  const [cards, setCards] = useState([])
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('insights')
  const [moneyToAllocate, setMoneyToAllocate] = useState(1000)

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics').then(r=>r.json()),
      fetch('/api/cards').then(r=>r.json()),
      fetch('/api/debts').then(r=>r.json()),
    ]).then(([a,c,d]) => {
      setData(a); setCards(c.cards||[]); setDebts(d.debts||[])
      setLoading(false)
    })
  }, [])

  const tx = data?.transactions || []
  const snap = data?.snapshots || []
  const currSnap = snap[snap.length-1] || {}
  const prevSnap = snap[snap.length-2] || {}
  const months = data?.months || []
  const income = snap.find(s=>s.month==='2026-04' || s.month==='2026-05')?.totalIngresos || 8762

  // ── Gastos Hormiga ──────────────────────────────────────────────────────────
  const antSpending = useMemo(() => {
    const map = {}
    tx.filter(t => t.type==='gasto' && Number(t.amount_pen||t.amount) <= 80 && t.merchant).forEach(t => {
      if (!map[t.merchant]) map[t.merchant] = { amounts: [], cat: t.category, months: new Set() }
      map[t.merchant].amounts.push(Number(t.amount_pen||t.amount))
      map[t.merchant].months.add(t.date?.slice(0,7))
    })
    const mCount = months.length || 5
    return Object.entries(map)
      .filter(([,v]) => v.amounts.length >= 4)
      .map(([merchant,v]) => ({
        merchant,
        category: v.cat,
        count: v.amounts.length,
        avg: Math.round(v.amounts.reduce((s,a)=>s+a,0)/v.amounts.length),
        monthly: Math.round(v.amounts.reduce((s,a)=>s+a,0)/mCount),
        annual: Math.round(v.amounts.reduce((s,a)=>s+a,0)/mCount*12),
      }))
      .sort((a,b)=>b.monthly-a.monthly)
      .slice(0, 12)
  }, [tx, months])

  // ── Pattern Insights ────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const result = []
    if (!snap.length || !tx.length) return result

    const byCat = (snap) => snap.byCat || {}
    const curr = byCat(currSnap), prev = byCat(prevSnap)

    // Delivery spike
    const delivNow = curr['Delivery']||0, delivPrev = prev['Delivery']||0
    if (delivNow > delivPrev * 1.3 && delivNow > 500) {
      result.push({ severity:'high', icon:'🛵', title:`Delivery +${((delivNow/delivPrev-1)*100).toFixed(0)}% este mes`, desc:`Gastaste ${S(delivNow)} vs ${S(delivPrev)} el mes pasado. Equivale a ${Math.round(delivNow/income*100)}% de tu sueldo en delivery.`, action:`Si lo reduces a tu promedio (${S(delivPrev)}), liberas ${S(delivNow-delivPrev)}/mes para deuda` })
    }
    
    // Restaurants spike
    const restNow = curr['Restaurantes']||0, restPrev = prev['Restaurantes']||0
    if (restNow > 1500) {
      const vs = restPrev > 0 ? ` (${restPrev<restNow?'+':''}${((restNow/restPrev-1)*100).toFixed(0)}% vs mes ant.)` : ''
      result.push({ severity: restNow > 2500 ? 'high' : 'medium', icon:'🍽️', title:`Restaurantes: ${S(restNow)}${vs}`, desc:`Gastas ${S(restNow)} en restaurantes. A ${S(Math.round(restNow/30))}/día en promedio.`, action:`Alternativa: cocinar 3 veces/semana puede reducir esto en S/400-800/mes` })
    }

    // Uber frequency
    const uberTxs = tx.filter(t=>t.merchant==='Uber' && t.date?.startsWith(months[months.length-1]))
    if (uberTxs.length > 15) {
      result.push({ severity:'medium', icon:'🚗', title:`${uberTxs.length} viajes Uber este mes`, desc:`${uberTxs.length} viajes = ${S(uberTxs.reduce((s,t)=>s+Number(t.amount_pen||t.amount),0))}. Promedio ${S(Math.round(uberTxs.reduce((s,t)=>s+Number(t.amount_pen||t.amount),0)/uberTxs.length))} por viaje.`, action:'¿Combinas Uber con Metropolitano para trayectos largos?' })
    }

    // Subscriptions total
    const subTotal = Object.entries(curr).find(([k])=>k==='Suscripciones')?.[1] || 0
    const subTxs = tx.filter(t=>t.category==='Suscripciones')
    const uniqueSubs = [...new Set(subTxs.map(t=>t.merchant))].filter(Boolean)
    if (uniqueSubs.length >= 4) {
      result.push({ severity:'low', icon:'📱', title:`${uniqueSubs.length} suscripciones activas: ${S(subTotal)}/mes`, desc:`${uniqueSubs.join(', ')}. En un año: ${S(subTotal*12)}.`, action:'¿Cuántas usas realmente cada semana?' })
    }

    // Spending > income
    if ((currSnap.totalGastos||0) > (currSnap.totalIngresos||0) && currSnap.totalIngresos > 0) {
      result.push({ severity:'high', icon:'⚠️', title:'Gastos superaron ingresos este mes', desc:`Gastaste ${S(currSnap.totalGastos)} pero recibiste ${S(currSnap.totalIngresos)}. Déficit de ${S(currSnap.totalGastos-currSnap.totalIngresos)}.`, action:'Revisa categorías de gastos — algo extraordinario ocurrió' })
    }

    // Positive: trend improving
    if (currSnap.totalGastos < prevSnap.totalGastos && prevSnap.totalGastos > 0) {
      result.push({ severity:'positive', icon:'🎉', title:`Gastos bajaron ${S(prevSnap.totalGastos-currSnap.totalGastos)} vs mes anterior`, desc:`De ${S(prevSnap.totalGastos)} a ${S(currSnap.totalGastos)}. Eso es ${S((prevSnap.totalGastos-currSnap.totalGastos)*12)}/año si se mantiene.`, action:'¡Buen trabajo! Cada sol ahorrado va directo a reducir deuda' })
    }

    // Weekend spending pattern
    const weekendTx = tx.filter(t=>{const d=new Date(t.date);return (d.getDay()===0||d.getDay()===6)&&t.type==='gasto'})
    const weekdayTx = tx.filter(t=>{const d=new Date(t.date);return d.getDay()>0&&d.getDay()<6&&t.type==='gasto'})
    const wkndAvg = weekendTx.reduce((s,t)=>s+Number(t.amount_pen||t.amount),0)/Math.max(weekendTx.length,1)
    const wkdyAvg = weekdayTx.reduce((s,t)=>s+Number(t.amount_pen||t.amount),0)/Math.max(weekdayTx.length,1)
    if (wkndAvg > wkdyAvg * 1.5 && wkndAvg > 50) {
      result.push({ severity:'info', icon:'📅', title:`Gastas ${((wkndAvg/wkdyAvg-1)*100).toFixed(0)}% más los fines de semana`, desc:`Prom fin de semana: ${S(wkndAvg)}/tx vs ${S(wkdyAvg)}/tx en semana.`, action:'Los viernes y sábados son los días de mayor gasto — planifica un límite semanal' })
    }

    return result.slice(0, 8)
  }, [snap, tx, months, income, currSnap, prevSnap])

  // ── Money Advisor ───────────────────────────────────────────────────────────
  const moneyAdvice = useMemo(() => {
    const realCards = (cards||[]).filter(c => !(c.bank==='Interbank' && (c.name||'').toLowerCase().includes('access')) && Number(c.current_balance)>0)
    const allDebtsData = [
      ...realCards.map(c => ({ name:`${c.bank} ${c.name}`, balance:Number(c.current_balance), rate:Number(c.tcea||c.tea||40)/100, minPay:Number(c.minimum_payment||0) })),
      ...(debts||[]).filter(d=>Number(d.current_balance)>0).map(d=>({ name:d.name, balance:Number(d.current_balance), rate:Number(d.tea||d.tcea||13)/100, minPay:Number(d.monthly_payment||0) }))
    ].sort((a,b)=>b.rate-a.rate)
    
    const totalDebt = allDebtsData.reduce((s,d)=>s+d.balance,0)
    const fixedMonthly = currSnap.totalFijos || 4511
    const warda = 30146 // from DB
    const emergencyFundMonths = warda / fixedMonthly
    const targetEFMonths = 3
    const efGap = Math.max(0, (targetEFMonths - emergencyFundMonths) * fixedMonthly)
    
    const recs = []
    let available = moneyToAllocate

    // Emergency fund check
    if (emergencyFundMonths < 1) {
      const ef = Math.min(available * 0.6, efGap)
      recs.push({ icon:'🛡️', priority:'🔴 Urgente', title:'Fondo de emergencia < 1 mes', amount:ef, reason:`Con solo ${emergencyFundMonths.toFixed(1)} meses de respaldo, cualquier imprevisto te fuerza a deuda cara. WARDA ya tiene ${S(warda)} pero necesitas ${S(fixedMonthly*3)} (3 meses).`, impactAnnual: ef * (allDebtsData[0]?.rate||0.4) })
      available -= ef
    } else if (emergencyFundMonths < targetEFMonths) {
      const ef = Math.min(available * 0.3, efGap)
      recs.push({ icon:'🛡️', priority:'🟡 Importante', title:`Completar fondo emergencia (${emergencyFundMonths.toFixed(1)} de 3 meses)`, amount:ef, reason:`WARDA (${S(warda)}) da ${emergencyFundMonths.toFixed(1)} meses. Meta: 3 meses = ${S(fixedMonthly*3)}. Faltan ${S(efGap)}.`, impactAnnual: 0 })
      available -= ef
    }

    // High rate debt
    if (available > 0 && allDebtsData[0]?.rate > 0.30) {
      const topDebt = allDebtsData[0]
      const allocation = Math.min(available * 0.85, topDebt.balance)
      const intSaved = allocation * topDebt.rate
      recs.push({ icon:'⚡', priority:'🔴 Alto impacto', title:`Atacar ${topDebt.name}`, amount:allocation, reason:`TCEA ${(topDebt.rate*100).toFixed(0)}% — es la "inversión" más rentable que puedes hacer. Ningún fondo mutuo ni plazo fijo peruano paga ${(topDebt.rate*100).toFixed(0)}% garantizado.`, impactAnnual: intSaved })
      available -= allocation
    }

    // If leftover and no very high rate debt
    if (available > 200 && allDebtsData.every(d=>d.rate<0.25)) {
      recs.push({ icon:'📈', priority:'🟢 Oportunidad', title:'Fondos mutuos / Inversión moderada', amount:available, reason:`Con tu deuda más cara al ${allDebtsData[0]?.(d=>d)?((allDebtsData[0].rate*100).toFixed(0)):0}%, hay espacio para invertir el excedente. Opciones en Perú: fondos mutuos Sura/BCP/Interbank (7-12% anual), ETFs en dólares (Banca digital), CTS productiva.`, impactAnnual: available * 0.09 })
    }

    return { recs, allDebtsData, emergencyFundMonths, efGap, warda }
  }, [cards, debts, moneyToAllocate, currSnap])

  // ── Financial Score ─────────────────────────────────────────────────────────
  const score = useMemo(() => {
    const debtPayments = moneyAdvice.allDebtsData.reduce((s,d)=>s+d.minPay,0)
    const totalDebt = moneyAdvice.allDebtsData.reduce((s,d)=>s+d.balance,0)
    const dti = income > 0 ? (debtPayments/income)*100 : 100
    const efMonths = moneyAdvice.emergencyFundMonths

    const factors = [
      { label:'Ratio deuda/ingreso', value:dti, 
        score: dti<20?25:dti<36?20:dti<50?12:dti<65?6:0, max:25,
        color: dti<36?'#22c55e':dti<50?'#f59e0b':'#ef4444',
        detail:`${dti.toFixed(0)}% del sueldo en cuotas ${dti<36?'✅':dti<50?'⚠️':'🔴'}` },
      { label:'Fondo emergencia', value:efMonths,
        score: efMonths>=6?20:efMonths>=3?16:efMonths>=1?10:efMonths>=0.5?5:0, max:20,
        color: efMonths>=3?'#22c55e':efMonths>=1?'#f59e0b':'#ef4444',
        detail:`${efMonths.toFixed(1)} meses de respaldo ${efMonths>=3?'✅':efMonths>=1?'⚠️':'🔴'}` },
      { label:'Control de gastos', value:(currSnap.totalGastos||0)/(income||1)*100,
        score: (currSnap.totalGastos||0)<income*0.70?20:(currSnap.totalGastos||0)<income*0.85?15:(currSnap.totalGastos||0)<income*0.95?8:3, max:20,
        color: (currSnap.totalGastos||0)<income*0.85?'#22c55e':'#ef4444',
        detail:`Gastos = ${income>0?((currSnap.totalGastos||0)/income*100).toFixed(0):100}% del ingreso` },
      { label:'Nivel de deuda', value:totalDebt,
        score: totalDebt<income*6?15:totalDebt<income*12?10:totalDebt<income*18?5:2, max:15,
        color: totalDebt<income*12?'#f59e0b':'#ef4444',
        detail:`Deuda = ${income>0?(totalDebt/income).toFixed(0):0}x sueldo mensual` },
      { label:'Tasa de ahorro WARDA', value:moneyAdvice.warda,
        score: moneyAdvice.warda>income*3?20:moneyAdvice.warda>income?15:moneyAdvice.warda>income*0.5?10:5, max:20,
        color:'#22c55e',
        detail:`${S(moneyAdvice.warda)} en WARDA (${income>0?(moneyAdvice.warda/income).toFixed(1):0} meses de sueldo)` },
    ]
    const total = factors.reduce((s,f)=>s+f.score,0)
    const grade = total>=80?'A':total>=65?'B':total>=50?'C':total>=35?'D':'F'
    const gradeColor = total>=80?'#22c55e':total>=65?'#84cc16':total>=50?'#f59e0b':total>=35?'#f97316':'#ef4444'
    const gradeMsg = total>=80?'Excelente':total>=65?'Bien':total>=50?'Regular — hay trabajo por hacer':total>=35?'Necesita atención':'Situación crítica'
    return { score:total, grade, gradeColor, gradeMsg, factors }
  }, [moneyAdvice, income, currSnap])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{background:'var(--bg-base)'}}>
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-4 md:p-5 space-y-5 max-w-5xl mx-auto" style={{background:'var(--bg-base)',minHeight:'100vh'}}>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Brain size={20} className="text-purple-400"/> Inteligencia Financiera
        </h1>
        <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>
          Análisis automático · Gastos hormiga · Score · Qué hacer con tu dinero
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{background:'var(--bg-card)'}}>
        {[{v:'insights',l:'💡 Insights'},{v:'score',l:'🏆 Score'},{v:'hormiga',l:'🐜 Gastos Hormiga'},{v:'advisor',l:'💰 Asesor'}].map(t=>(
          <button key={t.v} onClick={()=>setActiveTab(t.v)}
            className="flex-1 py-2 text-xs md:text-sm font-medium rounded-xl transition-all whitespace-nowrap px-2"
            style={{background:activeTab===t.v?'var(--blue)':'transparent',color:activeTab===t.v?'#fff':'var(--text-3)'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* TAB: Insights */}
      {activeTab==='insights' && (
        <div className="space-y-3">
          <p className="text-xs" style={{color:'var(--text-3)'}}>Patrones detectados en tus últimos {months.length} meses de datos</p>
          {insights.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm" style={{color:'var(--text-3)'}}>Sin insights disponibles aún. Carga más meses de EECCs.</p>
            </div>
          ) : insights.map((ins, i) => (
            <div key={i} className="card p-4" style={{borderLeft:`3px solid ${SEVERITY[ins.severity]}`}}>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{ins.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-white mb-0.5">{ins.title}</p>
                  <p className="text-sm mb-2" style={{color:'var(--text-2)'}}>{ins.desc}</p>
                  <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg" style={{background:SEV_BG[ins.severity]}}>
                    <Lightbulb size={12} className="flex-shrink-0 mt-0.5" style={{color:SEVERITY[ins.severity]}}/>
                    <p className="text-xs" style={{color:SEVERITY[ins.severity]}}>{ins.action}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: Score */}
      {activeTab==='score' && (
        <div className="space-y-4">
          {/* Big score */}
          <div className="card p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{background:`radial-gradient(circle at 50% 50%, ${score.gradeColor}, transparent)`}}/>
            <div className="relative">
              <div className="w-28 h-28 rounded-full mx-auto flex items-center justify-center mb-3 border-4"
                style={{borderColor:score.gradeColor,background:`${score.gradeColor}15`}}>
                <div>
                  <p className="text-4xl font-black" style={{color:score.gradeColor}}>{score.grade}</p>
                  <p className="text-lg font-bold text-white num">{score.score}</p>
                </div>
              </div>
              <p className="font-semibold text-white text-lg">{score.gradeMsg}</p>
              <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>Score de 100 puntos · Actualizado con tus datos reales</p>
            </div>
          </div>

          {/* Factor breakdown */}
          <div className="space-y-3">
            {score.factors.map((f,i)=>(
              <div key={i} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">{f.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold num" style={{color:f.color}}>{f.score}/{f.max}</p>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full mb-2" style={{background:'var(--border)'}}>
                  <div className="h-full rounded-full transition-all" style={{width:`${(f.score/f.max)*100}%`,background:f.color}}/>
                </div>
                <p className="text-xs" style={{color:'var(--text-3)'}}>{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Gastos Hormiga */}
      {activeTab==='hormiga' && (
        <div className="space-y-4">
          <div className="card p-4 border" style={{borderColor:'rgba(234,179,8,0.3)',background:'rgba(234,179,8,0.04)'}}>
            <p className="text-sm font-semibold" style={{color:'#fbbf24'}}>🐜 Gastos hormiga — pequeños pero devastadores</p>
            <p className="text-sm mt-1" style={{color:'var(--text-2)'}}>
              Son transacciones pequeñas que se repiten constantemente. Individualmente parecen inofensivas, pero sumadas representan una porción importante de tus ingresos. El peligro: al ser pequeñas, nunca las "notas".
            </p>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Impacto total de gastos hormiga</h2>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="p-3 rounded-xl text-center" style={{background:'var(--bg-card2)'}}>
                <p className="text-xs" style={{color:'var(--text-3)'}}>Total/mes</p>
                <p className="text-xl font-bold text-orange-400 num">{S(antSpending.reduce((s,a)=>s+a.monthly,0))}</p>
              </div>
              <div className="p-3 rounded-xl text-center" style={{background:'var(--bg-card2)'}}>
                <p className="text-xs" style={{color:'var(--text-3)'}}>Al año</p>
                <p className="text-xl font-bold text-red-400 num">{S(antSpending.reduce((s,a)=>s+a.annual,0))}</p>
              </div>
              <div className="p-3 rounded-xl text-center" style={{background:'var(--bg-card2)'}}>
                <p className="text-xs" style={{color:'var(--text-3)'}}>% del sueldo/mes</p>
                <p className="text-xl font-bold num" style={{color:income>0&&antSpending.reduce((s,a)=>s+a.monthly,0)/income>0.3?'#ef4444':'#f59e0b'}}>{income>0?((antSpending.reduce((s,a)=>s+a.monthly,0)/income)*100).toFixed(0):0}%</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={antSpending.slice(0,8)} layout="vertical">
                <XAxis type="number" tick={{fill:'var(--text-3)',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`S/${v}`}/>
                <YAxis type="category" dataKey="merchant" width={80} tick={{fill:'var(--text-2)',fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:'var(--bg-card2)',border:'1px solid var(--border2)',borderRadius:8,fontSize:11}} formatter={v=>[`S/${v}/mes`]}/>
                <Bar dataKey="monthly" radius={[0,4,4,0]}>
                  {antSpending.slice(0,8).map((_,i)=>(
                    <Cell key={i} fill={['#ef4444','#f97316','#f59e0b','#eab308','#84cc16'][Math.min(i,4)]}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {antSpending.map((a,i)=>(
              <div key={i} className="card p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                  style={{background:`rgba(239,68,68,${0.1+i*0.05})`,color:'#ef4444'}}>{i+1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{a.merchant}</p>
                  <p className="text-xs" style={{color:'var(--text-3)'}}>{a.category} · {a.count} veces · prom {S(a.avg)}/compra</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-orange-400 num">{S(a.monthly)}/mes</p>
                  <p className="text-xs" style={{color:'var(--text-3)'}}>{S(a.annual)}/año</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Advisor */}
      {activeTab==='advisor' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-white mb-1">¿Qué hago con este dinero?</h2>
            <p className="text-xs mb-3" style={{color:'var(--text-3)'}}>Tengo disponible:</p>
            <div className="flex items-center gap-3 mb-1">
              <input type="range" min={100} max={8000} step={100} value={moneyToAllocate}
                onChange={e=>setMoneyToAllocate(Number(e.target.value))}
                className="flex-1" style={{accentColor:'var(--blue)'}}/>
              <span className="text-lg font-bold num text-white w-28 text-right">{S(moneyToAllocate)}</span>
            </div>
            <div className="flex justify-between text-xs" style={{color:'var(--text-3)'}}>
              <span>S/ 100</span><span>S/ 2,000</span><span>S/ 4,000</span><span>S/ 8,000</span>
            </div>
          </div>

          {/* Context */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {[
              {label:'WARDA actual',value:S(moneyAdvice.warda),color:'#22d3ee'},
              {label:'Fondo emerg.',value:`${moneyAdvice.emergencyFundMonths.toFixed(1)}m`,color:moneyAdvice.emergencyFundMonths>=3?'#22c55e':'#ef4444'},
              {label:'Deuda más cara',value:`${moneyAdvice.allDebtsData[0]?(moneyAdvice.allDebtsData[0].rate*100).toFixed(0):0}% TCEA`,color:'#ef4444'},
              {label:'Total deuda',value:S(moneyAdvice.allDebtsData.reduce((s,d)=>s+d.balance,0)),color:'#f97316'},
            ].map((k,i)=>(
              <div key={i} className="p-2 rounded-xl text-center" style={{background:'var(--bg-card)'}}>
                <p style={{color:'var(--text-3)'}}>{k.label}</p>
                <p className="font-bold mt-0.5 num" style={{color:k.color}}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div className="space-y-3">
            {moneyAdvice.recs.map((r,i)=>(
              <div key={i} className="card p-4" style={{borderLeft:`3px solid ${i===0?'#ef4444':i===1?'#f97316':'#22c55e'}`}}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{r.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:i===0?'rgba(239,68,68,0.2)':i===1?'rgba(249,115,22,0.2)':'rgba(34,197,94,0.2)',color:i===0?'#fca5a5':i===1?'#fdba74':'#86efac'}}>{r.priority}</span>
                      <p className="font-semibold text-white">{r.title}</p>
                    </div>
                    <p className="text-sm mb-2" style={{color:'var(--text-2)'}}>{r.reason}</p>
                    <div className="flex items-center justify-between p-2 rounded-xl" style={{background:'var(--bg-card2)'}}>
                      <span className="text-xs font-semibold text-white">Destinar: {S(r.amount)}</span>
                      {r.impactAnnual > 0 && <span className="text-xs text-green-400">Ahorro/año: {S(r.impactAnnual)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Link to copiloto */}
          <Link href="/dashboard/chat" className="card p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#3b82f6,#8b5cf6)'}}>
              <Brain size={18} className="text-white"/>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Pregúntale al Copiloto IA</p>
              <p className="text-xs" style={{color:'var(--text-3)'}}>Para análisis más profundo y estrategias personalizadas</p>
            </div>
            <ArrowRight size={16} style={{color:'var(--text-3)'}}/>
          </Link>
        </div>
      )}
    </div>
  )
}

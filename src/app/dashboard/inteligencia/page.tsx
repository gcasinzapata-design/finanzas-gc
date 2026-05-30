// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { Brain, AlertCircle, Lightbulb, TrendingUp, TrendingDown, Zap, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(Math.round(n)||0)}`
const SEV_CLR = { high:'#ef4444', medium:'#f97316', low:'#eab308', positive:'#22c55e', info:'#3b82f6' }
const SEV_BG = { high:'rgba(239,68,68,0.08)', medium:'rgba(249,115,22,0.08)', low:'rgba(234,179,8,0.08)', positive:'rgba(34,197,94,0.08)', info:'rgba(59,130,246,0.08)' }

export default function InteligenciaPage() {
  const [data, setData] = useState(null)
  const [cards, setCards] = useState([])
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('insights')
  // Manual savings input (real cash in accounts - WARDA does NOT count)
  const [realSavings, setRealSavings] = useState(5000) // user sets this manually
  const [moneyAvailable, setMoneyAvailable] = useState(1000)
  const [moneyInputStr, setMoneyInputStr] = useState('1000')

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
  const months = data?.months || []
  const currSnap = snap[snap.length-1] || {}
  const prevSnap = snap[snap.length-2] || {}
  // Income: use highest recorded month
  const income = Math.max(...snap.map(s=>s.totalIngresos||0).filter(v=>v>0), 8762)
  // Fixed monthly expenses (recurring)
  const fixedMonthly = currSnap.totalFijos || snap.reduce((s,m)=>s+m.totalFijos,0)/Math.max(snap.length,1) || 4500

  // ── SUSCRIPCIONES: calculate correctly from all months ──────────────────────
  const subStats = useMemo(() => {
    const subTxs = tx.filter(t=>t.category==='Suscripciones')
    const byMerchant = {}
    subTxs.forEach(t => {
      const m = t.merchant || t.description?.slice(0,20) || 'Otra'
      if (!byMerchant[m]) byMerchant[m] = { total:0, count:0, months: new Set() }
      byMerchant[m].total += Number(t.amount_pen||t.amount)
      byMerchant[m].count++
      byMerchant[m].months.add(t.date?.slice(0,7))
    })
    const nMonths = months.length || 5
    const list = Object.entries(byMerchant).map(([name, v]) => ({
      name,
      monthly: Math.round(v.total / nMonths),
      count: v.count,
    })).filter(s => s.monthly > 0).sort((a,b)=>b.monthly-a.monthly)
    const totalMonthly = list.reduce((s,x)=>s+x.monthly, 0)
    return { list, totalMonthly }
  }, [tx, months])

  // ── GASTOS HORMIGA ───────────────────────────────────────────────────────────
  const antSpending = useMemo(() => {
    const map = {}
    const nMonths = months.length || 5
    tx.filter(t => t.type==='gasto' && Number(t.amount_pen||t.amount) <= 80 && t.merchant).forEach(t => {
      if (!map[t.merchant]) map[t.merchant] = { amounts:[], cat:t.category }
      map[t.merchant].amounts.push(Number(t.amount_pen||t.amount))
    })
    return Object.entries(map)
      .filter(([,v]) => v.amounts.length >= 4)
      .map(([merchant,v]) => ({
        merchant, category: v.cat,
        count: v.amounts.length,
        avg: Math.round(v.amounts.reduce((s,a)=>s+a,0)/v.amounts.length),
        monthly: Math.round(v.amounts.reduce((s,a)=>s+a,0)/nMonths),
        annual: Math.round(v.amounts.reduce((s,a)=>s+a,0)/nMonths*12),
      }))
      .sort((a,b)=>b.monthly-a.monthly)
      .slice(0, 12)
  }, [tx, months])

  // ── INSIGHTS ────────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const result = []
    if (!snap.length) return result
    const curr = currSnap.byCat || {}
    const prev = prevSnap.byCat || {}

    // Delivery comparison
    const delivNow = curr['Delivery']||0, delivPrev = prev['Delivery']||0
    if (delivNow > 0 && delivPrev > 0 && delivNow > delivPrev * 1.25) {
      result.push({ severity:'high', icon:'🛵',
        title:`Delivery subió ${((delivNow/delivPrev-1)*100).toFixed(0)}% este mes`,
        desc:`${S(delivNow)} vs ${S(delivPrev)} el mes anterior. Diferencia: ${S(delivNow-delivPrev)}.`,
        action:`Reducirlo a tu promedio libera ${S(delivNow-delivPrev)}/mes para deuda` })
    } else if (delivNow > income * 0.1) {
      result.push({ severity:'medium', icon:'🛵',
        title:`Delivery = ${((delivNow/income)*100).toFixed(0)}% del sueldo (${S(delivNow)})`,
        desc:`Rappis frecuentes: ${S(Math.round(delivNow/30))}/día promedio.`,
        action:`Cada S/300 menos en delivery = 1 cuota extra a la AMEX` })
    }

    // Restaurants
    const restNow = curr['Restaurantes']||0
    if (restNow > 2000) {
      result.push({ severity: restNow > 3000 ? 'high' : 'medium', icon:'🍽️',
        title:`Restaurantes: ${S(restNow)} este mes`,
        desc:`${S(Math.round(restNow/30))}/día promedio en restaurantes.${restNow > (prev['Restaurantes']||0) ? ' Es tu mes más alto.' : ''}`,
        action:`Cocinar 2-3 veces/semana ahorra ~S/500-800/mes` })
    }

    // Subscriptions — using correct total
    if (subStats.list.length >= 4) {
      result.push({ severity:'low', icon:'📱',
        title:`${subStats.list.length} suscripciones: ${S(subStats.totalMonthly)}/mes (S/${subStats.totalMonthly*12} /año)`,
        desc:`${subStats.list.map(s=>`${s.name} ~${S(s.monthly)}`).join(' · ')}`,
        action:`¿Usas todas cada semana? Cada una cancelada = más para deuda` })
    }

    // Travel/extraordinary
    const viajNow = curr['Viajes']||0
    if (viajNow > 1000) {
      result.push({ severity:'info', icon:'✈️',
        title:`Viajes/extraordinario: ${S(viajNow)} este mes`,
        desc:`Gastos de viaje inflan el mes. Sin esto, tus gastos reales serían ~${S((currSnap.totalGastos||0)-viajNow)}.`,
        action:`Considera provisionar S/300-500/mes para viajes para no descapitalizarte` })
    }

    // Spending vs income alert
    if ((currSnap.totalGastos||0) > income && income > 0) {
      result.push({ severity:'high', icon:'⚠️',
        title:`Gastos > Ingresos este mes`,
        desc:`Gastaste ${S(currSnap.totalGastos)} con ingresos de ${S(income)}. Déficit: ${S(currSnap.totalGastos-income)}.`,
        action:`Revisa si fue un mes extraordinario (viajes, mascotas, eventos). Si se repite, es una señal de alerta` })
    }

    // Positive: improvement
    if (currSnap.totalGastos > 0 && prevSnap.totalGastos > 0 && currSnap.totalGastos < prevSnap.totalGastos * 0.9) {
      result.push({ severity:'positive', icon:'🎉',
        title:`Gastos ${((1-currSnap.totalGastos/prevSnap.totalGastos)*100).toFixed(0)}% menores al mes anterior`,
        desc:`De ${S(prevSnap.totalGastos)} a ${S(currSnap.totalGastos)}. Ahorro: ${S(prevSnap.totalGastos-currSnap.totalGastos)}/mes.`,
        action:`Si se mantiene: ${S((prevSnap.totalGastos-currSnap.totalGastos)*12)} extra/año para deuda` })
    }

    // Interest charges visible
    const interestPaid = tx.filter(t=>t.category==='Intereses'&&t.type==='gasto').reduce((s,t)=>s+Number(t.amount_pen||t.amount),0)
    if (interestPaid > 500) {
      result.push({ severity:'high', icon:'🏦',
        title:`Pagaste ${S(interestPaid)} en intereses (${months.length} meses)`,
        desc:`Solo en intereses visibles en tus EECCs. El costo real incluye intereses embebidos en tus cuotas.`,
        action:`Esta es la razón #1 para atacar primero la AMEX (81.5%) y el BBVA (69.99%)` })
    }

    // Mascotas — if high
    const mascNow = (tx.filter(t=>t.category==='Mascotas')).reduce((s,t)=>s+Number(t.amount_pen||t.amount),0)
    if (mascNow > 1000) {
      result.push({ severity:'low', icon:'🐾',
        title:`Mascotas: ${S(mascNow)} histórico (~${S(Math.round(mascNow/Math.max(months.length,1)))}/mes)`,
        desc:`Incluye alimento, veterinaria y accesorios.`,
        action:`Costo legítimo — asegúrate de tenerlo presupuestado cada mes` })
    }

    return result.slice(0, 8)
  }, [snap, tx, months, income, currSnap, prevSnap, subStats])

  // ── SCORE — sin WARDA, con ahorro real manual ────────────────────────────────
  const score = useMemo(() => {
    const realCards = (cards||[]).filter(c=>!(c.bank==='Interbank'&&(c.name||'').toLowerCase().includes('access'))&&Number(c.current_balance)>0)
    const allDebtsData = [
      ...realCards.map(c=>({name:`${c.bank} ${c.name}`,balance:Number(c.current_balance),rate:Number(c.tcea||c.tea||40)/100,minPay:Number(c.minimum_payment||0)})),
      ...(debts||[]).filter(d=>Number(d.current_balance)>0).map(d=>({name:d.name,balance:Number(d.current_balance),rate:Number(d.tea||d.tcea||13)/100,minPay:Number(d.monthly_payment||0)}))
    ]
    const totalDebt = allDebtsData.reduce((s,d)=>s+d.balance,0)
    const minPayments = allDebtsData.reduce((s,d)=>s+d.minPay,0)
    const dti = income>0 ? (minPayments/income)*100 : 100
    // Emergency fund = real savings (manual input), target = 3 months of fixed expenses
    const efMonths = fixedMonthly > 0 ? realSavings/fixedMonthly : 0
    const avgExpense = snap.length>0 ? snap.reduce((s,m)=>s+(m.totalGastos||0),0)/snap.length : income*0.9

    const factors = [
      { label:'Ratio deuda/ingreso (DTI)', value:dti,
        score: dti<20?25:dti<36?20:dti<50?12:dti<65?6:0, max:25,
        color: dti<36?'#22c55e':dti<50?'#f59e0b':'#ef4444',
        detail:`${dti.toFixed(0)}% del sueldo en cuotas ${dti<36?'✅':dti<50?'⚠️':'🔴'} (ideal <36%)` },
      { label:'Fondo de emergencia (ahorros reales)', value:efMonths,
        score: efMonths>=6?20:efMonths>=3?16:efMonths>=1?10:efMonths>=0.5?5:0, max:20,
        color: efMonths>=3?'#22c55e':efMonths>=1?'#f59e0b':'#ef4444',
        detail:`${S(realSavings)} = ${efMonths.toFixed(1)} meses de gastos fijos ${efMonths>=3?'✅':efMonths>=1?'⚠️':'🔴'} (meta: 3m)` },
      { label:'Control de gastos', value:(avgExpense/income)*100,
        score: avgExpense<income*0.70?20:avgExpense<income*0.85?15:avgExpense<income*0.95?8:3, max:20,
        color: avgExpense<income*0.85?'#22c55e':'#ef4444',
        detail:`Gasto prom = ${income>0?((avgExpense/income)*100).toFixed(0):100}% del ingreso` },
      { label:'Nivel de deuda total', value:totalDebt,
        score: totalDebt<income*6?15:totalDebt<income*12?10:totalDebt<income*18?5:2, max:15,
        color: totalDebt<income*12?'#f59e0b':'#ef4444',
        detail:`Deuda = ${income>0?(totalDebt/income).toFixed(0):0}x tu sueldo mensual` },
      { label:'Diversificación (tasa promedio deuda)', value:0,
        score: allDebtsData.length>0 ? (allDebtsData.reduce((s,d)=>s+d.rate*d.balance,0)/Math.max(totalDebt,1) < 0.25 ? 20 : allDebtsData.reduce((s,d)=>s+d.rate*d.balance,0)/Math.max(totalDebt,1) < 0.45 ? 12 : 5) : 20, max:20,
        color: '#f59e0b',
        detail:`Tasa ponderada: ${totalDebt>0?((allDebtsData.reduce((s,d)=>s+d.rate*d.balance,0)/totalDebt)*100).toFixed(0):0}% promedio — afectada por AMEX y BBVA` },
    ]
    const total = factors.reduce((s,f)=>s+f.score, 0)
    const grade = total>=80?'A':total>=65?'B':total>=50?'C':total>=35?'D':'F'
    const gradeColor = total>=80?'#22c55e':total>=65?'#84cc16':total>=50?'#f59e0b':total>=35?'#f97316':'#ef4444'
    return { score:total, grade, gradeColor, factors }
  }, [cards, debts, income, fixedMonthly, realSavings, snap, months])

  // ── MONEY ADVISOR ───────────────────────────────────────────────────────────
  const moneyAdvice = useMemo(() => {
    const realCards = (cards||[]).filter(c=>!(c.bank==='Interbank'&&(c.name||'').toLowerCase().includes('access'))&&Number(c.current_balance)>0)
    const allDebtsData = [
      ...realCards.map(c=>({name:`${c.bank} ${c.name}`,balance:Number(c.current_balance),rate:Number(c.tcea||c.tea||40)/100,minPay:Number(c.minimum_payment||0)})),
      ...(debts||[]).filter(d=>Number(d.current_balance)>0).map(d=>({name:d.name,balance:Number(d.current_balance),rate:Number(d.tea||d.tcea||13)/100,minPay:Number(d.monthly_payment||0)}))
    ].sort((a,b)=>b.rate-a.rate)
    const targetEF = fixedMonthly * 3
    const efGap = Math.max(0, targetEF - realSavings)
    const efMonths = fixedMonthly > 0 ? realSavings/fixedMonthly : 0

    const recs = []
    let available = moneyAvailable

    if (efMonths < 1 && efGap > 0) {
      const ef = Math.min(available * 0.5, efGap)
      recs.push({ icon:'🛡️', priority:'🔴 Urgente', title:'Fondo emergencia < 1 mes',
        amount: ef,
        reason:`Con ${efMonths.toFixed(1)} meses de respaldo cualquier imprevisto te fuerza a deuda cara. Meta mínima: ${S(fixedMonthly)} (1 mes) → ideal ${S(targetEF)} (3 meses).`,
        impact: `Llegarías a ${((realSavings+ef)/fixedMonthly).toFixed(1)} meses` })
      available -= ef
    }

    if (available > 0 && allDebtsData[0]?.rate > 0.30) {
      const top = allDebtsData[0]
      const allocation = Math.min(available * 0.80, top.balance)
      recs.push({ icon:'⚡', priority:'🔴 Máximo impacto', title:`Pago extra → ${top.name}`,
        amount: allocation,
        reason:`TCEA ${(top.rate*100).toFixed(0)}%: cada sol que pagas aquí "gana" ${(top.rate*100).toFixed(0)}% garantizado — mejor que cualquier inversión peruana sin riesgo.`,
        impact: `Ahorra ~${S(allocation*top.rate)}/año en intereses` })
      available -= allocation
    } else if (available > 0 && allDebtsData[0]?.rate > 0.10) {
      const top = allDebtsData[0]
      const allocation = Math.min(available * 0.60, top.balance)
      recs.push({ icon:'📉', priority:'🟠 Buena opción', title:`Abono extra → ${top.name}`,
        amount: allocation,
        reason:`Con tasas entre 10-30%, pagar deuda supera a los fondos conservadores pero hay espacio para también guardar algo.`,
        impact: `Ahorra ~${S(allocation*top.rate)}/año` })
      available -= allocation
    }

    if (available > 200 && efMonths < 3) {
      const ef = Math.min(available, efGap)
      if (ef > 0) {
        recs.push({ icon:'💰', priority:'🟡 Colchón de seguridad', title:'Completar fondo emergencia',
          amount: ef,
          reason:`Llevar a 3 meses de gastos fijos (${S(targetEF)}) te da estabilidad para atacar deuda sin nerviosismo.`,
          impact: `${((realSavings+ef)/fixedMonthly).toFixed(1)} meses de respaldo` })
        available -= ef
      }
    }

    if (available > 0 && allDebtsData.every(d=>d.rate<=0.15)) {
      recs.push({ icon:'📈', priority:'🟢 Invertir excedente', title:'Fondos mutuos / Plazo fijo',
        amount: available,
        reason:`Con tu deuda bajo el 15%, tiene sentido diversificar. Opciones Perú: fondos mutuos Sura/BCP/Interbank (7-12% anual), depósito a plazo fijo BCP (>5%), ETFs en dólares.`,
        impact: `~${S(available*0.09)}/año en rendimiento` })
    }

    return { recs, allDebtsData, efMonths, efGap, targetEF }
  }, [cards, debts, moneyAvailable, fixedMonthly, realSavings])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{background:'var(--bg-base)'}}>
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-4 md:p-5 space-y-5 max-w-5xl mx-auto" style={{background:'var(--bg-base)',minHeight:'100vh'}}>

      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Brain size={20} className="text-purple-400"/> Inteligencia Financiera
        </h1>
        <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>Análisis automático basado en tus datos reales · {months.length} meses</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{background:'var(--bg-card)'}}>
        {[{v:'insights',l:'💡 Insights'},{v:'score',l:'🏆 Score'},{v:'hormiga',l:'🐜 Hormiga'},{v:'advisor',l:'💰 Asesor'}].map(t=>(
          <button key={t.v} onClick={()=>setActiveTab(t.v)}
            className="flex-1 py-2 text-xs md:text-sm font-medium rounded-xl transition-all whitespace-nowrap px-2"
            style={{background:activeTab===t.v?'var(--blue)':'transparent',color:activeTab===t.v?'#fff':'var(--text-3)'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── INSIGHTS ── */}
      {activeTab==='insights' && (
        <div className="space-y-3">
          {insights.length === 0 ? (
            <div className="card p-8 text-center"><p className="text-2xl mb-2">🔍</p><p className="text-sm" style={{color:'var(--text-3)'}}>Carga más EECCs para generar insights.</p></div>
          ) : insights.map((ins, i) => (
            <div key={i} className="card p-4" style={{borderLeft:`3px solid ${SEV_CLR[ins.severity]}`}}>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{ins.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-white mb-0.5">{ins.title}</p>
                  <p className="text-sm mb-2" style={{color:'var(--text-2)'}}>{ins.desc}</p>
                  <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg" style={{background:SEV_BG[ins.severity]}}>
                    <Lightbulb size={12} className="flex-shrink-0 mt-0.5" style={{color:SEV_CLR[ins.severity]}}/>
                    <p className="text-xs" style={{color:SEV_CLR[ins.severity]}}>{ins.action}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SCORE ── */}
      {activeTab==='score' && (
        <div className="space-y-4">
          {/* Real savings input - critical for accurate score */}
          <div className="card p-4 border" style={{borderColor:'rgba(59,130,246,0.3)',background:'rgba(59,130,246,0.05)'}}>
            <p className="text-sm font-semibold text-white mb-1">📌 Ingresa tus ahorros reales</p>
            <p className="text-xs mb-3" style={{color:'var(--text-3)'}}>
              WARDA no cuenta — ese dinero rota. Pon el saldo real de tus cuentas de ahorro BCP S/ y $ (convertido a PEN). Esto activa el Score correcto.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium" style={{color:'var(--text-2)'}}>Mis ahorros reales:</span>
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{color:'var(--text-3)'}}>S/</span>
                <input type="number" value={realSavings} onChange={e=>setRealSavings(Number(e.target.value)||0)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl text-sm font-bold text-white"
                  style={{background:'var(--bg-card2)',border:'1px solid var(--border2)'}}/>
              </div>
              <span className="text-xs" style={{color:'var(--text-3)'}}>= {(realSavings/fixedMonthly).toFixed(1)} meses</span>
            </div>
          </div>

          {/* Score display */}
          <div className="card p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{background:`radial-gradient(circle at 50%,${score.gradeColor},transparent)`}}/>
            <div className="relative">
              <div className="w-28 h-28 rounded-full mx-auto flex items-center justify-center mb-3 border-4"
                style={{borderColor:score.gradeColor,background:`${score.gradeColor}15`}}>
                <div>
                  <p className="text-4xl font-black" style={{color:score.gradeColor}}>{score.grade}</p>
                  <p className="text-lg font-bold text-white num">{score.score}/100</p>
                </div>
              </div>
              <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>Score basado en tus datos reales</p>
            </div>
          </div>

          <div className="space-y-3">
            {score.factors.map((f,i)=>(
              <div key={i} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">{f.label}</p>
                  <p className="text-sm font-bold num" style={{color:f.color}}>{f.score}/{f.max} pts</p>
                </div>
                <div className="w-full h-2 rounded-full mb-2" style={{background:'var(--border)'}}>
                  <div className="h-full rounded-full" style={{width:`${(f.score/f.max)*100}%`,background:f.color,transition:'width 0.5s'}}/>
                </div>
                <p className="text-xs" style={{color:'var(--text-3)'}}>{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HORMIGA ── */}
      {activeTab==='hormiga' && (
        <div className="space-y-4">
          <div className="card p-4 border" style={{borderColor:'rgba(234,179,8,0.3)',background:'rgba(234,179,8,0.04)'}}>
            <p className="text-sm font-semibold" style={{color:'#fbbf24'}}>🐜 La trampa de los gastos pequeños</p>
            <p className="text-sm mt-1" style={{color:'var(--text-2)'}}>Transacciones de S/3–80 que se repiten constantemente. Individualmente parecen insignificantes. Sumadas, pueden ser más que una cuota de tarjeta.</p>
          </div>
          <div className="card p-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-xl text-center" style={{background:'var(--bg-card2)'}}>
                <p className="text-xs" style={{color:'var(--text-3)'}}>Total/mes</p>
                <p className="text-xl font-bold text-orange-400 num">{S(antSpending.reduce((s,a)=>s+a.monthly,0))}</p>
              </div>
              <div className="p-3 rounded-xl text-center" style={{background:'var(--bg-card2)'}}>
                <p className="text-xs" style={{color:'var(--text-3)'}}>Al año</p>
                <p className="text-xl font-bold text-red-400 num">{S(antSpending.reduce((s,a)=>s+a.annual,0))}</p>
              </div>
              <div className="p-3 rounded-xl text-center" style={{background:'var(--bg-card2)'}}>
                <p className="text-xs" style={{color:'var(--text-3)'}}>% sueldo</p>
                <p className="text-xl font-bold num" style={{color:'#f59e0b'}}>{income>0?((antSpending.reduce((s,a)=>s+a.monthly,0)/income)*100).toFixed(0):0}%</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={antSpending.slice(0,8)} layout="vertical">
                <XAxis type="number" tick={{fill:'var(--text-3)',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`S/${v}`}/>
                <YAxis type="category" dataKey="merchant" width={85} tick={{fill:'var(--text-2)',fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:'var(--bg-card2)',border:'1px solid var(--border2)',borderRadius:8,fontSize:11}} formatter={v=>[`S/${v}/mes`]}/>
                <Bar dataKey="monthly" radius={[0,4,4,0]}>
                  {antSpending.slice(0,8).map((_,i)=><Cell key={i} fill={['#ef4444','#f97316','#f59e0b','#eab308','#84cc16'][Math.min(i,4)]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {antSpending.map((a,i)=>(
              <div key={i} className="card p-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold"
                  style={{background:`rgba(239,68,68,${0.1+i*0.05})`,color:'#ef4444'}}>{i+1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{a.merchant}</p>
                  <p className="text-xs" style={{color:'var(--text-3)'}}>{a.category} · {a.count}x total · S/{a.avg} prom/compra</p>
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

      {/* ── ASESOR ── */}
      {activeTab==='advisor' && (
        <div className="space-y-4">
          {/* Manual input - both slider AND text field */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-white mb-3">¿Cuánto dinero tengo disponible?</h2>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="number"
                value={moneyInputStr}
                onChange={e => {
                  setMoneyInputStr(e.target.value)
                  const v = Number(e.target.value)
                  if (!isNaN(v) && v >= 0) setMoneyAvailable(v)
                }}
                placeholder="Ej: 1500"
                className="w-36 px-3 py-2 rounded-xl text-sm font-bold text-white"
                style={{background:'var(--bg-card2)',border:'1px solid var(--border2)'}}/>
              <span className="text-sm" style={{color:'var(--text-3)'}}>soles disponibles para asignar</span>
            </div>
            <input type="range" min={0} max={8000} step={100} value={Math.min(moneyAvailable,8000)}
              onChange={e=>{const v=Number(e.target.value);setMoneyAvailable(v);setMoneyInputStr(String(v))}}
              className="w-full" style={{accentColor:'var(--blue)'}}/>
            <div className="flex justify-between text-xs mt-1" style={{color:'var(--text-3)'}}>
              <span>S/ 0</span><span>S/ 2k</span><span>S/ 4k</span><span>S/ 8k</span>
            </div>
          </div>

          {/* Also allow setting real savings here */}
          <div className="card p-4 border" style={{borderColor:'rgba(34,197,94,0.2)'}}>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-medium" style={{color:'var(--text-2)'}}>Mis ahorros reales en cuentas:</p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm" style={{color:'var(--text-3)'}}>S/</span>
                <input type="number" value={realSavings} onChange={e=>setRealSavings(Number(e.target.value)||0)}
                  className="w-28 px-2 py-1 rounded-lg text-sm font-bold text-white"
                  style={{background:'var(--bg-card2)',border:'1px solid var(--border2)'}}/>
              </div>
              <span className="text-xs" style={{color:'var(--text-3)'}}>
                = {(realSavings/fixedMonthly).toFixed(1)} meses · Meta: {S(fixedMonthly*3)} (3 meses) · {realSavings>= fixedMonthly*3?'✅ OK':'⚠️ Insuficiente'}
              </span>
            </div>
          </div>

          {/* Context strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {[
              {label:'Fondo emerg.',value:`${(realSavings/fixedMonthly).toFixed(1)}m`,color:realSavings>=fixedMonthly*3?'#22c55e':'#ef4444'},
              {label:'Deuda más cara',value:`${moneyAdvice.allDebtsData[0]?(moneyAdvice.allDebtsData[0].rate*100).toFixed(0):0}% TCEA`,color:'#ef4444'},
              {label:'Disponible',value:S(moneyAvailable),color:'#3b82f6'},
              {label:'Deuda total',value:S(moneyAdvice.allDebtsData.reduce((s,d)=>s+d.balance,0)),color:'#f97316'},
            ].map((k,i)=>(
              <div key={i} className="p-2 rounded-xl text-center" style={{background:'var(--bg-card)'}}>
                <p style={{color:'var(--text-3)'}}>{k.label}</p>
                <p className="font-bold mt-0.5 num" style={{color:k.color}}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {moneyAdvice.recs.length === 0 ? (
              <div className="card p-6 text-center"><p className="text-sm" style={{color:'var(--text-3)'}}>Ingresa un monto disponible para ver recomendaciones</p></div>
            ) : moneyAdvice.recs.map((r,i)=>(
              <div key={i} className="card p-4" style={{borderLeft:`3px solid ${i===0?'#ef4444':i===1?'#f97316':'#22c55e'}`}}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{r.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{background:i===0?'rgba(239,68,68,0.2)':i===1?'rgba(249,115,22,0.2)':'rgba(34,197,94,0.2)',
                          color:i===0?'#fca5a5':i===1?'#fdba74':'#86efac'}}>{r.priority}</span>
                      <p className="font-semibold text-white">{r.title}</p>
                    </div>
                    <p className="text-sm mb-2" style={{color:'var(--text-2)'}}>{r.reason}</p>
                    <div className="flex items-center justify-between p-2 rounded-xl" style={{background:'var(--bg-card2)'}}>
                      <span className="text-xs font-semibold text-white">Destinar: {S(r.amount)}</span>
                      {r.impact && <span className="text-xs text-green-400">{r.impact}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Link href="/dashboard/chat" className="card p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#3b82f6,#8b5cf6)'}}>
              <Brain size={18} className="text-white"/>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Pregúntale al Copiloto IA</p>
              <p className="text-xs" style={{color:'var(--text-3)'}}>Análisis personalizado con tus datos reales</p>
            </div>
            <ArrowRight size={16} style={{color:'var(--text-3)'}}/>
          </Link>
        </div>
      )}
    </div>
  )
}

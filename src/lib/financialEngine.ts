// @ts-nocheck
// FinanzasPE — Motor Financiero Central
// Técnicas validadas: Avalancha, Bola de Nieve, Regla 50/30/20, Fondo Emergencia, etc.

export type Debt = {
  id: string
  name: string
  institution: string
  balance: number
  rate: number      // TCEA anual como decimal (0.815 = 81.5%)
  minPayment: number
  type: 'tarjeta' | 'prestamo'
}

export type SimulationResult = {
  months: number
  totalInterest: number
  totalPaid: number
  payoffDate: string
  schedule: Array<{ month: number; balance: number; payment: number; interest: number; principal: number }>
}

// Simula el payoff de una deuda con pagos fijos
export function simulateDebt(debt: Debt, extraPayment: number = 0): SimulationResult {
  const monthlyRate = debt.rate / 12
  const payment = Math.max(debt.minPayment + extraPayment, debt.minPayment)
  let balance = debt.balance
  let totalInterest = 0
  let months = 0
  const schedule = []
  const maxMonths = 600 // 50 años

  while (balance > 0.01 && months < maxMonths) {
    const interest = balance * monthlyRate
    const principal = Math.min(payment - interest, balance)
    if (principal <= 0) break // pago mínimo no cubre intereses
    balance -= principal
    totalInterest += interest
    months++
    schedule.push({ month: months, balance: Math.max(0, balance), payment, interest, principal })
  }

  const payoffDate = new Date()
  payoffDate.setMonth(payoffDate.getMonth() + months)

  return {
    months,
    totalInterest: Math.round(totalInterest),
    totalPaid: Math.round(debt.balance + totalInterest),
    payoffDate: payoffDate.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' }),
    schedule
  }
}

// Estrategia Avalancha: mayor TCEA primero
export function avalancheStrategy(debts: Debt[], extraBudget: number) {
  const sorted = [...debts].sort((a, b) => b.rate - a.rate)
  return simulateMultiDebt(sorted, extraBudget)
}

// Estrategia Bola de Nieve: menor saldo primero (psicológica)
export function snowballStrategy(debts: Debt[], extraBudget: number) {
  const sorted = [...debts].sort((a, b) => a.balance - b.balance)
  return simulateMultiDebt(sorted, extraBudget)
}

function simulateMultiDebt(debts: Debt[], extraBudget: number) {
  let debtStates = debts.map(d => ({ ...d, remaining: d.balance }))
  let month = 0
  let totalInterest = 0
  const maxMonths = 600
  const timeline: Array<{ month: number; debts: Array<{ name: string; balance: number }> }> = []

  while (debtStates.some(d => d.remaining > 0.01) && month < maxMonths) {
    month++
    let extra = extraBudget

    // Pay minimum on all, apply extra to first
    for (let i = 0; i < debtStates.length; i++) {
      const d = debtStates[i]
      if (d.remaining <= 0) continue
      const mRate = d.rate / 12
      const interest = d.remaining * mRate
      totalInterest += interest
      let payment = d.minPayment
      if (i === 0 && extra > 0) { payment += extra; extra = 0 }
      if (payment > d.remaining + interest) payment = d.remaining + interest
      d.remaining = Math.max(0, d.remaining + interest - payment)
      // If this debt is paid off, cascade extra to next
      if (d.remaining < 0.01) {
        d.remaining = 0
        extra += d.minPayment
      }
    }

    if (month % 6 === 0) {
      timeline.push({
        month,
        debts: debtStates.map(d => ({ name: d.name, balance: Math.round(d.remaining) }))
      })
    }
  }

  return { months: month, totalInterest: Math.round(totalInterest), timeline }
}

// Score Financiero 0-100
export function calcFinancialScore(data: {
  income: number
  expenses: number
  totalDebt: number
  debtPayments: number
  savings: number
  emergencyFund: number
  fixedExpenses: number
}): { score: number; grade: string; factors: Array<{ label: string; score: number; max: number; insight: string }> } {
  const { income, expenses, totalDebt, debtPayments, savings, emergencyFund, fixedExpenses } = data
  const factors = []

  // 1. Ratio deuda/ingreso (DTI) — ideal <36%, crítico >50%
  const dti = income > 0 ? (debtPayments / income) * 100 : 100
  const dtiScore = dti < 20 ? 25 : dti < 36 ? 20 : dti < 50 ? 12 : dti < 65 ? 6 : 0
  factors.push({
    label: 'Ratio deuda/ingreso',
    score: dtiScore, max: 25,
    insight: dti < 20 ? '✅ Excelente' : dti < 36 ? '⚠️ Aceptable' : `🔴 Alto (${dti.toFixed(0)}% del sueldo en cuotas)`
  })

  // 2. Tasa de ahorro — ideal >20%
  const savRate = income > 0 ? (savings / income) * 100 : 0
  const savScore = savRate > 20 ? 20 : savRate > 10 ? 15 : savRate > 5 ? 10 : savRate > 0 ? 5 : 0
  factors.push({
    label: 'Tasa de ahorro',
    score: savScore, max: 20,
    insight: savRate > 20 ? '✅ Excelente' : savRate > 10 ? '⚠️ Bien, puede mejorar' : `🔴 Bajo (${savRate.toFixed(1)}%)`
  })

  // 3. Fondo de emergencia — ideal 3-6 meses de gastos fijos
  const efMonths = fixedExpenses > 0 ? emergencyFund / fixedExpenses : 0
  const efScore = efMonths >= 6 ? 20 : efMonths >= 3 ? 16 : efMonths >= 1 ? 10 : efMonths >= 0.5 ? 5 : 0
  factors.push({
    label: 'Fondo de emergencia',
    score: efScore, max: 20,
    insight: efMonths >= 6 ? '✅ Sólido (6+ meses)' : efMonths >= 3 ? '⚠️ Suficiente (3+ meses)' : `🔴 Insuficiente (${efMonths.toFixed(1)} meses)`
  })

  // 4. Control de gastos (gastos vs ingresos)
  const expRatio = income > 0 ? (expenses / income) * 100 : 100
  const expScore = expRatio < 70 ? 20 : expRatio < 85 ? 15 : expRatio < 95 ? 8 : expRatio < 110 ? 3 : 0
  factors.push({
    label: 'Control de gastos',
    score: expScore, max: 20,
    insight: expRatio < 70 ? '✅ Excelente control' : expRatio < 85 ? '⚠️ Aceptable' : `🔴 Gastos = ${expRatio.toFixed(0)}% del ingreso`
  })

  // 5. Diversificación deuda (no tener deuda en tasa muy alta)
  const hasHighRate = totalDebt > 0
  const divScore = !hasHighRate ? 15 : totalDebt < income * 6 ? 10 : totalDebt < income * 12 ? 6 : 2
  factors.push({
    label: 'Nivel de deuda total',
    score: divScore, max: 15,
    insight: totalDebt < income * 6 ? '⚠️ Manejable' : `🔴 Alta (${(totalDebt/income).toFixed(0)} meses de sueldo)`
  })

  const score = factors.reduce((s, f) => s + f.score, 0)
  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F'

  return { score, grade, factors }
}

// Análisis gastos hormiga
export function detectAnts(transactions: any[]): Array<{
  merchant: string; category: string; count: number; avgAmount: number; monthlyImpact: number; annualImpact: number; insight: string
}> {
  const map: Record<string, { amounts: number[]; dates: string[]; category: string }> = {}
  
  transactions
    .filter(t => t.type === 'gasto' && Number(t.amount_pen || t.amount) <= 80 && Number(t.amount_pen || t.amount) >= 3 && t.merchant)
    .forEach(t => {
      const m = t.merchant
      if (!map[m]) map[m] = { amounts: [], dates: [], category: t.category }
      map[m].amounts.push(Number(t.amount_pen || t.amount))
      map[m].dates.push(t.date?.slice(0, 7))
    })

  const months = [...new Set(transactions.map(t => t.date?.slice(0, 7)).filter(Boolean))].length || 1

  return Object.entries(map)
    .filter(([, v]) => v.amounts.length >= 4)
    .map(([merchant, v]) => {
      const avg = v.amounts.reduce((s, a) => s + a, 0) / v.amounts.length
      const monthly = v.amounts.reduce((s, a) => s + a, 0) / months
      const annual = monthly * 12
      let insight = ''
      if (monthly > 300) insight = `Equivale a ${(monthly / 1000).toFixed(1)} sueldos mínimos mensuales`
      else if (annual > 1000) insight = `En un año acumulas S/${annual.toFixed(0)}`
      else insight = `${v.amounts.length} compras en ${months} meses`
      return { merchant, category: v.category, count: v.amounts.length, avgAmount: Math.round(avg), monthlyImpact: Math.round(monthly), annualImpact: Math.round(annual), insight }
    })
    .sort((a, b) => b.monthlyImpact - a.monthlyImpact)
    .slice(0, 10)
}

// Recomendación: ¿Qué hacer con el dinero disponible?
export function adviseMoney(available: number, debts: Debt[], income: number, emergencyFund: number, fixedMonthlyExpenses: number) {
  const targetEF = fixedMonthlyExpenses * 3 // 3 meses mínimo
  const efGap = Math.max(0, targetEF - emergencyFund)
  const highRateDebt = debts.filter(d => d.rate > 0.30).sort((a, b) => b.rate - a.rate)
  const maxDebtRate = highRateDebt[0]?.rate || 0
  
  // Costo de oportunidad: si la deuda más cara > 15%, siempre conviene pagar antes de invertir
  const recommendations: Array<{ priority: number; action: string; amount: number; reason: string; impact: string }> = []

  // 1. Fondo de emergencia primero (si < 1 mes)
  if (emergencyFund < fixedMonthlyExpenses) {
    const toEF = Math.min(available, fixedMonthlyExpenses - emergencyFund)
    recommendations.push({
      priority: 1,
      action: 'Fondo de emergencia urgente',
      amount: toEF,
      reason: 'Tienes menos de 1 mes de gastos fijos como respaldo. Sin esto, cualquier imprevisto te fuerza a más deuda.',
      impact: `Llegarías a ${(emergencyFund + toEF) / fixedMonthlyExpenses.toFixed(1)} meses de respaldo`
    })
    available -= toEF
  }

  // 2. Si hay deuda > 30% TCEA, atacarla es la mejor "inversión"
  if (available > 0 && maxDebtRate > 0.30) {
    const topDebt = highRateDebt[0]
    const allocation = Math.min(available * 0.80, topDebt.balance)
    const interestSaved = allocation * topDebt.rate
    recommendations.push({
      priority: 2,
      action: `Atacar ${topDebt.name} (${(topDebt.rate * 100).toFixed(1)}% TCEA)`,
      amount: allocation,
      reason: `Al ${(topDebt.rate * 100).toFixed(0)}% TCEA, cada sol que pagas "gana" ${(topDebt.rate * 100).toFixed(0)}% garantizado. Ninguna inversión peruana ofrece eso sin riesgo.`,
      impact: `Ahorras ~S/${Math.round(interestSaved)}/año en intereses`
    })
    available -= allocation
  }

  // 3. Si ya atacó deuda, completar fondo de emergencia a 3 meses
  if (available > 0 && emergencyFund < targetEF) {
    const toEF = Math.min(available, efGap)
    recommendations.push({
      priority: 3,
      action: 'Completar fondo de emergencia (3 meses)',
      amount: toEF,
      reason: `Con 3 meses de gastos fijos (S/${targetEF.toFixed(0)}) tienes colchón para cualquier imprevisto sin tocar deuda.`,
      impact: `WARDA puede ayudarte con este objetivo automáticamente`
    })
    available -= toEF
  }

  // 4. Si queda y deuda media (15-30%)
  if (available > 0 && debts.some(d => d.rate > 0.15 && d.rate <= 0.30)) {
    const midDebt = debts.filter(d => d.rate > 0.15 && d.rate <= 0.30).sort((a, b) => b.rate - a.rate)[0]
    recommendations.push({
      priority: 4,
      action: `Reducir ${midDebt.name} (${(midDebt.rate * 100).toFixed(1)}% TEA)`,
      amount: Math.min(available, 500),
      reason: 'Con deuda al 13-30%, pagar supera a fondos mutuos conservadores pero hay espacio para algo de liquidez.',
      impact: 'Balance entre reducción de deuda y mantener liquidez'
    })
  }

  return recommendations
}

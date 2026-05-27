// ============================================================
// forecastEngine.ts
// Financial Forecasting Engine - Finanzas GC
// Liquidity forecasting 30/60/90 days, risk classification,
// scenario analysis (optimistic / base / pessimistic)
// ============================================================

export interface ForecastInput {
    currentBalance: number          // current liquid savings (soles)
  monthlyIncome: number           // average monthly income
  monthlyExpenses: number         // average monthly expenses (excl. debt)
  monthlyDebtPayments: number     // total monthly debt obligations
  incomeVolatility?: number       // std dev / mean income (0-1)
  expenseVolatility?: number      // std dev / mean expenses (0-1)
  plannedExtraExpenses?: Array<{  // one-time future expenses
      month: number                 // months from now (1-12)
      amount: number
      label: string
  }>
}

export interface LiquidityPoint {
    month: number                   // months from now
  label: string                   // e.g. "Mes 1", "Mes 3"
  balance: number                 // projected balance
  netFlow: number                 // income - expenses - debt
}

export interface ForecastScenario {
    label: 'optimista' | 'base' | 'pesimista'
    projected30Days: number
    projected60Days: number
    projected90Days: number
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    monthlyNetFlow: number
    liquidityPoints: LiquidityPoint[]
}

export interface ForecastResult {
    base: ForecastScenario
    optimistic: ForecastScenario
    pessimistic: ForecastScenario
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    riskLabel: string
    monthsUntilNegative: number | null   // null = never in 12-month horizon
  breakEvenMonth: number | null        // month where balance recovers after going negative
  alerts: string[]
}

// ── Risk Classification ──────────────────────────────────────
function classifyRisk(
    balance90: number,
    monthlyExpenses: number,
    monthlyIncome: number
  ): ForecastScenario['riskLevel'] {
    const monthsOfExpenses = monthlyExpenses > 0 ? balance90 / monthlyExpenses : 99
    if (balance90 < 0) return 'CRITICAL'
    if (monthsOfExpenses < 1) return 'HIGH'
    if (monthsOfExpenses < 3) return 'MEDIUM'
    return 'LOW'
}

// ── Build Scenario ───────────────────────────────────────────
function buildScenario(
    label: ForecastScenario['label'],
    currentBalance: number,
    monthlyNetFlow: number,
    monthlyExpenses: number,
    monthlyIncome: number,
    plannedExtraExpenses: ForecastInput['plannedExtraExpenses'] = []
  ): ForecastScenario {
    const liquidityPoints: LiquidityPoint[] = []
        let runningBalance = currentBalance

  for (let month = 1; month <= 3; month++) {
        const extras = (plannedExtraExpenses ?? [])
          .filter((e) => e.month === month)
          .reduce((s, e) => s + e.amount, 0)

      runningBalance += monthlyNetFlow - extras
        liquidityPoints.push({
                month,
                label: `Mes ${month}`,
                balance: Math.round(runningBalance),
                netFlow: Math.round(monthlyNetFlow - extras),
        })
  }

  const projected30Days = liquidityPoints[0].balance
    const projected60Days = liquidityPoints[1].balance
    const projected90Days = liquidityPoints[2].balance
    const riskLevel = classifyRisk(projected90Days, monthlyExpenses, monthlyIncome)

  return {
        label,
        projected30Days,
        projected60Days,
        projected90Days,
        riskLevel,
        monthlyNetFlow,
        liquidityPoints,
  }
}

// ── Months Until Negative Balance ────────────────────────────
function calculateMonthsUntilNegative(
    currentBalance: number,
    monthlyNetFlow: number,
    plannedExtraExpenses: ForecastInput['plannedExtraExpenses'] = []
  ): number | null {
    if (monthlyNetFlow >= 0) return null

  let balance = currentBalance
    for (let m = 1; m <= 24; m++) {
          const extras = (plannedExtraExpenses ?? [])
            .filter((e) => e.month === m)
            .reduce((s, e) => s + e.amount, 0)
          balance += monthlyNetFlow - extras
          if (balance < 0) return m
    }
    return null
}

// ── Master Forecast Generator ────────────────────────────────
export function generateForecast(input: ForecastInput): ForecastResult {
    const {
          currentBalance,
          monthlyIncome,
          monthlyExpenses,
          monthlyDebtPayments,
          incomeVolatility = 0.1,
          expenseVolatility = 0.1,
          plannedExtraExpenses = [],
    } = input

  const baseNetFlow = monthlyIncome - monthlyExpenses - monthlyDebtPayments

  // Scenario net flows
  const optimisticNetFlow = monthlyIncome * (1 + incomeVolatility) - monthlyExpenses * (1 - expenseVolatility) - monthlyDebtPayments
    const pessimisticNetFlow = monthlyIncome * (1 - incomeVolatility) - monthlyExpenses * (1 + expenseVolatility) - monthlyDebtPayments

  const base = buildScenario('base', currentBalance, baseNetFlow, monthlyExpenses, monthlyIncome, plannedExtraExpenses)
    const optimistic = buildScenario('optimista', currentBalance, optimisticNetFlow, monthlyExpenses, monthlyIncome, plannedExtraExpenses)
    const pessimistic = buildScenario('pesimista', currentBalance, pessimisticNetFlow, monthlyExpenses, monthlyIncome, plannedExtraExpenses)

  // Overall risk is based on pessimistic scenario
  const riskLevel = pessimistic.riskLevel

  const riskLabels: Record<ForecastScenario['riskLevel'], string> = {
        LOW: 'Riesgo bajo — finanzas estables',
        MEDIUM: 'Riesgo moderado — reforzar liquidez',
        HIGH: 'Riesgo alto — fondo de emergencia insuficiente',
        CRITICAL: 'Riesgo crítico — déficit proyectado',
  }

  const monthsUntilNegative = calculateMonthsUntilNegative(
        currentBalance,
        pessimisticNetFlow,
        plannedExtraExpenses
      )

  // Alerts
  const alerts: string[] = []
      if (base.projected30Days < 0) alerts.push('Saldo negativo proyectado en 30 días')
    if (base.projected60Days < 0 && base.projected30Days >= 0) alerts.push('Saldo negativo proyectado en 60 días')
    if (base.projected90Days < 0 && base.projected60Days >= 0) alerts.push('Saldo negativo proyectado en 90 días')
    if (pessimistic.projected30Days < currentBalance * 0.3) alerts.push('Escenario pesimista consume >70% del saldo en 30 días')
    if (monthsUntilNegative !== null && monthsUntilNegative <= 3) {
          alerts.push(`Balance puede volverse negativo en ${monthsUntilNegative} meses (escenario pesimista)`)
    }
    if (baseNetFlow < 0) alerts.push('Flujo de caja mensual negativo — gastos superan ingresos')

  return {
        base,
        optimistic,
        pessimistic,
        riskLevel,
        riskLabel: riskLabels[riskLevel],
        monthsUntilNegative,
        breakEvenMonth: null, // TODO: calculate when negative balance recovers
        alerts,
  }
}

// ── Legacy compatibility export ──────────────────────────────
export interface ForecastResult_v1 {
    projected30Days: number
    projected60Days: number
    projected90Days: number
    monthlyNetFlow: number
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

// ============================================================
// financialHealth.ts
// Financial Health Scoring Engine - Finanzas GC
// Generates holistic financial health score with warnings
// and optimization recommendations
// ============================================================

export interface FinancialHealthInput {
    savingsRate: number        // % of income saved (0-100)
  debtRatio: number          // total debt / monthly income
  runwayMonths: number       // months of expenses covered by savings
  cashflowStability?: number // coefficient of variation (0-1, lower=stable)
  debtBurden?: number        // monthly debt payments / monthly income (0-1)
  spendingConsistency?: number // 0-1, higher=more consistent
}

export interface HealthWarning {
    code: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    message: string
}

export interface HealthRecommendation {
    priority: number          // 1=highest
  category: 'savings' | 'debt' | 'liquidity' | 'cashflow' | 'spending'
    action: string
    impact: 'high' | 'medium' | 'low'
}

export interface FinancialHealthResult {
    score: number              // 0-100
  status: 'excellent' | 'healthy' | 'warning' | 'critical'
    breakdown: {
      savingsScore: number
      debtScore: number
      liquidityScore: number
      cashflowScore: number
      spendingScore: number
    }
    warnings: HealthWarning[]
    recommendations: HealthRecommendation[]
    tier: string               // Human-readable label
}

export function financialHealth(input: FinancialHealthInput): FinancialHealthResult {
    const warnings: HealthWarning[] = []
        const recommendations: HealthRecommendation[] = []

            // ── Savings Score (25 pts) ──────────────────────────────────
            let savingsScore = 0
    if (input.savingsRate >= 30) savingsScore = 25
    else if (input.savingsRate >= 20) savingsScore = 20
    else if (input.savingsRate >= 10) savingsScore = 13
    else if (input.savingsRate >= 5) savingsScore = 7
    else savingsScore = 2

  if (input.savingsRate < 10) {
        warnings.push({
                code: 'LOW_SAVINGS_RATE',
                severity: input.savingsRate < 5 ? 'critical' : 'high',
                message: `Tasa de ahorro del ${input.savingsRate.toFixed(1)}% — por debajo del mínimo recomendado (10%)`,
        })
        recommendations.push({
                priority: 1,
                category: 'savings',
                action: 'Aumentar tasa de ahorro al menos al 10% automatizando transferencias al inicio del mes',
                impact: 'high',
        })
  } else if (input.savingsRate < 20) {
        warnings.push({
                code: 'MODERATE_SAVINGS_RATE',
                severity: 'medium',
                message: `Tasa de ahorro del ${input.savingsRate.toFixed(1)}% — espacio para mejorar hacia el 20%`,
        })
  }

  // ── Debt Score (25 pts) ─────────────────────────────────────
  let debtScore = 0
    if (input.debtRatio <= 2) debtScore = 25
    else if (input.debtRatio <= 4) debtScore = 18
    else if (input.debtRatio <= 8) debtScore = 10
    else if (input.debtRatio <= 15) debtScore = 4
    else debtScore = 0

  if (input.debtRatio > 8) {
        warnings.push({
                code: 'HIGH_DEBT_RATIO',
                severity: input.debtRatio > 15 ? 'critical' : 'high',
                message: `Ratio deuda/ingreso de ${input.debtRatio.toFixed(1)}x — nivel de riesgo elevado`,
        })
        recommendations.push({
                priority: 2,
                category: 'debt',
                action: 'Aplicar estrategia avalanche: priorizar pagos de deudas con mayor tasa de interés',
                impact: 'high',
        })
  }

  const debtBurden = input.debtBurden ?? 0
    if (debtBurden > 0.4) {
          warnings.push({
                  code: 'HIGH_DEBT_BURDEN',
                  severity: 'high',
                  message: `${(debtBurden * 100).toFixed(0)}% del ingreso va a pagos de deuda — supera el límite recomendado (40%)`,
          })
          recommendations.push({
                  priority: 3,
                  category: 'debt',
                  action: 'Evaluar refinanciamiento o consolidación de deudas para reducir cuota mensual',
                  impact: 'high',
          })
    }

  // ── Liquidity Score (25 pts) ────────────────────────────────
  let liquidityScore = 0
    if (input.runwayMonths >= 6) liquidityScore = 25
    else if (input.runwayMonths >= 4) liquidityScore = 18
    else if (input.runwayMonths >= 2) liquidityScore = 10
    else if (input.runwayMonths >= 1) liquidityScore = 5
    else liquidityScore = 0

  if (input.runwayMonths < 3) {
        warnings.push({
                code: 'LOW_LIQUIDITY_RUNWAY',
                severity: input.runwayMonths < 1 ? 'critical' : 'high',
                message: `Solo ${input.runwayMonths.toFixed(1)} meses de runway — fondo de emergencia insuficiente`,
        })
        recommendations.push({
                priority: 1,
                category: 'liquidity',
                action: 'Construir fondo de emergencia de 3-6 meses de gastos como prioridad inmediata',
                impact: 'high',
        })
  }

  // ── Cashflow Score (15 pts) ─────────────────────────────────
  const cashflowStability = input.cashflowStability ?? 0.3
    let cashflowScore = 0
    if (cashflowStability <= 0.15) cashflowScore = 15
    else if (cashflowStability <= 0.30) cashflowScore = 11
    else if (cashflowStability <= 0.50) cashflowScore = 6
    else cashflowScore = 2

  if (cashflowStability > 0.5) {
        warnings.push({
                code: 'UNSTABLE_CASHFLOW',
                severity: 'medium',
                message: 'Flujo de caja irregular — variabilidad alta en ingresos o gastos mensuales',
        })
        recommendations.push({
                priority: 4,
                category: 'cashflow',
                action: 'Identificar gastos variables y crear presupuesto mensual fijo con categorías',
                impact: 'medium',
        })
  }

  // ── Spending Consistency Score (10 pts) ─────────────────────
  const spendingConsistency = input.spendingConsistency ?? 0.7
    let spendingScore = 0
    if (spendingConsistency >= 0.85) spendingScore = 10
    else if (spendingConsistency >= 0.70) spendingScore = 7
    else if (spendingConsistency >= 0.50) spendingScore = 4
    else spendingScore = 1

  if (spendingConsistency < 0.5) {
        warnings.push({
                code: 'INCONSISTENT_SPENDING',
                severity: 'medium',
                message: 'Patrones de gasto inconsistentes — dificulta la planificación financiera',
        })
  }

  // ── Total Score ─────────────────────────────────────────────
  const score = Math.min(
        100,
        Math.max(0, savingsScore + debtScore + liquidityScore + cashflowScore + spendingScore)
      )

  // ── Status & Tier ───────────────────────────────────────────
  let status: FinancialHealthResult['status'] = 'excellent'
    let tier = 'Excelente'
    if (score < 40) { status = 'critical'; tier = 'Crítico' }
    else if (score < 60) { status = 'warning'; tier = 'En riesgo' }
    else if (score < 80) { status = 'healthy'; tier = 'Saludable' }

  // Sort recommendations by priority
  recommendations.sort((a, b) => a.priority - b.priority)

  return {
        score,
        status,
        tier,
        breakdown: {
                savingsScore,
                debtScore,
                liquidityScore,
                cashflowScore,
                spendingScore,
        },
        warnings,
        recommendations,
  }
}

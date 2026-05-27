// ============================================================
// debtStrategies.ts
// Debt Strategy Engine - Finanzas GC
// Avalanche, Snowball, Hybrid strategies with payoff simulation
// and interest savings calculation
// ============================================================

import { DebtAccount } from './debtMetrics'

export interface StrategyStep {
    month: number
    debtName: string
    payment: number
    interestPaid: number
    principalPaid: number
    remainingBalance: number
    isPayoff: boolean
}

export interface PayoffSimulation {
    strategy: 'avalanche' | 'snowball' | 'hybrid'
    strategyLabel: string
    prioritizedDebts: DebtAccount[]
    totalMonthsToPayoff: number
    totalInterestPaid: number
    totalPaid: number
    interestSavedVsMinimum: number
    monthlyPaymentRequired: number
    steps: StrategyStep[]         // monthly simulation steps
  recommendation: string
}

// ── Avalanche: highest interest first (mathematically optimal) ──
export function avalancheStrategy(debts: DebtAccount[]): DebtAccount[] {
    return [...debts].sort((a, b) => b.tea - a.tea)
}

// ── Snowball: smallest balance first (psychologically motivating) ──
export function snowballStrategy(debts: DebtAccount[]): DebtAccount[] {
    return [...debts].sort((a, b) => a.balance - b.balance)
}

// ── Hybrid: pay off toxic debts (>40% TEA) first, then avalanche ──
export function hybridStrategy(debts: DebtAccount[]): DebtAccount[] {
    const toxic = debts.filter((d) => d.tea >= 40).sort((a, b) => b.tea - a.tea)
    const normal = debts.filter((d) => d.tea < 40).sort((a, b) => b.tea - a.tea)
    return [...toxic, ...normal]
}

// ── Payoff Simulation ─────────────────────────────────────────
export function simulatePayoff(
    debts: DebtAccount[],
    strategy: 'avalanche' | 'snowball' | 'hybrid',
    extraMonthlyPayment: number = 0
  ): PayoffSimulation {
    const strategyFn = strategy === 'avalanche'
      ? avalancheStrategy
          : strategy === 'snowball'
      ? snowballStrategy
          : hybridStrategy

  const strategyLabels = {
        avalanche: 'Avalanche (mayor interés primero)',
        snowball: 'Snowball (menor balance primero)',
        hybrid: 'Híbrido (deudas tóxicas primero)',
  }

  const prioritizedDebts = strategyFn(debts)
    const minimumPayments = debts.reduce((s, d) => s + (d.monthlyPayment ?? 0), 0)
    const totalMonthlyBudget = minimumPayments + extraMonthlyPayment

  // Simulate month by month
  let balances = prioritizedDebts.map((d) => ({ ...d, currentBalance: d.balance }))
    const steps: StrategyStep[] = []
        let totalInterestPaid = 0
    let month = 0
    const MAX_MONTHS = 360 // 30 years safety cap

  while (balances.some((b) => b.currentBalance > 0.01) && month < MAX_MONTHS) {
        month++
        let remainingBudget = totalMonthlyBudget

      for (const debt of balances) {
              if (debt.currentBalance <= 0) continue

          const monthlyRate = Math.pow(1 + debt.tea / 100, 1 / 12) - 1
              const interestCharge = debt.currentBalance * monthlyRate
              const minPayment = debt.monthlyPayment ?? Math.max(interestCharge + 1, debt.currentBalance * 0.02)

          // Pay minimum first
          const actualPayment = Math.min(minPayment, debt.currentBalance + interestCharge)
              const principalPaid = actualPayment - interestCharge
              debt.currentBalance = Math.max(0, debt.currentBalance - principalPaid)
              totalInterestPaid += interestCharge
              remainingBudget -= actualPayment

          const isPayoff = debt.currentBalance < 0.01

                  steps.push({
                            month,
                            debtName: debt.name,
                            payment: actualPayment,
                            interestPaid: interestCharge,
                            principalPaid: Math.max(0, principalPaid),
                            remainingBalance: debt.currentBalance,
                            isPayoff,
                  })

          if (isPayoff) debt.currentBalance = 0
      }

      // Apply extra payment to first non-zero debt (priority order)
      if (remainingBudget > 0) {
              const targetDebt = balances.find((b) => b.currentBalance > 0)
              if (targetDebt) {
                        const extra = Math.min(remainingBudget, targetDebt.currentBalance)
                        targetDebt.currentBalance = Math.max(0, targetDebt.currentBalance - extra)
              }
      }
  }

  const totalPaid = totalInterestPaid + debts.reduce((s, d) => s + d.balance, 0)

  // Estimate interest savings vs minimum-only payments
  const minimumOnlyInterest = debts.reduce((s, d) => {
        // Rough estimate: paying minimum only on high-interest debt can take decades
                                               const monthlyRate = Math.pow(1 + d.tea / 100, 1 / 12) - 1
        const minPayment = d.monthlyPayment ?? d.balance * 0.02
        if (minPayment <= d.balance * monthlyRate) return s + d.balance * 2 // cant payoff
                                               const n = Math.log(minPayment / (minPayment - d.balance * monthlyRate)) / Math.log(1 + monthlyRate)
        const totalPaidMin = minPayment * n
        return s + (totalPaidMin - d.balance)
  }, 0)

  const interestSavedVsMinimum = Math.max(0, minimumOnlyInterest - totalInterestPaid)

  let recommendation = ''
    if (strategy === 'avalanche') {
          recommendation = 'Avalanche maximiza el ahorro en intereses. Requiere disciplina al inicio ya que las deudas más grandes tardan más en eliminarse.'
    } else if (strategy === 'snowball') {
          recommendation = 'Snowball genera victorias rápidas al eliminar deudas pequeñas. Ideal si necesitas motivación, aunque pagas más intereses.'
    } else {
          recommendation = 'Híbrido elimina primero las deudas con tasas >40% TEA (las más destructivas) y luego sigue el orden de mayor a menor tasa.'
    }

  return {
        strategy,
        strategyLabel: strategyLabels[strategy],
        prioritizedDebts,
        totalMonthsToPayoff: month,
        totalInterestPaid: Math.round(totalInterestPaid),
        totalPaid: Math.round(totalPaid),
        interestSavedVsMinimum: Math.round(interestSavedVsMinimum),
        monthlyPaymentRequired: Math.round(totalMonthlyBudget),
        steps: steps.filter((s) => s.isPayoff), // only show payoff milestones
        recommendation,
  }
}

// ── Recommend Best Strategy ────────────────────────────────────
export function recommendStrategy(debts: DebtAccount[]): 'avalanche' | 'snowball' | 'hybrid' {
    const hasToxicDebts = debts.some((d) => d.tea >= 40)
    if (hasToxicDebts) return 'hybrid'

  const smallDebts = debts.filter((d) => d.balance < 2000)
    if (smallDebts.length >= 2) return 'snowball'

  return 'avalanche'
}

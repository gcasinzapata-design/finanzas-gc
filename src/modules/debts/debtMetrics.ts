// ============================================================
// debtMetrics.ts
// Debt Intelligence Engine - Finanzas GC
// Total debt tracking, weighted interest, toxic debt detection,
// monthly interest leakage, and debt trend analysis
// ============================================================

export interface DebtAccount {
    id?: string
    name: string
    institution?: string       // BCP, BBVA, Interbank, etc.
  type?: 'credit_card' | 'personal_loan' | 'mortgage' | 'auto_loan' | 'other'
    balance: number            // current balance (soles)
  tea: number                // annual effective interest rate (TEA, 0-100 %)
  monthlyPayment?: number    // minimum monthly payment
  creditLimit?: number       // for credit cards
  currency?: 'PEN' | 'USD'
}

export interface DebtSnapshot {
    month: string              // YYYY-MM
  totalDebt: number
    weightedInterest: number   // %
}

export interface ToxicDebt {
    account: DebtAccount
    annualInterestCost: number
    monthlyInterestCost: number
    toxicityScore: number      // 0-100, higher = more toxic
  reason: string
}

export interface DebtMetricsResult {
    totalDebt: number
    weightedInterest: number          // % (weighted average TEA)
  monthlyInterestLeakage: number    // soles/month going to interest
  utilizationRate: number           // credit card utilization (0-1)
  debtBurdenRatio: number           // monthly payments / income (0-1)
  toxicDebts: ToxicDebt[]
    debtTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown'
    debtTrendPercent: number          // % change vs previous period
  summary: {
      totalAccounts: number
      creditCards: number
      loans: number
      highestInterestDebt: DebtAccount | null
      largestDebt: DebtAccount | null
  }
}

// ── Weighted Interest ────────────────────────────────────────
export function calculateWeightedInterest(debts: DebtAccount[]): number {
    const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0)
    if (!totalDebt) return 0
    const weightedSum = debts.reduce((sum, d) => sum + d.balance * d.tea, 0)
    return weightedSum / totalDebt
}

// ── Monthly Interest Leakage ─────────────────────────────────
export function calculateMonthlyInterestLeakage(debts: DebtAccount[]): number {
    return debts.reduce((sum, d) => {
          // Convert TEA to monthly rate: (1 + TEA/100)^(1/12) - 1
                            const monthlyRate = Math.pow(1 + d.tea / 100, 1 / 12) - 1
          return sum + d.balance * monthlyRate
    }, 0)
}

// ── Toxic Debt Detection ─────────────────────────────────────
// Toxic = high interest (TEA > 30%) or high utilization credit card
export function detectToxicDebts(debts: DebtAccount[]): ToxicDebt[] {
    return debts
      .filter((d) => d.tea > 25 || (d.type === 'credit_card' && d.creditLimit && d.balance / d.creditLimit > 0.7))
      .map((d) => {
              const monthlyRate = Math.pow(1 + d.tea / 100, 1 / 12) - 1
              const monthlyInterestCost = d.balance * monthlyRate
              const annualInterestCost = d.balance * (d.tea / 100)

                 let toxicityScore = 0
              const reasons: string[] = []

                      if (d.tea >= 60) { toxicityScore += 50; reasons.push('TEA mayor al 60%') }
              else if (d.tea >= 40) { toxicityScore += 35; reasons.push('TEA mayor al 40%') }
              else if (d.tea >= 25) { toxicityScore += 20; reasons.push('TEA mayor al 25%') }

                 if (d.type === 'credit_card' && d.creditLimit) {
                           const utilization = d.balance / d.creditLimit
                           if (utilization > 0.9) { toxicityScore += 30; reasons.push('Utilización >90%') }
                           else if (utilization > 0.7) { toxicityScore += 15; reasons.push('Utilización >70%') }
                 }

                 return {
                           account: d,
                           annualInterestCost,
                           monthlyInterestCost,
                           toxicityScore: Math.min(100, toxicityScore),
                           reason: reasons.join(', '),
                 }
      })
      .sort((a, b) => b.toxicityScore - a.toxicityScore)
}

// ── Credit Card Utilization ──────────────────────────────────
export function calculateUtilizationRate(debts: DebtAccount[]): number {
    const cards = debts.filter((d) => d.type === 'credit_card' && d.creditLimit && d.creditLimit > 0)
    if (!cards.length) return 0
    const totalBalance = cards.reduce((s, d) => s + d.balance, 0)
    const totalLimit = cards.reduce((s, d) => s + (d.creditLimit ?? 0), 0)
    return totalLimit > 0 ? totalBalance / totalLimit : 0
}

// ── Debt Trend Analysis ──────────────────────────────────────
export function analyzeDebtTrend(
    snapshots: DebtSnapshot[]
  ): { trend: DebtMetricsResult['debtTrend']; trendPercent: number } {
    if (snapshots.length < 2) return { trend: 'unknown', trendPercent: 0 }

  const sorted = [...snapshots].sort((a, b) => a.month.localeCompare(b.month))
    const latest = sorted[sorted.length - 1].totalDebt
    const previous = sorted[sorted.length - 2].totalDebt

  if (!previous) return { trend: 'unknown', trendPercent: 0 }

  const changePercent = ((latest - previous) / previous) * 100

  let trend: DebtMetricsResult['debtTrend'] = 'stable'
    if (changePercent > 3) trend = 'increasing'
    else if (changePercent < -3) trend = 'decreasing'

  return { trend, trendPercent: changePercent }
}

// ── Master Debt Metrics ──────────────────────────────────────
export function calculateDebtMetrics(
    debts: DebtAccount[],
    monthlyIncome?: number,
    snapshots?: DebtSnapshot[]
  ): DebtMetricsResult {
    const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
    const weightedInterest = calculateWeightedInterest(debts)
    const monthlyInterestLeakage = calculateMonthlyInterestLeakage(debts)
    const utilizationRate = calculateUtilizationRate(debts)
    const toxicDebts = detectToxicDebts(debts)

  const totalMonthlyPayments = debts.reduce((s, d) => s + (d.monthlyPayment ?? 0), 0)
    const debtBurdenRatio = monthlyIncome && monthlyIncome > 0
      ? totalMonthlyPayments / monthlyIncome
          : 0

  const { trend, trendPercent } = snapshots?.length
      ? analyzeDebtTrend(snapshots)
        : { trend: 'unknown' as const, trendPercent: 0 }

  const creditCards = debts.filter((d) => d.type === 'credit_card')
    const loans = debts.filter((d) => d.type !== 'credit_card')
    const highestInterestDebt = debts.length
      ? [...debts].sort((a, b) => b.tea - a.tea)[0]
          : null
    const largestDebt = debts.length
      ? [...debts].sort((a, b) => b.balance - a.balance)[0]
          : null

  return {
        totalDebt,
        weightedInterest,
        monthlyInterestLeakage,
        utilizationRate,
        debtBurdenRatio,
        toxicDebts,
        debtTrend: trend,
        debtTrendPercent: trendPercent,
        summary: {
                totalAccounts: debts.length,
                creditCards: creditCards.length,
                loans: loans.length,
                highestInterestDebt,
                largestDebt,
        },
  }
}

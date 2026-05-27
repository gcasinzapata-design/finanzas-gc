import { calculateSavingsRate } from '../analytics/cashflowAnalytics'
import { calculateNetWorth } from '../analytics/netWorth'
import { calculateWeightedInterest } from '../debts/debtMetrics'
import { runwayAnalysis } from '../forecasting/runwayAnalysis'
import { financialHealth } from '../analytics/financialHealth'

export interface DashboardInput {
  income: number
  expenses: number
  assets: number
  liabilities: number
  availableCash: number
  debts: {
    name: string
    balance: number
    tea: number
  }[]
}

export function buildDashboardMetrics(
  input: DashboardInput
) {
  const savingsRate = calculateSavingsRate(
    input.income,
    input.expenses
  )

  const netWorth = calculateNetWorth({
    assets: input.assets,
    liabilities: input.liabilities
  })

  const weightedInterest =
    calculateWeightedInterest(input.debts)

  const runway = runwayAnalysis({
    availableCash: input.availableCash,
    monthlyExpenses: input.expenses
  })

  const health = financialHealth({
    savingsRate,
    debtRatio:
      input.liabilities /
      Math.max(input.assets, 1),
    runwayMonths: runway.runwayMonths
  })

  return {
    savingsRate,
    netWorth,
    weightedInterest,
    runway,
    health
  }
}

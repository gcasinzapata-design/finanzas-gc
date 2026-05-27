export interface ForecastInput {
  currentBalance: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlyDebtPayments: number
}

export interface ForecastResult {
  projected30Days: number
  projected60Days: number
  projected90Days: number
  monthlyNetFlow: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export function generateForecast({
  currentBalance,
  monthlyIncome,
  monthlyExpenses,
  monthlyDebtPayments
}: ForecastInput): ForecastResult {
  const monthlyNetFlow =
    monthlyIncome -
    monthlyExpenses -
    monthlyDebtPayments

  const projected30Days =
    currentBalance + monthlyNetFlow

  const projected60Days =
    currentBalance + monthlyNetFlow * 2

  const projected90Days =
    currentBalance + monthlyNetFlow * 3

  let riskLevel: ForecastResult['riskLevel'] = 'LOW'

  if (projected90Days < 1000) {
    riskLevel = 'MEDIUM'
  }

  if (projected90Days < 0) {
    riskLevel = 'HIGH'
  }

  return {
    projected30Days,
    projected60Days,
    projected90Days,
    monthlyNetFlow,
    riskLevel
  }
}

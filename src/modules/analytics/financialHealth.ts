export interface FinancialHealthInput {
  savingsRate: number
  debtRatio: number
  runwayMonths: number
}

export interface FinancialHealthResult {
  score: number
  status: string
}

export function financialHealth(
  input: FinancialHealthInput
): FinancialHealthResult {
  let score = 100

  score -= input.debtRatio * 0.5

  if (input.savingsRate < 10) {
    score -= 20
  }

  if (input.runwayMonths < 6) {
    score -= 20
  }

  if (score < 0) {
    score = 0
  }

  let status = 'healthy'

  if (score < 70) {
    status = 'warning'
  }

  if (score < 50) {
    status = 'critical'
  }

  return {
    score,
    status
  }
}

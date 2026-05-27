export interface RunwayInput {
  availableCash: number
  monthlyExpenses: number
}

export interface RunwayResult {
  runwayMonths: number
  status: string
}

export function runwayAnalysis(
  input: RunwayInput
): RunwayResult {
  if (!input.monthlyExpenses) {
    return {
      runwayMonths: 999,
      status: 'stable'
    }
  }

  const runwayMonths =
    input.availableCash /
    input.monthlyExpenses

  let status = 'healthy'

  if (runwayMonths < 6) {
    status = 'warning'
  }

  if (runwayMonths < 3) {
    status = 'critical'
  }

  return {
    runwayMonths,
    status
  }
}

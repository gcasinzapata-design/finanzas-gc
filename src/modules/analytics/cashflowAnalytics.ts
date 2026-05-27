export function calculateSavingsRate(
  income: number,
  expenses: number
) {
  if (!income) return 0

  return ((income - expenses) / income) * 100
}

export function calculateBurnRate(
  monthlyExpenses: number,
  currentCash: number
) {
  if (!monthlyExpenses) return 0

  return currentCash / monthlyExpenses
}

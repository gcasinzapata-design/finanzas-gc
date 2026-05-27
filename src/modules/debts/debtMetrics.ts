export interface DebtAccount {
  name: string
  balance: number
  tea: number
}

export function calculateWeightedInterest(
  debts: DebtAccount[]
) {
  const totalDebt = debts.reduce(
    (sum, debt) => sum + debt.balance,
    0
  )

  if (!totalDebt) return 0

  const weightedInterest = debts.reduce(
    (sum, debt) => {
      return sum + debt.balance * debt.tea
    },
    0
  )

  return weightedInterest / totalDebt
}

export function calculateMonthlyInterestLeakage(
  debts: DebtAccount[]
) {
  return debts.reduce((sum, debt) => {
    return (
      sum +
      (debt.balance * debt.tea) / 12 / 100
    )
  }, 0)
}

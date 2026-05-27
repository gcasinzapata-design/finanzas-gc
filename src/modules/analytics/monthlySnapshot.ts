export interface MonthlySnapshot {
  month: number
  year: number

  income: number
  expenses: number

  debtPayments: number

  savingsRate: number

  endingBalance: number
}

export function calculateNetCashflow(
  snapshot: MonthlySnapshot
) {
  return (
    snapshot.income -
    snapshot.expenses -
    snapshot.debtPayments
  )
}

export interface DebtStrategyAccount {
  name: string
  balance: number
  tea: number
}

export function avalancheStrategy(
  debts: DebtStrategyAccount[]
) {
  return [...debts].sort(
    (a, b) => b.tea - a.tea
  )
}

export function snowballStrategy(
  debts: DebtStrategyAccount[]
) {
  return [...debts].sort(
    (a, b) => a.balance - b.balance
  )
}

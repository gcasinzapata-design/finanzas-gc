export interface HistoricalSnapshot {
  month: number
  year: number
  income: number
  expenses: number
  debt: number
  netWorth: number
  savingsRate: number
}

export function buildHistoricalTrend(
  snapshots: HistoricalSnapshot[]
) {
  return snapshots
    .sort((a, b) => {
      const left = a.year * 100 + a.month
      const right = b.year * 100 + b.month

      return left - right
    })
    .map(snapshot => ({
      label: `${snapshot.month}/${snapshot.year}`,
      income: snapshot.income,
      expenses: snapshot.expenses,
      debt: snapshot.debt,
      netWorth: snapshot.netWorth,
      savingsRate: snapshot.savingsRate
    }))
}

interface Props {
  totalDebt: number
  weightedInterest: number
  monthlyLeakage: number
}

export default function DebtCenterCard({
  totalDebt,
  weightedInterest,
  monthlyLeakage
}: Props) {
  return (
    <div className='rounded-3xl border p-6'>
      <h2 className='text-2xl font-semibold'>Debt Center</h2>

      <div className='mt-6 space-y-4'>
        <div>
          <p>Total Debt</p>
          <p className='text-4xl font-bold'>
            {totalDebt.toLocaleString()}
          </p>
        </div>

        <div>
          <p>Weighted Interest</p>
          <p className='text-xl font-semibold'>
            {weightedInterest.toFixed(2)}%
          </p>
        </div>

        <div>
          <p>Monthly Leakage</p>
          <p className='text-xl font-semibold'>
            {monthlyLeakage.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  )
}

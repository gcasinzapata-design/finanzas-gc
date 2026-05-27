'use client'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

interface Props {
  data: any[]
}

export default function HistoricalCashflowChart({
  data
}: Props) {
  return (
    <div className='h-[420px] w-full rounded-3xl border p-4'>
      <ResponsiveContainer width='100%' height='100%'>
        <AreaChart data={data}>
          <XAxis dataKey='month' />

          <YAxis />

          <Tooltip />

          <Area
            type='monotone'
            dataKey='income'
          />

          <Area
            type='monotone'
            dataKey='expenses'
          />

          <Area
            type='monotone'
            dataKey='netCashflow'
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

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

export default function NetWorthTrendChart({
  data
}: Props) {
  return (
    <div className='rounded-3xl border p-4 h-[420px]'>
      <ResponsiveContainer width='100%' height='100%'>
        <AreaChart data={data}>
          <XAxis dataKey='label' />
          <YAxis />
          <Tooltip />

          <Area
            type='monotone'
            dataKey='netWorth'
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

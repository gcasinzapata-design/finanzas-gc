'use client'
import { useEffect, useState, useMemo } from 'react'
import { TrendingDown, Calendar, AlertCircle, CheckCircle2, Clock, CreditCard, Building2, RefreshCw } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts'

function fmtS(n: number) { return `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:2}).format(n||0)}` }
function fmtN(n: number, dec=0) { return new Intl.NumberFormat('es-PE',{minimumFractionDigits:dec,maximumFractionDigits:dec}).format(n||0) }

const BANK_COLORS: Record<string, string> = {
  'BCP': '#0062e0', 'Interbank': '#e63329', 'BBVA': '#004999', 'Scotiabank': '#d4181e'
}
const CARD_COLORS: Record<string, string> = {
  'BCP': '#1e40af', 'Interbank': '#dc2626', 'BBVA': '#d97706'
}

function PayoffGauge({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0
  const r = 40, cx = 50, cy = 50
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={pct > 80 ? '#22c55e' : pct > 50 ? '#3b82f6' : '#f97316'} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}/>
      <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="bold" fill="currentColor">{pct.toFixed(0)}%</text>
    </svg>
  )
}

export default function PrestamosPage() {
  const [debts, setDebts] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])
  async function loadData() {
    setLoading(true)
    const [dR, cR] = await Promise.all([
      fetch('/api/debts').then(r => r.json()),
      fetch('/api/cards').then(r => r.json()),
    ])
    setDebts(dR.debts || [])
    setCards(cR.cards || [])
    setLoading(false)
  }

  const activeDebts = debts.filter(d => Number(d.current_balance) > 0)
  // Exclude IBK Visa Access — it's a compra de deuda, shown in loans section
  const activeCards = cards.filter(c => Number(c.current_balance) > 0 && !(c.bank === 'Interbank' && (c.name||'').toLowerCase().includes('access')))

  const totalDebtPrest = activeDebts.reduce((s, d) => s + Number(d.current_balance), 0)
  const totalDebtCards = activeCards.reduce((s, c) => s + Number(c.current_balance), 0)
  const totalDebt = totalDebtPrest + totalDebtCards
  const totalMonthly = activeDebts.reduce((s, d) => s + Number(d.monthly_payment || 0), 0)
    + activeCards.reduce((s, c) => s + Number(c.minimum_payment || 0), 0)

  // Proyección de pago (avalancha — mayor tasa primero)
  const allDebtsSorted = [...activeCards.map(c => ({
    name: `${c.bank} ${c.name}`, balance: Number(c.current_balance),
    rate: Number(c.tcea || c.tea || 0), monthly: Number(c.minimum_payment || 0), type: 'TC', color: CARD_COLORS[c.bank] || '#6b7280'
  })), ...activeDebts.map(d => ({
    name: d.name, balance: Number(d.current_balance),
    rate: Number(d.tea || 0), monthly: Number(d.monthly_payment || 0), type: 'Prest', color: BANK_COLORS[d.institution] || '#6b7280',
    remaining: d.remaining_installments
  }))].sort((a, b) => b.rate - a.rate)

  // Interés mensual estimado por deuda
  const monthlyInterest = allDebtsSorted.map(d => ({
    name: d.name.replace('Préstamo ', '').replace('IBK Visa Access — ', 'IBK '),
    interes: Math.round(d.balance * (d.rate / 100) / 12),
    cuota: Math.round(d.monthly),
    color: d.color
  }))

  // Evolución de deuda (simulación próximos 12 meses)
  const debtProjection = useMemo(() => {
    let bal = totalDebt
    return Array.from({ length: 13 }, (_, i) => {
      const point = { mes: i === 0 ? 'Hoy' : `+${i}m`, deuda: Math.round(bal) }
      if (i > 0) bal = Math.max(0, bal - totalMonthly * 0.6) // approx (abono neto de capital)
      return point
    })
  }, [totalDebt, totalMonthly])

  // Distribución de deuda por banco
  const byBank: Record<string, number> = {}
  allDebtsSorted.forEach(d => {
    const bank = d.type === 'TC' ? d.name.split(' ')[0] : d.name.includes('BCP') ? 'BCP' : d.name.includes('IBK') || d.name.includes('Interbank') ? 'Interbank' : 'Otro'
    byBank[bank] = (byBank[bank] || 0) + d.balance
  })
  const bankPie = Object.entries(byBank).map(([name, value]) => ({ name, value: Math.round(value) }))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="animate-spin text-blue-500" size={32}/>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 size={24} className="text-blue-600"/> Préstamos & Tarjetas
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitoreo completo de deudas — datos EECC</p>
        </div>
        <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <RefreshCw size={16} className="text-gray-500"/>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Deuda Total', value: fmtS(totalDebt), icon: '💰', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Tarjetas', value: fmtS(totalDebtCards), icon: '💳', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Préstamos', value: fmtS(totalDebtPrest), icon: '🏦', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Pago Mensual', value: fmtS(totalMonthly), icon: '📅', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        ].map((kpi, i) => (
          <div key={i} className={`${kpi.bg} rounded-2xl p-4`}>
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Proyección de deuda */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">📉 Proyección Deuda Total (12 meses)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={debtProjection}>
              <XAxis dataKey="mes" tick={{ fontSize: 10 }}/>
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={(v: any) => [fmtS(v), 'Deuda']}/>
              <Area type="monotone" dataKey="deuda" stroke="#ef4444" fill="#fef2f2" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Interés mensual por deuda */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🔥 Interés Mensual Estimado</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyInterest} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${fmtN(v)}`}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90}/>
              <Tooltip formatter={(v: any) => [fmtS(v)]}/>
              <Bar dataKey="interes" name="Interés" radius={[0, 4, 4, 0]}>
                {monthlyInterest.map((entry, i) => (
                  <Cell key={i} fill={entry.color}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Préstamos */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Building2 size={16} className="text-blue-600"/>
          <h2 className="font-semibold text-gray-900 dark:text-white">Préstamos Activos</h2>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {activeDebts.map((d, i) => {
            const paid = Number(d.original_amount || 0) - Number(d.current_balance)
            const paidPct = d.original_amount > 0 ? (paid / Number(d.original_amount)) * 100 : 0
            const monthlyInterest = Number(d.current_balance) * (Number(d.tea || 0) / 100) / 12
            const termMonths = d.remaining_installments || 0
            return (
              <div key={d.id} className="p-4 flex flex-wrap items-start gap-4">
                <div className="flex-shrink-0">
                  <PayoffGauge paid={paid} total={Number(d.original_amount || d.current_balance)}/>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{d.name}</h3>
                      <p className="text-xs text-gray-500">{d.institution} · TEA {d.tea || '?'}%</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-red-600">{fmtS(Number(d.current_balance))}</p>
                      <p className="text-xs text-gray-500">Saldo capital</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">Cuota/mes</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtS(Number(d.monthly_payment || 0))}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">Cuotas rest.</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{d.remaining_installments || '?'}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                      <p className="text-xs text-orange-600">Interés/mes</p>
                      <p className="text-sm font-semibold text-orange-700">{fmtS(monthlyInterest)}</p>
                    </div>
                  </div>
                  {d.notes && (
                    <p className="text-xs text-gray-400 italic truncate">{d.notes}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar size={11} className="text-gray-400"/>
                    <span className="text-gray-500">Próx. pago: {d.next_payment_date || '?'}</span>
                    {termMonths <= 3 && termMonths > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">¡Casi listo!</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tarjetas */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <CreditCard size={16} className="text-purple-600"/>
          <h2 className="font-semibold text-gray-900 dark:text-white">Tarjetas de Crédito</h2>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {activeCards.map((c, i) => {
            const used = Number(c.current_balance)
            const limit = Number(c.credit_limit) || 0
            const usePct = limit > 0 ? (used / limit) * 100 : 0
            const available = Number(c.available_credit) || Math.max(0, limit - used)
            const monthInt = used * (Number(c.tcea || c.tea || 0) / 100) / 12
            const isBBVA = c.bank === 'BBVA'
            return (
              <div key={c.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{c.bank} {c.name} ***{c.last_four}</h3>
                      {isBBVA && !c.current_balance && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">Pendiente EECC</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">TCEA {c.tcea || c.tea || '?'}% · Corte día {c.cut_date || '?'} · Vence día {c.payment_due_date || '?'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">{isBBVA && !c.current_balance ? 'N/A' : fmtS(used)}</p>
                    <p className="text-xs text-gray-500">de {fmtS(limit)} límite</p>
                  </div>
                </div>
                {!isBBVA && (
                  <>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Utilización: {usePct.toFixed(0)}%</span>
                        <span className={usePct > 80 ? 'text-red-500 font-medium' : usePct > 50 ? 'text-orange-500' : 'text-green-500'}>
                          {usePct > 80 ? '⚠️ Alto' : usePct > 50 ? '⚡ Medio' : '✅ Bajo'}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${usePct > 80 ? 'bg-red-500' : usePct > 50 ? 'bg-orange-400' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(usePct, 100)}%` }}/>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Pago mín</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtS(Number(c.minimum_payment || 0))}</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                        <p className="text-xs text-green-600">Disponible</p>
                        <p className="text-sm font-semibold text-green-700">{fmtS(available)}</p>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                        <p className="text-xs text-orange-600">Interés/mes</p>
                        <p className="text-sm font-semibold text-orange-700">{monthInt > 0 ? fmtS(monthInt) : 'N/A'}</p>
                      </div>
                    </div>
                  </>
                )}
                {isBBVA && !c.current_balance && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-sm text-yellow-700">
                    <AlertCircle size={14}/>
                    <span>Sube el EECC de BBVA para ver el saldo y movimientos de la Mastercard Black</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Estrategia avalancha */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-800">
        <h2 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
          🎯 Estrategia Avalancha Recomendada
        </h2>
        <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
          Paga mínimos en todas las deudas. El excedente va primero a la deuda con mayor tasa:
        </p>
        <div className="space-y-2">
          {allDebtsSorted.filter(d => d.rate > 0).map((d, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-blue-400'}`}>{i+1}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[160px]">{d.name}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{d.rate}% TCEA</span>
                <span className="text-xs text-gray-500">{fmtS(d.balance)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

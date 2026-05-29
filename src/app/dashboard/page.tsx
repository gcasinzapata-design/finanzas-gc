// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, ArrowRight, RefreshCw, AlertTriangle, Repeat } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts'

const S = (n: number) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0)}`
const S2 = (n: number) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n || 0)}`

const CAT_CLR: Record<string, string> = {
  Seguros:'#f97316',Deudas:'#ef4444',Delivery:'#fb923c',Restaurantes:'#f59e0b',
  Transporte:'#3b82f6',Supermercados:'#84cc16',Entretenimiento:'#8b5cf6',
  Servicios:'#eab308',Alquiler:'#0ea5e9',Suscripciones:'#ec4899',
  Mascotas:'#14b8a6',Viajes:'#a78bfa',Sueldo:'#22c55e',Tecnología:'#06b6d4',
  Compras:'#f43f5e',Otros:'#64748b',Transferencias:'#94a3b8',
}

const MONTH_NAMES: Record<string,string> = { '2026-02':'Feb', '2026-03':'Mar', '2026-04':'Abr' }

function Chip({ pct }: { pct: number }) {
  const cls = pct > 0 ? 'trend-down' : pct < 0 ? 'trend-up' : 'trend-neu'
  const icon = pct > 0 ? '↑' : pct < 0 ? '↓' : '→'
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {icon} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function KPICard({ label, value, prev, sub, color = '#3b82f6' }: any) {
  const pct = prev > 0 ? ((value - prev) / prev) * 100 : 0
  return (
    <div className="card p-4 animate-fade">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</span>
        {prev > 0 && <Chip pct={pct}/>}
      </div>
      <p className="text-2xl font-bold num" style={{ color }}>{S(value)}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [cards, setCards] = useState<any[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('2026-04')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [aR, cR, dR] = await Promise.all([
        fetch('/api/analytics').then(r => r.json()),
        fetch('/api/cards').then(r => r.json()),
        fetch('/api/debts').then(r => r.json()),
      ])
      setData(aR)
      setCards(cR.cards || [])
      setDebts(dR.debts || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const snap = useMemo(() => data?.snapshots || [], [data])
  const curr = snap[snap.length - 1] || {}
  const prev = snap[snap.length - 2] || {}
  const prevPrev = snap[snap.length - 3] || {}

  const totalDebt = [...(cards || []), ...(debts || [])].reduce((s, d) => s + Number(d.current_balance || 0), 0)
  const monthlyCommit = [...(cards || [])].reduce((s, c) => s + Number(c.minimum_payment || 0), 0)
    + [...(debts || [])].reduce((s, d) => s + Number(d.monthly_payment || 0), 0)

  const balance = curr.totalIngresos - curr.totalGastos
  const prevBalance = prev.totalIngresos - prev.totalGastos

  // Chart data
  const cashflowData = snap.map((s: any) => ({
    month: MONTH_NAMES[s.month],
    Ingresos: s.totalIngresos,
    Gastos: s.totalGastos,
    Fijos: s.fijos,
  }))

  // Top 6 categories current month
  const topCats = useMemo(() => {
    if (!curr.byCat) return []
    return Object.entries(curr.byCat as Record<string,number>)
      .sort(([,a],[,b]) => (b as number)-(a as number))
      .slice(0, 6)
      .map(([cat, amt]) => {
        const prevAmt = (prev.byCat?.[cat] as number) || 0
        const delta = prevAmt > 0 ? ((amt as number - prevAmt) / prevAmt) * 100 : 0
        return { cat, amt: amt as number, prevAmt, delta }
      })
  }, [curr, prev])

  // Recent transactions
  const recent = useMemo(() => (data?.transactions || []).slice(0, 8), [data])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Cargando datos...</p>
      </div>
    </div>
  )

  return (
    <div className="p-5 space-y-5 max-w-7xl mx-auto" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Datos EECC · Feb–Abr 2026 · {data?.transactions?.length || 0} movimientos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="p-2 rounded-lg transition-colors" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <RefreshCw size={14} style={{ color: 'var(--text-3)' }}/>
          </button>
          <Link href="/dashboard/chat"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
            ✦ Copiloto IA
          </Link>
        </div>
      </div>

      {/* Balance Hero */}
      <div className="card p-5 relative overflow-hidden" style={{ borderColor: balance >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
        <div className="absolute inset-0 opacity-5" style={{ background: balance >= 0 ? 'radial-gradient(circle at 80% 50%,#10b981,transparent)' : 'radial-gradient(circle at 80% 50%,#ef4444,transparent)' }}/>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Balance Neto — Abr 2026</p>
            <p className={`text-4xl font-bold num ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{S2(balance)}</p>
            <div className="flex items-center gap-3 mt-2 text-sm" style={{ color: 'var(--text-2)' }}>
              <span className="flex items-center gap-1"><TrendingUp size={13} className="text-green-400"/> {S(curr.totalIngresos)}</span>
              <span className="text-gray-600">−</span>
              <span className="flex items-center gap-1"><TrendingDown size={13} className="text-red-400"/> {S(curr.totalGastos)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {prevBalance !== 0 && <Chip pct={prevBalance !== 0 ? ((balance - prevBalance) / Math.abs(prevBalance)) * 100 : 0}/>}
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>vs Mar {S(prevBalance)}</span>
          </div>
        </div>
        {/* Alert crítico */}
        {curr.totalIngresos > 0 && curr.totalGastos / curr.totalIngresos > 0.9 && (
          <div className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
            <AlertTriangle size={12}/>
            Gastos representan el {((curr.totalGastos / curr.totalIngresos) * 100).toFixed(0)}% del sueldo — situación crítica
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Ingresos" value={curr.totalIngresos} prev={prev.totalIngresos} sub="Sueldo neto" color="#10b981"/>
        <KPICard label="Gastos" value={curr.totalGastos} prev={prev.totalGastos} sub={`${((curr.totalGastos/curr.totalIngresos||0)*100).toFixed(0)}% del ingreso`} color="#ef4444"/>
        <KPICard label="Gastos Fijos" value={curr.fijos} prev={prev.fijos} sub={`${((curr.fijos/curr.totalGastos||0)*100).toFixed(0)}% del total`} color="#f97316"/>
        <KPICard label="Deuda Total" value={totalDebt} sub={`Cuota: ${S(monthlyCommit)}/mes`} color="#8b5cf6"/>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Cashflow Bar */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Cashflow Feb–Abr</h2>
            <Link href="/dashboard/analisis" className="text-xs flex items-center gap-1" style={{ color: 'var(--blue)' }}>
              Ver análisis <ArrowRight size={11}/>
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={cashflowData} barGap={2}>
              <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
              <Tooltip
                contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [S(v)]}/>
              <Bar dataKey="Ingresos" fill="#10b981" radius={[4,4,0,0]}/>
              <Bar dataKey="Gastos" fill="#ef4444" radius={[4,4,0,0]}/>
              <Bar dataKey="Fijos" fill="#f97316" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            {[['Ingresos','#10b981'],['Gastos','#ef4444'],['Fijos','#f97316']].map(([l,c]) => (
              <div key={l} className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                <div className="w-2 h-2 rounded-sm" style={{ background: c }}/>
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Top Categories */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Categorías — Abr</h2>
            <Link href="/dashboard/categorias" className="text-xs flex items-center gap-1" style={{ color: 'var(--blue)' }}>
              Ver todas <ArrowRight size={11}/>
            </Link>
          </div>
          <div className="space-y-2">
            {topCats.map(({ cat, amt, delta }) => (
              <div key={cat} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_CLR[cat] || '#64748b' }}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>{cat}</span>
                    <div className="flex items-center gap-1.5">
                      {delta !== 0 && <Chip pct={delta}/>}
                      <span className="text-xs font-semibold text-white num">{S(amt)}</span>
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min((amt / curr.totalGastos) * 100, 100)}%`, background: CAT_CLR[cat] || '#64748b' }}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold text-white">Últimos movimientos</h2>
          <Link href="/dashboard/transactions" className="text-xs flex items-center gap-1" style={{ color: 'var(--blue)' }}>
            Ver todos <ArrowRight size={11}/>
          </Link>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {recent.map((t: any, i: number) => (
            <Link key={t.id || i} href={`/dashboard/transactions?id=${t.id}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02] group">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                style={{ background: (CAT_CLR[t.category] || '#64748b') + '22' }}>
                {t.category === 'Sueldo' ? '💰' : t.category === 'Delivery' ? '🛵' : t.category === 'Transporte' ? '🚗'
                  : t.category === 'Restaurantes' ? '🍽️' : t.category === 'Seguros' ? '🔒' : t.category === 'Supermercados' ? '🛒'
                  : t.category === 'Entretenimiento' ? '🎬' : t.category === 'Deudas' ? '🏦' : '📋'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
                  {t.merchant || t.description?.slice(0, 28) || '—'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: (CAT_CLR[t.category] || '#64748b') + '22', color: CAT_CLR[t.category] || '#94a3b8', fontSize: '10px' }}>
                    {t.category}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{t.date?.slice(0, 10)}</span>
                  {t.is_recurring && <Repeat size={10} style={{ color: '#f97316' }}/>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold num ${t.type === 'ingreso' ? 'text-green-400' : t.type === 'transferencia' ? 'text-blue-400' : 'text-white'}`}>
                  {t.type === 'ingreso' ? '+' : t.type === 'gasto' ? '-' : '↔'}{S2(Number(t.amount_pen||t.amount))}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}

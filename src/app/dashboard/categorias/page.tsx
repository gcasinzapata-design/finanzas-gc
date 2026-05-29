// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const S = (n: number) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0 }).format(n || 0)}`
const CAT_CLR: Record<string, string> = {
  Seguros:'#f97316',Deudas:'#ef4444',Delivery:'#fb923c',Restaurantes:'#f59e0b',
  Transporte:'#3b82f6',Supermercados:'#84cc16',Entretenimiento:'#8b5cf6',
  Servicios:'#eab308',Alquiler:'#0ea5e9',Suscripciones:'#ec4899',
  Mascotas:'#14b8a6',Viajes:'#a78bfa',Sueldo:'#22c55e',Tecnología:'#06b6d4',
  Compras:'#f43f5e',Otros:'#64748b',Transferencias:'#94a3b8',
}
const TX_ICONS: Record<string, string> = {
  Sueldo:'💰',Delivery:'🛵',Transporte:'🚗',Restaurantes:'🍽️',Seguros:'🔒',
  Supermercados:'🛒',Entretenimiento:'🎬',Deudas:'🏦',Mascotas:'🐾',
  Viajes:'✈️',Servicios:'⚡',Suscripciones:'📱',Alquiler:'🏠',Tecnología:'💻',
  Compras:'🛍️',Transferencias:'↔️',Otros:'📋',
}
const MONTH_LABELS: Record<string,string> = { '2026-02':'Feb', '2026-03':'Mar', '2026-04':'Abr' }

function Sparkline({ data, color }: { data: number[], color: string }) {
  const max = Math.max(...data, 1)
  const w = 60, h = 24
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={(1 / (data.length - 1)) * w * (data.length - 1)} cy={h - (data[data.length - 1] / max) * h} r={2} fill={color}/>
    </svg>
  )
}

export default function CategoriasPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [selTxs, setSelTxs] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/analytics').then(r => r.json()).then(d => { setAnalytics(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const catTrend = useMemo(() => analytics?.categoryTrend?.filter((c: any) => c.last > 0) || [], [analytics])
  const totalGastos = useMemo(() => catTrend.reduce((s: number, c: any) => s + c.last, 0), [catTrend])

  function openCategory(cat: string) {
    setSelected(cat)
    const txs = (analytics?.transactions || [])
      .filter((t: any) => (t.category || 'Otros') === cat && t.type === 'gasto' && t.date?.startsWith('2026-04'))
      .sort((a: any, b: any) => Number(b.amount) - Number(a.amount))
    setSelTxs(txs)
  }

  // Heatmap data
  const heatmapCats = useMemo(() => {
    return catTrend.slice(0, 12).map((c: any) => ({
      cat: c.category,
      feb: c.monthly[0]?.total || 0,
      mar: c.monthly[1]?.total || 0,
      abr: c.monthly[2]?.total || 0,
    }))
  }, [catTrend])

  // Comparison chart
  const compData = useMemo(() => {
    return catTrend.slice(0, 8).map((c: any) => ({
      name: c.category.slice(0, 8),
      Mar: c.prev,
      Abr: c.last,
    }))
  }, [catTrend])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-5 space-y-5 max-w-6xl mx-auto" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div>
        <h1 className="text-xl font-bold text-white">Categorías</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Análisis mes a mes · Gastos solamente</p>
      </div>

      {/* MoM Comparison Chart */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Comparativo Mar vs Abr — Top 8</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={compData} barGap={2}>
            <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
            <Tooltip contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [S(v)]}/>
            <Bar dataKey="Mar" fill="#3b82f6" opacity={0.6} radius={[3,3,0,0]} name="Mar"/>
            <Bar dataKey="Abr" fill="#3b82f6" radius={[3,3,0,0]} name="Abr"/>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 justify-center">
          {[['Mar 2026','rgba(59,130,246,0.6)'],['Abr 2026','#3b82f6']].map(([l,c]) => (
            <div key={l} className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
              <div className="w-2 h-2 rounded-sm" style={{ background: c as string }}/>
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold text-white">Mapa de Calor — Feb/Mar/Abr</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-2.5" style={{ color: 'var(--text-3)', fontWeight: 500 }}>Categoría</th>
                {['2026-02','2026-03','2026-04'].map(m => (
                  <th key={m} className="text-right px-4 py-2.5" style={{ color: 'var(--text-3)', fontWeight: 500 }}>{MONTH_LABELS[m]}</th>
                ))}
                <th className="text-right px-4 py-2.5" style={{ color: 'var(--text-3)', fontWeight: 500 }}>Tendencia</th>
                <th className="text-right px-4 py-2.5" style={{ color: 'var(--text-3)', fontWeight: 500 }}>MoM</th>
              </tr>
            </thead>
            <tbody>
              {catTrend.map((c: any) => {
                const maxVal = Math.max(c.feb || c.monthly[0]?.total, c.mar || c.monthly[1]?.total, c.last, 1)
                const getHeat = (v: number) => Math.max(0.05, Math.min(0.8, v / maxVal))
                return (
                  <tr key={c.category}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onClick={() => openCategory(c.category)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 14 }}>{TX_ICONS[c.category] || '📋'}</span>
                        <span style={{ color: 'var(--text-1)' }}>{c.category}</span>
                      </div>
                    </td>
                    {c.monthly.map((m: any, i: number) => (
                      <td key={i} className="text-right px-4 py-2.5 num" style={{ color: 'var(--text-1)' }}>
                        <span className="inline-block px-2 py-0.5 rounded"
                          style={{ background: m.total > 0 ? (CAT_CLR[c.category] || '#3b82f6') + Math.round(getHeat(m.total) * 255).toString(16).padStart(2,'0') : 'transparent' }}>
                          {m.total > 0 ? S(m.total) : '—'}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right">
                      <Sparkline data={c.monthly.map((m: any) => m.total)} color={CAT_CLR[c.category] || '#3b82f6'}/>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {c.delta > 5 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-400">
                          <TrendingUp size={11}/> +{c.delta}%
                        </span>
                      ) : c.delta < -5 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-400">
                          <TrendingDown size={11}/> {c.delta}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: 'var(--text-3)' }}>
                          <Minus size={11}/> 0%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden animate-fade" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{TX_ICONS[selected] || '📋'}</span>
                <div>
                  <h3 className="font-semibold text-white">{selected}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{selTxs.length} transacciones en Abr · {S(selTxs.reduce((s,t)=>s+Number(t.amount),0))}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-white/5">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto divide-y" style={{ borderColor: 'var(--border)', maxHeight: '60vh' }}>
              {selTxs.map((t, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-1)' }}>{t.merchant || t.description?.slice(0, 30)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{t.date?.slice(0, 10)} · {t.bank}</p>
                  </div>
                  <p className="text-sm font-semibold num text-white">-{S(Number(t.amount))}</p>
                </div>
              ))}
              {selTxs.length === 0 && (
                <div className="px-5 py-8 text-center" style={{ color: 'var(--text-3)' }}>Sin transacciones en Abr</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

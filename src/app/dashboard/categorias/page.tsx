// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, ChevronRight, X, Check, ChevronDown, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0 }).format(n || 0)}`
const CAT_CLR = {
  Seguros:'#f97316',Deudas:'#ef4444',Delivery:'#fb923c',Restaurantes:'#f59e0b',
  Transporte:'#3b82f6',Supermercados:'#84cc16',Entretenimiento:'#8b5cf6',
  Servicios:'#eab308',Alquiler:'#0ea5e9',Suscripciones:'#ec4899',Mascotas:'#14b8a6',
  Viajes:'#a78bfa',Sueldo:'#22c55e',Tecnología:'#06b6d4',Compras:'#f43f5e',
  Moda:'#db2777',Salud:'#10b981',Gasolina:'#78716c',Educación:'#6366f1',
  Ahorro:'#22d3ee',Hogar:'#a16207',Retiro:'#64748b',Impuestos:'#dc2626',
  Intereses:'#16a34a',Comisiones:'#9ca3af',Otros:'#64748b',
}
const TX_ICON = {
  Sueldo:'💰',Delivery:'🛵',Transporte:'🚗',Restaurantes:'🍽️',Seguros:'🔒',
  Supermercados:'🛒',Entretenimiento:'🎬',Deudas:'🏦',Mascotas:'🐾',Viajes:'✈️',
  Servicios:'⚡',Suscripciones:'📱',Alquiler:'🏠',Tecnología:'💻',Compras:'🛍️',
  Moda:'👔',Salud:'💊',Gasolina:'⛽',Educación:'📚',Ahorro:'🐷',Hogar:'🏡',
  Retiro:'🏧','Retiro Efectivo':'🏧',Impuestos:'📋',Intereses:'💹',Otros:'📦',
}
const MONTHS = [
  { v:'', l:'Todos los meses' },
  { v:'2026-05', l:'Mayo 2026' },
  { v:'2026-04', l:'Abril 2026' },
  { v:'2026-03', l:'Marzo 2026' },
  { v:'2026-02', l:'Febrero 2026' },
]
const MN = { '2026-02':'Feb', '2026-03':'Mar', '2026-04':'Abr', '2026-05':'May' }

const ALL_CATS = [
  'Sueldo','Restaurantes','Delivery','Supermercados','Transporte','Gasolina',
  'Entretenimiento','Suscripciones','Servicios','Alquiler','Seguros','Ahorro',
  'Mascotas','Viajes','Hospedaje','Compras','Moda','Salud','Tecnología',
  'Educación','Deudas','Cuotas Préstamos','Transferencias','Transferencias Recibidas',
  'Pago Tarjeta','Retiro Efectivo','Impuestos','Intereses','Comisiones','Hogar','Otros',
]

function CategoryChooser({ current, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const filtered = ALL_CATS.filter(c => c.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="absolute right-0 top-8 z-50 w-52 rounded-xl overflow-hidden shadow-2xl animate-fade"
      style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}
      onClick={e => e.stopPropagation()}>
      <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar categoría..."
          className="w-full text-xs px-2 py-1.5 rounded-lg"
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-1)' }}/>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filtered.map(c => (
          <button key={c} onClick={() => onSelect(c)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-white/5"
            style={{ color: c === current ? '#60a5fa' : 'var(--text-2)' }}>
            <span>{TX_ICON[c] || '📋'}</span>
            <span>{c}</span>
            {c === current && <Check size={10} className="ml-auto text-blue-400"/>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function CategoriasPage() {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState('')
  const [selected, setSelected] = useState(null)
  const [editingTx, setEditingTx] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { load() }, [month])

  function load() {
    setLoading(true)
    const params = month ? `?month=${month}` : ''
    fetch(`/api/analytics${params}`).then(r => r.json()).then(d => {
      setAnalytics(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  async function reclassify(merchant, newCat, txId, applyToAll) {
    setSaving(true)
    const res = await fetch('/api/transactions/recategorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant, newCategory: newCat, applyToAll, txId })
    })
    const data = await res.json()
    setSaving(false)
    setEditingTx(null)
    if (data.success) {
      const msg = applyToAll
        ? `✅ ${data.updated} transacciones de "${merchant}" → ${newCat}`
        : `✅ Transacción reclasificada → ${newCat}`
      setToast(msg)
      setTimeout(() => setToast(null), 3500)
      load()
    }
  }

  const catTrend = useMemo(() => (analytics?.categoryTrend || []).filter(c => c.last > 50 || c.monthly.some(m => m.total > 50)), [analytics])
  const totalGastos = useMemo(() => catTrend.reduce((s, c) => s + c.last, 0), [catTrend])

  const selectedCat = useMemo(() => catTrend.find(c => c.category === selected), [catTrend, selected])

  // Comparison chart
  const compData = useMemo(() => catTrend.slice(0, 10).map(c => ({
    name: c.category.length > 7 ? c.category.slice(0,7)+'…' : c.category,
    Mar: c.monthly[1]?.total || 0,
    Abr: c.monthly[2]?.total || 0,
  })), [catTrend])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-5 space-y-5 max-w-6xl mx-auto" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm text-white animate-fade shadow-lg"
          style={{ background: '#059669' }}>{toast}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Categorías</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Análisis MoM · Haz click en una categoría para ver comercios y reclasificar</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="text-sm px-3 py-2 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <button onClick={load} className="p-2 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <RefreshCw size={14} style={{ color: 'var(--text-3)' }}/>
          </button>
        </div>
      </div>

      {/* MoM bar chart */}
      {!month && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Comparativo Mar vs Abr — Top 10 categorías</h2>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={compData} barGap={1}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
              <Tooltip contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11 }} formatter={v => [S(v)]}/>
              <Bar dataKey="Mar" fill="rgba(59,130,246,0.5)" radius={[3,3,0,0]}/>
              <Bar dataKey="Abr" fill="#3b82f6" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold text-white">
            {month ? `Categorías — ${MONTHS.find(m=>m.v===month)?.l}` : 'Todas las categorías — Feb/Mar/Abr'}
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{catTrend.length} categorías · {S(totalGastos)} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-2" style={{ color: 'var(--text-3)', fontWeight: 500 }}>Categoría</th>
                {!month && ['Feb','Mar','Abr'].map(m => (
                  <th key={m} className="text-right px-3 py-2" style={{ color: 'var(--text-3)', fontWeight: 500 }}>{m}</th>
                ))}
                {month && <th className="text-right px-4 py-2" style={{ color: 'var(--text-3)', fontWeight: 500 }}>Total</th>}
                <th className="text-right px-3 py-2" style={{ color: 'var(--text-3)', fontWeight: 500 }}>Tendencia</th>
                {!month && <th className="text-right px-3 py-2" style={{ color: 'var(--text-3)', fontWeight: 500 }}>MoM</th>}
                <th className="text-right px-4 py-2" style={{ color: 'var(--text-3)', fontWeight: 500 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {catTrend.map(c => {
                const isOpen = selected === c.category
                const vals = c.monthly.map(m => m.total)
                const maxV = Math.max(...vals, 1)
                return (
                  <tr key={c.category}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid var(--border)', background: isOpen ? 'var(--blue-glow)' : 'transparent' }}
                    onClick={() => setSelected(isOpen ? null : c.category)}
                    onMouseEnter={e => !isOpen && (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => !isOpen && (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span>{TX_ICON[c.category] || '📋'}</span>
                        <span className="font-medium" style={{ color: CAT_CLR[c.category] || 'var(--text-1)' }}>{c.category}</span>
                        <ChevronRight size={11} style={{ color: 'var(--text-3)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: '0.2s' }}/>
                      </div>
                    </td>
                    {!month && c.monthly.map((m, i) => (
                      <td key={i} className="text-right px-3 py-2.5 num">
                        <span className="inline-block px-2 py-0.5 rounded text-white text-opacity-90"
                          style={{ background: m.total > 0 ? (CAT_CLR[c.category]||'#3b82f6') + (Math.round((m.total/maxV)*200+30)).toString(16).padStart(2,'0') : 'transparent' }}>
                          {m.total > 0 ? S(m.total) : '—'}
                        </span>
                      </td>
                    ))}
                    {month && <td className="text-right px-4 py-2.5 num font-semibold text-white">{S(c.last)}</td>}
                    <td className="px-3 py-2.5 text-right">
                      {c.last > 0 && !month && (
                        <svg width={50} height={18} viewBox="0 0 50 18">
                          {vals.length > 1 && (
                            <polyline
                              points={vals.map((v,i) => `${(i/(vals.length-1))*48},${16-(v/maxV)*14}`).join(' ')}
                              fill="none" stroke={CAT_CLR[c.category]||'#3b82f6'} strokeWidth={1.5}
                              strokeLinecap="round" strokeLinejoin="round"/>
                          )}
                        </svg>
                      )}
                    </td>
                    {!month && (
                      <td className="px-3 py-2.5 text-right">
                        {Math.abs(c.delta) > 3 ? (
                          <span className={`inline-flex items-center gap-0.5 font-bold text-xs ${c.delta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {c.delta > 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                            {c.delta > 0 ? '+' : ''}{c.delta}%
                          </span>
                        ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-3)' }}>
                      {totalGastos > 0 ? `${((c.last/totalGastos)*100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Detail — Merchant drill-down */}
      {selected && selectedCat && (
        <div className="card overflow-hidden animate-fade" id="cat-detail">
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{TX_ICON[selected] || '📋'}</span>
              <div>
                <h2 className="font-semibold text-white">{selected}</h2>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {selectedCat.merchantList.length} comercios · {S(selectedCat.merchantList.reduce((s,m)=>s+m.total,0))} total histórico
                </p>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-white/5">
              <X size={16} style={{ color: 'var(--text-3)' }}/>
            </button>
          </div>

          {/* Merchant list with reclassify */}
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {selectedCat.merchantList.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>Sin comercios identificados</div>
            ) : selectedCat.merchantList.map((m, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{m.name}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-3)' }}>{m.count}x</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Último: {m.lastDate}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-bold num text-white">{S(m.total)}</span>
                  <div className="relative">
                    <button
                      onClick={() => setEditingTx(editingTx === m.name ? null : m.name)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ background: editingTx === m.name ? 'var(--blue-glow)' : 'var(--bg-card2)', border: `1px solid ${editingTx === m.name ? '#3b82f6' : 'var(--border2)'}`, color: editingTx === m.name ? '#60a5fa' : 'var(--text-3)' }}>
                      Cambiar cat.
                      <ChevronDown size={10}/>
                    </button>
                    {editingTx === m.name && (
                      <CategoryChooser
                        current={selected}
                        onClose={() => setEditingTx(null)}
                        onSelect={async (newCat) => {
                          const confirm = window.confirm(
                            `¿Cambiar "${m.name}" de "${selected}" a "${newCat}"?\n\n` +
                            `• Solo este registro\n• O TODOS los ${m.count} meses en que aparece\n\n` +
                            `Presiona OK para aplicar a TODOS los meses, Cancelar para solo este.`
                          )
                          await reclassify(m.name, newCat, null, true) // always apply all for merchants
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly breakdown per merchant */}
          {selectedCat.merchantList.length > 0 && !month && (
            <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-3)' }}>Evolución mensual — Top 5 comercios</h3>
              <div className="space-y-1.5">
                {selectedCat.merchantList.slice(0,5).map((m,i) => {
                  const monthlyForMerch = ['2026-02','2026-03','2026-04'].map(mo => {
                    const t = (analytics?.transactions||[]).filter(t =>
                      t.merchant === m.name && t.date?.startsWith(mo) && t.type === 'gasto'
                    ).reduce((s,t) => s + Number(t.amount_pen||t.amount), 0)
                    return { month: MN[mo], total: Math.round(t) }
                  })
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs w-28 truncate" style={{ color: 'var(--text-2)' }}>{m.name}</span>
                      <div className="flex gap-1 flex-1">
                        {monthlyForMerch.map((mo,j) => (
                          <div key={j} className="flex-1 text-center">
                            <div className="text-xs num" style={{ color: mo.total > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                              {mo.total > 0 ? S(mo.total) : '—'}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-3)', fontSize: 9 }}>{mo.month}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// @ts-nocheck
'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { TrendingUp, TrendingDown, X, Tag, RefreshCw, Check, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(n||0)}`
const CAT_CLR = {
  Seguros:'#f97316',Deudas:'#ef4444',Delivery:'#fb923c',Restaurantes:'#f59e0b',
  Transporte:'#3b82f6',Supermercados:'#22c55e',Markets:'#4ade80',Entretenimiento:'#8b5cf6',
  Servicios:'#eab308',Alquiler:'#0ea5e9',Suscripciones:'#ec4899',Mascotas:'#14b8a6',
  Viajes:'#a78bfa',Sueldo:'#22c55e',Tecnología:'#06b6d4',Compras:'#f43f5e',
  Moda:'#db2777',Salud:'#10b981',Gasolina:'#78716c',Educación:'#6366f1',
  Hogar:'#a16207',Impuestos:'#dc2626',Intereses:'#16a34a',Internet:'#6366f1',
  Club:'#d97706','Yape/Plin':'#7c3aed',Otros:'#64748b',
}
const TX_ICON = {
  Sueldo:'💰',Delivery:'🛵',Transporte:'🚗',Restaurantes:'🍽️',Seguros:'🔒',Supermercados:'🛒',
  Markets:'🏪',Entretenimiento:'🎬',Deudas:'🏦',Mascotas:'🐾',Viajes:'✈️',Servicios:'⚡',
  Suscripciones:'📱',Alquiler:'🏠',Tecnología:'💻',Compras:'🛍️',Moda:'👔',Salud:'💊',
  Gasolina:'⛽',Educación:'📚',Hogar:'🏡',Impuestos:'📋',Intereses:'💹',Internet:'🌐',
  Club:'🎭','Yape/Plin':'📲',Otros:'📦',
}
const MN = {'2026-01':'Ene','2026-02':'Feb','2026-03':'Mar','2026-04':'Abr','2026-05':'May'}
const ALL_CATS = [
  'Restaurantes','Delivery','Markets','Supermercados','Transporte','Gasolina',
  'Entretenimiento','Suscripciones','Servicios','Alquiler','Seguros','Internet','Hogar',
  'Mascotas','Viajes','Compras','Moda','Salud','Tecnología','Educación','Club',
  'Cuotas Préstamos','Ahorro','Yape/Plin','Pago Tarjeta','Pago Préstamo',
  'Transferencias Propias','Transferencias Recibidas','Impuestos','Intereses','Comisiones','Otros',
]

function CatModal({ current, onClose, onSelect }) {
  const [search, setSearch] = useState('')
  const filtered = ALL_CATS.filter(c => c.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{background:'rgba(0,0,0,0.7)'}} onClick={onClose}>
      <div className="w-full md:max-w-sm rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl"
        style={{background:'var(--bg-card)',border:'1px solid var(--border)'}} onClick={e=>e.stopPropagation()}>
        <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b" style={{borderColor:'var(--border)'}}>
          <h3 className="text-sm font-semibold text-white">Cambiar categoría</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={14} style={{color:'var(--text-3)'}}/></button>
        </div>
        <div className="p-3">
          <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..."
            className="w-full text-sm px-3 py-2 rounded-xl"
            style={{background:'var(--bg-base)',border:'1px solid var(--border)',color:'var(--text-1)'}}/>
        </div>
        <div className="max-h-64 overflow-y-auto pb-3">
          {filtered.map(c=>(
            <button key={c} onClick={()=>onSelect(c)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-white/5"
              style={{color:c===current?'#60a5fa':'var(--text-2)'}}>
              <span>{TX_ICON[c]||'📋'}</span>
              <span className="flex-1">{c}</span>
              {c===current && <Check size={12} className="text-blue-400"/>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CategoriasPage() {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState('')
  const [selected, setSelected] = useState(null)
  // reclassify target: { txId, merchant, currentCat, merchantCount }
  const [reclTarget, setReclTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { load() }, [month])

  function load() {
    setLoading(true)
    fetch('/api/analytics?' + Date.now()).then(r=>r.json()).then(d=>{setAnalytics(d);setLoading(false)}).catch(()=>setLoading(false))
  }

  // ── THE FIX: always pass txId when single, merchant when all ──
  async function reclassify(target, newCat) {
    if (!target || !newCat) return
    setSaving(true)
    setReclTarget(null)

    let body
    if (target.applyAll && target.merchant) {
      body = { merchant: target.merchant, newCategory: newCat, applyToAll: true }
    } else {
      // Single tx: MUST pass txId
      body = { txId: target.txId, newCategory: newCat, applyToAll: false }
    }

    try {
      const res = await fetch('/api/transactions/recategorize', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        const scope = data.scope === 'all_months' ? `${data.updated} transacciones de "${target.merchant}"` : '1 transacción'
        setToast(`✅ ${scope} → ${newCat}`)
        setTimeout(()=>setToast(null), 3000)
        load()
        setSelected(null)
      } else {
        setToast(`❌ Error: ${data.error}`)
        setTimeout(()=>setToast(null), 3000)
      }
    } catch(e) {
      setToast(`❌ Error de conexión`)
      setTimeout(()=>setToast(null), 3000)
    }
    setSaving(false)
  }

  const months = analytics?.months || []
  const monthOptions = [{v:'',l:'Todos los meses'}, ...months.map(m=>({v:m,l:(MN[m]||m)+' 2026'}))]

  const getCatValue = useCallback((c) => {
    if (!month) return c.last
    return c.monthly?.find(m=>m.month===month)?.total || 0
  }, [month])

  const catTrend = useMemo(() => {
    return (analytics?.categoryTrend||[])
      .filter(c => c.category !== 'Ahorro' && c.total > 0)
      .map(c => ({...c, displayValue: getCatValue(c)}))
      .filter(c => !month || c.displayValue > 0)
      .sort((a,b) => b.displayValue - a.displayValue)
  }, [analytics, month, getCatValue])

  const totalGastos = useMemo(() => catTrend.reduce((s,c)=>s+c.displayValue,0), [catTrend])
  const selectedCat = useMemo(() => analytics?.categoryTrend?.find(c=>c.category===selected), [analytics, selected])

  const catTransactions = useMemo(() => {
    if (!selected || !analytics?.transactions) return []
    return analytics.transactions
      .filter(t => (t.category||'Otros')===selected && t.type==='gasto' && t.category!=='Ahorro'
        && (month ? t.date?.startsWith(month) : true))
      .sort((a,b) => Number(b.amount_pen||b.amount) - Number(a.amount_pen||a.amount))
  }, [selected, analytics, month])

  const availMonths = months.slice(-3)
  const compData = useMemo(() => catTrend.slice(0,10).map(c => {
    const obj = { name: c.category.length>8 ? c.category.slice(0,7)+'…' : c.category }
    availMonths.forEach(m => { obj[MN[m]||m] = c.monthly?.find(x=>x.month===m)?.total||0 })
    return obj
  }), [catTrend, availMonths])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{background:'var(--bg-base)'}}>
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-6xl mx-auto" style={{background:'var(--bg-base)',minHeight:'100vh'}}>

      {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm text-white shadow-xl animate-fade" style={{background:toast.startsWith('✅')?'#059669':'#dc2626'}}>{toast}</div>}

      {reclTarget && (
        <CatModal current={reclTarget.currentCat} onClose={()=>setReclTarget(null)}
          onSelect={newCat => {
            if (reclTarget.merchantCount > 1) {
              const applyAll = window.confirm(
                `¿Aplicar "${newCat}" a TODAS las ${reclTarget.merchantCount} transacciones de "${reclTarget.merchant}"?\n\nOK = Todos los meses\nCancelar = Solo esta transacción`
              )
              reclassify({...reclTarget, applyAll}, newCat)
            } else {
              reclassify({...reclTarget, applyAll: false}, newCat)
            }
          }}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white">Categorías</h1>
          <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>Clic en categoría → transacciones → Recategorizar (persiste en DB)</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e=>{setMonth(e.target.value);setSelected(null)}}
            className="text-sm px-3 py-2 rounded-xl"
            style={{background:'var(--bg-card)',border:'1px solid var(--border)',color:'var(--text-1)'}}>
            {monthOptions.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <button onClick={load} className="p-2 rounded-xl" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
            <RefreshCw size={13} style={{color:'var(--text-3)'}}/>
          </button>
        </div>
      </div>

      {!month && availMonths.length >= 2 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Comparativo mensual — Top 10</h2>
          <ResponsiveContainer width="100%" height={155}>
            <BarChart data={compData} barGap={1}>
              <XAxis dataKey="name" tick={{fill:'var(--text-3)',fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'var(--text-3)',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip contentStyle={{background:'var(--bg-card2)',border:'1px solid var(--border2)',borderRadius:8,fontSize:11}} formatter={v=>[S(v)]}/>
              {availMonths.map((m,i)=>(
                <Bar key={m} dataKey={MN[m]||m} fill={['rgba(59,130,246,0.4)','rgba(59,130,246,0.65)','#3b82f6'][i]||'#3b82f6'} radius={[3,3,0,0]}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{borderColor:'var(--border)'}}>
          <h2 className="text-sm font-semibold text-white">{month ? monthOptions.find(m2=>m2.v===month)?.l : 'Todos los meses'}</h2>
          <span className="text-xs" style={{color:'var(--text-3)'}}>{catTrend.length} cats · {S(totalGastos)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr style={{borderBottom:'1px solid var(--border)'}}>
                <th className="text-left px-4 py-2" style={{color:'var(--text-3)',fontWeight:500}}>Categoría</th>
                {!month && availMonths.map(m=>(
                  <th key={m} className="text-right px-3 py-2" style={{color:'var(--text-3)',fontWeight:500}}>{MN[m]||m}</th>
                ))}
                {month && <th className="text-right px-4 py-2" style={{color:'var(--text-3)',fontWeight:500}}>Total</th>}
                <th className="text-right px-3 py-2 hidden md:table-cell" style={{color:'var(--text-3)',fontWeight:500}}>Trend</th>
                {!month && <th className="text-right px-3 py-2" style={{color:'var(--text-3)',fontWeight:500}}>MoM</th>}
                <th className="text-right px-4 py-2" style={{color:'var(--text-3)',fontWeight:500}}>%</th>
              </tr>
            </thead>
            <tbody>
              {catTrend.map(c => {
                const isOpen = selected===c.category
                const vals = c.monthly?.map(m=>m.total)||[]
                const maxV = Math.max(...vals,1)
                return (
                  <tr key={c.category} className="cursor-pointer transition-colors"
                    style={{borderBottom:'1px solid var(--border)',background:isOpen?'var(--blue-glow)':'transparent'}}
                    onClick={()=>setSelected(isOpen?null:c.category)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span>{TX_ICON[c.category]||'📋'}</span>
                        <span className="font-medium" style={{color:CAT_CLR[c.category]||'var(--text-1)'}}>{c.category}</span>
                        <ChevronRight size={11} style={{color:'var(--text-3)',transform:isOpen?'rotate(90deg)':'none',transition:'0.2s'}}/>
                      </div>
                    </td>
                    {!month && availMonths.map((m,i) => {
                      const found = c.monthly?.find(x=>x.month===m)
                      const v = found?.total||0
                      const hex = Math.round((v/maxV)*180+30).toString(16).padStart(2,'0')
                      return (
                        <td key={m} className="text-right px-3 py-2.5 num">
                          <span className="inline-block px-2 py-0.5 rounded"
                            style={{background:v>0?(CAT_CLR[c.category]||'#3b82f6')+hex:'transparent',color:v>0?'#fff':'var(--text-3)'}}>
                            {v>0?S(v):'—'}
                          </span>
                        </td>
                      )
                    })}
                    {month && <td className="text-right px-4 py-2.5 num font-semibold text-white">{S(c.displayValue)}</td>}
                    <td className="px-3 py-2.5 text-right hidden md:table-cell">
                      {vals.length>1 && (
                        <svg width={50} height={16} viewBox="0 0 50 16">
                          <polyline points={vals.map((v,i)=>`${(i/(vals.length-1))*48},${14-(v/maxV)*12}`).join(' ')}
                            fill="none" stroke={CAT_CLR[c.category]||'#3b82f6'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </td>
                    {!month && (
                      <td className="px-3 py-2.5 text-right">
                        {Math.abs(c.delta)>3 ? (
                          <span className={`inline-flex items-center gap-0.5 font-bold text-xs ${c.delta>0?'text-red-400':'text-green-400'}`}>
                            {c.delta>0?<TrendingUp size={9}/>:<TrendingDown size={9}/>}{c.delta>0?'+':''}{c.delta}%
                          </span>
                        ) : <span style={{color:'var(--text-3)'}}>—</span>}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right" style={{color:'var(--text-3)'}}>
                      {totalGastos>0?`${((c.displayValue/totalGastos)*100).toFixed(1)}%`:'—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && selectedCat && (
        <div className="card overflow-hidden animate-fade">
          <div className="px-4 md:px-5 py-4 border-b flex items-center justify-between" style={{borderColor:'var(--border)'}}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{TX_ICON[selected]||'📋'}</span>
              <div>
                <h2 className="font-semibold text-white">{selected}</h2>
                <p className="text-xs" style={{color:'var(--text-3)'}}>
                  {catTransactions.length} txs · {S(catTransactions.reduce((s,t)=>s+Number(t.amount_pen||t.amount),0))}
                  {month ? ` en ${MN[month]||month}` : ' histórico'}
                </p>
              </div>
            </div>
            <button onClick={()=>setSelected(null)} className="p-1.5 rounded-lg hover:bg-white/5">
              <X size={15} style={{color:'var(--text-3)'}}/>
            </button>
          </div>

          <div className="divide-y max-h-96 overflow-y-auto" style={{borderColor:'var(--border)'}}>
            {catTransactions.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-2xl mb-2">📭</p>
                <p className="text-sm" style={{color:'var(--text-3)'}}>
                  {month ? `Sin transacciones de "${selected}" en ${MN[month]||month}` : `Sin transacciones`}
                </p>
              </div>
            ) : catTransactions.map((t,i) => {
              const merchantCount = selectedCat.merchantList?.find(m=>m.name===t.merchant)?.count || 1
              return (
                <div key={t.id||i} className="flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-white/[0.02]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{color:'var(--text-1)'}}>
                      {t.merchant||t.description?.slice(0,35)||'—'}
                    </p>
                    <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>
                      {t.date?.slice(0,10)} · {t.bank}
                      {t.currency==='USD' && <span className="ml-1.5 px-1 rounded" style={{background:'rgba(234,179,8,0.15)',color:'#fbbf24'}}>USD ${Number(t.amount).toFixed(0)}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold num text-white">{S(Number(t.amount_pen||t.amount))}</span>
                    <button
                      disabled={saving}
                      onClick={() => setReclTarget({
                        txId: t.id,
                        merchant: t.merchant,
                        currentCat: t.category||'Otros',
                        merchantCount,
                      })}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                      style={{background:'var(--bg-card2)',border:'1px solid var(--border2)',color:'var(--text-3)'}}>
                      <Tag size={11}/>
                      <span className="hidden md:inline">Cambiar</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {selectedCat.merchantList.length > 0 && (
            <div className="border-t" style={{borderColor:'var(--border)'}}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{borderBottom:'1px solid var(--border)'}}>
                <p className="text-xs font-semibold text-white">Todos los comercios</p>
                <span className="text-xs" style={{color:'var(--text-3)'}}>{selectedCat.merchantList.length} · {S(selectedCat.merchantList.reduce((s,m)=>s+m.total,0))} total histórico</span>
              </div>
              <div className="divide-y max-h-48 overflow-y-auto" style={{borderColor:'var(--border)'}}>
                {selectedCat.merchantList.map((m,i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{color:'var(--text-1)'}}>{m.name}</p>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>{m.count}x · último {m.lastDate}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold num text-white">{S(m.total)}</span>
                      <button
                        disabled={saving}
                        onClick={() => setReclTarget({
                          txId: null,
                          merchant: m.name,
                          currentCat: selected,
                          merchantCount: m.count,
                          applyAll: true,
                        })}
                        className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg"
                        style={{background:'var(--bg-card2)',border:'1px solid var(--border2)',color:'var(--text-3)'}}>
                        <Tag size={10}/> <span className="hidden md:inline">Todos ({m.count})</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

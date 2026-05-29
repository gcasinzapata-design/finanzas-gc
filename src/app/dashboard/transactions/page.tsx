// @ts-nocheck
'use client'
import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, X, Repeat, ArrowUpDown, DollarSign, ChevronDown } from 'lucide-react'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n || 0)}`
const D = (n) => `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(n || 0)}`

const CAT_CLR = {
  Seguros:'#f97316',Deudas:'#ef4444',Delivery:'#fb923c',Restaurantes:'#f59e0b',
  Transporte:'#3b82f6',Supermercados:'#84cc16',Entretenimiento:'#8b5cf6',
  Servicios:'#eab308',Alquiler:'#0ea5e9',Suscripciones:'#ec4899',Mascotas:'#14b8a6',
  Viajes:'#a78bfa',Sueldo:'#22c55e',Tecnología:'#06b6d4',Compras:'#f43f5e',
  Moda:'#db2777',Salud:'#10b981',Gasolina:'#78716c',Educación:'#6366f1',
  Ahorro:'#22d3ee',Hogar:'#a16207',Impuestos:'#dc2626',Intereses:'#16a34a',
  Otros:'#64748b',Transferencias:'#94a3b8',
}
const TX_ICON = {
  Sueldo:'💰',Delivery:'🛵',Transporte:'🚗',Restaurantes:'🍽️',Seguros:'🔒',
  Supermercados:'🛒',Entretenimiento:'🎬',Deudas:'🏦',Mascotas:'🐾',Viajes:'✈️',
  Servicios:'⚡',Suscripciones:'📱',Alquiler:'🏠',Tecnología:'💻',Compras:'🛍️',
  Moda:'👔',Salud:'💊',Gasolina:'⛽',Educación:'📚',Ahorro:'🐷',Hogar:'🏡',
  Retiro:'🏧','Retiro Efectivo':'🏧',Impuestos:'📋',Otros:'📦',
}
const MONTHS = [
  { v:'', l:'Todos los meses' },
  { v:'2026-05', l:'Mayo 2026' },
  { v:'2026-04', l:'Abril 2026' },
  { v:'2026-03', l:'Marzo 2026' },
  { v:'2026-02', l:'Febrero 2026' },
  { v:'2026-01', l:'Enero 2026' },
]
const ALL_CATS = [
  'Sueldo','Restaurantes','Delivery','Supermercados','Transporte','Gasolina',
  'Entretenimiento','Suscripciones','Servicios','Alquiler','Seguros','Ahorro',
  'Mascotas','Viajes','Compras','Moda','Salud','Tecnología','Educación',
  'Deudas','Cuotas Préstamos','Transferencias','Transferencias Recibidas',
  'Pago Tarjeta','Retiro Efectivo','Impuestos','Intereses','Hogar','Otros',
]

function TxDetail({ tx, onClose, allTx, onReclassify }) {
  const [showCatPicker, setShowCatPicker] = useState(false)
  const [catSearch, setCatSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const sameMerch = allTx.filter(t => t.merchant === tx.merchant && t.id !== tx.id && t.type === tx.type)

  async function doReclassify(newCat, applyAll) {
    setSaving(true)
    await fetch('/api/transactions/recategorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant: tx.merchant, newCategory: newCat, applyToAll: applyAll, txId: tx.id })
    })
    setSaving(false)
    setShowCatPicker(false)
    onReclassify(newCat, applyAll)
  }

  const filteredCats = ALL_CATS.filter(c => c.toLowerCase().includes(catSearch.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1"/>
      <div className="w-full max-w-sm h-full overflow-y-auto animate-slide"
        style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b sticky top-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: (CAT_CLR[tx.category]||'#64748b')+'20' }}>
              {TX_ICON[tx.category]||'📋'}
            </div>
            <div>
              <p className="font-semibold text-white truncate max-w-[180px]">{tx.merchant||tx.description?.slice(0,30)}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{tx.date?.slice(0,10)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={16} style={{ color: 'var(--text-3)' }}/>
          </button>
        </div>

        {/* Amount */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Monto</p>
          <p className={`text-3xl font-bold num ${tx.type==='ingreso'?'text-green-400':tx.type==='transferencia'?'text-blue-400':'text-white'}`}>
            {tx.type==='ingreso'?'+':tx.type==='gasto'?'−':'↔'}{S(Number(tx.amount_pen||tx.amount))}
          </p>
          {tx.currency === 'USD' && (
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <DollarSign size={11} className="text-yellow-400"/>
              <span style={{ color: 'var(--text-3)' }}>
                {D(Number(tx.amount))} USD · TC {tx.fx_rate} · Convertido: {S(Number(tx.amount_pen))}
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          {[
            { label: 'Categoría', value: tx.category||'—', color: CAT_CLR[tx.category] },
            { label: 'Banco', value: tx.bank||'—' },
            { label: 'Fecha', value: tx.date?.slice(0,10)||'—' },
            { label: 'Moneda', value: tx.currency||'PEN' },
            { label: 'Descripción', value: tx.description||'—' },
          ].map(({ label, value, color }, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)', minWidth: 80 }}>{label}</span>
              <span className="text-sm text-right font-medium" style={{ color: color||'var(--text-1)' }}>{value}</span>
            </div>
          ))}
          {tx.is_recurring && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <Repeat size={12} className="text-orange-400 flex-shrink-0"/>
              <p className="text-xs text-orange-400 font-medium">{tx.recurring_label||'Gasto fijo recurrente'}</p>
            </div>
          )}
        </div>

        {/* Reclassify */}
        <div className="px-5 pb-4">
          <button onClick={() => setShowCatPicker(!showCatPicker)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: showCatPicker ? 'var(--blue-glow)' : 'var(--bg-card2)', border: `1px solid ${showCatPicker ? '#3b82f6' : 'var(--border2)'}`, color: showCatPicker ? '#60a5fa' : 'var(--text-2)' }}>
            <ChevronDown size={14}/> Cambiar categoría
          </button>

          {showCatPicker && (
            <div className="mt-2 rounded-xl overflow-hidden" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
              <div className="p-2">
                <input autoFocus value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Buscar..."
                  className="w-full text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-1)' }}/>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                {filteredCats.map(cat => (
                  <button key={cat} className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-white/5"
                    style={{ color: cat === tx.category ? '#60a5fa' : 'var(--text-2)' }}
                    onClick={() => {
                      const applyAll = tx.merchant && sameMerch.length > 0
                        ? window.confirm(`¿Aplicar "${cat}" a TODAS las ${sameMerch.length+1} transacciones de "${tx.merchant}" en todos los meses?`)
                        : false
                      doReclassify(cat, applyAll)
                    }}>
                    <span>{TX_ICON[cat]||'📋'} {cat}</span>
                    {cat === tx.category && <span className="text-blue-400">✓ actual</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Same merchant history */}
        {sameMerch.length > 0 && (
          <div className="mx-5 mb-5 rounded-xl overflow-hidden" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold text-white">{tx.merchant} — Historial ({sameMerch.length} más)</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Total: {S(sameMerch.reduce((s,t)=>s+Number(t.amount_pen||t.amount),0) + Number(tx.amount_pen||tx.amount))}
              </p>
            </div>
            <div className="divide-y max-h-44 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
              {sameMerch.slice(0,10).map((t,i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2">
                  <div>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>{t.date?.slice(0,10)}</span>
                    {t.currency === 'USD' && <span className="ml-1.5 text-xs px-1 rounded" style={{ background: 'rgba(234,179,8,0.2)', color: '#fbbf24' }}>USD</span>}
                  </div>
                  <span className="text-xs font-medium num text-white">{S(Number(t.amount_pen||t.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TransactionsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [allTx, setAllTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('2026-05')
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('')
  const [currFilter, setCurrFilter] = useState('all')
  const [showRecurring, setShowRecurring] = useState(false)
  const [sortBy, setSortBy] = useState('date')
  const [selectedTx, setSelectedTx] = useState(null)

  useEffect(() => { loadTx() }, [monthFilter])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id && allTx.length > 0) setSelectedTx(allTx.find(t => t.id === id) || null)
  }, [searchParams, allTx])

  async function loadTx() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '600', source: 'eecc' })
      if (monthFilter) params.set('month', monthFilter)
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      setAllTx(data.transactions || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const categories = useMemo(() => [...new Set(allTx.map(t=>t.category).filter(Boolean))].sort(), [allTx])

  const filtered = useMemo(() => {
    let list = allTx
    if (typeFilter !== 'all') list = list.filter(t => t.type === typeFilter)
    if (catFilter) list = list.filter(t => t.category === catFilter)
    if (currFilter !== 'all') list = list.filter(t => t.currency === currFilter)
    if (showRecurring) list = list.filter(t => t.is_recurring)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        (t.merchant||'').toLowerCase().includes(q) ||
        (t.description||'').toLowerCase().includes(q) ||
        (t.category||'').toLowerCase().includes(q))
    }
    if (sortBy === 'amount') list = [...list].sort((a,b) => Number(b.amount_pen||b.amount) - Number(a.amount_pen||a.amount))
    return list
  }, [allTx, typeFilter, catFilter, currFilter, search, showRecurring, sortBy])

  const totals = useMemo(() => ({
    gastos: filtered.filter(t=>t.type==='gasto').reduce((s,t)=>s+Number(t.amount_pen||t.amount),0),
    ingresos: filtered.filter(t=>t.type==='ingreso').reduce((s,t)=>s+Number(t.amount_pen||t.amount),0),
    usd: filtered.filter(t=>t.currency==='USD' && t.type==='gasto').reduce((s,t)=>s+Number(t.amount),0),
  }), [filtered])

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-white">Transacciones</h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-400 font-semibold num">+{S(totals.ingresos)}</span>
            <span style={{ color: 'var(--text-3)' }}>·</span>
            <span className="text-red-400 font-semibold num">-{S(totals.gastos)}</span>
            {totals.usd > 0 && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24' }}>-${totals.usd.toFixed(0)} USD</span>}
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-3)' }}>{filtered.length}</span>
          </div>
        </div>
        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-xl"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-1)' }}>
            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          {(['all','gasto','ingreso','transferencia']).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="text-xs px-2.5 py-1.5 rounded-xl font-medium"
              style={{ background: typeFilter===t?'var(--blue)':'var(--bg-card2)', color: typeFilter===t?'#fff':'var(--text-2)', border: `1px solid ${typeFilter===t?'var(--blue)':'var(--border2)'}` }}>
              {t==='all'?'Todos':t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
          <button onClick={() => setCurrFilter(c => c==='all'?'USD':'all')}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl"
            style={{ background: currFilter==='USD'?'rgba(234,179,8,0.2)':'var(--bg-card2)', border: `1px solid ${currFilter==='USD'?'#fbbf24':'var(--border2)'}`, color: currFilter==='USD'?'#fbbf24':'var(--text-2)' }}>
            <DollarSign size={10}/> USD
          </button>
          <button onClick={() => setSortBy(s => s==='date'?'amount':'date')}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-2)' }}>
            <ArrowUpDown size={10}/> {sortBy==='date'?'Fecha':'Monto'}
          </button>
          <button onClick={() => setShowRecurring(!showRecurring)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl"
            style={{ background: showRecurring?'rgba(249,115,22,0.2)':'var(--bg-card2)', border: `1px solid ${showRecurring?'#f97316':'var(--border2)'}`, color: showRecurring?'#f97316':'var(--text-2)' }}>
            <Repeat size={10}/> Fijos
          </button>
        </div>
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-xl"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-1)' }}/>
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} style={{ color: 'var(--text-3)' }}/></button>}
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-xl"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-1)' }}>
            <option value="">Todas las cats</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.slice(0, 300).map((t, i) => (
              <button key={t.id||i} onClick={() => setSelectedTx(t)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.02] transition-colors">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-base"
                  style={{ background: (CAT_CLR[t.category]||'#64748b')+'20' }}>
                  {TX_ICON[t.category]||'📋'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
                      {t.merchant||t.description?.slice(0,28)||'—'}
                    </p>
                    {t.is_recurring && <Repeat size={10} className="flex-shrink-0" style={{ color: '#f97316' }}/>}
                    {t.currency==='USD' && <span className="text-xs px-1 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24', fontSize: 9 }}>USD</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: (CAT_CLR[t.category]||'#64748b')+'20', color: CAT_CLR[t.category]||'#94a3b8', fontSize: '10px' }}>
                      {t.category||'Otros'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>{t.date?.slice(5,10)} · {t.bank}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold num ${t.type==='ingreso'?'text-green-400':t.type==='transferencia'?'text-blue-400':'text-white'}`}>
                    {t.type==='ingreso'?'+':t.type==='gasto'?'−':'↔'}{S(Number(t.amount_pen||t.amount))}
                  </p>
                  {t.currency==='USD' && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{D(Number(t.amount))}</p>}
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-center py-16 text-4xl">🔍<p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>Sin resultados</p></div>}
            {filtered.length > 300 && <div className="py-3 text-center text-xs" style={{ color: 'var(--text-3)' }}>300 de {filtered.length}</div>}
          </div>
        </div>
      )}

      {selectedTx && (
        <TxDetail
          tx={selectedTx}
          onClose={() => { setSelectedTx(null); router.replace('/dashboard/transactions') }}
          allTx={allTx}
          onReclassify={(newCat, applyAll) => {
            setAllTx(prev => prev.map(t => {
              if (applyAll && t.merchant === selectedTx.merchant) return { ...t, category: newCat }
              if (!applyAll && t.id === selectedTx.id) return { ...t, category: newCat }
              return t
            }))
            setSelectedTx(prev => prev ? { ...prev, category: newCat } : null)
          }}
        />
      )}
    </div>
  )
}

export default function TransactionsPage() {
  return <Suspense><TransactionsInner/></Suspense>
}

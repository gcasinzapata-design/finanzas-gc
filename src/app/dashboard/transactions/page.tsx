// @ts-nocheck
'use client'
import { useEffect, useState, useMemo, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, X, Repeat, ArrowUpDown, DollarSign, ChevronDown, Filter, Tag, Check, Building2, CreditCard, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-react'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:2}).format(n||0)}`
const S0 = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(n||0)}`
const D = (n) => `$${new Intl.NumberFormat('en-US',{minimumFractionDigits:2}).format(n||0)}`

const CAT_CLR = {
  Seguros:'#f97316',Deudas:'#ef4444',Delivery:'#fb923c',Restaurantes:'#f59e0b',
  Transporte:'#3b82f6',Supermercados:'#22c55e',Markets:'#4ade80',Entretenimiento:'#8b5cf6',
  Servicios:'#eab308',Alquiler:'#0ea5e9',Suscripciones:'#ec4899',Mascotas:'#14b8a6',
  Viajes:'#a78bfa',Sueldo:'#22c55e',Tecnología:'#06b6d4',Compras:'#f43f5e',
  Moda:'#db2777',Salud:'#10b981',Gasolina:'#78716c',Educación:'#6366f1',
  Ahorro:'#22d3ee',Hogar:'#a16207',Impuestos:'#dc2626',Intereses:'#16a34a',
  Internet:'#6366f1','Cuotas Préstamos':'#ef4444',Club:'#d97706',
  'Yape/Plin':'#7c3aed','Pago Tarjeta':'#94a3b8','Pago Préstamo':'#64748b',
  'Transferencias Propias':'#475569',Otros:'#64748b',
}
const TX_ICON = {
  Sueldo:'💰',Delivery:'🛵',Transporte:'🚗',Restaurantes:'🍽️',Seguros:'🔒',
  Supermercados:'🛒',Markets:'🏪',Entretenimiento:'🎬',Deudas:'🏦',Mascotas:'🐾',
  Viajes:'✈️',Servicios:'⚡',Suscripciones:'📱',Alquiler:'🏠',Tecnología:'💻',
  Compras:'🛍️',Moda:'👔',Salud:'💊',Gasolina:'⛽',Educación:'📚',Ahorro:'🐷',
  Hogar:'🏡',Impuestos:'📋',Intereses:'💹',Internet:'🌐',Club:'🎭',
  'Cuotas Préstamos':'🏦','Yape/Plin':'📲','Pago Tarjeta':'💳','Pago Préstamo':'🏛️',
  'Transferencias Propias':'↔️',Otros:'📦',
}
const MONTHS = [
  {v:'',l:'Todos los meses'},{v:'2026-05',l:'Mayo 2026'},{v:'2026-04',l:'Abril 2026'},
  {v:'2026-03',l:'Marzo 2026'},{v:'2026-02',l:'Febrero 2026'},{v:'2026-01',l:'Enero 2026'},
]
const ALL_CATS = [
  'Sueldo','Restaurantes','Delivery','Markets','Supermercados','Transporte','Gasolina',
  'Entretenimiento','Suscripciones','Servicios','Alquiler','Seguros','Internet','Hogar',
  'Mascotas','Viajes','Compras','Moda','Salud','Tecnología','Educación','Club',
  'Cuotas Préstamos','Ahorro','Yape/Plin','Pago Tarjeta','Pago Préstamo',
  'Transferencias Propias','Transferencias Recibidas','Impuestos','Intereses',
  'Comisiones','Otros',
]
const BANKS = ['BCP','BCP Visa Sapphire','BCP AMEX','Interbank Visa Infinite','Interbank','BBVA']

// ── Category Picker Modal ────────────────────────────────────────────────────
function CatModal({ current, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const filtered = ALL_CATS.filter(c => c.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{background:'rgba(0,0,0,0.7)'}} onClick={onClose}>
      <div className="w-full md:max-w-sm rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}} onClick={e=>e.stopPropagation()}>
        <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b" style={{borderColor:'var(--border)'}}>
          <h3 className="text-sm font-semibold text-white">Cambiar categoría</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={14} style={{color:'var(--text-3)'}}/></button>
        </div>
        <div className="p-3">
          <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..."
            className="w-full text-sm px-3 py-2 rounded-xl" style={{background:'var(--bg-base)',border:'1px solid var(--border)',color:'var(--text-1)'}}/>
        </div>
        <div className="max-h-64 overflow-y-auto pb-3">
          {filtered.map(c => (
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

// ── Transaction Detail Slide Panel ───────────────────────────────────────────
function TxDetail({ tx, allTx, onClose, onReclassify }) {
  const [showCatModal, setShowCatModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const sameMerch = useMemo(() =>
    allTx.filter(t => t.merchant && t.merchant === tx.merchant && t.id !== tx.id && t.type === tx.type),
    [allTx, tx])
  const merchantTotal = sameMerch.reduce((s,t)=>s+Number(t.amount_pen||t.amount),0) + Number(tx.amount_pen||tx.amount)

  async function doReclassify(newCat) {
    setSaving(true)
    setShowCatModal(false)
    const applyAll = tx.merchant && sameMerch.length > 0
      ? window.confirm(`¿Aplicar "${newCat}" a TODAS las ${sameMerch.length+1} transacciones de "${tx.merchant}" en todos los meses?\n\nOK = Todos los meses | Cancelar = Solo esta`)
      : false
    await fetch('/api/transactions/recategorize', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({merchant: applyAll?tx.merchant:null, newCategory:newCat, applyToAll:applyAll, txId: applyAll?null:tx.id})
    })
    setSaving(false)
    onReclassify(newCat, applyAll, tx.merchant)
  }

  const color = CAT_CLR[tx.category] || '#64748b'
  const isGasto = tx.type==='gasto'
  const isIngreso = tx.type==='ingreso'

  return (
    <>
      {showCatModal && <CatModal current={tx.category} onClose={()=>setShowCatModal(false)} onSelect={doReclassify}/>}
      <div className="fixed inset-0 z-40 flex" onClick={onClose}>
        <div className="flex-1"/>
        <div className="w-full max-w-sm h-full overflow-y-auto shadow-2xl animate-slide"
          style={{background:'var(--bg-card)',borderLeft:'1px solid var(--border)'}}
          onClick={e=>e.stopPropagation()}>

          {/* Color accent top bar */}
          <div className="h-1 w-full" style={{background:`linear-gradient(90deg, ${color}, ${color}88)`}}/>

          {/* Header */}
          <div className="sticky top-0 flex items-start justify-between p-5 border-b" style={{background:'var(--bg-card)',borderColor:'var(--border)'}}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl" style={{background:color+'20'}}>
                {TX_ICON[tx.category]||'📋'}
              </div>
              <div>
                <p className="font-semibold text-white leading-tight">{tx.merchant||tx.description?.slice(0,30)||'—'}</p>
                <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{tx.date?.slice(0,10)} · {tx.bank}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <X size={15} style={{color:'var(--text-3)'}}/>
            </button>
          </div>

          {/* Amount */}
          <div className="px-5 py-5 border-b" style={{borderColor:'var(--border)'}}>
            <p className="text-xs mb-1 font-medium uppercase tracking-wide" style={{color:'var(--text-3)'}}>
              {isIngreso?'Ingreso recibido':isGasto?'Gasto':'Transferencia'}
            </p>
            <p className={`text-4xl font-bold num ${isIngreso?'text-green-400':isGasto?'text-white':'text-blue-400'}`}>
              {isIngreso?'+':isGasto?'−':'↔'}{S(Number(tx.amount_pen||tx.amount))}
            </p>
            {tx.currency==='USD' && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                style={{background:'rgba(234,179,8,0.15)',color:'#fbbf24'}}>
                <DollarSign size={10}/> {D(Number(tx.amount))} USD · TC {tx.fx_rate}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="px-5 py-4 space-y-3">
            {[
              {label:'Categoría', value:tx.category||'—', color},
              {label:'Tipo', value:isIngreso?'Ingreso':isGasto?'Gasto':'Transferencia'},
              {label:'Banco', value:tx.bank||'—'},
              {label:'Fuente', value:tx.source==='eecc'?'Estado de Cuenta':'Gmail'},
              {label:'Moneda', value:tx.currency||'PEN'},
              {label:'Descripción', value:tx.description?.slice(0,60)||'—'},
            ].map(({label,value,color:c},i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-xs flex-shrink-0 font-medium" style={{color:'var(--text-3)',minWidth:80}}>{label}</span>
                <span className="text-sm text-right font-medium" style={{color:c||'var(--text-1)'}}>{value}</span>
              </div>
            ))}
            {tx.is_recurring && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:'rgba(249,115,22,0.1)',border:'1px solid rgba(249,115,22,0.2)'}}>
                <Repeat size={12} className="text-orange-400"/><p className="text-xs text-orange-400 font-medium">Gasto recurrente</p>
              </div>
            )}
          </div>

          {/* Recategorize */}
          <div className="px-5 pb-4">
            <button onClick={()=>setShowCatModal(true)} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{background:'var(--blue)',color:'#fff',opacity:saving?0.6:1}}>
              <Tag size={14}/> {saving?'Guardando…':'Cambiar categoría'}
            </button>
          </div>

          {/* Merchant history */}
          {sameMerch.length > 0 && (
            <div className="mx-5 mb-5 rounded-2xl overflow-hidden" style={{background:'var(--bg-card2)',border:'1px solid var(--border2)'}}>
              <div className="px-4 py-3 border-b" style={{borderColor:'var(--border)'}}>
                <p className="text-xs font-semibold text-white">{tx.merchant}</p>
                <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>
                  {sameMerch.length+1} veces · Total {S0(merchantTotal)}
                </p>
              </div>
              <div className="divide-y max-h-48 overflow-y-auto" style={{borderColor:'var(--border)'}}>
                {sameMerch.slice(0,12).map((t,i)=>(
                  <div key={i} className="flex items-center justify-between px-4 py-2">
                    <span className="text-xs" style={{color:'var(--text-3)'}}>{t.date?.slice(0,10)}</span>
                    <span className="text-xs font-medium num text-white">{S(Number(t.amount_pen||t.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Filter Chip ──────────────────────────────────────────────────────────────
function Chip({ active, label, icon, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap"
      style={{
        background: active ? 'var(--blue)' : 'var(--bg-card2)',
        border: `1px solid ${active ? 'var(--blue)' : 'var(--border2)'}`,
        color: active ? '#fff' : 'var(--text-2)'
      }}>
      {icon && <span>{icon}</span>}
      {label}
    </button>
  )
}

// ── Summary Bar ──────────────────────────────────────────────────────────────
function SummaryBar({ transactions }) {
  const gastos = transactions.filter(t=>t.type==='gasto').reduce((s,t)=>s+Number(t.amount_pen||t.amount),0)
  const ingresos = transactions.filter(t=>t.type==='ingreso').reduce((s,t)=>s+Number(t.amount_pen||t.amount),0)
  const usd = transactions.filter(t=>t.currency==='USD'&&t.type==='gasto').reduce((s,t)=>s+Number(t.amount),0)
  const count = transactions.length
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-wrap" style={{borderColor:'var(--border)',background:'var(--bg-card2)'}}>
      <span className="text-xs font-semibold num text-green-400">+{S0(ingresos)}</span>
      <span style={{color:'var(--text-3)'}}>·</span>
      <span className="text-xs font-semibold num text-red-400">−{S0(gastos)}</span>
      {usd > 0 && <><span style={{color:'var(--text-3)'}}>·</span><span className="text-xs px-1.5 py-0.5 rounded-full num" style={{background:'rgba(234,179,8,0.15)',color:'#fbbf24'}}>${usd.toFixed(0)} USD</span></>}
      <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{background:'var(--border)',color:'var(--text-3)'}}>{count} movs</span>
    </div>
  )
}

function TransactionsInner() {
  const [allTx, setAllTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState('2026-05')
  const [typeFilter, setTypeFilter] = useState('all') // all|gasto|ingreso|transferencia
  const [bankFilter, setBankFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('')
  const [currFilter, setCurrFilter] = useState('all') // all|USD|PEN
  const [recurFilter, setRecurFilter] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date') // date|amount
  const [selectedTx, setSelectedTx] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { loadTx() }, [monthFilter])

  async function loadTx() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit:'900', source:'eecc' })
      if (monthFilter) params.set('month', monthFilter)
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      setAllTx(data.transactions || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const banks = useMemo(() => [...new Set(allTx.map(t=>t.bank).filter(Boolean))].sort(), [allTx])
  const categories = useMemo(() => [...new Set(allTx.map(t=>t.category).filter(Boolean))].sort(), [allTx])

  const filtered = useMemo(() => {
    let list = allTx
    if (typeFilter !== 'all') list = list.filter(t => t.type === typeFilter)
    if (bankFilter !== 'all') list = list.filter(t => t.bank === bankFilter)
    if (catFilter) list = list.filter(t => t.category === catFilter)
    if (currFilter !== 'all') list = list.filter(t => t.currency === currFilter)
    if (recurFilter) list = list.filter(t => t.is_recurring)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        (t.merchant||'').toLowerCase().includes(q) ||
        (t.description||'').toLowerCase().includes(q) ||
        (t.category||'').toLowerCase().includes(q) ||
        (t.bank||'').toLowerCase().includes(q))
    }
    if (sortBy === 'amount') list = [...list].sort((a,b)=>Number(b.amount_pen||b.amount)-Number(a.amount_pen||a.amount))
    return list
  }, [allTx, typeFilter, bankFilter, catFilter, currFilter, recurFilter, search, sortBy])

  // Group by date
  const grouped = useMemo(() => {
    const groups = {}
    filtered.slice(0,400).forEach(t => {
      const d = t.date?.slice(0,10) || 'Sin fecha'
      if (!groups[d]) groups[d] = []
      groups[d].push(t)
    })
    return Object.entries(groups).sort(([a],[b]) => b.localeCompare(a))
  }, [filtered])

  const activeFiltersCount = [typeFilter!=='all',bankFilter!=='all',!!catFilter,currFilter!=='all',recurFilter].filter(Boolean).length

  function clearFilters() {
    setTypeFilter('all'); setBankFilter('all'); setCatFilter(''); setCurrFilter('all'); setRecurFilter(false)
  }

  function handleReclassify(newCat, applyAll, merchant) {
    setAllTx(prev => prev.map(t => {
      if (applyAll && merchant && t.merchant === merchant) return {...t, category: newCat}
      if (!applyAll && t.id === selectedTx?.id) return {...t, category: newCat}
      return t
    }))
    if (selectedTx) setSelectedTx(prev => ({...prev, category: newCat}))
    setToast(`✅ Categoría actualizada → ${newCat}`)
    setTimeout(() => setToast(null), 3000)
  }

  // Format date header
  function fmtDateHeader(d) {
    const today = new Date().toISOString().slice(0,10)
    const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10)
    if (d === today) return 'Hoy'
    if (d === yesterday) return 'Ayer'
    const dt = new Date(d + 'T12:00:00')
    return dt.toLocaleDateString('es-PE', {weekday:'short',day:'numeric',month:'short'}).replace(/^\w/,c=>c.toUpperCase())
  }

  function fmtDateTotal(txs) {
    const total = txs.filter(t=>t.type==='gasto').reduce((s,t)=>s+Number(t.amount_pen||t.amount),0)
    return total > 0 ? `−${S0(total)}` : ''
  }

  return (
    <div className="h-full flex flex-col" style={{background:'var(--bg-base)'}}>

      {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm text-white shadow-lg" style={{background:'#059669'}}>{toast}</div>}
      {selectedTx && <TxDetail tx={selectedTx} allTx={allTx} onClose={()=>setSelectedTx(null)} onReclassify={handleReclassify}/>}

      {/* ── Header ── */}
      <div className="border-b sticky top-0 z-20" style={{background:'var(--bg-card)',borderColor:'var(--border)'}}>
        <div className="flex items-center gap-2 px-4 py-3">
          <h1 className="text-base font-bold text-white flex-shrink-0">Transacciones</h1>

          {/* Month selector */}
          <div className="relative ml-1">
            <select value={monthFilter} onChange={e=>{setMonthFilter(e.target.value)}}
              className="text-xs pl-2.5 pr-6 py-1.5 rounded-xl appearance-none font-medium"
              style={{background:'var(--bg-card2)',border:'1px solid var(--border)',color:'var(--text-1)'}}>
              {MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:'var(--text-3)'}}/>
          </div>

          <div className="flex-1"/>

          {/* Filter toggle */}
          <button onClick={()=>setShowFilters(f=>!f)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{background:showFilters||activeFiltersCount>0?'var(--blue)':'var(--bg-card2)',border:`1px solid ${showFilters||activeFiltersCount>0?'var(--blue)':'var(--border)'}`,color:showFilters||activeFiltersCount>0?'#fff':'var(--text-2)'}}>
            <Filter size={11}/>
            Filtros
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold" style={{background:'#fff',color:'var(--blue)'}}>{activeFiltersCount}</span>
            )}
          </button>

          {/* Sort */}
          <button onClick={()=>setSortBy(s=>s==='date'?'amount':'date')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs"
            style={{background:'var(--bg-card2)',border:'1px solid var(--border)',color:'var(--text-2)'}}>
            <ArrowUpDown size={10}/> {sortBy==='date'?'Fecha':'Monto'}
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-3)'}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Buscar comercio, categoría, banco…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-xl"
              style={{background:'var(--bg-card2)',border:'1px solid var(--border2)',color:'var(--text-1)'}}/>
            {search && <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={12} style={{color:'var(--text-3)'}}/></button>}
          </div>
        </div>

        {/* ── Filter Panel ── */}
        {showFilters && (
          <div className="px-4 pb-3 border-t space-y-2.5" style={{borderColor:'var(--border)'}}>
            {/* Type */}
            <div>
              <p className="text-xs font-medium mb-1.5" style={{color:'var(--text-3)'}}>Tipo</p>
              <div className="flex gap-1.5 flex-wrap">
                {[{v:'all',l:'Todos'},{v:'gasto',l:'Gastos',icon:'↓'},{v:'ingreso',l:'Ingresos',icon:'↑'},{v:'transferencia',l:'Transferencias',icon:'↔'}].map(o=>(
                  <Chip key={o.v} active={typeFilter===o.v} label={o.l} icon={o.icon} onClick={()=>setTypeFilter(o.v)}/>
                ))}
              </div>
            </div>
            {/* Bank */}
            <div>
              <p className="text-xs font-medium mb-1.5" style={{color:'var(--text-3)'}}>Banco / Tarjeta</p>
              <div className="flex gap-1.5 flex-wrap">
                <Chip active={bankFilter==='all'} label="Todos" onClick={()=>setBankFilter('all')}/>
                {banks.map(b=>(
                  <Chip key={b} active={bankFilter===b} label={b} icon={<Building2 size={9}/>} onClick={()=>setBankFilter(b===bankFilter?'all':b)}/>
                ))}
              </div>
            </div>
            {/* Category */}
            <div>
              <p className="text-xs font-medium mb-1.5" style={{color:'var(--text-3)'}}>Categoría</p>
              <div className="relative">
                <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
                  className="w-full text-xs pl-3 pr-7 py-2 rounded-xl appearance-none"
                  style={{background:'var(--bg-card2)',border:'1px solid var(--border2)',color:'var(--text-1)'}}>
                  <option value="">Todas las categorías</option>
                  {categories.map(c=><option key={c} value={c}>{TX_ICON[c]||'📋'} {c}</option>)}
                </select>
                <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:'var(--text-3)'}}/>
              </div>
            </div>
            {/* Extra chips */}
            <div className="flex gap-1.5">
              <Chip active={currFilter==='USD'} label="Solo USD" icon={<DollarSign size={9}/>} onClick={()=>setCurrFilter(c=>c==='USD'?'all':'USD')}/>
              <Chip active={recurFilter} label="Recurrentes" icon={<Repeat size={9}/>} onClick={()=>setRecurFilter(r=>!r)}/>
              {activeFiltersCount > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs" style={{color:'#f87171'}}>
                  <X size={9}/> Limpiar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        <SummaryBar transactions={filtered}/>
      </div>

      {/* ── Transaction List grouped by date ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16" style={{color:'var(--text-3)'}}>
          <Search size={40} className="mb-3 opacity-30"/>
          <p className="text-sm font-medium">Sin movimientos</p>
          <p className="text-xs mt-1">Prueba cambiando los filtros</p>
          {activeFiltersCount>0 && <button onClick={clearFilters} className="mt-3 text-xs text-blue-400 underline">Limpiar filtros</button>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {grouped.map(([date, txs]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center justify-between px-4 py-2 sticky top-0" style={{background:'var(--bg-base)',borderBottom:'1px solid var(--border)'}}>
                <span className="text-xs font-semibold" style={{color:'var(--text-3)'}}>{fmtDateHeader(date)}</span>
                <span className="text-xs font-semibold" style={{color:'var(--text-3)'}}>{fmtDateTotal(txs)}</span>
              </div>
              {/* Transactions for this date */}
              <div className="divide-y" style={{borderColor:'var(--border)'}}>
                {txs.map((t,i) => {
                  const isGasto = t.type==='gasto'
                  const isIngreso = t.type==='ingreso'
                  const color = CAT_CLR[t.category]||'#64748b'
                  return (
                    <button key={t.id||i} onClick={()=>setSelectedTx(t)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg"
                        style={{background:color+'18'}}>
                        {TX_ICON[t.category]||'📋'}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate" style={{color:'var(--text-1)'}}>
                            {t.merchant||t.description?.slice(0,30)||'—'}
                          </p>
                          {t.is_recurring && <Repeat size={10} className="flex-shrink-0" style={{color:'#f97316'}}/>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                            style={{background:color+'18',color,fontSize:'10px'}}>
                            {t.category||'—'}
                          </span>
                          <span className="text-xs" style={{color:'var(--text-3)',fontSize:'11px'}}>{t.bank}</span>
                          {t.currency==='USD' && <span className="text-xs px-1 rounded" style={{background:'rgba(234,179,8,0.15)',color:'#fbbf24',fontSize:'9px'}}>USD</span>}
                        </div>
                      </div>
                      {/* Amount */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold num ${isIngreso?'text-green-400':isGasto?'text-white':'text-blue-400'}`}>
                          {isIngreso?'+':isGasto?'−':'↔'}{S(Number(t.amount_pen||t.amount))}
                        </p>
                        {t.currency==='USD' && <p className="text-xs num" style={{color:'var(--text-3)'}}>${Number(t.amount).toFixed(2)}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {filtered.length > 400 && (
            <div className="py-4 text-center text-xs" style={{color:'var(--text-3)'}}>
              Mostrando 400 de {filtered.length} movimientos
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TransactionsPage() {
  return <Suspense><TransactionsInner/></Suspense>
}

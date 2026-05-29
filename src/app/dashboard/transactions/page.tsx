'use client'
import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, X, Repeat, ChevronDown, ArrowUpDown, Calendar, Tag, Building2, ExternalLink } from 'lucide-react'

const S = (n: number) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n || 0)}`
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

const MONTHS = [
  { v:'', l:'Todos los meses' }, { v:'2026-04', l:'Abril 2026' },
  { v:'2026-03', l:'Marzo 2026' }, { v:'2026-02', l:'Febrero 2026' },
]

function TransactionDetail({ tx, onClose, allTx }: { tx: any, onClose: () => void, allTx: any[] }) {
  const sameMerch = allTx.filter(t => t.merchant === tx.merchant && t.id !== tx.id && t.type === tx.type)
  const totalSameMerch = sameMerch.reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-sm h-full overflow-y-auto animate-slide" style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b sticky top-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', zIndex: 1 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: (CAT_CLR[tx.category] || '#64748b') + '20' }}>
              {TX_ICONS[tx.category] || '📋'}
            </div>
            <div>
              <p className="font-semibold text-white truncate max-w-[180px]">{tx.merchant || tx.description?.slice(0, 30)}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{tx.date?.slice(0, 10)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={16} style={{ color: 'var(--text-3)' }}/>
          </button>
        </div>

        {/* Amount */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Monto</p>
          <p className={`text-3xl font-bold num ${tx.type === 'ingreso' ? 'text-green-400' : tx.type === 'transferencia' ? 'text-blue-400' : 'text-white'}`}>
            {tx.type === 'ingreso' ? '+' : tx.type === 'gasto' ? '−' : '↔'}{S(Number(tx.amount))}
          </p>
          <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-3)' }}>{tx.type} · {tx.currency}</p>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          {[
            { icon: <Tag size={13}/>, label: 'Categoría', value: tx.category || '—', color: CAT_CLR[tx.category] },
            { icon: <Building2 size={13}/>, label: 'Banco', value: tx.bank || '—' },
            { icon: <Calendar size={13}/>, label: 'Fecha', value: tx.date?.slice(0, 10) || '—' },
            { icon: null, label: 'Descripción', value: tx.description || '—' },
            { icon: null, label: 'Fuente', value: tx.source === 'eecc' ? 'Estado de Cuenta' : 'Gmail' },
          ].map(({ icon, label, value, color }, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: 'var(--text-3)', minWidth: 80 }}>
                {icon}
                <span className="text-xs">{label}</span>
              </div>
              <span className="text-sm text-right font-medium" style={{ color: color || 'var(--text-1)' }}>{value}</span>
            </div>
          ))}

          {tx.is_recurring && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-1" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <Repeat size={12} className="text-orange-400 flex-shrink-0"/>
              <div>
                <p className="text-xs font-medium text-orange-400">Gasto Fijo</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{tx.recurring_label || 'Recurrente mensual'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Same merchant */}
        {sameMerch.length > 0 && (
          <div className="mx-5 mb-5">
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                  {tx.merchant ? `Otros en ${tx.merchant}` : 'Transacciones similares'} ({sameMerch.length})
                </p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Total histórico: {S(totalSameMerch + Number(tx.amount))}</p>
              </div>
              <div className="divide-y max-h-48 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                {sameMerch.slice(0, 8).map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2">
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>{t.date?.slice(0, 10)}</span>
                    <span className={`text-xs font-medium num ${t.type === 'gasto' ? 'text-white' : 'text-green-400'}`}>
                      {t.type === 'ingreso' ? '+' : '-'}{S(Number(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
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
  const preselId = searchParams.get('id')

  const [allTx, setAllTx] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('2026-04')
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('')
  const [showRecurring, setShowRecurring] = useState(false)
  const [selectedTx, setSelectedTx] = useState<any>(null)
  const [sortBy, setSortBy] = useState<'date'|'amount'>('date')

  useEffect(() => { loadTx() }, [monthFilter])

  useEffect(() => {
    if (preselId && allTx.length > 0) {
      const found = allTx.find(t => t.id === preselId)
      if (found) setSelectedTx(found)
    }
  }, [preselId, allTx])

  async function loadTx() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500', currency: 'PEN', source: 'eecc' })
      if (monthFilter) params.set('month', monthFilter)
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      setAllTx(data.transactions || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const categories = useMemo(() => [...new Set(allTx.map(t => t.category).filter(Boolean))].sort(), [allTx])

  const filtered = useMemo(() => {
    let list = allTx
    if (typeFilter !== 'all') list = list.filter(t => t.type === typeFilter)
    if (catFilter) list = list.filter(t => t.category === catFilter)
    if (showRecurring) list = list.filter(t => t.is_recurring)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t => (t.merchant||'').toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q))
    }
    if (sortBy === 'amount') list = [...list].sort((a, b) => Number(b.amount) - Number(a.amount))
    return list
  }, [allTx, typeFilter, catFilter, search, showRecurring, sortBy])

  const totals = useMemo(() => ({
    gastos: filtered.filter(t => t.type === 'gasto').reduce((s, t) => s + Number(t.amount), 0),
    ingresos: filtered.filter(t => t.type === 'ingreso').reduce((s, t) => s + Number(t.amount), 0),
  }), [filtered])

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-white">Transacciones</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-400 font-semibold num">+{S(totals.ingresos)}</span>
            <span style={{ color: 'var(--text-3)' }}>·</span>
            <span className="text-red-400 font-semibold num">-{S(totals.gastos)}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-3)' }}>
              {filtered.length}
            </span>
          </div>
        </div>

        {/* Filters row 1 */}
        <div className="flex flex-wrap gap-2 mb-2">
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl num"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-1)' }}>
            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          {(['all','gasto','ingreso','transferencia'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="text-xs px-3 py-1.5 rounded-xl font-medium transition-colors"
              style={{ background: typeFilter === t ? 'var(--blue)' : 'var(--bg-card2)', color: typeFilter === t ? '#fff' : 'var(--text-2)', border: `1px solid ${typeFilter === t ? 'var(--blue)' : 'var(--border2)'}` }}>
              {t === 'all' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button onClick={() => setSortBy(s => s === 'date' ? 'amount' : 'date')}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-2)' }}>
            <ArrowUpDown size={11}/> {sortBy === 'date' ? 'Por fecha' : 'Por monto'}
          </button>
        </div>

        {/* Filters row 2 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar comercio, categoría..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-1)' }}/>
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={12} style={{ color: 'var(--text-3)' }}/></button>}
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-xl"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)', color: 'var(--text-1)' }}>
            <option value="">Categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => setShowRecurring(!showRecurring)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl transition-colors"
            style={{ background: showRecurring ? 'rgba(249,115,22,0.2)' : 'var(--bg-card2)', border: `1px solid ${showRecurring ? '#f97316' : 'var(--border2)'}`, color: showRecurring ? '#f97316' : 'var(--text-2)' }}>
            <Repeat size={11}/> Fijos
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <p className="text-2xl">🔍</p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Sin resultados</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.slice(0, 300).map((t, i) => (
                <button key={t.id || i} onClick={() => setSelectedTx(t)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.02]">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-base"
                    style={{ background: (CAT_CLR[t.category] || '#64748b') + '20' }}>
                    {TX_ICONS[t.category] || '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
                        {t.merchant || t.description?.slice(0, 30) || '—'}
                      </p>
                      {t.is_recurring && <Repeat size={10} className="flex-shrink-0" style={{ color: '#f97316' }}/>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: (CAT_CLR[t.category] || '#64748b') + '20', color: CAT_CLR[t.category] || '#94a3b8', fontSize: '10px' }}>
                        {t.category || 'Otros'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{t.date?.slice(5, 10)} · {t.bank}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold num ${t.type === 'ingreso' ? 'text-green-400' : t.type === 'transferencia' ? 'text-blue-400' : 'text-white'}`}>
                      {t.type === 'ingreso' ? '+' : t.type === 'gasto' ? '−' : '↔'}{S(Number(t.amount))}
                    </p>
                  </div>
                </button>
              ))}
              {filtered.length > 300 && (
                <div className="px-5 py-3 text-center text-xs" style={{ color: 'var(--text-3)' }}>
                  Mostrando 300 de {filtered.length} · Ajusta los filtros para ver más
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      {selectedTx && (
        <TransactionDetail tx={selectedTx} onClose={() => { setSelectedTx(null); router.replace('/dashboard/transactions') }} allTx={allTx}/>
      )}
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsInner/>
    </Suspense>
  )
}

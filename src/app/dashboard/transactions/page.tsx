'use client'
import { useEffect, useState, useMemo } from 'react'
import { Search, Download, Filter, Repeat, Calendar } from 'lucide-react'

const CAT_COLORS: Record<string, string> = {
  'Seguros':'#f97316','Deudas':'#ef4444','Delivery':'#fb923c','Restaurantes':'#f59e0b',
  'Transporte':'#3b82f6','Supermercados':'#84cc16','Entretenimiento':'#8b5cf6',
  'Servicios':'#eab308','Transferencias':'#64748b','Alquiler':'#0ea5e9',
  'Suscripciones':'#ec4899','Mascotas':'#14b8a6','Viajes':'#a78bfa',
  'Sueldo':'#22c55e','Tecnología':'#06b6d4','Compras':'#f43f5e','Otros':'#94a3b8',
}
function fmt(n: number) { return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0) }

const MONTHS = [
  { value: '', label: 'Todos los meses' },
  { value: '2026-04', label: 'Abril 2026' },
  { value: '2026-03', label: 'Marzo 2026' },
  { value: '2026-02', label: 'Febrero 2026' },
  { value: '2026-01', label: 'Enero 2026' },
]

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'gasto' | 'ingreso' | 'transferencia'>('all')
  const [monthFilter, setMonthFilter] = useState('2026-04')
  const [catFilter, setCatFilter] = useState('')
  const [showRecurring, setShowRecurring] = useState(false)

  useEffect(() => { loadTransactions() }, [monthFilter])

  async function loadTransactions() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500', currency: 'PEN', source: 'eecc' })
      if (monthFilter) params.set('month', monthFilter)
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      setTransactions(data.transactions || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const categories = useMemo(() => {
    const set = new Set(transactions.map(t => t.category).filter(Boolean))
    return Array.from(set).sort()
  }, [transactions])

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false
      if (catFilter && tx.category !== catFilter) return false
      if (showRecurring && !tx.is_recurring) return false
      const q = search.toLowerCase()
      if (q && !(tx.merchant || '').toLowerCase().includes(q) && !(tx.description || '').toLowerCase().includes(q) && !(tx.category || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [transactions, typeFilter, catFilter, search, showRecurring])

  const totalGastos = filtered.filter(t => t.type === 'gasto').reduce((s, t) => s + Number(t.amount), 0)
  const totalIngresos = filtered.filter(t => t.type === 'ingreso').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transacciones</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="text-green-600 font-semibold">+S/{fmt(totalIngresos)}</span>
          <span>|</span>
          <span className="text-red-600 font-semibold">-S/{fmt(totalGastos)}</span>
          <span className="text-gray-400">({filtered.length})</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 mb-4 border border-gray-100 dark:border-gray-700 space-y-2">
        <div className="flex flex-wrap gap-2">
          {/* Mes */}
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          {/* Tipo */}
          {(['all', 'gasto', 'ingreso', 'transferencia'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${typeFilter === t ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {t === 'all' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}

          {/* Categoría */}
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Fijos */}
          <button onClick={() => setShowRecurring(!showRecurring)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${showRecurring ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
            <Repeat size={13}/> Solo fijos
          </button>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar comercio, descripción o categoría..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"/>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"/>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filtered.slice(0, 200).map((tx, i) => (
              <div key={tx.id || i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                {/* Dot */}
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[tx.category] || '#94a3b8' }}/>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {tx.merchant || tx.description?.slice(0, 30) || '—'}
                    </p>
                    {tx.is_recurring && <Repeat size={10} className="text-orange-400 flex-shrink-0"/>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded-full text-white text-opacity-90"
                      style={{ backgroundColor: (CAT_COLORS[tx.category] || '#94a3b8') + 'cc' }}>
                      {tx.category || 'Otros'}
                    </span>
                    <span className="text-xs text-gray-400">{tx.bank}</span>
                    <span className="text-xs text-gray-400">{tx.date?.slice(0, 10)}</span>
                  </div>
                </div>

                {/* Monto */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${
                    tx.type === 'ingreso' ? 'text-green-600' : tx.type === 'transferencia' ? 'text-blue-500' : 'text-gray-900 dark:text-white'
                  }`}>
                    {tx.type === 'ingreso' ? '+' : tx.type === 'gasto' ? '-' : '↔'} S/{fmt(Number(tx.amount))}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{tx.type}</p>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg">No hay transacciones</p>
                <p className="text-sm mt-1">Ajusta los filtros</p>
              </div>
            )}
            {filtered.length > 200 && (
              <div className="text-center py-3 text-xs text-gray-400">
                Mostrando 200 de {filtered.length} transacciones
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

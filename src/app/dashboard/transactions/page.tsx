'use client'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

const CAT_COLORS: Record<string,string> = {
  'Restaurantes':'#f97316','Supermercados':'#84cc16','Alimentación':'#fb923c','Transporte':'#3b82f6',
  'Salud':'#10b981','Entretenimiento':'#8b5cf6','Compras':'#f43f5e','Servicios':'#eab308',
  'Educación':'#06b6d4','Vivienda':'#64748b','Suscripciones':'#ec4899','Viajes':'#f59e0b','Deudas':'#ef4444','Otros':'#94a3b8',
}
function fmt(n: number) { return new Intl.NumberFormat('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0) }

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all'|'gasto'|'ingreso'>('all')

  useEffect(() => { loadTransactions() }, [])

  async function loadTransactions() {
    setLoading(true)
    try { const res = await fetch('/api/transactions?limit=500'); const data = await res.json(); setTransactions(data.transactions||[]) } catch(e){console.error(e)}
    setLoading(false)
  }

  const filtered = transactions.filter(tx => {
    const matchFilter = filter==='all'||tx.type===filter
    const q = search.toLowerCase()
    const matchSearch = !q||(tx.merchant||'').toLowerCase().includes(q)||(tx.description||'').toLowerCase().includes(q)||(tx.category||'').toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const totalGastos = filtered.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0)
  const totalIngresos = filtered.filter(t=>t.type==='ingreso').reduce((s,t)=>s+t.amount,0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Transacciones</h1>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="text-rose-400">-S/ {fmt(totalGastos)}</span>
          <span>/</span>
          <span className="text-emerald-400">+S/ {fmt(totalIngresos)}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por comercio, categoría..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-slate-600" />
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
          {(['all','gasto','ingreso'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter===f?'bg-slate-700 text-white':'text-slate-400 hover:text-slate-200'}`}>
              {f==='all'?'Todos':f==='gasto'?'Gastos':'Ingresos'}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      ) : filtered.length===0 ? (
        <div className="text-center py-12 text-slate-500"><p>No hay transacciones.</p><p className="text-xs mt-1">Sincroniza Gmail o importa un EECC.</p></div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {filtered.map((tx,i)=>(
            <div key={tx.id} className={`flex items-center gap-4 px-5 py-4 ${i<filtered.length-1?'border-b border-slate-800':''}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${tx.type==='ingreso'?'bg-emerald-500/20 text-emerald-400':'bg-rose-500/20 text-rose-400'}`}>
                {tx.type==='ingreso'?'+':'-'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-sm font-medium truncate">{tx.merchant||tx.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{background:`${CAT_COLORS[tx.category||'Otros']}20`,color:CAT_COLORS[tx.category||'Otros']}}>
                    {tx.category||'Otros'}
                  </span>
                  <span className="text-slate-500 text-xs">{tx.source}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`font-bold ${tx.type==='ingreso'?'text-emerald-400':'text-slate-200'}`}>
                  {tx.type==='ingreso'?'+':'-'}S/ {fmt(tx.amount)}
                </p>
                <p className="text-slate-500 text-xs">{tx.date?new Date(tx.date).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'2-digit'}):''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

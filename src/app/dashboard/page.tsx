'use client'
import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, AlertTriangle, Repeat, Wallet, CreditCard, ChevronDown, ChevronUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import Link from 'next/link'

// ── Colores por categoría ───────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  'Seguros':       '#f97316', // naranja
  'Deudas':        '#ef4444', // rojo
  'Delivery':      '#fb923c', // naranja claro
  'Restaurantes':  '#f59e0b', // ámbar
  'Transporte':    '#3b82f6', // azul
  'Supermercados': '#84cc16', // verde
  'Entretenimiento':'#8b5cf6',// violeta
  'Servicios':     '#eab308', // amarillo
  'Transferencias':'#64748b', // gris
  'Alquiler':      '#0ea5e9', // celeste
  'Suscripciones': '#ec4899', // rosa
  'Mascotas':      '#14b8a6', // teal
  'Viajes':        '#a78bfa', // lila
  'Hogar':         '#6366f1', // índigo
  'Tecnología':    '#06b6d4', // cian
  'Compras':       '#f43f5e', // rosa fuerte
  'Sueldo':        '#22c55e', // verde
  'Otros':         '#94a3b8', // gris
}

function fmtS(n: number) { return `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0)}` }
function fmtN(n: number) { return new Intl.NumberFormat('es-PE',{minimumFractionDigits:0,maximumFractionDigits:0}).format(n||0) }

const MONTHS = ['2026-02','2026-03','2026-04']
const MONTH_LABELS: Record<string,string> = {'2026-02':'Feb 26','2026-03':'Mar 26','2026-04':'Abr 26'}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [txAll, setTxAll] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{text:string;ok:boolean}|null>(null)
  const [selMonth, setSelMonth] = useState('2026-04')
  const [showFixedDetail, setShowFixedDetail] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [txRes, cardsRes, debtsRes] = await Promise.all([
        fetch('/api/transactions?limit=1000&currency=PEN').then(r=>r.json()),
        fetch('/api/cards').then(r=>r.json()),
        fetch('/api/debts').then(r=>r.json()),
      ])
      setTxAll(txRes.transactions||[])
      setCards(cardsRes.cards||[])
      setDebts(debtsRes.debts||[])
    } catch(e){console.error(e)}
    setLoading(false)
  }

  async function syncGmail() {
    setSyncing(true); setSyncMsg(null)
    try {
      const res = await fetch('/api/gmail',{method:'POST'})
      const data = await res.json()
      setSyncMsg({text: data.message||(data.error?'Error: '+data.error:'Listo'), ok:!!data.success})
      if(data.success) loadAll()
    } catch { setSyncMsg({text:'Error de conexión',ok:false}) }
    setSyncing(false)
  }

  // ── Transacciones del mes seleccionado ──
  const txMonth = useMemo(()=> txAll.filter(t => t.date?.startsWith(selMonth) && t.source === 'eecc'), [txAll, selMonth])
  const gastos = txMonth.filter(t=>t.type==='gasto')
  const ingresos = txMonth.filter(t=>t.type==='ingreso')
  const totalGastos = gastos.reduce((s,t)=>s+Number(t.amount),0)
  const totalIngresos = ingresos.reduce((s,t)=>s+Number(t.amount),0)
  const balance = totalIngresos - totalGastos

  // ── Gastos fijos del mes ──
  const gastosFixos = txMonth.filter(t=>t.is_recurring && t.type==='gasto')
  const totalFijos = gastosFixos.reduce((s,t)=>s+Number(t.amount),0)
  const gastosVariables = totalGastos - totalFijos

  // ── Sueldo neto disponible ──
  const sueldo = ingresos.filter(t=>t.category==='Sueldo').reduce((s,t)=>s+Number(t.amount),0)
  const ratioFijos = sueldo > 0 ? (totalFijos/sueldo)*100 : 0
  const ratioTotal = sueldo > 0 ? (totalGastos/sueldo)*100 : 0

  // ── Por categoría ──
  const byCat: Record<string,number> = {}
  gastos.forEach(t=>{ const c=t.category||'Otros'; byCat[c]=(byCat[c]||0)+Number(t.amount) })
  const pieData = Object.entries(byCat)
    .map(([name,value])=>({name,value:Math.round(value)}))
    .sort((a,b)=>b.value-a.value)
    .slice(0,8)

  // ── Histórico mensual (eecc) ──
  const monthlyData = MONTHS.map(m => {
    const txM = txAll.filter(t => t.date?.startsWith(m) && t.source === 'eecc')
    const g = txM.filter(t=>t.type==='gasto').reduce((s,t)=>s+Number(t.amount),0)
    const i = txM.filter(t=>t.type==='ingreso').reduce((s,t)=>s+Number(t.amount),0)
    const fijos = txM.filter(t=>t.is_recurring && t.type==='gasto').reduce((s,t)=>s+Number(t.amount),0)
    return { month: MONTH_LABELS[m]||m, gastos: Math.round(g), ingresos: Math.round(i), fijos: Math.round(fijos) }
  })

  // ── Top merchants ──
  const byMerch: Record<string,number> = {}
  gastos.filter(t=>t.merchant).forEach(t=>{ byMerch[t.merchant!]=(byMerch[t.merchant!]||0)+Number(t.amount) })
  const topMerch = Object.entries(byMerch).sort(([,a],[,b])=>b-a).slice(0,6)

  // ── Deuda total ──
  const totalDeudaTarjetas = cards.reduce((s,c)=>s+(Number(c.current_balance)||0),0)
  const totalDeudaPrestamos = debts.reduce((s,d)=>s+(Number(d.current_balance)||0),0)
  const totalDeuda = totalDeudaTarjetas + totalDeudaPrestamos

  // ── Gastos fijos agrupados ──
  const fixedGroups: Record<string,number> = {}
  gastosFixos.forEach(t => {
    const label = t.recurring_label || t.category || 'Otro'
    fixedGroups[label] = (fixedGroups[label]||0) + Number(t.amount)
  })
  const fixedList = Object.entries(fixedGroups).sort(([,a],[,b])=>b-a)

  if(loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Cargando Copiloto Financiero...</p>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Copiloto Financiero</h1>
          <p className="text-sm text-gray-500">Hola, Gian Carlo 👋</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Selector de mes */}
          <div className="flex gap-1">
            {MONTHS.map(m=>(
              <button key={m} onClick={()=>setSelMonth(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selMonth===m ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                {MONTH_LABELS[m]}
              </button>
            ))}
          </div>
          <button onClick={syncGmail} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
            <RefreshCw size={14} className={syncing?'animate-spin':''}/>
            {syncing?'Sincronizando...':'Sync Gmail'}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`p-3 rounded-xl text-sm font-medium ${syncMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {syncMsg.text}
        </div>
      )}

      {/* ── KPIs principales ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Ingresos</span>
            <TrendingUp size={16} className="text-green-500"/>
          </div>
          <p className="text-2xl font-bold text-green-600">{fmtS(totalIngresos)}</p>
          <p className="text-xs text-gray-400 mt-1">Sueldo: {fmtS(sueldo)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Gastos</span>
            <TrendingDown size={16} className="text-red-500"/>
          </div>
          <p className="text-2xl font-bold text-red-600">{fmtS(totalGastos)}</p>
          <p className={`text-xs mt-1 font-medium ${ratioTotal > 100 ? 'text-red-500' : ratioTotal > 80 ? 'text-orange-500' : 'text-gray-400'}`}>
            {ratioTotal.toFixed(0)}% del sueldo
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Balance</span>
            <DollarSign size={16} className={balance>=0?'text-green-500':'text-red-500'}/>
          </div>
          <p className={`text-2xl font-bold ${balance>=0?'text-green-600':'text-red-600'}`}>{fmtS(balance)}</p>
          <p className="text-xs text-gray-400 mt-1">{balance>=0?'Superávit 🟢':'Déficit 🔴'}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Deuda Total</span>
            <AlertTriangle size={16} className="text-orange-500"/>
          </div>
          <p className="text-2xl font-bold text-orange-600">{fmtS(totalDeuda)}</p>
          <p className="text-xs text-gray-400 mt-1">TC: {fmtS(totalDeudaTarjetas)}</p>
        </div>
      </div>

      {/* ── Gastos Fijos vs Variables ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <Repeat size={18} className="text-blue-500"/>
            <h2 className="font-semibold text-gray-900 dark:text-white">Gastos Fijos vs Variables</h2>
          </div>
          <button onClick={()=>setShowFixedDetail(!showFixedDetail)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            {showFixedDetail ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            {showFixedDetail ? 'Ocultar' : 'Ver detalle'}
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Barra de distribución */}
          <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex">
            {totalGastos > 0 && <>
              <div className="bg-orange-500 h-full transition-all" style={{width:`${(totalFijos/totalGastos)*100}%`}}/>
              <div className="bg-blue-400 h-full transition-all" style={{width:`${(gastosVariables/totalGastos)*100}%`}}/>
            </>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-orange-500"/>
                <span className="text-xs text-orange-700 dark:text-orange-400 font-medium">Gastos Fijos</span>
              </div>
              <p className="text-xl font-bold text-orange-600">{fmtS(totalFijos)}</p>
              <p className="text-xs text-orange-500 mt-0.5">{ratioFijos.toFixed(0)}% del sueldo · {totalGastos>0?((totalFijos/totalGastos)*100).toFixed(0):0}% del total</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-blue-400"/>
                <span className="text-xs text-blue-700 dark:text-blue-400 font-medium">Gastos Variables</span>
              </div>
              <p className="text-xl font-bold text-blue-600">{fmtS(gastosVariables)}</p>
              <p className="text-xs text-blue-500 mt-0.5">{totalGastos>0?((gastosVariables/totalGastos)*100).toFixed(0):0}% del total</p>
            </div>
          </div>

          {showFixedDetail && (
            <div className="space-y-1.5 mt-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Detalle de gastos fijos identificados</p>
              {fixedList.map(([label, amt])=>(
                <div key={label} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmtS(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Gráficos: Pie + Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Distribución de gastos */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Distribución de Gastos</h2>
          <div className="flex gap-3">
            <ResponsiveContainer width="60%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" strokeWidth={1}>
                  {pieData.map((entry,i)=>(
                    <Cell key={i} fill={CAT_COLORS[entry.name]||'#94a3b8'}/>
                  ))}
                </Pie>
                <Tooltip formatter={(v:any)=>[`S/ ${fmtN(v)}`,'Gasto']}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[180px] pr-1">
              {pieData.map((d,i)=>(
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{backgroundColor:CAT_COLORS[d.name]||'#94a3b8'}}/>
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{d.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0">{fmtS(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Histórico mensual */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Comparativo Feb–Abr 2026</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData} barGap={2}>
              <XAxis dataKey="month" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:10}} tickFormatter={(v)=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={(v:any)=>[fmtS(v)]}/>
              <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[3,3,0,0]}/>
              <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[3,3,0,0]}/>
              <Bar dataKey="fijos" name="G.Fijos" fill="#f97316" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top Merchants + Deuda ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top comercios */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
            <Wallet size={15} className="text-blue-500"/>
            Top Comercios — {MONTH_LABELS[selMonth]}
          </h2>
          <div className="space-y-2">
            {topMerch.map(([merch,amt],i)=>{
              const pct = totalGastos > 0 ? (amt/totalGastos)*100 : 0
              return (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{merch}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white ml-2 flex-shrink-0">{fmtS(amt)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                    <div className="h-full rounded-full bg-blue-500" style={{width:`${Math.min(pct,100)}%`}}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Deuda por tarjeta/préstamo */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
            <CreditCard size={15} className="text-red-500"/>
            Deudas Actuales
          </h2>
          <div className="space-y-2">
            {[...cards.filter(c=>Number(c.current_balance)>0).map((c:any)=>({
              name: c.name, balance: Number(c.current_balance), rate: c.tcea||c.tea||0, type:'TC'
            })), ...debts.filter(d=>Number(d.current_balance)>0).map((d:any)=>({
              name: d.name, balance: Number(d.current_balance), rate: d.tea||0, type:'Prest'
            }))].sort((a,b)=>b.balance-a.balance).map((d,i)=>(
              <div key={i} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{d.name}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${d.type==='TC'?'bg-red-100 text-red-600':'bg-orange-100 text-orange-600'}`}>{d.type}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{fmtS(d.balance)}</p>
                  {d.rate > 0 && <p className="text-xs text-gray-400">{d.rate.toFixed(1)}% TEA</p>}
                </div>
              </div>
            ))}
            {totalDeuda > 0 && (
              <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-600 mt-2">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Total Deuda</span>
                <span className="text-sm font-bold text-red-600">{fmtS(totalDeuda)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Alerta deuda/ingreso ── */}
      {sueldo > 0 && ratioTotal > 80 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">⚠️ Ratio deuda/ingreso crítico</p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">
              Tus gastos representan el <strong>{ratioTotal.toFixed(0)}%</strong> de tus ingresos.
              Los compromisos fijos ({ratioFijos.toFixed(0)}%) dejan solo <strong>{fmtS(sueldo - totalFijos)}</strong> libres.
            </p>
          </div>
        </div>
      )}

      {/* ── Link a Copiloto ── */}
      <div className="flex justify-end">
        <Link href="/dashboard/copiloto"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition shadow">
          💬 Preguntarle al Copiloto IA →
        </Link>
      </div>
    </div>
  )
}

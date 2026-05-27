'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Link from 'next/link'
import DebtCenterCard from '@/components/dashboard/DebtCenterCard'
import NetWorthTrendChart from '@/components/charts/NetWorthTrendChart'
import HistoricalCashflowChart from '@/components/charts/HistoricalCashflowChart'

const CAT_COLORS: Record<string, string> = {
'Restaurantes':'#f97316','Supermercados':'#84cc16','Alimentación':'#fb923c','Transporte':'#3b82f6',
'Salud':'#10b981','Entretenimiento':'#8b5cf6','Compras':'#f43f5e','Servicios':'#eab308',
'Educación':'#06b6d4','Vivienda':'#64748b','Suscripciones':'#ec4899','Viajes':'#f59e0b',
'Deudas':'#ef4444','Otros':'#94a3b8',
}
function fmt(n: number) { return new Intl.NumberFormat('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0) }

export default function DashboardPage() {
const { data: session } = useSession()
const [transactions, setTransactions] = useState<any[]>([])
const [cards, setCards] = useState<any[]>([])
const [debts, setDebts] = useState<any[]>([])
const [loading, setLoading] = useState(true)
const [syncing, setSyncing] = useState(false)
const [syncMsg, setSyncMsg] = useState<{text:string;ok:boolean}|null>(null)

useEffect(() => { loadAll() }, [])

async function loadAll() {
setLoading(true)
try {
const [txRes, cardsRes, debtsRes] = await Promise.all([
fetch('/api/transactions?limit=300').then(r=>r.json()),
fetch('/api/cards').then(r=>r.json()),
fetch('/api/debts').then(r=>r.json()),
])
setTransactions(txRes.transactions||[])
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

const thisMonth = new Date().toISOString().slice(0,7)
const prevMonth = new Date(new Date().setMonth(new Date().getMonth()-1)).toISOString().slice(0,7)
const txThis = transactions.filter(t=>t.date?.startsWith(thisMonth))
const txPrev = transactions.filter(t=>t.date?.startsWith(prevMonth))
const gastosEste = txThis.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0)
const gastosAnte = txPrev.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0)
const ingresosEste = txThis.filter(t=>t.type==='ingreso').reduce((s,t)=>s+t.amount,0)
const balanceEste = ingresosEste - gastosEste
const gastoDiario = gastosEste / (new Date().getDate()||1)
const gastosChange = gastosAnte>0 ? ((gastosEste-gastosAnte)/gastosAnte)*100 : 0

const byCat: Record<string,number> = {}
txThis.filter(t=>t.type==='gasto').forEach(t=>{ const c=t.category||'Otros'; byCat[c]=(byCat[c]||0)+t.amount })
const pieData = Object.entries(byCat).map(([name,value])=>({name,value:Math.round(value)})).sort((a,b)=>b.value-a.value).slice(0,7)

const byMonth: Record<string,{g:number;i:number}> = {}
transactions.forEach(t=>{ const m=t.date?.slice(0,7); if(!m) return; if(!byMonth[m]) byMonth[m]={g:0,i:0}; if(t.type==='gasto') byMonth[m].g+=t.amount; else if(t.type==='ingreso') byMonth[m].i+=t.amount })
const barData = Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).slice(-6).map(([month,{g,i}])=>({ month: new Date(month+'-01').toLocaleDateString('es-PE',{month:'short'}), gastos:Math.round(g), ingresos:Math.round(i) }))

const byMerch: Record<string,number> = {}
txThis.filter(t=>t.type==='gasto'&&t.merchant).forEach(t=>{ byMerch[t.merchant!]=(byMerch[t.merchant!]||0)+t.amount })
const topMerch = Object.entries(byMerch).sort(([,a],[,b])=>b-a).slice(0,5)

const totalDeudaTarjetas = cards.reduce((s,c)=>s+(c.current_balance||0),0)
const totalDeudaPrestamos = debts.reduce((s,d)=>s+(d.current_balance||0),0)
const totalDeuda = totalDeudaTarjetas + totalDeudaPrestamos

// Weighted interest for DebtCenterCard
const allDebtsForMetrics = [
...cards.filter(c=>c.current_balance>0).map((c:any)=>({ name: c.name, balance: c.current_balance||0, tea: c.tcea||c.tea||0 })),
...debts.filter(d=>d.current_balance>0).map((d:any)=>({ name: d.name, balance: d.current_balance||0, tea: d.tea||0 })),
]
const totalDebtForCalc = allDebtsForMetrics.reduce((s,d)=>s+d.balance,0)
const weightedInterest = totalDebtForCalc > 0
? allDebtsForMetrics.reduce((s,d)=>s+d.balance*d.tea,0) / totalDebtForCalc
: 0
const monthlyLeakage = allDebtsForMetrics.reduce((s,d)=>s+(d.balance*d.tea)/12/100,0)

// Net worth trend data (last 6 months)
const netWorthData = Object.entries(byMonth)
.sort(([a],[b])=>a.localeCompare(b))
.slice(-6)
.map(([month,{g,i}])=>{
const label = new Date(month+'-01').toLocaleDateString('es-PE',{month:'short',year:'2-digit'})
return { label, netWorth: Math.round(i - g) }
})

// Historical cashflow data (last 6 months)
const cashflowData = Object.entries(byMonth)
.sort(([a],[b])=>a.localeCompare(b))
.slice(-6)
.map(([month,{g,i}])=>({
month: new Date(month+'-01').toLocaleDateString('es-PE',{month:'short'}),
income: Math.round(i),
expenses: Math.round(g),
netCashflow: Math.round(i - g),
}))

if(loading) return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Cargando...</div></div>

return (
<div className="p-6 space-y-6">
<div className="flex items-center justify-between">
<div>
<h1 className="text-xl font-bold text-white">Hola, {session?.user?.name?.split(' ')[0]} 👋</h1>
<p className="text-slate-400 text-sm">{new Date().toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'})}</p>
</div>
<button onClick={syncGmail} disabled={syncing}
className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl border border-slate-700">
<RefreshCw className={`w-4 h-4 ${syncing?'animate-spin':''}`} />
{syncing?'Sincronizando...':'Sincronizar Gmail'}
</button>
</div>

{syncMsg && (
<div className={`px-4 py-3 rounded-xl text-sm ${syncMsg.ok?'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20':'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
{syncMsg.text}
</div>
)}

<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
{[
{label:'Gastos del mes',value:`S/ ${fmt(gastosEste)}`,icon:TrendingDown,color:'rose',sub:gastosAnte>0?`${gastosChange>0?'+':''}${gastosChange.toFixed(0)}% vs mes ant.`:undefined},
{label:'Ingresos del mes',value:`S/ ${fmt(ingresosEste)}`,icon:TrendingUp,color:'emerald'},
{label:'Balance neto',value:`S/ ${fmt(balanceEste)}`,icon:DollarSign,color:balanceEste>=0?'emerald':'rose'},
{label:'Gasto diario prom.',value:`S/ ${fmt(gastoDiario)}`,icon:TrendingDown,color:'amber'},
].map(({label,value,icon:Icon,color,sub})=>(
<div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
<div className="flex items-center justify-between mb-3">
<p className="text-slate-400 text-xs font-medium">{label}</p>
<div className={`w-8 h-8 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
<Icon className={`w-4 h-4 text-${color}-400`} />
</div>
</div>
<p className="text-white text-xl font-bold">{value}</p>
{sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
</div>
))}
</div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
<div className="lg:col-span-2">
<NetWorthTrendChart data={netWorthData} />
</div>
<div>
<DebtCenterCard
totalDebt={totalDeuda}
weightedInterest={weightedInterest}
monthlyLeakage={monthlyLeakage}
/>
</div>
</div>

<HistoricalCashflowChart data={cashflowData} />

<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
<div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
<h2 className="text-white font-semibold mb-4 text-sm">Gastos por categoría</h2>
{pieData.length > 0 ? (
<div className="flex gap-4">
<div className="flex-1">
<ResponsiveContainer width="100%" height={200}>
<PieChart>
<Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
{pieData.map((entry,i)=><Cell key={i} fill={CAT_COLORS[entry.name]||'#94a3b8'} />)}
</Pie>
<Tooltip formatter={(v:any)=>`S/ ${fmt(v)}`} />
</PieChart>
</ResponsiveContainer>
</div>
<div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px]">
{pieData.map(({name,value})=>(
<div key={name} className="flex items-center justify-between text-xs">
<div className="flex items-center gap-1.5">
<div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:CAT_COLORS[name]||'#94a3b8'}} />
<span className="text-slate-300 truncate">{name}</span>
</div>
<span className="text-slate-400 ml-2">S/ {fmt(value)}</span>
</div>
))}
</div>
</div>
) : <p className="text-slate-500 text-xs text-center py-8">Sin gastos este mes</p>}
</div>

<div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
<h2 className="text-white font-semibold mb-4 text-sm">Gastos vs Ingresos (6 meses)</h2>
{barData.length > 0 ? (
<ResponsiveContainer width="100%" height={200}>
<BarChart data={barData}>
<XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false} />
<YAxis tick={{fill:'#94a3b8',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={(v)=>`S/${(v/1000).toFixed(0)}k`} />
<Tooltip formatter={(v:any)=>`S/ ${fmt(v)}`} contentStyle={{background:'#0f172a',border:'1px solid #1e293b',borderRadius:'8px'}} />
<Bar dataKey="gastos" fill="#f43f5e" radius={[4,4,0,0]} name="Gastos" />
<Bar dataKey="ingresos" fill="#10b981" radius={[4,4,0,0]} name="Ingresos" />
</BarChart>
</ResponsiveContainer>
) : <p className="text-slate-500 text-xs text-center py-8">Sin datos aún</p>}
</div>
</div>

{topMerch.length > 0 && (
<div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
<h2 className="text-white font-semibold mb-4 text-sm">Top comercios este mes</h2>
<div className="space-y-2">
{topMerch.map(([name,amount])=>{
const pct = gastosEste>0?(amount/gastosEste)*100:0
return (
<div key={name} className="flex items-center gap-3">
<div className="w-24 text-slate-300 text-xs truncate">{name}</div>
<div className="flex-1 bg-slate-800 rounded-full h-1.5">
<div className="bg-rose-500 h-1.5 rounded-full" style={{width:`${Math.min(pct,100)}%`}} />
</div>
<div className="w-20 text-slate-400 text-xs text-right">S/ {fmt(amount)}</div>
</div>
)
})}
</div>
</div>
)}

<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
<div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
<div className="flex items-center justify-between mb-3">
<h2 className="text-white font-semibold text-sm">Deudas totales</h2>
<Link href="/dashboard/cards" className="text-emerald-400 text-xs hover:underline">Ver todo</Link>
</div>
{totalDeuda > 0 ? (
<div className="space-y-2">
<div className="flex justify-between items-center">
<span className="text-slate-400 text-xs">Tarjetas ({cards.length})</span>
<span className="text-rose-400 text-sm font-semibold">S/ {fmt(totalDeudaTarjetas)}</span>
</div>
<div className="flex justify-between items-center">
<span className="text-slate-400 text-xs">Préstamos ({debts.length})</span>
<span className="text-rose-400 text-sm font-semibold">S/ {fmt(totalDeudaPrestamos)}</span>
</div>
<div className="border-t border-slate-700 pt-2 flex justify-between items-center">
<span className="text-slate-300 text-xs font-medium">Total</span>
<span className="text-white text-base font-bold">S/ {fmt(totalDeuda)}</span>
</div>
</div>
) : <p className="text-slate-500 text-xs text-center py-4">Sin deudas registradas</p>}
</div>

<div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
<div className="flex items-center justify-between mb-3">
<h2 className="text-white font-semibold text-sm">Accesos rápidos</h2>
</div>
<div className="grid grid-cols-2 gap-2">
{[
{href:'/dashboard/eecc',label:'Importar EECC',emoji:'📄'},
{href:'/dashboard/ocr',label:'Escanear recibo',emoji:'📸'},
{href:'/dashboard/chat',label:'Copiloto IA',emoji:'🤖'},
{href:'/dashboard/goals',label:'Mis objetivos',emoji:'🎯'},
].map(({href,label,emoji})=>(
<Link key={href} href={href} className="flex flex-col items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 rounded-xl p-3 text-center transition-colors">
<span className="text-2xl">{emoji}</span>
<span className="text-slate-300 text-xs font-medium">{label}</span>
</Link>
))}
</div>
</div>
</div>
</div>
)
}

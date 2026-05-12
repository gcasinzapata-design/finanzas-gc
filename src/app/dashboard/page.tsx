'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Link from 'next/link'

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

      {totalDeuda>0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-amber-300 font-semibold text-sm">Deuda total: S/ {fmt(totalDeuda)}</p>
              <p className="text-amber-400/70 text-xs">Tarjetas S/ {fmt(totalDeudaTarjetas)} · Préstamos S/ {fmt(totalDeudaPrestamos)}</p>
            </div>
          </div>
          <Link href="/dashboard/cards" className="text-amber-400 text-xs hover:underline">Ver deudas →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl p-5 border border-slate-800">
          <h2 className="text-white font-semibold text-sm mb-4">Evolución mensual</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barGap={2}>
              <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false} width={55} tickFormatter={v=>`S/${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{background:'#1e293b',border:'1px solid #334155',borderRadius:8,color:'#f1f5f9'}} formatter={(v:number)=>[`S/ ${fmt(v)}`,'']} />
              <Bar dataKey="gastos" fill="#f43f5e" radius={[4,4,0,0]} name="Gastos" />
              <Bar dataKey="ingresos" fill="#10b981" radius={[4,4,0,0]} name="Ingresos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
          <h2 className="text-white font-semibold text-sm mb-4">Por categoría</h2>
          {pieData.length>0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                    {pieData.map(entry=><Cell key={entry.name} fill={CAT_COLORS[entry.name]||'#94a3b8'} />)}
                  </Pie>
                  <Tooltip contentStyle={{background:'#1e293b',border:'1px solid #334155',borderRadius:8}} formatter={(v:number)=>[`S/ ${fmt(v)}`,'']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {pieData.map(({name,value})=>(
                  <div key={name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{background:CAT_COLORS[name]||'#94a3b8'}} />
                      <span className="text-slate-400">{name}</span>
                    </div>
                    <span className="text-slate-300">S/ {fmt(value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-slate-500 text-sm text-center py-8">Sin datos este mes</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
          <h2 className="text-white font-semibold text-sm mb-4">Donde más gastas este mes</h2>
          {topMerch.length>0 ? (
            <div className="space-y-3">
              {topMerch.map(([name,amount])=>(
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 truncate flex-1">{name}</span>
                    <span className="text-slate-400 ml-2">S/ {fmt(amount)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full">
                    <div className="h-full rounded-full bg-emerald-500" style={{width:`${topMerch[0][1]>0?(amount/topMerch[0][1])*100:0}%`}} />
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-500 text-sm text-center py-4">Sin datos este mes</p>}
        </div>
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">Últimas transacciones</h2>
            <Link href="/dashboard/transactions" className="text-emerald-400 text-xs hover:underline">Ver todas →</Link>
          </div>
          <div className="space-y-2">
            {transactions.slice(0,8).map(tx=>(
              <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-slate-800/50 last:border-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${tx.type==='ingreso'?'bg-emerald-500/20 text-emerald-400':'bg-rose-500/20 text-rose-400'}`}>
                  {tx.type==='ingreso'?'+':'-'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-xs font-medium truncate">{tx.merchant||tx.description}</p>
                  <p className="text-slate-500 text-xs">{tx.category} · {tx.date?new Date(tx.date).toLocaleDateString('es-PE',{day:'numeric',month:'short'}):''}</p>
                </div>
                <span className={`text-sm font-semibold ${tx.type==='ingreso'?'text-emerald-400':'text-slate-200'}`}>
                  {tx.type==='ingreso'?'+':'-'}S/ {fmt(tx.amount)}
                </span>
              </div>
            ))}
            {transactions.length===0 && <p className="text-slate-500 text-sm text-center py-4">Sin transacciones. Sincroniza Gmail o importa un EECC.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {href:'/dashboard/chat',label:'Registrar gasto',desc:'Lenguaje natural',icon:'⚡'},
          {href:'/dashboard/eecc',label:'Importar EECC',desc:'PDF o imagen',icon:'📄'},
          {href:'/dashboard/cards',label:'Gestionar deudas',desc:`S/ ${fmt(totalDeuda)} pendiente`,icon:'💳'},
          {href:'/dashboard/goals',label:'Mis objetivos',desc:'Metas financieras',icon:'🎯'},
        ].map(({href,label,desc,icon})=>(
          <Link key={href} href={href} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors">
            <span className="text-2xl block mb-2">{icon}</span>
            <p className="text-slate-200 text-sm font-medium">{label}</p>
            <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

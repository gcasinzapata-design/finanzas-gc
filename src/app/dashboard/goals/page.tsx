'use client'
import { useEffect, useState } from 'react'
import { Target, Plus, Trash2, CheckCircle } from 'lucide-react'

function fmt(n: number) { return new Intl.NumberFormat('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0) }
const ICONS = ['🎯','🏖️','🚗','🏠','💪','📚','💰','✈️','🎓','🛡️']
const COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#f43f5e','#06b6d4']

export default function GoalsPage() {
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState<{id:string;val:string}|null>(null)
  const [form, setForm] = useState({name:'',type:'ahorro',target_amount:'',current_amount:'',target_date:'',monthly_contribution:'',icon:'🎯',color:'#3b82f6'})

  useEffect(()=>{load()},[])

  async function load() {
    setLoading(true)
    try { const r = await fetch('/api/goals').then(x=>x.json()); setGoals(r.goals||[]) } catch(e){console.error(e)}
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    await fetch('/api/goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,target_amount:parseFloat(form.target_amount)||0,current_amount:parseFloat(form.current_amount)||0,monthly_contribution:parseFloat(form.monthly_contribution)||null})})
    setShowForm(false); setSaving(false); load()
  }

  async function addMoney(id: string, amount: number) {
    const g = goals.find(g=>g.id===id); if(!g) return
    await fetch('/api/goals',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,current_amount:g.current_amount+amount})})
    setAdding(null); load()
  }

  const active = goals.filter(g=>!g.is_completed)
  const done = goals.filter(g=>g.is_completed)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Objetivos financieros</h1>
        <button onClick={()=>setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-sm hover:bg-blue-500/30"><Plus className="w-4 h-4"/>Nuevo objetivo</button>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm">Nuevo objetivo</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="col-span-2"><label className="text-slate-400 text-xs block mb-1">Nombre</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Fondo de emergencia, Viaje..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"/></div>
            <div><label className="text-slate-400 text-xs block mb-1">Tipo</label><select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none"><option value="ahorro">Ahorro</option><option value="fondo_emergencia">Fondo emergencia</option><option value="eliminar_deuda">Eliminar deuda</option><option value="viaje">Viaje</option><option value="compra">Compra grande</option><option value="otro">Otro</option></select></div>
            {[['target_amount','Meta S/','5000'],['current_amount','Ya tengo S/','0'],['monthly_contribution','Ahorro/mes S/','500']].map(([k,l,p])=>(
              <div key={k}><label className="text-slate-400 text-xs block mb-1">{l}</label><input type="number" placeholder={p} value={(form as any)[k]} onChange={e=>setForm(prev=>({...prev,[k]:e.target.value}))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"/></div>
            ))}
            <div><label className="text-slate-400 text-xs block mb-1">Fecha meta</label><input type="date" value={form.target_date} onChange={e=>setForm(p=>({...p,target_date:e.target.value}))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none"/></div>
          </div>
          <div><label className="text-slate-400 text-xs block mb-2">Ícono</label><div className="flex flex-wrap gap-2">{ICONS.map(ic=><button key={ic} onClick={()=>setForm(p=>({...p,icon:ic}))} className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center ${form.icon===ic?'bg-blue-500/30 ring-2 ring-blue-500':'bg-slate-800'}`}>{ic}</button>)}</div></div>
          <div><label className="text-slate-400 text-xs block mb-2">Color</label><div className="flex gap-2">{COLORS.map(c=><button key={c} onClick={()=>setForm(p=>({...p,color:c}))} className={`w-6 h-6 rounded-full ${form.color===c?'ring-2 ring-white scale-125':''}`} style={{background:c}}/>)}</div></div>
          <div className="flex gap-2 justify-end">
            <button onClick={()=>setShowForm(false)} className="px-4 py-2 text-slate-400 text-sm">Cancelar</button>
            <button onClick={save} disabled={saving||!form.name||!form.target_amount} className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm rounded-lg disabled:opacity-50">{saving?'Guardando...':'Crear objetivo'}</button>
          </div>
        </div>
      )}

      {active.length>0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {active.map(g=>{
            const pct = g.target_amount>0?Math.min((g.current_amount/g.target_amount)*100,100):0
            const remaining = g.target_amount - g.current_amount
            const months = g.monthly_contribution&&g.monthly_contribution>0?Math.ceil(remaining/g.monthly_contribution):null
            return (
              <div key={g.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:`${g.color}22`}}>{g.icon}</div>
                    <div><p className="text-white font-semibold text-sm">{g.name}</p><p className="text-slate-400 text-xs">{g.type.replace('_',' ')}</p></div>
                  </div>
                  <button onClick={()=>fetch(`/api/goals?id=${g.id}`,{method:'DELETE'}).then(load)} className="text-slate-600 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-300 font-semibold">S/ {fmt(g.current_amount)}</span><span className="text-slate-500">de S/ {fmt(g.target_amount)}</span></div>
                  <div className="h-3 bg-slate-800 rounded-full"><div className="h-full rounded-full" style={{width:`${pct}%`,background:g.color}}/></div>
                  <div className="flex justify-between mt-1"><span className="text-xs font-bold" style={{color:g.color}}>{pct.toFixed(0)}%</span><span className="text-xs text-slate-500">Faltan S/ {fmt(remaining)}</span></div>
                </div>
                {months&&<p className="text-slate-500 text-xs mb-3">~{months} meses a S/ {fmt(g.monthly_contribution)}/mes</p>}
                {adding?.id===g.id ? (
                  <div className="flex gap-2">
                    <input type="number" placeholder="Monto S/" value={adding.val} onChange={e=>setAdding({id:g.id,val:e.target.value})} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none"/>
                    <button onClick={()=>addMoney(g.id,parseFloat(adding.val)||0)} className="px-3 py-1.5 text-xs rounded-lg text-white" style={{background:g.color}}>✓</button>
                    <button onClick={()=>setAdding(null)} className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-400">×</button>
                  </div>
                ) : (
                  <button onClick={()=>setAdding({id:g.id,val:''})} className="w-full py-2 text-xs rounded-lg border transition-colors" style={{borderColor:`${g.color}50`,color:g.color,background:`${g.color}10`}}>+ Agregar dinero</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {done.length>0 && (
        <div>
          <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400"/>Completados</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {done.map(g=><div key={g.id} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 opacity-70"><span className="text-2xl">{g.icon}</span><div><p className="text-emerald-300 font-semibold text-sm">{g.name}</p><p className="text-emerald-400/70 text-xs">S/ {fmt(g.target_amount)} ✓</p></div></div>)}
          </div>
        </div>
      )}

      {goals.length===0&&!loading&&<div className="text-center py-16 text-slate-500"><Target className="w-10 h-10 mx-auto mb-3 opacity-30"/><p>Define tus objetivos financieros.</p></div>}
    </div>
  )
}

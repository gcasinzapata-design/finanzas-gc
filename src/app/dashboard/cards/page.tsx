'use client'
import { useEffect, useState } from 'react'
import { CreditCard, Plus, Trash2, Landmark, TrendingDown } from 'lucide-react'

function fmt(n: number) { return new Intl.NumberFormat('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0) }
const COLORS = ['#10b981','#3b82f6','#8b5cf6','#f43f5e','#f59e0b','#06b6d4']

export default function CardsPage() {
  const [cards, setCards] = useState<any[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCard, setShowCard] = useState(false)
  const [showDebt, setShowDebt] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cardForm, setCardForm] = useState({bank:'',name:'',last_four:'',credit_limit:'',current_balance:'',tcea:'',cut_date:'',payment_due_date:'',minimum_payment:'',color:'#10b981'})
  const [debtForm, setDebtForm] = useState({name:'',type:'prestamo_personal',institution:'',original_amount:'',current_balance:'',monthly_payment:'',tea:'',total_installments:'',remaining_installments:'',next_payment_date:''})

  useEffect(()=>{load()},[])

  async function load() {
    setLoading(true)
    try {
      const [cr,dr] = await Promise.all([fetch('/api/cards').then(r=>r.json()),fetch('/api/debts').then(r=>r.json())])
      setCards(cr.cards||[]); setDebts(dr.debts||[])
    } catch(e){console.error(e)}
    setLoading(false)
  }

  async function saveCard() {
    setSaving(true)
    await fetch('/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...cardForm,credit_limit:parseFloat(cardForm.credit_limit)||null,current_balance:parseFloat(cardForm.current_balance)||0,tcea:parseFloat(cardForm.tcea)||null,cut_date:parseInt(cardForm.cut_date)||null,payment_due_date:parseInt(cardForm.payment_due_date)||null,minimum_payment:parseFloat(cardForm.minimum_payment)||null})})
    setShowCard(false); setSaving(false); load()
  }

  async function saveDebt() {
    setSaving(true)
    await fetch('/api/debts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...debtForm,original_amount:parseFloat(debtForm.original_amount)||0,current_balance:parseFloat(debtForm.current_balance)||0,monthly_payment:parseFloat(debtForm.monthly_payment)||null,tea:parseFloat(debtForm.tea)||null,total_installments:parseInt(debtForm.total_installments)||null,remaining_installments:parseInt(debtForm.remaining_installments)||null})})
    setShowDebt(false); setSaving(false); load()
  }

  const totalTarjetas = cards.reduce((s,c)=>s+(c.current_balance||0),0)
  const totalPrestamos = debts.reduce((s,d)=>s+(d.current_balance||0),0)
  const sortedByRate = [...cards.filter(c=>c.current_balance>0).map(c=>({id:c.id,name:`${c.bank} ${c.name}`,rate:c.tcea||0,balance:c.current_balance,type:'tarjeta'})),...debts.filter(d=>d.current_balance>0).map(d=>({id:d.id,name:d.name,rate:d.tea||0,balance:d.current_balance,type:'deuda'}))].sort((a,b)=>b.rate-a.rate)

  const fi = (label: string, key: string, form: any, setForm: any, type='text', ph='') => (
    <div key={key}>
      <label className="text-slate-400 text-xs block mb-1">{label}</label>
      <input type={type} placeholder={ph} value={form[key]} onChange={e=>setForm((p: any)=>({...p,[key]:e.target.value}))}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"/>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Tarjetas y Deudas</h1>
        <div className="flex gap-2">
          <button onClick={()=>setShowDebt(!showDebt)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/20 text-amber-400 rounded-xl text-sm hover:bg-amber-500/30"><Plus className="w-4 h-4"/>Préstamo</button>
          <button onClick={()=>setShowCard(!showCard)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm hover:bg-emerald-500/30"><Plus className="w-4 h-4"/>Tarjeta</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-slate-400 text-xs mb-1">Deuda total</p><p className="text-rose-400 text-2xl font-bold">S/ {fmt(totalTarjetas+totalPrestamos)}</p></div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-slate-400 text-xs mb-1">Tarjetas</p><p className="text-amber-400 text-2xl font-bold">S/ {fmt(totalTarjetas)}</p><p className="text-slate-500 text-xs">{cards.length} tarjeta{cards.length!==1?'s':''}</p></div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-slate-400 text-xs mb-1">Préstamos</p><p className="text-blue-400 text-2xl font-bold">S/ {fmt(totalPrestamos)}</p><p className="text-slate-500 text-xs">{debts.length} préstamo{debts.length!==1?'s':''}</p></div>
      </div>

      {showCard && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm">Nueva tarjeta de crédito</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {fi('Banco','bank',cardForm,setCardForm,'text','BCP, Interbank...')}
            {fi('Nombre','name',cardForm,setCardForm,'text','Visa Oro...')}
            {fi('Últimos 4 dígitos','last_four',cardForm,setCardForm,'text','1234')}
            {fi('Límite S/','credit_limit',cardForm,setCardForm,'number','5000')}
            {fi('Saldo actual S/','current_balance',cardForm,setCardForm,'number','1200')}
            {fi('TCEA %','tcea',cardForm,setCardForm,'number','45.5')}
            {fi('Día de corte','cut_date',cardForm,setCardForm,'number','15')}
            {fi('Día de pago','payment_due_date',cardForm,setCardForm,'number','8')}
            {fi('Pago mínimo S/','minimum_payment',cardForm,setCardForm,'number','150')}
            <div><label className="text-slate-400 text-xs block mb-2">Color</label><div className="flex gap-2">{COLORS.map(c=><button key={c} onClick={()=>setCardForm((p: any)=>({...p,color:c}))} className={`w-6 h-6 rounded-full ${cardForm.color===c?'ring-2 ring-white scale-125':''}`} style={{background:c}}/>)}</div></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={()=>setShowCard(false)} className="px-4 py-2 text-slate-400 text-sm">Cancelar</button>
            <button onClick={saveCard} disabled={saving||!cardForm.bank} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm rounded-lg disabled:opacity-50">{saving?'Guardando...':'Guardar tarjeta'}</button>
          </div>
        </div>
      )}

      {showDebt && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm">Nuevo préstamo</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {fi('Nombre','name',debtForm,setDebtForm,'text','Préstamo BCP')}
            {fi('Entidad','institution',debtForm,setDebtForm,'text','BCP...')}
            {fi('Monto original S/','original_amount',debtForm,setDebtForm,'number','10000')}
            {fi('Saldo actual S/','current_balance',debtForm,setDebtForm,'number','7500')}
            {fi('Cuota mensual S/','monthly_payment',debtForm,setDebtForm,'number','450')}
            {fi('TEA %','tea',debtForm,setDebtForm,'number','25')}
            {fi('Cuotas totales','total_installments',debtForm,setDebtForm,'number','24')}
            {fi('Cuotas restantes','remaining_installments',debtForm,setDebtForm,'number','18')}
            {fi('Próximo pago','next_payment_date',debtForm,setDebtForm,'date')}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={()=>setShowDebt(false)} className="px-4 py-2 text-slate-400 text-sm">Cancelar</button>
            <button onClick={saveDebt} disabled={saving||!debtForm.name} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm rounded-lg disabled:opacity-50">{saving?'Guardando...':'Guardar deuda'}</button>
          </div>
        </div>
      )}

      {cards.length>0 && (
        <div>
          <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-400"/>Tarjetas de crédito</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cards.map(card=>{
              const pct = card.credit_limit?Math.min((card.current_balance/card.credit_limit)*100,100):0
              return (
                <div key={card.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-5" style={{background:`linear-gradient(135deg, ${card.color}18, ${card.color}08)`,borderBottom:`1px solid ${card.color}25`}}>
                    <div className="flex justify-between items-start mb-3">
                      <div><p className="text-slate-300 text-xs">{card.bank}</p><p className="text-white font-bold">{card.name}</p>{card.last_four&&<p className="text-slate-500 text-xs">**** {card.last_four}</p>}</div>
                      <button onClick={()=>fetch(`/api/cards?id=${card.id}`,{method:'DELETE'}).then(load)} className="text-slate-600 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                    <div className="text-xs text-slate-400 mb-1 flex justify-between"><span>Utilizado</span><span className={pct>70?'text-rose-400':'text-slate-300'}>{pct.toFixed(0)}%</span></div>
                    <div className="h-1.5 bg-slate-800 rounded-full"><div className="h-full rounded-full" style={{width:`${pct}%`,background:pct>70?'#f43f5e':card.color}}/></div>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-3 text-center">
                    <div><p className="text-slate-500 text-xs">Saldo</p><p className={`font-bold text-sm ${pct>70?'text-rose-400':'text-white'}`}>S/ {fmt(card.current_balance)}</p></div>
                    <div><p className="text-slate-500 text-xs">Límite</p><p className="text-slate-300 font-bold text-sm">{card.credit_limit?`S/ ${fmt(card.credit_limit)}`:'—'}</p></div>
                    <div><p className="text-slate-500 text-xs">TCEA</p><p className="text-amber-400 font-bold text-sm">{card.tcea?`${card.tcea}%`:'—'}</p></div>
                  </div>
                  {(card.payment_due_date||card.minimum_payment)&&<div className="px-4 pb-3 flex gap-4 text-xs text-slate-500">{card.payment_due_date&&<span>Vence día {card.payment_due_date}</span>}{card.minimum_payment&&<span>Mín S/ {fmt(card.minimum_payment)}</span>}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {debts.length>0 && (
        <div>
          <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2"><Landmark className="w-4 h-4 text-amber-400"/>Préstamos</h2>
          <div className="space-y-3">
            {debts.map(debt=>{
              const pct = debt.original_amount>0?((debt.original_amount-debt.current_balance)/debt.original_amount)*100:0
              return (
                <div key={debt.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex justify-between mb-2">
                    <div><p className="text-white font-semibold text-sm">{debt.name}</p><p className="text-slate-400 text-xs">{debt.institution}</p></div>
                    <div className="flex items-center gap-2"><p className="text-rose-400 font-bold">S/ {fmt(debt.current_balance)}</p><button onClick={()=>fetch(`/api/debts?id=${debt.id}`,{method:'DELETE'}).then(load)} className="text-slate-600 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5"/></button></div>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full mb-2"><div className="h-full bg-blue-500 rounded-full" style={{width:`${Math.min(pct,100)}%`}}/></div>
                  <div className="flex gap-4 text-xs text-slate-500">{debt.monthly_payment&&<span>Cuota S/ {fmt(debt.monthly_payment)}</span>}{debt.tea&&<span>TEA {debt.tea}%</span>}{debt.remaining_installments&&<span>{debt.remaining_installments} cuotas rest.</span>}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sortedByRate.length>0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><TrendingDown className="w-4 h-4 text-emerald-400"/><h2 className="text-white font-semibold text-sm">Estrategia Avalancha — paga en este orden</h2></div>
          <p className="text-slate-500 text-xs mb-3">Paga primero la deuda con mayor tasa para minimizar intereses totales.</p>
          <div className="space-y-2">
            {sortedByRate.map((d,i)=>(
              <div key={d.id} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${i===0?'bg-rose-500 text-white':'bg-slate-800 text-slate-400'}`}>{i+1}</span>
                <span className="text-slate-300 text-sm flex-1">{d.name}</span>
                <span className="text-amber-400 text-xs">{d.rate>0?`${d.rate}%`:'—'}</span>
                <span className="text-slate-400 text-xs">S/ {fmt(d.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cards.length===0&&debts.length===0&&!loading&&(
        <div className="text-center py-16 text-slate-500"><CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30"/><p>Agrega tus tarjetas y préstamos para gestionar tus deudas.</p></div>
      )}
    </div>
  )
}

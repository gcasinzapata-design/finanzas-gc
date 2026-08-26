// @ts-nocheck
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(Math.round(n)||0)}`

function buildCoachContext(tx, cards, debts, habits, todayLogs) {
  const MONTHS = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08']
  const MN = {'2026-01':'Ene','2026-02':'Feb','2026-03':'Mar','2026-04':'Abr','2026-05':'May','2026-06':'Jun','2026-07':'Jul','2026-08':'Ago'}
  const amtPen = (t) => Number(t.amount_pen||t.amount||0)

  const byMonth = {}
  MONTHS.forEach(m => {
    const g = tx.filter(t=>t.type==='gasto'&&t.category!=='Ahorro'&&t.date?.startsWith(m))
    const inc = tx.filter(t=>t.type==='ingreso'&&['Sueldo','Gratificacion'].includes(t.category)&&t.date?.startsWith(m))
    byMonth[m] = { gastos:Math.round(g.reduce((s,t)=>s+amtPen(t),0)), ingresos:Math.round(inc.reduce((s,t)=>s+amtPen(t),0)) }
  })

  const byCat = {}
  tx.filter(t=>t.type==='gasto'&&t.category!=='Ahorro').forEach(t=>{
    byCat[t.category||'Otros'] = (byCat[t.category||'Otros']||0) + amtPen(t)
  })
  const topCats = Object.entries(byCat).sort(([,a],[,b])=>b-a).slice(0,10)

  const realCards = cards.filter(c=>!(c.bank==='Interbank'&&(c.name||'').toLowerCase().includes('access'))&&Number(c.current_balance)>0)
  const totalTC = realCards.reduce((s,c)=>s+Number(c.current_balance||0),0)
  const totalPrest = debts.reduce((s,d)=>s+Number(d.current_balance||0),0)
  const totalDebt = totalTC + totalPrest
  const minPayments = realCards.reduce((s,c)=>s+Number(c.minimum_payment||0),0) + debts.reduce((s,d)=>s+Number(d.monthly_payment||0),0)
  const income = 11336

  const habitsDone = habits.filter(h=>todayLogs.includes(h.id)).map(h=>`${h.emoji||'ok'} ${h.name}`)
  const habitsPending = habits.filter(h=>!todayLogs.includes(h.id)).map(h=>`- ${h.name}`)
  const habitLine = habits.length > 0 ? `Habitos hoy: ${habitsDone.length}/${habits.length} completos` : 'Sin habitos configurados'

  const monthLines = MONTHS.filter(m=>byMonth[m]?.gastos>0||byMonth[m]?.ingresos>0)
    .slice(-4).map(m=>`${MN[m]}: In ${S(byMonth[m].ingresos)} | Gasto ${S(byMonth[m].gastos)}`).join('\n')

  const cardLines = realCards.map(c=>`- ${c.bank} ${c.name||''} ****${c.last_four||'??'}: ${S(Number(c.current_balance))} | TCEA ${c.tcea||c.tea||'?'}% | Min ${S(Number(c.minimum_payment||0))}`).join('\n')
  const debtLines = debts.filter(d=>Number(d.current_balance)>0).map(d=>`- ${d.name}: ${S(Number(d.current_balance))} | ${S(Number(d.monthly_payment||0))}/mes | TEA ${d.tea||'?'}% | ${d.remaining_installments||'?'} cuotas`).join('\n')
  const catLines = topCats.map(([c,a])=>`- ${c}: ${S(a)}`).join('\n')

  return `Eres GC COACH, el asistente personal de Gian Carlo Asin Zapata, Lima, Peru.

Eres un coach integral que cubre: finanzas, fitness, nutricion, mentalidad y rutinas.
Estilo: directo, honesto, como un buen amigo experto. Max 350 palabras. Bullets cuando ayudan.

--- PERFIL DE GIAN CARLO ---

VIDA:
- Lima, Peru | Trabaja remoto (Justo/InDrive)
- Vive con su novia | Tiene perro: Magno
- Paseos Magno: 10am, 4pm, 10pm (aprox 40 min cada uno = buen NEAT)
- Futbol: domingos (cardio garantizado)
- Mananas tranquilas, noches libres
- Objetivos de vida: respiracion, autoconocimiento, manifestacion, conexion con naturaleza

OBJETIVO FISICO:
- Cuerpo atletico funcional, modo gimnasta
- Bajo en grasa, buena masa muscular (no culturista)
- Referencia: atleta funcional, gimnasta

ENTRENAMIENTO:
- Puede: gym, casa, piscina, correr, futbol domingos
- Paseos con Magno 3x/dia = base de movimiento diario
- Plan sugerido: Lun Empuje | Mar Tiron+natacion | Mie Piernas+core | Jue Cardio suave | Vie Funcional | Sab Descanso | Dom Futbol

SUPLEMENTOS:
- Creatina monohidrato: 5g/dia con agua
- Omega 3: con comidas (recuperacion, antiinflamatorio)
- Animal Pak: con la comida mas grande del dia (multivitaminico completo)
- ISO100 Dymatize: proteina whey isolate, 25g prot / 130 cal por scoop

NUTRICION TARGET (recomposicion corporal):
- Calorias: 2200-2400 kcal/dia
- Proteina: 180-200g/dia
- Carbohidratos: 200-230g/dia
- Grasas: 60-75g/dia
- Agua: 3L+/dia

--- FINANZAS REALES ---

Sueldo neto: ${S(income)}/mes (S/14K brutos desde ago 2026)
+ Deposito novia: S/1,533/mes = Total ${S(income+1533)}/mes
Cuotas minimas: ${S(minPayments)}/mes
Deuda total: ${S(totalDebt)} (${(totalDebt/income).toFixed(1)} meses de sueldo)

Deudas (atacar en orden - metodo avalancha):
${cardLines}
${debtLines}

Ultimos meses:
${monthLines}

Top gastos:
${catLines}

--- HOY ---
${habitLine}
${habitsDone.length > 0 ? 'Hechos: ' + habitsDone.join(', ') : ''}
${habitsPending.length > 0 ? 'Pendientes: ' + habitsPending.join(', ') : ''}

--- COMO ACTUAR ---
1. Fitness: planes concretos con series/reps, alternativas por ubicacion
2. Nutricion: macros exactos, comidas peruanas economicas
3. Finanzas: usa numeros reales, directo sobre la deuda
4. Mentalidad: practicas concretas (respiracion 4-7-8, journaling)
5. Integracion: conecta dominios (ej: mejor salud = mejor trabajo = pagar deuda mas rapido)`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { messages } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'Sin mensajes' }, { status: 400 })

  const uid = session.user.id
  const sb = createServiceClient()

  const [txR, cR, dR, habR, logsR] = await Promise.all([
    sb.from('transactions').select('date,amount,amount_pen,currency,type,category').eq('user_id',uid).eq('source','eecc').gte('date','2026-01-01').order('date',{ascending:false}).limit(500),
    sb.from('credit_cards').select('*').eq('user_id',uid).eq('is_active',true),
    sb.from('debts').select('*').eq('user_id',uid).eq('is_active',true),
    sb.from('user_habits').select('*').eq('user_id',uid).eq('is_active',true),
    sb.from('user_habit_logs').select('habit_id').eq('user_id',uid).eq('log_date',new Date().toISOString().slice(0,10)),
  ])

  const habits = habR.data || []
  const todayLogs = (logsR.data||[]).map(l=>l.habit_id)
  const systemPrompt = buildCoachContext(txR.data||[], cR.data||[], dR.data||[], habits, todayLogs)
  const chatMsgs = messages.map(m=>({role:m.role==='user'?'user':'assistant', content:m.content}))

  try {
    const userMsg = chatMsgs.map(m=>`${m.role==='user'?'GC':'Coach'}: ${m.content}`).join('\n')
    const reply = await callAI(userMsg, systemPrompt, 1500)
    return NextResponse.json({ reply, model: 'GC Coach' })
  } catch(e:any) {
    return NextResponse.json({ reply: `Error: ${e.message}` })
  }
}

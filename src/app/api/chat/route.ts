// @ts-nocheck
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(Math.round(n)||0)}`

function buildCoachContext(tx, cards, debts, habits, todayLogs, meals, checkin, recentWorkouts) {
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
  const topCats = Object.entries(byCat).sort(([,a],[,b])=>b-a).slice(0,8)

  const realCards = cards.filter(c=>!(c.bank==='Interbank'&&(c.name||'').toLowerCase().includes('access'))&&Number(c.current_balance)>0)
  const totalDebt = realCards.reduce((s,c)=>s+Number(c.current_balance||0),0) + debts.reduce((s,d)=>s+Number(d.current_balance||0),0)
  const minPayments = realCards.reduce((s,c)=>s+Number(c.minimum_payment||0),0) + debts.reduce((s,d)=>s+Number(d.monthly_payment||0),0)
  const income = 11336

  // Nutrition totals today
  const TARGETS = { calories: 2300, protein_g: 190, carbs_g: 215, fat_g: 67 }
  const nutrition = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories||0),
    protein_g: acc.protein_g + Number(m.protein_g||0),
    carbs_g: acc.carbs_g + Number(m.carbs_g||0),
    fat_g: acc.fat_g + Number(m.fat_g||0),
  }), { calories:0, protein_g:0, carbs_g:0, fat_g:0 })
  const remaining = {
    calories: TARGETS.calories - nutrition.calories,
    protein_g: TARGETS.protein_g - nutrition.protein_g,
    carbs_g: TARGETS.carbs_g - nutrition.carbs_g,
  }

  const mealLines = meals.length > 0
    ? meals.map(m=>`  - ${m.meal_time}: ${m.description} (${m.calories}kcal | P:${Math.round(m.protein_g)}g C:${Math.round(m.carbs_g)}g G:${Math.round(m.fat_g)}g)`).join('\n')
    : '  Sin comidas registradas hoy aun'

  // Energy/stress adaptation
  const energy = checkin?.energy_level || 3
  const stress = checkin?.stress_level || 2
  const sleep = checkin?.sleep_hours || 7
  let trainingAdaptation = 'Entrenamiento normal segun el plan'
  if (energy <= 2 || stress >= 4 || sleep < 6) {
    trainingAdaptation = 'DIA DIFICIL: Recomienda sesion ligera o movilidad/caminar. Reprogramar sesion fuerte para manana.'
  } else if (energy >= 4 && stress <= 2) {
    trainingAdaptation = 'EXCELENTE ESTADO: Dia ideal para entrenar fuerte. Puedes agregar intensidad.'
  }

  // Recent workouts (last 3 days)
  const workoutHistory = recentWorkouts.slice(0,3).map(w=>`  - ${w.log_date}: ${w.workout_type} ${w.duration_min?`(${w.duration_min}min)`:''}  intensidad ${w.intensity}/5`).join('\n') || '  Sin entrenamientos recientes registrados'

  // Habits
  const habitsDone = habits.filter(h=>todayLogs.includes(h.id)).map(h=>`${h.emoji||'ok'} ${h.name}`)
  const habitsPending = habits.filter(h=>!todayLogs.includes(h.id)).map(h=>h.name)

  const monthLines = MONTHS.filter(m=>byMonth[m]?.gastos>0).slice(-3).map(m=>`  ${MN[m]}: In ${S(byMonth[m].ingresos)} | Gasto ${S(byMonth[m].gastos)}`).join('\n')
  const cardLines = realCards.map(c=>`  - ${c.bank} ${c.name||''} ***${c.last_four||'??'}: ${S(Number(c.current_balance))} | TCEA ${c.tcea||c.tea||'?'}%`).join('\n')
  const debtLines = debts.filter(d=>Number(d.current_balance)>0).map(d=>`  - ${d.name}: ${S(Number(d.current_balance))} | ${S(Number(d.monthly_payment||0))}/mes | TEA ${d.tea||'?'}%`).join('\n')

  return `Eres GC COACH, el asistente personal de Gian Carlo Asin Zapata, Lima, Peru.
Coach integral: finanzas, fitness, nutricion, mentalidad, rutinas.
Estilo: directo, honesto, como buen amigo experto. Max 350 palabras. Usa bullets cuando ayuda.

=== PERFIL GC ===
Objetivo: cuerpo atletico funcional (gimnasta/atleta). Bajo grasa, buena masa muscular.
Gym: GRATIS. Puede tambien: casa, piscina, correr, futbol domingos.
Paseos Magno: 10am/4pm/10pm (~40 min c/u) = NEAT significativo
Suplementos: Creatina 5g/dia | Omega 3 con comidas | Animal Pak con comida grande | ISO100 Dymatize (25g prot/130kcal)
Mentalidad: respiracion, autoconocimiento, manifestacion, conexion naturaleza
Sueldo neto: ${S(income)}/mes | Deuda total: ${S(totalDebt)} | Cuotas: ${S(minPayments)}/mes

=== NUTRICION HOY ===
Comidas registradas:
${mealLines}

CONSUMIDO: ${Math.round(nutrition.calories)} kcal | Prot: ${Math.round(nutrition.protein_g)}g | Carbs: ${Math.round(nutrition.carbs_g)}g | Grasa: ${Math.round(nutrition.fat_g)}g
TARGETS:   ${TARGETS.calories} kcal | Prot: ${TARGETS.protein_g}g | Carbs: ${TARGETS.carbs_g}g | Grasa: ${TARGETS.fat_g}g
FALTAN:    ${Math.max(0,Math.round(remaining.calories))} kcal | Prot: ${Math.max(0,Math.round(remaining.protein_g))}g | Carbs: ${Math.max(0,Math.round(remaining.carbs_g))}g

REGLA: Cuando GC pregunte que comer, calcula EXACTAMENTE cuanto le falta y recomienda comidas peruanas accesibles que completen esos macros. Siempre incluye el macro breakdown de tu recomendacion.

=== ESTADO HOY ===
Energia: ${energy}/5 ${energy>=4?'(alto)':energy<=2?'(bajo - adaptar)':'(normal)'}
Estres:  ${stress}/5 ${stress>=4?'(alto - cuidado)':stress<=2?'(bajo - bien)':'(moderado)'}
Sueno:   ${sleep}h ${sleep<6?'(insuficiente - prioridad descanso)':sleep>=7?'(adecuado)':'(aceptable)'}
ADAPTACION ENTRENAMIENTO: ${trainingAdaptation}

=== ENTRENAMIENTO RECIENTE ===
${workoutHistory}
Plan base: Lun-Empuje | Mar-Tiron/Natacion | Mie-Piernas+Core | Jue-Cardio | Vie-Funcional | Sab-Descanso | Dom-Futbol

REGLA: Si dia pesado (energia<=2 o estres>=4), sugiere sesion ligera y reprograma la fuerte para manana. Siempre explica el ajuste.

=== HABITOS HOY ===
${habits.length > 0 ? `${habitsDone.length}/${habits.length} completados` : 'Sin habitos configurados'}
${habitsDone.length > 0 ? 'Hechos: ' + habitsDone.join(', ') : ''}
${habitsPending.length > 0 ? 'Pendientes: ' + habitsPending.join(', ') : ''}

=== FINANZAS ===
Ultimos meses:
${monthLines}
Deudas (avalancha):
${cardLines}
${debtLines}
Top gastos: ${topCats.slice(0,5).map(([c,a])=>`${c} ${S(a)}`).join(' | ')}

=== COMO ACTUAR ===
1. NUTRICION: Calcula siempre macros restantes. Recomienda comidas concretas con su breakdown.
2. ENTRENAMIENTO: Adapta segun energia/estres del dia. Si dia dificil, ajusta y explica.
3. FINANZAS: Usa numeros reales, directo sobre la deuda.
4. MENTALIDAD: Practicas concretas (respiracion 4-7-8, box breathing, journaling 5min).
5. INTEGRACION: Conecta todo - mejor nutricion = mejor energia = mejor trabajo = pagar deuda mas rapido.`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { messages } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'Sin mensajes' }, { status: 400 })

  const uid = session.user.id
  const today = new Date().toISOString().slice(0, 10)
  const sb = createServiceClient()

  const [txR, cR, dR, habR, logsR, mealsR, checkinR, workoutsR] = await Promise.all([
    sb.from('transactions').select('date,amount,amount_pen,type,category').eq('user_id',uid).eq('source','eecc').gte('date','2026-01-01').limit(400),
    sb.from('credit_cards').select('*').eq('user_id',uid).eq('is_active',true),
    sb.from('debts').select('*').eq('user_id',uid).eq('is_active',true),
    sb.from('user_habits').select('*').eq('user_id',uid).eq('is_active',true),
    sb.from('user_habit_logs').select('habit_id').eq('user_id',uid).eq('log_date',today),
    sb.from('meal_logs').select('*').eq('user_id',uid).eq('log_date',today).order('created_at'),
    sb.from('daily_checkin').select('*').eq('user_id',uid).eq('log_date',today).maybeSingle(),
    sb.from('workout_logs').select('*').eq('user_id',uid).gte('log_date', new Date(Date.now()-7*86400000).toISOString().slice(0,10)).order('log_date',{ascending:false}).limit(5),
  ])

  const systemPrompt = buildCoachContext(
    txR.data||[], cR.data||[], dR.data||[],
    habR.data||[], (logsR.data||[]).map(l=>l.habit_id),
    mealsR.data||[], checkinR.data,
    workoutsR.data||[]
  )

  const chatMsgs = messages.map(m=>({role:m.role==='user'?'user':'assistant', content:m.content}))

  try {
    const userMsg = chatMsgs.map(m=>`${m.role==='user'?'GC':'Coach'}: ${m.content}`).join('\n')
    const reply = await callAI(userMsg, systemPrompt, 1500)
    return NextResponse.json({ reply, model: 'GC Coach' })
  } catch(e:any) {
    return NextResponse.json({ reply: `Error: ${e.message}` })
  }
}

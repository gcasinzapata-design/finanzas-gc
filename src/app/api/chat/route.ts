// @ts-nocheck
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(Math.round(n)||0)}`

function buildCoachContext(tx, cards, debts, habits, todayLogs) {
  // ── FINANZAS ───────────────────────────────────────────────────────────────
  const MONTHS = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08']
  const MN = {'2026-01':'Ene','2026-02':'Feb','2026-03':'Mar','2026-04':'Abr','2026-05':'May','2026-06':'Jun','2026-07':'Jul','2026-08':'Ago'}
  const amtPen = (t) => Number(t.amount_pen||t.amount||0)

  const byMonth = {}
  MONTHS.forEach(m => {
    const g = tx.filter(t=>t.type==='gasto'&&t.category!=='Ahorro'&&t.date?.startsWith(m))
    const i = tx.filter(t=>t.type==='ingreso'&&['Sueldo','Gratificación'].includes(t.category)&&t.date?.startsWith(m))
    byMonth[m] = { gastos:Math.round(g.reduce((s,t)=>s+amtPen(t),0)), ingresos:Math.round(i.reduce((s,t)=>s+amtPen(t),0)) }
  })

  const byCat = {}
  tx.filter(t=>t.type==='gasto'&&t.category!=='Ahorro').forEach(t=>{
    byCat[t.category||'Otros'] = (byCat[t.category||'Otros']||0) + amtPen(t)
  })
  const topCats = Object.entries(byCat).sort(([,a],[,b])=>b-a).slice(0,12)

  const realCards = cards.filter(c=>!(c.bank==='Interbank'&&(c.name||'').toLowerCase().includes('access'))&&Number(c.current_balance)>0)
  const totalTC = realCards.reduce((s,c)=>s+Number(c.current_balance||0),0)
  const totalPrest = debts.reduce((s,d)=>s+Number(d.current_balance||0),0)
  const totalDebt = totalTC + totalPrest
  const minPayments = realCards.reduce((s,c)=>s+Number(c.minimum_payment||0),0) + debts.reduce((s,d)=>s+Number(d.monthly_payment||0),0)
  const income = 11336 // Confirmed neto Aug 2026
  const avgExpense = MONTHS.filter(m=>byMonth[m]?.gastos>0).reduce((s,m)=>s+byMonth[m].gastos,0) / Math.max(MONTHS.filter(m=>byMonth[m]?.gastos>0).length,1)
  const dti = ((minPayments/income)*100).toFixed(0)

  // ── HÁBITOS HOY ────────────────────────────────────────────────────────────
  const habitsDone = habits.filter(h=>todayLogs.includes(h.id)).map(h=>`${h.emoji||'✅'} ${h.name}`)
  const habitsPending = habits.filter(h=>!todayLogs.includes(h.id)).map(h=>`${h.emoji||'⬜'} ${h.name}`)
  const habitProgress = habits.length > 0 ? `${habitsDone.length}/${habits.length} hábitos completados hoy` : 'Sin hábitos registrados aún'

  return `Eres GC COACH — el asistente de vida personal de Gian Carlo Asin Zapata, Lima, Perú.

Eres un coach integral de PRIMERA CLASE que cubre:
💰 Finanzas personales (Dave Ramsey + psicología del dinero)
💪 Fitness funcional y rendimiento atlético
🥗 Nutrición y composición corporal  
🧘 Mentalidad, bienestar y crecimiento personal
🔄 Rutinas, hábitos y optimización de vida

Tu estilo: directo, honesto, personalizado. Como un buen amigo que es experto en todo. No suavizas la verdad. Máximo 350 palabras. Bullet points cuando ayudan.

═══════════════════════════════════════════
PERFIL DE GIAN CARLO
═══════════════════════════════════════════

VIDA Y RUTINA:
• Lima, Perú | Trabaja remoto (Justo/InDrive — food delivery ops)
• Vive con su novia | Tiene perro: Magno 🐕
• Paseos: 10am · 4pm · 10pm (~40 min cada uno = NEAT significativo)
• Fútbol: domingos (activo, recuperación activa)
• Mañanas: tranquilas | Noches: más libres
• Mentalidad: respiración, autoconocimiento, manifestación, conexión con naturaleza

OBJETIVO FÍSICO:
• Cuerpo atlético funcional — modo gimnasta
• Bajo en grasa corporal, buena masa muscular (no bulky)
• Referencia: atleta funcional, no culturista

ENTRENAMIENTO DISPONIBLE:
• Gym, casa, piscina, correr al aire libre
• Fútbol domingos (cardio + agilidad garantizado)
• Paseos con Magno 3x/día = 2h+ caminata/día base

SUPLEMENTOS ACTUALES:
• Creatina monohidrato → 5g/día con agua
• Omega 3 → con comidas (anti-inflamatorio, recuperación)  
• Animal Pak → multivitamínico completo, con comida más grande del día
• ISO100 Dymatize → proteína whey isolate hidrolizada, 25g prot/130 cal por scoop

NUTRICIÓN TARGET (para recomposición corporal):
• Calorías: ~2,200-2,400 kcal/día
• Proteína: 180-200g/día (2.2-2.5g/kg est.)
• Carbohidratos: 200-230g/día
• Grasas: 60-75g/día
• Hidratación: 3L+ agua

PLAN DE ENTRENAMIENTO RECOMENDADO:
Lun: Empuje — pecho/hombros/tríceps (calistenia + pesos)
Mar: Tirón — espalda/bíceps (piscina o gym)
Mié: Piernas + core funcional
Jue: Movilidad + cardio suave (correr 30min)
Vie: Cuerpo completo / funcional
Sáb: Descanso activo o nadar
Dom: Fútbol ⚽ (actividad garantizada)

═══════════════════════════════════════════
FINANZAS — SNAPSHOT REAL
═══════════════════════════════════════════

Sueldo neto: ${S(income)}/mes (S/14K brutos, desde ago 2026)
+ Depósito novia alquiler: S/1,533/mes
= Ingreso total: ${S(income + 1533)}/mes
Gasto promedio mensual: ${S(avgExpense)}
Cuotas mínimas totales: ${S(minPayments)}/mes
DTI: ${dti}% ${Number(dti)>40?'🔴 ALTO':Number(dti)>25?'⚠️ MODERADO':'✅ OK'}

DEUDAS (atacar en este orden — método avalancha):
${realCards.map(c=>`• ${c.bank} ${c.name||''} ****${c.last_four||'??'}: ${S(Number(c.current_balance))} | TCEA ${c.tcea||c.tea||'?'}% | Mín ${S(Number(c.minimum_payment||0))}`).join('\n')}
${debts.filter(d=>Number(d.current_balance)>0).map(d=>`• ${d.name}: ${S(Number(d.current_balance))} | ${S(Number(d.monthly_payment||0))}/mes | TEA ${d.tea||'?'}% | ${d.remaining_installments||'?'} cuotas`).join('\n')}
DEUDA TOTAL: ${S(totalDebt)} (${(totalDebt/income).toFixed(1)} meses de sueldo)

ÚLTIMOS MESES:
${MONTHS.filter(m=>byMonth[m]?.gastos>0||byMonth[m]?.ingresos>0).slice(-4).map(m=>`${MN[m]}: In ${S(byMonth[m].ingresos)} | Gasto ${S(byMonth[m].gastos)}`).join('\n')}

TOP CATEGORÍAS DE GASTO:
${topCats.slice(0,8).map(([c,a])=>`• ${c}: ${S(a)}`).join('\n')}

═══════════════════════════════════════════
HOY
═══════════════════════════════════════════

${habitProgress}
${habitsDone.length > 0 ? `Completados: ${habitsDone.join(', ')}` : ''}
${habitsPending.length > 0 ? `Pendientes: ${habitsPending.join(', ')}` : ''}

═══════════════════════════════════════════
C�MO ACTUAR COMO COACH
═══════════════════════════════════════════

1. Si pregunta de fitness → da plan concreto, ejercicios con series/reps, alternativas según dónde esté
2. Si pregunta de nutrición → calcula macros exactos, sugiere comidas peruanas asequibles
3. Si pregunta de finanzas → usa los números reales de arriba, sé directo sobre la deuda
4. Si pregunta de mentalidad → prácticas concretas (respiración 4-7-8, box breathing, journaling)
5. Si pregunta qué hacer ahora → revisa hábitos del día y contexto para dar LA MEJOR siguiente acción
6. Integra dominios: "entrenar te da energía para trabajar mejor, trabajar bien paga la deuda, sin deuda tienes libertad para vivir mejor"`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { messages } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'Sin mensajes' }, { status: 400 })

  const uid = session.user.id
  const sb = createServiceClient()

  // Load real data for context
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
    return NextResponse.json({ reply: `⚠️ ${e.message}` })
  }
}

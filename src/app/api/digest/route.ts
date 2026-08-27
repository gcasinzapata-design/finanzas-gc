// @ts-nocheck
export const dynamic = 'force-dynamic'
// Daily digest endpoint — called by Make every morning at 7am
// Returns formatted WhatsApp message with today's plan
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(Math.round(n)||0)}`

const DAY_ES = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado']
const PLAN = {
  1:'Empuje — Pecho/Hombros/Triceps 💪',
  2:'Tiron — Espalda/Biceps + Natacion 🏊',
  3:'Piernas + Core Funcional 🦵',
  4:'Cardio + Movilidad 🏃',
  5:'Funcional + Atletico ⚡',
  6:'Descanso activo + Magno 🧘',
  0:'Futbol ⚽'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  const sb = createServiceClient()

  // Validate token
  const { data: t } = await sb.from('api_tokens').select('user_id').eq('token', token||'').maybeSingle()
  if (!t) return NextResponse.json({ error: 'Token invalido' }, { status: 401 })

  const uid = t.user_id
  const today = new Date()
  const todayStr = today.toISOString().slice(0,10)
  const yesterdayStr = new Date(Date.now()-86400000).toISOString().slice(0,10)
  const dayNum = today.getDay()
  const dayName = DAY_ES[dayNum]
  const dateLabel = today.toLocaleDateString('es-PE',{day:'numeric',month:'long'})

  // Fetch all needed data in parallel
  const [tasksR, habitsR, logsR, mealsYestR, mealsTodayR, txMonthR, cardsR, healthR] = await Promise.all([
    sb.from('user_tasks').select('title,is_recurring,days_of_week,last_completed_date,status,priority').eq('user_id',uid),
    sb.from('user_habits').select('name,emoji,time_of_day').eq('user_id',uid).eq('is_active',true).order('sort_order'),
    sb.from('user_habit_logs').select('habit_id').eq('user_id',uid).eq('log_date',todayStr),
    sb.from('meal_logs').select('calories,protein_g').eq('user_id',uid).eq('log_date',yesterdayStr),
    sb.from('meal_logs').select('calories,protein_g').eq('user_id',uid).eq('log_date',todayStr),
    sb.from('transactions').select('amount_pen,type,category').eq('user_id',uid).eq('source','eecc').gte('date',todayStr.slice(0,7)+'-01').lte('date',todayStr),
    sb.from('credit_cards').select('bank,last_four,current_balance,tcea').eq('user_id',uid).eq('is_active',true).gt('current_balance',0).order('tcea',{ascending:false}).limit(2),
    sb.from('health_metrics').select('sleep_hours,resting_hr,steps').eq('user_id',uid).eq('log_date',yesterdayStr).maybeSingle(),
  ])

  const allTasks = tasksR.data || []
  const todayTasks = allTasks.filter(t => {
    if (!t.is_recurring) return t.status !== 'done'
    if (!t.days_of_week?.includes(dayNum)) return false
    return t.last_completed_date !== todayStr
  })
  const homeTasks = todayTasks.filter(t=>t.is_recurring)
  const personalTasks = todayTasks.filter(t=>!t.is_recurring)

  const habits = habitsR.data || []
  const doneHabitIds = new Set((logsR.data||[]).map(l=>l.habit_id))

  // Nutrition yesterday
  const mealsYest = mealsYestR.data || []
  const calYest = Math.round(mealsYest.reduce((s,m)=>s+(m.calories||0),0))
  const protYest = Math.round(mealsYest.reduce((s,m)=>s+Number(m.protein_g||0),0))

  // Spending this month
  const txMonth = txMonthR.data || []
  const gastoMes = Math.round(txMonth.filter(t=>t.type==='gasto').reduce((s,t)=>s+Number(t.amount_pen||0),0))

  // Top card
  const topCard = (cardsR.data||[])[0]

  // Health yesterday
  const h = healthR.data

  // Build WhatsApp message
  const lines = [
    `🌅 *Buenos dias, Gian!*`,
    `📅 *${dayName} ${dateLabel}*`,
    ``,
    `💪 *ENTRENAMIENTO:* ${PLAN[dayNum]}`,
    ``,
  ]

  // Home tasks
  if (homeTasks.length > 0) {
    lines.push(`🏠 *HOGAR HOY:*`)
    homeTasks.forEach(t => lines.push(`  ▫️ ${t.title}`))
    lines.push(``)
  }

  // Habits reminder
  const pendingHabits = habits.filter(h=>!doneHabitIds.has(h.id))
  if (pendingHabits.length > 0) {
    lines.push(`✅ *HABITOS PENDIENTES:* ${pendingHabits.length}/${habits.length}`)
    pendingHabits.slice(0,4).forEach(h=>lines.push(`  ${h.emoji} ${h.name}`))
    if (pendingHabits.length > 4) lines.push(`  ...y ${pendingHabits.length-4} mas`)
    lines.push(``)
  }

  // Nutrition yesterday
  if (calYest > 0) {
    const calStatus = calYest >= 2000 ? '✅' : calYest >= 1500 ? '⚠️' : '❌'
    const protStatus = protYest >= 160 ? '✅' : protYest >= 120 ? '⚠️' : '❌'
    lines.push(`🥗 *NUTRICION AYER:*`)
    lines.push(`  ${calStatus} Calorias: ${calYest}/2300 kcal`)
    lines.push(`  ${protStatus} Proteina: ${protYest}/190g`)
    lines.push(``)
  }

  // Health data
  if (h?.sleep_hours) {
    const sleepStatus = h.sleep_hours >= 7 ? '😴✅' : h.sleep_hours >= 6 ? '😐⚠️' : '😫❌'
    lines.push(`❤️ *SALUD AYER:*`)
    lines.push(`  ${sleepStatus} Sueno: ${h.sleep_hours}h`)
    if (h.resting_hr) lines.push(`  ❤️ FC reposo: ${h.resting_hr} bpm`)
    if (h.steps) lines.push(`  👟 Pasos: ${h.steps.toLocaleString()}`)
    lines.push(``)
  }

  // Finance snapshot
  lines.push(`💰 *FINANZAS:*`)
  lines.push(`  Gasto del mes: ${S(gastoMes)}`)
  if (topCard) lines.push(`  🔴 Prioridad: ${topCard.bank} ****${topCard.last_four} — ${S(Number(topCard.current_balance))} al ${topCard.tcea}% TCEA`)
  lines.push(``)

  // Personal tasks
  if (personalTasks.length > 0) {
    lines.push(`📋 *PENDIENTES:*`)
    personalTasks.slice(0,3).forEach(t=>lines.push(`  ▫️ ${t.priority==='high'?'🔴 ':''}${t.title}`))
    if (personalTasks.length > 3) lines.push(`  ...y ${personalTasks.length-3} mas`)
    lines.push(``)
  }

  lines.push(`_Responde o pregunta lo que necesites al GC Coach_ 🤖`)

  const message = lines.join('\n')

  return NextResponse.json({
    message,
    date: todayStr,
    stats: { homeTasks: homeTasks.length, habits: habits.length, doneHabits: doneHabitIds.size, calYest, protYest, gastoMes }
  })
}

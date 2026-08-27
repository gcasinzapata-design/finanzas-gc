// @ts-nocheck
export const dynamic = 'force-dynamic'
// Sends the daily digest email directly via Supabase-stored Gmail token
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(Math.round(n)||0)}`
const DAY_ES = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado']
const PLAN:any = {1:'Empuje — Pecho/Hombros/Triceps 💪',2:'Tiron — Espalda/Biceps 🏊',3:'Piernas + Core 🦵',4:'Cardio + Movilidad 🏃',5:'Funcional ⚡',6:'Descanso activo 🧘',0:'Futbol ⚽'}

async function buildAndSendEmail(uid: string, token: string, sb: any) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0,10)
  const yesterdayStr = new Date(Date.now()-86400000).toISOString().slice(0,10)
  const dayNum = today.getDay()
  const dateLabel = today.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'})

  const [tasksR, habitsR, logsR, mealsR, txR, cardsR, healthR] = await Promise.all([
    sb.from('user_tasks').select('title,is_recurring,days_of_week,last_completed_date,status,priority').eq('user_id',uid),
    sb.from('user_habits').select('name,emoji').eq('user_id',uid).eq('is_active',true).order('sort_order'),
    sb.from('user_habit_logs').select('habit_id').eq('user_id',uid).eq('log_date',todayStr),
    sb.from('meal_logs').select('calories,protein_g').eq('user_id',uid).eq('log_date',yesterdayStr),
    sb.from('transactions').select('amount_pen,type').eq('user_id',uid).eq('source','eecc').gte('date',todayStr.slice(0,7)+'-01'),
    sb.from('credit_cards').select('bank,last_four,current_balance,tcea').eq('user_id',uid).eq('is_active',true).gt('current_balance',0).order('tcea',{ascending:false,nullsFirst:false}).limit(1),
    sb.from('health_metrics').select('sleep_hours,steps').eq('user_id',uid).eq('log_date',yesterdayStr).maybeSingle(),
  ])

  const allTasks = tasksR.data||[]
  const todayTasks = allTasks.filter((t:any) => !t.is_recurring ? t.status!=='done' : t.days_of_week?.includes(dayNum) && t.last_completed_date!==todayStr)
  const homeTasks = todayTasks.filter((t:any)=>t.is_recurring)
  const personalTasks = todayTasks.filter((t:any)=>!t.is_recurring)
  const habits = habitsR.data||[]
  const doneIds = new Set((logsR.data||[]).map((l:any)=>l.habit_id))
  const pendingHabits = habits.filter((h:any)=>!doneIds.has(h.id))
  const calYest = Math.round((mealsR.data||[]).reduce((s:number,m:any)=>s+(m.calories||0),0))
  const protYest = Math.round((mealsR.data||[]).reduce((s:number,m:any)=>s+Number(m.protein_g||0),0))
  const gastoMes = Math.round((txR.data||[]).filter((t:any)=>t.type==='gasto').reduce((s:number,t:any)=>s+Number(t.amount_pen||0),0))
  const topCard = (cardsR.data||[])[0]
  const h = healthR.data

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:28px;border-radius:16px;">
<h2 style="color:#3b82f6;margin-top:0;">⚡ GC Personal OS — ${dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1)}</h2>
<div style="background:#1e293b;border-radius:12px;padding:20px;line-height:1.9;font-size:14px;">
<p>💪 <strong>Entrenamiento:</strong> ${PLAN[dayNum]}</p>
${homeTasks.length>0?`<p>🏠 <strong>Hogar hoy:</strong><br>${homeTasks.map((t:any)=>`&nbsp;&nbsp;▫️ ${t.title}`).join('<br>')}</p>`:''}
${pendingHabits.length>0?`<p>✅ <strong>Hábitos pendientes:</strong> ${doneIds.size}/${habits.length}<br>${pendingHabits.slice(0,5).map((h:any)=>`&nbsp;&nbsp;${h.emoji} ${h.name}`).join('<br>')}${pendingHabits.length>5?`<br>&nbsp;&nbsp;...y ${pendingHabits.length-5} más`:''}</p>`:'<p>✅ <strong>¡Todos los hábitos completados!</strong> 🎉</p>'}
${calYest>0?`<p>🥗 <strong>Nutrición ayer:</strong><br>&nbsp;&nbsp;${calYest>=2000?'✅':'⚠️'} ${calYest}/2300 kcal &nbsp; ${protYest>=160?'✅':'⚠️'} ${protYest}/190g proteína</p>`:''}
${h?.sleep_hours?`<p>😴 <strong>Salud ayer:</strong> ${h.sleep_hours}h sueño${h.steps?` · ${h.steps.toLocaleString()} pasos`:''}</p>`:''}
<p>💰 <strong>Finanzas:</strong><br>&nbsp;&nbsp;Gasto del mes: ${S(gastoMes)}<br>${topCard?`&nbsp;&nbsp;🔴 Prioridad: ${topCard.bank} ****${topCard.last_four} — ${S(Number(topCard.current_balance))} al ${topCard.tcea||'?'}% TCEA`:''}</p>
${personalTasks.length>0?`<p>📋 <strong>Pendientes:</strong><br>${personalTasks.slice(0,3).map((t:any)=>`&nbsp;&nbsp;${t.priority==='high'?'🔴':'▫️'} ${t.title}`).join('<br>')}${personalTasks.length>3?`<br>&nbsp;&nbsp;...y ${personalTasks.length-3} más`:''}</p>`:''}
</div>
<p style="margin-top:16px;padding:12px;background:#1e3a5f;border-radius:8px;color:#93c5fd;font-size:12px;">💬 Abre el <strong>GC Coach</strong> para preguntar sobre tu día</p>
<p style="color:#475569;font-size:11px;text-align:center;margin-top:16px;">GC Personal OS · Digest automático</p>
</div>`

  // Send via Gmail API (same as gmailmcp but using googleapis)
  const { google } = await import('googleapis')
  
  // Get stored access token from Supabase (needs to be refreshed periodically)
  // For now, use the GOOGLE_CLIENT env vars with a stored refresh token
  const oAuth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://finanzas-personal-nu.vercel.app/api/auth/callback/google'
  )
  
  // Get the user's stored token from api_tokens or a dedicated table
  const { data: tokenData } = await sb.from('api_tokens').select('*').eq('user_id', uid).maybeSingle()
  
  // If we have a gmail_refresh_token stored, use it
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  if (!refreshToken) {
    return { error: 'No Gmail refresh token configured' }
  }
  
  oAuth.setCredentials({ refresh_token: refreshToken })
  const gmail = google.gmail({ version: 'v1', auth: oAuth })

  const subject = `${dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1)} — GC OS 🌅`
  const emailLines = [`To: ${uid}`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`, 'MIME-Version: 1.0', 'Content-Type: text/html; charset=utf-8', '', html]
  const raw = Buffer.from(emailLines.join('\r\n')).toString('base64url')
  
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
  return { success: true }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const sb = createServiceClient()
  const { data: t } = await sb.from('api_tokens').select('user_id').eq('token', token||'').maybeSingle()
  if (!t) return NextResponse.json({ error: 'Token invalido' }, { status: 401 })
  const result = await buildAndSendEmail(t.user_id, token!, sb)
  return NextResponse.json(result)
}

// @ts-nocheck
// Copiloto IA Financiero — GPT-level financial advisor for Peru
// Claude Haiku → Gemini Flash fallback
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:0}).format(Math.round(n)||0)}`

function buildExpertContext(tx, cards, debts) {
  const months = ['2026-01','2026-02','2026-03','2026-04','2026-05']
  const MN = {'2026-01':'Ene','2026-02':'Feb','2026-03':'Mar','2026-04':'Abr','2026-05':'May'}
  const amtPen = (t) => Number(t.amount_pen||t.amount||0)

  const byMonth = {}
  months.forEach(m => {
    const g = tx.filter(t=>t.type==='gasto'&&t.category!=='Ahorro'&&t.date?.startsWith(m))
    const i = tx.filter(t=>t.type==='ingreso'&&t.category==='Sueldo'&&t.date?.startsWith(m))
    byMonth[m] = { gastos:Math.round(g.reduce((s,t)=>s+amtPen(t),0)), ingresos:Math.round(i.reduce((s,t)=>s+amtPen(t),0)) }
  })

  const byCat = {}
  tx.filter(t=>t.type==='gasto'&&t.category!=='Ahorro').forEach(t=>{
    byCat[t.category||'Otros'] = (byCat[t.category||'Otros']||0) + amtPen(t)
  })
  const topCats = Object.entries(byCat).sort(([,a],[,b])=>b-a).slice(0,15)

  const realCards = cards.filter(c=>!(c.bank==='Interbank'&&(c.name||'').toLowerCase().includes('access'))&&Number(c.current_balance)>0)
  const totalTC = realCards.reduce((s,c)=>s+Number(c.current_balance||0),0)
  const totalPrest = debts.reduce((s,d)=>s+Number(d.current_balance||0),0)
  const totalDebt = totalTC + totalPrest
  const minPayments = realCards.reduce((s,c)=>s+Number(c.minimum_payment||0),0) + debts.reduce((s,d)=>s+Number(d.monthly_payment||0),0)
  const income = Math.max(...months.map(m=>byMonth[m]?.ingresos||0).filter(v=>v>0), 8762)
  const avgMonthlyExpense = months.filter(m=>byMonth[m]?.gastos>0).reduce((s,m)=>s+byMonth[m].gastos,0) / Math.max(months.filter(m=>byMonth[m]?.gastos>0).length,1)
  const warda = tx.filter(t=>t.category==='Ahorro'&&t.type==='transferencia').reduce((s,t)=>s+amtPen(t),0)
  const dti = income>0?((minPayments/income)*100).toFixed(0):0
  const savings = tx.filter(t=>t.type==='transferencia'&&t.category==='Ahorro').reduce((s,t)=>s+amtPen(t),0)

  return `Eres un ASESOR FINANCIERO PERSONAL EXPERTO de primer nivel para Gian Carlo Asin Zapata, Lima, Perú.

Combinas el conocimiento de:
- Dave Ramsey (eliminación agresiva de deuda, baby steps)
- Morgan Housel (psicología del dinero)
- Robert Kiyosaki (flujo de caja, activos vs pasivos)
- Warren Buffett (costo de oportunidad, valor del dinero en el tiempo)
- Conocimiento profundo del sistema financiero peruano (BCR, SBS, AFPs, fondos mutuos, tasas)

═══ PERFIL FINANCIERO REAL ═══
Ingreso neto mensual: ${S(income)}
Gasto promedio mensual (real, sin duplicados): ${S(avgMonthlyExpense)}
Balance mensual promedio: ${S(income - avgMonthlyExpense)}
Tasa de endeudamiento (DTI): ${dti}% del sueldo en cuotas ${Number(dti)>40?'🔴 ALTO':Number(dti)>25?'⚠️ MODERADO':'✅ OK'}
WARDA acumulado: ${S(warda)}
Alquiler: USD $830/mes (dpto San Isidro/Chorrillos área)

═══ CASHFLOW Ene-May 2026 ═══
${months.filter(m=>byMonth[m]?.ingresos||byMonth[m]?.gastos).map(m=>`${MN[m]}: In ${S(byMonth[m].ingresos)} | Gasto ${S(byMonth[m].gastos)} | Balance ${S((byMonth[m].ingresos||0)-(byMonth[m].gastos||0))}`).join('\n')}

═══ DEUDAS (ordenadas por TCEA — ATACA EN ESTE ORDEN) ═══
${realCards.map(c=>`• ${c.bank} ${c.name} ***${c.last_four||'????'}: S/${Number(c.current_balance).toFixed(0)} saldo | TCEA ${c.tcea||c.tea||'?'}% | Mín S/${Number(c.minimum_payment||0).toFixed(0)}/mes | Corte día ${c.cut_date||'?'} | Pago día ${c.payment_due_date||'?'}`).join('\n')}
${debts.filter(d=>Number(d.current_balance)>0).map(d=>`• ${d.name} (${d.institution}): S/${Number(d.current_balance).toFixed(0)} | Cuota ${S(Number(d.monthly_payment||0))}/mes | TEA ${d.tea||d.tcea||'?'}% | ${d.remaining_installments||'?'} cuotas rest.`).join('\n')}
DEUDA TOTAL TARJETAS: ${S(totalTC)}
DEUDA TOTAL PRÉSTAMOS: ${S(totalPrest)}
DEUDA TOTAL: ${S(totalDebt)} = ${income>0?(totalDebt/income).toFixed(1):0} meses de sueldo

═══ GASTOS POR CATEGORÍA (total 5 meses) ═══
${topCats.map(([c,a])=>`• ${c}: ${S(a)} (${income>0?((a/(income*5))*100).toFixed(1):0}% del ingreso total)`).join('\n')}

═══ ANÁLISIS CLAVE ═══
Costo intereses estimado/año: ${S(totalTC * 0.60 + totalPrest * 0.135)} (promedio ponderado TCEA)
Regla 50/30/20 ideal: ${S(income*0.5)} necesidades | ${S(income*0.3)} deseos | ${S(income*0.2)} ahorro/deuda
Con ${S(income - avgMonthlyExpense - minPayments)} de margen libre: ${income - avgMonthlyExpense - minPayments > 0 ? 'disponible para atacar deuda' : '⚠️ en déficit'}

═══ ESTRATEGIA RECOMENDADA (Avalancha Dave Ramsey) ═══
1. BCP AMEX Platinum — 81.5% TCEA — ATACAR PRIMERO → sin dejarla usar
2. BBVA Mastercard Black — 69.99% TCEA 
3. BCP Visa Sapphire — 57% TCEA
4. IBK Visa Infinite — 34.8% TCEA (última)
Préstamos BCP/IBK: seguir pagando mínimo (tasas razonables)

═══ CÓMO RESPONDER ═══
- Español peruano directo y claro, como un buen amigo que sabe de finanzas
- Da números EXACTOS con sus datos reales
- Sé proactivo: si ves algo mal, díselo
- Cita técnicas con nombre ("la regla de avalancha dice...", "según el DTI estás en...")
- Cuando den opciones, recomienda la MEJOR para su perfil (reducir deuda)
- No suavices malas noticias — la verdad financiera ayuda más
- Máximo 400 palabras por respuesta, bullet points cuando sea útil`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { messages } = await req.json()
  const supabase = createServiceClient()
  const uid = session.user.id

  const [txR, cR, dR] = await Promise.all([
    supabase.from('transactions').select('amount,amount_pen,type,category,description,merchant,date,bank,currency,is_recurring').eq('user_id',uid).eq('source','eecc').order('date',{ascending:false}).limit(800),
    supabase.from('credit_cards').select('*').eq('user_id',uid).eq('is_active',true),
    supabase.from('debts').select('*').eq('user_id',uid).eq('is_active',true),
  ])

  const systemPrompt = buildExpertContext(txR.data||[], cR.data||[], dR.data||[])
  const chatMsgs = messages.map(m=>({ role:m.role==='assistant'?'assistant':'user', content:m.content }))

  // Try Claude Haiku
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':anthropicKey,'anthropic-version':'2023-06-01'},
        body:JSON.stringify({model:'claude-haiku-4-5',max_tokens:1200,system:systemPrompt,messages:chatMsgs}),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.content?.[0]?.text) return NextResponse.json({reply:data.content[0].text,model:'Claude Haiku'})
      }
    } catch(e) { console.log('Anthropic:', e.message) }
  }

  // Fallback: Gemini Flash
  const gKey = process.env.GEMINI_API_KEY || 'AIzaSyDM12m8wsZQSs1jrnFDOu_n1e49lBc6T-8'
  try {
    const gemContents = chatMsgs.map((m,i)=>({
      role:m.role==='assistant'?'model':'user',
      parts:[{text:i===0&&m.role==='user'?`${systemPrompt}\n\n---\n${m.content}`:m.content}]
    }))
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gKey}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:gemContents,generationConfig:{maxOutputTokens:1200,temperature:0.7}})
    })
    if (res.ok) {
      const data = await res.json()
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (reply) return NextResponse.json({reply,model:'Gemini Flash'})
    }
  } catch(e) { console.log('Gemini:', e.message) }

  return NextResponse.json({reply:'⚠️ Copiloto no disponible. Agrega ANTHROPIC_API_KEY en Vercel → Settings → Environment Variables.'})
}

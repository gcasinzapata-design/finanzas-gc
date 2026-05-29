// @ts-nocheck
// Copiloto IA — Claude Haiku primario, Gemini Flash fallback (ambos funcionan en Vercel)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0 }).format(n || 0)}`

function buildContext(tx, cards, debts) {
  const months = ['2026-01','2026-02','2026-03','2026-04','2026-05']
  const MN = {'2026-01':'Ene','2026-02':'Feb','2026-03':'Mar','2026-04':'Abr','2026-05':'May'}
  const amtPen = (t) => Number(t.amount_pen || t.amount || 0)

  const byMonth = {}
  months.forEach(m => {
    const g = tx.filter(t => t.type==='gasto' && t.category!=='Ahorro' && t.date?.startsWith(m))
    const i = tx.filter(t => t.type==='ingreso' && t.category==='Sueldo' && t.date?.startsWith(m))
    byMonth[m] = {
      gastos: Math.round(g.reduce((s,t) => s+amtPen(t), 0)),
      ingresos: Math.round(i.reduce((s,t) => s+amtPen(t), 0)),
    }
  })

  const byCat = {}
  tx.filter(t => t.type==='gasto' && t.category!=='Ahorro').forEach(t => {
    byCat[t.category||'Otros'] = (byCat[t.category||'Otros']||0) + amtPen(t)
  })
  const topCats = Object.entries(byCat).sort(([,a],[,b])=>b-a).slice(0,15)

  const realCards = cards.filter(c => !(c.bank==='Interbank' && (c.name||'').toLowerCase().includes('access')))
  const totalTC = realCards.reduce((s,c) => s+Number(c.current_balance||0), 0)
  const totalPrest = debts.reduce((s,d) => s+Number(d.current_balance||0), 0)
  const cuotas = realCards.reduce((s,c) => s+Number(c.minimum_payment||0), 0)
    + debts.reduce((s,d) => s+Number(d.monthly_payment||0), 0)
  const sueldo = Math.max(...months.map(m => byMonth[m]?.ingresos||0).filter(v=>v>0))

  return `Eres el COPILOTO FINANCIERO PERSONAL de Gian Carlo Asin Zapata. Asesor experto en finanzas personales peruanas.

═══ CASHFLOW REAL Ene–May 2026 ═══
${months.filter(m=>byMonth[m]?.ingresos||byMonth[m]?.gastos).map(m =>
  `${MN[m]}: Ingresos ${S(byMonth[m].ingresos)} | Gastos ${S(byMonth[m].gastos)} | Balance ${byMonth[m].ingresos>0?S(byMonth[m].ingresos-byMonth[m].gastos):'(sin sueldo registrado)'}`
).join('\n')}

═══ TARJETAS DE CRÉDITO ═══
${realCards.filter(c=>Number(c.current_balance)>0).map(c =>
  `• ${c.bank} ${c.name} ***${c.last_four||'????'}: S/${Number(c.current_balance).toFixed(0)} | TCEA ${c.tcea||c.tea||'?'}% | Mín S/${Number(c.minimum_payment||0).toFixed(0)}/mes`
).join('\n')}
TOTAL TC: ${S(totalTC)}

═══ PRÉSTAMOS ═══
${debts.filter(d=>Number(d.current_balance)>0).map(d =>
  `• ${d.name}: S/${Number(d.current_balance).toFixed(0)} | Cuota ${S(Number(d.monthly_payment||0))}/mes | ${d.remaining_installments||'?'} cuotas restantes`
).join('\n')}
TOTAL PRÉSTAMOS: ${S(totalPrest)}

═══ RESUMEN ═══
Deuda total: ${S(totalTC+totalPrest)}
Cuotas/mes: ${S(cuotas)} (${sueldo>0?(cuotas/sueldo*100).toFixed(0):'?'}% del sueldo de ${S(sueldo)})

═══ GASTOS POR CATEGORÍA (histórico) ═══
${topCats.map(([c,a])=>`• ${c}: ${S(a)}`).join('\n')}

═══ ESTRATEGIA RECOMENDADA ═══
Orden avalancha (TCEA mayor primero):
1. BCP AMEX Platinum: 81.5% TCEA — atacar primero
2. BBVA Mastercard Black: 69.99% TCEA
3. BCP Visa Sapphire: 57% TCEA
4. Interbank Visa Infinite: 34.8% TCEA

═══ REGLAS ═══
- Habla en español natural y directo, como un asesor financiero peruano
- Da consejos ACCIONABLES con números exactos
- Usa S/ para soles, $ para dólares
- WARDA es el mecanismo de ahorro automático (no es gasto)
- Sé conciso pero completo`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { messages } = await req.json()
  const supabase = createServiceClient()
  const uid = session.user.id

  // Load financial data
  const [txR, cR, dR] = await Promise.all([
    supabase.from('transactions').select('amount,amount_pen,type,category,description,merchant,date,bank,currency,is_recurring').eq('user_id', uid).eq('source','eecc').order('date',{ascending:false}).limit(800),
    supabase.from('credit_cards').select('*').eq('user_id', uid).eq('is_active', true),
    supabase.from('debts').select('*').eq('user_id', uid).eq('is_active', true),
  ])

  const systemPrompt = buildContext(txR.data||[], cR.data||[], dR.data||[])
  const chatMessages = messages.map(m => ({ role: m.role==='assistant'?'assistant':'user', content: m.content }))

  // ── 1. Try Anthropic Claude Haiku ──
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':anthropicKey, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model:'claude-haiku-4-5', max_tokens:1200, system:systemPrompt, messages:chatMessages }),
      })
      if (res.ok) {
        const data = await res.json()
        const reply = data.content?.[0]?.text
        if (reply) return NextResponse.json({ reply, model:'Claude Haiku' })
      }
      if (res.status === 402) {
        // No credits — fall through to Gemini
        console.log('Anthropic: no credits, falling back to Gemini')
      }
    } catch (e) {
      console.log('Anthropic error:', e.message)
    }
  }

  // ── 2. Gemini Flash (free, works in Vercel serverless) ──
  const geminiKey = process.env.GEMINI_API_KEY || 'AIzaSyDM12m8wsZQSs1jrnFDOu_n1e49lBc6T-8'
  try {
    // Build Gemini message — include system context in first user message
    const geminiContents = chatMessages.map((m, i) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: i === 0 && m.role === 'user'
        ? `${systemPrompt}\n\n---\nConsulta de Gian Carlo: ${m.content}`
        : m.content
      }]
    }))

    const gemRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: { maxOutputTokens: 1200, temperature: 0.7 }
        }),
      }
    )
    if (gemRes.ok) {
      const data = await gemRes.json()
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (reply) return NextResponse.json({ reply, model:'Gemini Flash' })
    }
  } catch (e) {
    console.log('Gemini error:', e.message)
  }

  // ── 3. No AI available ──
  return NextResponse.json({
    reply: `⚠️ El Copiloto IA no está disponible en este momento.\n\n**Para activarlo:**\n1. Ve a [vercel.com/dashboard](https://vercel.com) → finanzas-personal → Settings → Environment Variables\n2. Agrega \`ANTHROPIC_API_KEY\` con tu key de [console.anthropic.com](https://console.anthropic.com)\n\nEl costo es ~$0.01 por conversación con Claude Haiku.`
  })
}

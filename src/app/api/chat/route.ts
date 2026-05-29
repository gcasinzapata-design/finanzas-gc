// @ts-nocheck
// Copiloto IA usa Gemini Flash (free tier) para análisis financiero
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n || 0)}`

function buildSystem(tx, cards, debts) {
  const months = ['2026-02', '2026-03', '2026-04', '2026-05']
  const amtPen = (t) => Number(t.amount_pen || t.amount || 0)

  const byMonth = {}
  months.forEach(m => {
    const g = tx.filter(t => t.type === 'gasto' && t.category !== 'Ahorro' && t.date?.startsWith(m))
    const i = tx.filter(t => t.type === 'ingreso' && t.category === 'Sueldo' && t.date?.startsWith(m))
    byMonth[m] = {
      gastos: g.reduce((s, t) => s + amtPen(t), 0),
      ingresos: i.reduce((s, t) => s + amtPen(t), 0),
    }
  })

  const byCat = {}
  tx.filter(t => t.type === 'gasto' && t.category !== 'Ahorro').forEach(t => {
    const c = t.category || 'Otros'
    byCat[c] = (byCat[c] || 0) + amtPen(t)
  })
  const topCats = Object.entries(byCat).sort(([,a],[,b]) => b-a).slice(0, 12)

  const realCards = cards.filter(c => !(c.bank === 'Interbank' && (c.name||'').toLowerCase().includes('access')))
  const totalTC = realCards.reduce((s, c) => s + Number(c.current_balance||0), 0)
  const totalPrest = debts.reduce((s, d) => s + Number(d.current_balance||0), 0)
  const cuotas = realCards.reduce((s,c) => s + Number(c.minimum_payment||0), 0)
    + debts.reduce((s,d) => s + Number(d.monthly_payment||0), 0)
  const sueldo = byMonth['2026-05']?.ingresos || byMonth['2026-04']?.ingresos || 8762

  return `Eres el COPILOTO FINANCIERO de Gian Carlo Asin Zapata, asesor financiero personal experto en Perú.

DATOS REALES (Feb–May 2026):

📅 CASHFLOW MENSUAL (PEN):
Feb: Ingresos ${S(byMonth['2026-02']?.ingresos)} | Gastos ${S(byMonth['2026-02']?.gastos)} | Balance ${S(byMonth['2026-02']?.ingresos - byMonth['2026-02']?.gastos)}
Mar: Ingresos ${S(byMonth['2026-03']?.ingresos)} | Gastos ${S(byMonth['2026-03']?.gastos)} | Balance ${S(byMonth['2026-03']?.ingresos - byMonth['2026-03']?.gastos)}
Abr: Ingresos ${S(byMonth['2026-04']?.ingresos)} | Gastos ${S(byMonth['2026-04']?.gastos)} | Balance ${S(byMonth['2026-04']?.ingresos - byMonth['2026-04']?.gastos)}
May: Ingresos ${S(byMonth['2026-05']?.ingresos)} | Gastos ${S(byMonth['2026-05']?.gastos)}

💳 TARJETAS DE CRÉDITO:
${realCards.filter(c=>Number(c.current_balance)>0).map(c => `  • ${c.bank} ${c.name} ***${c.last_four}: S/${Number(c.current_balance).toFixed(0)} deuda | TCEA ${c.tcea||c.tea||'?'}% | Mín S/${Number(c.minimum_payment||0).toFixed(0)}/mes`).join('\n')}
  TOTAL TC: ${S(totalTC)}

🏦 PRÉSTAMOS:
${debts.filter(d=>Number(d.current_balance)>0).map(d => `  • ${d.name} (${d.institution}): S/${Number(d.current_balance).toFixed(0)} | Cuota ${S(Number(d.monthly_payment||0))}/mes | TEA ${d.tea||'?'}% | ${d.remaining_installments||'?'} cuotas rest.`).join('\n')}
  TOTAL PRÉSTAMOS: ${S(totalPrest)}

💰 DEUDA TOTAL: ${S(totalTC + totalPrest)} | CUOTAS/MES: ${S(cuotas)} (${(cuotas/sueldo*100).toFixed(0)}% del sueldo)

📊 TOP CATEGORÍAS (histórico):
${topCats.map(([c,a]) => `  • ${c}: ${S(a)}`).join('\n')}

REGLAS:
- Usa S/ para soles, $ para dólares
- Da consejos ACCIONABLES y ESPECÍFICOS con números exactos
- Orden avalancha: AMEX BCP 81.5% → Visa Sapphire 57% → BBVA Black 69.99% → IBK Infinite 34.8%
- Habla en español peruano natural y directo`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const { messages } = await req.json()
    const supabase = createServiceClient()
    const uid = session.user.id

    const [txR, cR, dR] = await Promise.all([
      supabase.from('transactions').select('amount,amount_pen,type,category,description,merchant,date,bank,currency,is_recurring').eq('user_id', uid).in('source', ['eecc','gmail']).order('date', { ascending: false }).limit(600),
      supabase.from('credit_cards').select('*').eq('user_id', uid).eq('is_active', true),
      supabase.from('debts').select('*').eq('user_id', uid).eq('is_active', true),
    ])

    const systemPrompt = buildSystem(txR.data || [], cR.data || [], dR.data || [])

    // Try Anthropic first, fall back to Gemini
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY || 'AIzaSyDM12m8wsZQSs1jrnFDOu_n1e49lBc6T-8'

    const anthroMessages = messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))

    // Try Anthropic
    if (anthropicKey) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1500, system: systemPrompt, messages: anthroMessages }),
        })
        if (res.ok) {
          const data = await res.json()
          const reply = data.content?.[0]?.text
          if (reply) return NextResponse.json({ reply, model: 'Claude Haiku' })
        }
      } catch {}
    }

    // Fallback to Gemini Flash (free)
    const geminiMessages = [
      { role: 'user', parts: [{ text: systemPrompt + '\n\nAhora responde esta consulta de Gian Carlo:\n\n' + messages[messages.length-1]?.content }] }
    ]
    
    const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: geminiMessages, generationConfig: { maxOutputTokens: 1500 } }),
    })

    if (gemRes.ok) {
      const data = await gemRes.json()
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (reply) return NextResponse.json({ reply, model: 'Gemini Flash' })
    }

    return NextResponse.json({ reply: '⚠️ No hay servicio de IA disponible. Verifica la ANTHROPIC_API_KEY en Vercel → Settings → Environment Variables.' })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    console.error('Chat error:', msg)
    return NextResponse.json({ reply: `Error: ${msg}` })
  }
}

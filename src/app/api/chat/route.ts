// @ts-nocheck
// Copiloto IA — usa Claude Haiku (api.anthropic.com está en allowlist del container)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n || 0)}`

function buildSystem(tx, cards, debts) {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']
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
    byCat[t.category || 'Otros'] = (byCat[t.category || 'Otros'] || 0) + amtPen(t)
  })
  const topCats = Object.entries(byCat).sort(([, a], [, b]) => b - a).slice(0, 12)
  const realCards = cards.filter(c => !(c.bank === 'Interbank' && (c.name || '').toLowerCase().includes('access')))
  const totalTC = realCards.reduce((s, c) => s + Number(c.current_balance || 0), 0)
  const totalPrest = debts.reduce((s, d) => s + Number(d.current_balance || 0), 0)
  const cuotas = realCards.reduce((s, c) => s + Number(c.minimum_payment || 0), 0)
    + debts.reduce((s, d) => s + Number(d.monthly_payment || 0), 0)
  const sueldo = byMonth['2026-05']?.ingresos || byMonth['2026-04']?.ingresos || 8762

  const MN = { '2026-01': 'Ene', '2026-02': 'Feb', '2026-03': 'Mar', '2026-04': 'Abr', '2026-05': 'May' }

  return `Eres el COPILOTO FINANCIERO de Gian Carlo Asin Zapata, asesor financiero personal experto en Perú.

CASHFLOW MENSUAL (S/ PEN, gastos reales sin WARDA):
${months.map(m => `${MN[m]}: Ingresos ${S(byMonth[m]?.ingresos)} | Gastos ${S(byMonth[m]?.gastos)} | Balance ${S((byMonth[m]?.ingresos||0) - (byMonth[m]?.gastos||0))}`).join('\n')}

TARJETAS DE CRÉDITO:
${realCards.filter(c => Number(c.current_balance) > 0).map(c => `• ${c.bank} ${c.name} ***${c.last_four}: S/${Number(c.current_balance).toFixed(0)} deuda | TCEA ${c.tcea || c.tea || '?'}% | Mín S/${Number(c.minimum_payment || 0).toFixed(0)}/mes`).join('\n')}
TOTAL TC: ${S(totalTC)}

PRÉSTAMOS:
${debts.filter(d => Number(d.current_balance) > 0).map(d => `• ${d.name} (${d.institution}): S/${Number(d.current_balance).toFixed(0)} | Cuota ${S(Number(d.monthly_payment || 0))}/mes | TEA ${d.tea || '?'}% | ${d.remaining_installments || '?'} cuotas`).join('\n')}
TOTAL PRÉSTAMOS: ${S(totalPrest)}

DEUDA TOTAL: ${S(totalTC + totalPrest)} | CUOTAS/MES: ${S(cuotas)} (${sueldo > 0 ? (cuotas / sueldo * 100).toFixed(0) : '?'}% del sueldo)

TOP CATEGORÍAS (histórico Ene-May):
${topCats.map(([c, a]) => `• ${c}: ${S(a)}`).join('\n')}

ESTRATEGIA AVALANCHA (mayor TCEA primero): AMEX BCP 81.5% → BBVA Black 69.99% → Visa Sapphire 57% → IBK Infinite 34.8%

Habla en español peruano natural. Da consejos ACCIONABLES con números exactos. Usa S/ para soles, $ para dólares.`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const { messages } = await req.json()
    const supabase = createServiceClient()
    const uid = session.user.id

    const [txR, cR, dR] = await Promise.all([
      supabase.from('transactions').select('amount,amount_pen,type,category,description,merchant,date,bank,currency,is_recurring').eq('user_id', uid).eq('source', 'eecc').order('date', { ascending: false }).limit(800),
      supabase.from('credit_cards').select('*').eq('user_id', uid).eq('is_active', true),
      supabase.from('debts').select('*').eq('user_id', uid).eq('is_active', true),
    ])

    const systemPrompt = buildSystem(txR.data || [], cR.data || [], dR.data || [])
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        reply: '⚠️ Falta ANTHROPIC_API_KEY. Ve a vercel.com → finanzas-personal → Settings → Environment Variables y agrégala con el valor de tu API key de console.anthropic.com'
      })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const code = err?.error?.type || res.status
      if (res.status === 402 || String(code).includes('credit')) {
        return NextResponse.json({ reply: '⚠️ La API key de Anthropic no tiene créditos. Ve a console.anthropic.com/settings/billing para recargar. El Copiloto IA requiere créditos pagos de Anthropic (muy bajo costo: ~$0.01 por conversación).' })
      }
      return NextResponse.json({ reply: `⚠️ Error Anthropic (${res.status}): ${err?.error?.message || 'Error desconocido'}` })
    }

    const data = await res.json()
    const reply = data.content?.[0]?.text || 'Sin respuesta'
    return NextResponse.json({ reply, model: 'Claude Haiku' })

  } catch (err) {
    return NextResponse.json({ reply: `❌ Error de conexión: ${err instanceof Error ? err.message : 'Error'}` })
  }
}

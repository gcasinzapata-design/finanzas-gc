// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

function fmt(n) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

function buildSystemPrompt(tx, cards, debts, goals) {
  const now = new Date()
  const months = ['2026-02', '2026-03', '2026-04', '2026-05']
  
  // Gastos por mes
  const byMonth = {}
  months.forEach(m => {
    const g = tx.filter(t => t.type === 'gasto' && t.date?.startsWith(m) && t.currency === 'PEN')
    const i = tx.filter(t => t.type === 'ingreso' && t.date?.startsWith(m) && t.currency === 'PEN')
    byMonth[m] = {
      gastos: g.reduce((s, t) => s + Number(t.amount), 0),
      ingresos: i.reduce((s, t) => s + Number(t.amount), 0),
    }
  })

  // Top categorías (histórico)
  const byCat = {}
  tx.filter(t => t.type === 'gasto' && t.currency === 'PEN').forEach(t => {
    const c = t.category || 'Otros'
    byCat[c] = (byCat[c] || 0) + Number(t.amount)
  })
  const topCats = Object.entries(byCat).sort(([, a], [, b]) => b - a).slice(0, 10)

  // Gastos fijos
  const fixedTx = tx.filter(t => t.is_recurring && t.type === 'gasto' && t.date?.startsWith('2026-04'))
  const fixedByLabel = {}
  fixedTx.forEach(t => {
    const l = t.recurring_label || t.category
    fixedByLabel[l] = (fixedByLabel[l] || 0) + Number(t.amount)
  })
  const totalFijosAbr = Object.values(fixedByLabel).reduce((s, v) => s + v, 0)

  const totalTarjetas = cards.reduce((s, c) => s + Number(c.current_balance || 0), 0)
  const totalPrestamos = debts.reduce((s, d) => s + Number(d.current_balance || 0), 0)
  const cuotasPrest = debts.reduce((s, d) => s + Number(d.monthly_payment || 0), 0)
  const cuotasTC = cards.reduce((s, c) => s + Number(c.minimum_payment || 0), 0)
  const sueldoAbr = byMonth['2026-04']?.ingresos || 8762.23
  const ratioDeuda = sueldoAbr > 0 ? ((cuotasPrest + cuotasTC) / sueldoAbr * 100).toFixed(1) : 'N/A'

  const deudas = [
    ...cards.filter(c => Number(c.current_balance) > 0).map(c => ({
      n: `${c.bank} ${c.name} ***${c.last_four || ''}`,
      s: Number(c.current_balance),
      t: Number(c.tcea || c.tea || 0),
      m: Number(c.minimum_payment || 0),
      tipo: 'TC',
      corte: c.cut_date,
      vence: c.payment_due_date
    })),
    ...debts.filter(d => Number(d.current_balance) > 0).map(d => ({
      n: `${d.name} (${d.institution})`,
      s: Number(d.current_balance),
      t: Number(d.tea || d.tcea || 0),
      m: Number(d.monthly_payment || 0),
      tipo: 'Préstamo',
      cuotasRest: d.remaining_installments,
      prox: d.next_payment_date
    }))
  ]

  return `Eres el COPILOTO FINANCIERO de Gian Carlo Asin Zapata, un asesor financiero personal experto en finanzas peruanas.

CONTEXTO DE GIAN CARLO:
- Trabaja en Lima, Perú. Sueldo neto: ~S/8,762/mes (CTS + gratificaciones adicionales)
- Situación de deuda CRÍTICA: ratio compromisos/ingreso ~97%
- Objetivo: salir de deudas, sobretodo las tarjetas de crédito con tasas altas

━━━━━━━━━ DATOS FINANCIEROS ACTUALES ━━━━━━━━━

📅 HISTORIAL MENSUAL (PEN):
Feb 2026: Ingresos S/${fmt(byMonth['2026-02']?.ingresos)} | Gastos S/${fmt(byMonth['2026-02']?.gastos)} | Balance S/${fmt((byMonth['2026-02']?.ingresos||0) - (byMonth['2026-02']?.gastos||0))}
Mar 2026: Ingresos S/${fmt(byMonth['2026-03']?.ingresos)} | Gastos S/${fmt(byMonth['2026-03']?.gastos)} | Balance S/${fmt((byMonth['2026-03']?.ingresos||0) - (byMonth['2026-03']?.gastos||0))}
Abr 2026: Ingresos S/${fmt(byMonth['2026-04']?.ingresos)} | Gastos S/${fmt(byMonth['2026-04']?.gastos)} | Balance S/${fmt((byMonth['2026-04']?.ingresos||0) - (byMonth['2026-04']?.gastos||0))}

📊 GASTOS FIJOS IDENTIFICADOS (Abr): S/${fmt(totalFijosAbr)}/mes
${Object.entries(fixedByLabel).sort(([,a],[,b]) => b-a).map(([l, a]) => `  • ${l}: S/${fmt(a)}`).join('\n')}

💳 TARJETAS DE CRÉDITO (${cards.length}):
${cards.filter(c=>Number(c.current_balance)>0).map(c => `  • ${c.bank} ${c.name} ***${c.last_four||'?'}: Deuda S/${fmt(c.current_balance)} | TCEA ${c.tcea||c.tea||'?'}% | Límite S/${fmt(c.credit_limit)} | Pago mín S/${fmt(c.minimum_payment||0)} | Corte día ${c.cut_date||'?'} | Vence día ${c.payment_due_date||'?'}`).join('\n')}
  TOTAL TC: S/${fmt(totalTarjetas)}

🏦 PRÉSTAMOS (${debts.length}):
${debts.filter(d=>Number(d.current_balance)>0).map(d => `  • ${d.name} (${d.institution}): Saldo S/${fmt(d.current_balance)} | Cuota S/${fmt(d.monthly_payment||0)}/mes | TEA ${d.tea||'?'}% | ${d.remaining_installments||'?'} cuotas restantes | Próx: ${d.next_payment_date||'?'}`).join('\n')}
  TOTAL PRÉSTAMOS: S/${fmt(totalPrestamos)}

💰 DEUDA TOTAL: S/${fmt(totalTarjetas + totalPrestamos)}
📉 COMPROMISOS FIJOS: S/${fmt(cuotasPrest + cuotasTC)}/mes (${ratioDeuda}% del sueldo)
💵 LIQUIDEZ ESTIMADA: S/${fmt(Math.max(0, sueldoAbr - cuotasPrest - cuotasTC))}/mes

🎯 OBJETIVOS FINANCIEROS:
${goals.length > 0 ? goals.map(g => `  • ${g.icon||'🎯'} ${g.name}: S/${fmt(g.current_amount)}/S/${fmt(g.target_amount)} (${(g.current_amount/g.target_amount*100).toFixed(0)}%)`).join('\n') : '  • Sin objetivos definidos aún'}

📈 TOP CATEGORÍAS DE GASTO (histórico):
${topCats.map(([c, a]) => `  • ${c}: S/${fmt(a)}`).join('\n')}

🔴 ORDEN AVALANCHA (mayor TCEA primero — óptimo para ahorrar intereses):
${[...deudas].filter(d=>d.t>0).sort((a,b) => b.t - a.t).map((d,i) => `  ${i+1}. ${d.n}: S/${fmt(d.s)} al ${d.t}% | mín S/${fmt(d.m)}/mes`).join('\n')}

🟢 ORDEN BOLA DE NIEVE (menor saldo primero — motivación rápida):
${[...deudas].sort((a,b) => a.s - b.s).map((d,i) => `  ${i+1}. ${d.n}: S/${fmt(d.s)}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCCIONES:
1. Sé ESPECÍFICO con números exactos (siempre usa S/ para soles, $ para dólares)
2. Da consejos ACCIONABLES, no solo informativos
3. Cuando hagas cálculos de deudas, muestra el math completo
4. Habla en español peruano natural y directo
5. Si detectas oportunidades de ahorro o errores, señálalos claramente
6. Priorizan estrategias reales dado el flujo de caja ajustado de Gian Carlo
7. Menciona fechas de corte/pago de tarjetas cuando sea relevante`
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const { messages } = await req.json()
    const supabase = createServiceClient()
    const uid = session.user.id

    const [txR, cR, dR, gR] = await Promise.all([
      supabase.from('transactions').select('amount,type,category,description,merchant,date,bank,currency,is_recurring,recurring_label').eq('user_id', uid).eq('source', 'eecc').order('date', { ascending: false }).limit(500),
      supabase.from('credit_cards').select('*').eq('user_id', uid).eq('is_active', true),
      supabase.from('debts').select('*').eq('user_id', uid).eq('is_active', true),
      supabase.from('financial_goals').select('*').eq('user_id', uid).eq('is_completed', false),
    ])

    const systemPrompt = buildSystemPrompt(txR.data || [], cR.data || [], dR.data || [], gR.data || [])

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ reply: '⚠️ ANTHROPIC_API_KEY no configurada en Vercel. Ve a Settings → Environment Variables y agrégala.' })
    }

    const client = new Anthropic({ apiKey })

    const anthropicMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: systemPrompt,
      messages: anthropicMessages,
    })

    const reply = response.content[0]?.text || 'Sin respuesta'
    return NextResponse.json({ reply })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    if (msg.includes('quota') || msg.includes('429') || msg.includes('rate')) {
      return NextResponse.json({ reply: '⚠️ Límite de API alcanzado. Espera un momento e intenta de nuevo.' })
    }
    console.error('Chat error:', msg)
    return NextResponse.json({ reply: `Error: ${msg}` })
  }
}

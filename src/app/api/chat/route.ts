// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

function fmt(n) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n || 0)
}

function buildContext(tx, cards, debts, goals) {
  const now = new Date()
  const thisMonth = now.toISOString().slice(0, 7)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1).toISOString().slice(0, 7)
  const gastosEste = tx.filter(t => t.type === 'gasto' && t.date?.startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0)
  const gastosAnte = tx.filter(t => t.type === 'gasto' && t.date?.startsWith(lastMonth)).reduce((s, t) => s + t.amount, 0)
  const ingresosEste = tx.filter(t => t.type === 'ingreso' && t.date?.startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0)
  const byCat = {}
  tx.filter(t => t.type === 'gasto').forEach(t => { const c = t.category || 'Otros'; byCat[c] = (byCat[c] || 0) + t.amount })
  const topCats = Object.entries(byCat).sort(([, a], [, b]) => b - a).slice(0, 8)
  const totalTarjetas = cards.reduce((s, c) => s + (c.current_balance || 0), 0)
  const totalPrestamos = debts.reduce((s, d) => s + (d.current_balance || 0), 0)
  const cuotasMin = cards.reduce((s, c) => s + (c.minimum_payment || 0), 0)
  const cuotasPrest = debts.reduce((s, d) => s + (d.monthly_payment || 0), 0)
  const totalComp = cuotasMin + cuotasPrest
  const ratio = ingresosEste > 0 ? (totalComp / ingresosEste * 100).toFixed(1) : 'N/A'
  const liquidez = Math.max(0, ingresosEste - gastosEste - totalComp)
  const deudas = [
    ...cards.filter(c => c.current_balance > 0).map(c => ({ n: `${c.bank} ${c.name}`, s: c.current_balance, t: c.tcea || 0, m: c.minimum_payment || 0 })),
    ...debts.filter(d => d.current_balance > 0).map(d => ({ n: d.name, s: d.current_balance, t: d.tea || 0, m: d.monthly_payment || 0 }))
  ]
  return {
    system: `Eres un asesor financiero y contador personal experto para peruanos. Conoces a fondo: SBS, TCEA, TEA, AFP, CTS, gratificaciones, bancos locales (BCP, Interbank, Scotiabank, BBVA, Mibanco), Yape, Plin.

MISION: dar consejos ESPECIFICOS con NUMEROS EXACTOS. Calculas estrategias reales de eliminación de deudas, optimización de tarjetas, gestión de liquidez y planificación financiera.

REGLAS:
- Siempre usa S/ para soles y $ para dólares
- Da números exactos, no rangos
- Si faltan datos (TCEA, TEA), dilo y pide que los complete en la sección Tarjetas/Deudas
- Habla en español peruano natural y directo
- Para estrategias de deuda, muestra el math: cuánto pagar, cuándo terminas, cuánto ahorras`,
    data: `SITUACION FINANCIERA ACTUAL (${now.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}):

MES ${thisMonth}: Ingresos S/${fmt(ingresosEste)} | Gastos S/${fmt(gastosEste)} (ant: S/${fmt(gastosAnte)}) | Balance S/${fmt(ingresosEste - gastosEste)}
Compromisos fijos: S/${fmt(totalComp)}/mes | Liquidez disponible: S/${fmt(liquidez)} | Ratio deuda/ingreso: ${ratio}%

TARJETAS (${cards.length}):
${cards.map(c => `- ${c.bank} ${c.name}: Deuda S/${fmt(c.current_balance)} | Limite S/${c.credit_limit ? fmt(c.credit_limit) : 'N/A'} | TCEA ${c.tcea || '?'}% | Pago min S/${fmt(c.minimum_payment || 0)} | Vence dia ${c.payment_due_date || '?'} | Corte dia ${c.cut_date || '?'}`).join('\n') || '- Sin tarjetas registradas'}
Total tarjetas: S/${fmt(totalTarjetas)}

PRESTAMOS (${debts.length}):
${debts.map(d => `- ${d.name}${d.institution ? ` (${d.institution})` : ''}: Saldo S/${fmt(d.current_balance)} | Cuota S/${fmt(d.monthly_payment || 0)}/mes | TEA ${d.tea || '?'}% | ${d.remaining_installments || '?'} cuotas rest.`).join('\n') || '- Sin prestamos registrados'}
Total prestamos: S/${fmt(totalPrestamos)}
DEUDA TOTAL: S/${fmt(totalTarjetas + totalPrestamos)}

OBJETIVOS:
${goals.map(g => `- ${g.icon} ${g.name}: S/${fmt(g.current_amount)}/S/${fmt(g.target_amount)} (${g.target_amount > 0 ? (g.current_amount / g.target_amount * 100).toFixed(0) : 0}%)`).join('\n') || '- Sin objetivos definidos'}

TOP GASTOS HISTORICOS:
${topCats.map(([c, a]) => `- ${c}: S/${fmt(a)}`).join('\n') || '- Sin transacciones aun'}

ORDEN AVALANCHA (mayor tasa = menos intereses):
${[...deudas].sort((a, b) => b.t - a.t).map((d, i) => `${i + 1}. ${d.n}: S/${fmt(d.s)} al ${d.t}% | min S/${fmt(d.m)}/mes`).join('\n') || '- Sin deudas'}

ORDEN BOLA DE NIEVE (menor saldo = motivacion rapida):
${[...deudas].sort((a, b) => a.s - b.s).map((d, i) => `${i + 1}. ${d.n}: S/${fmt(d.s)}`).join('\n') || '- Sin deudas'}

ULTIMAS 15 TRANSACCIONES:
${tx.slice(0, 15).map(t => `${t.date?.slice(0, 10)} | ${t.type === 'ingreso' ? '+' : '-'}S/${fmt(t.amount)} | ${t.currency !== 'PEN' ? t.currency : ''} ${t.merchant || t.description?.slice(0, 25)} | ${t.category}`).join('\n') || '- Sin transacciones registradas aun'}`
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const { messages } = await req.json()
    const supabase = createServiceClient()
    const uid = session.user.id

    const [txR, cR, dR, gR] = await Promise.all([
      supabase.from('transactions').select('amount,type,category,description,merchant,date,bank,currency').eq('user_id', uid).order('date', { ascending: false }).limit(200),
      supabase.from('credit_cards').select('*').eq('user_id', uid).eq('is_active', true),
      supabase.from('debts').select('*').eq('user_id', uid).eq('is_active', true),
      supabase.from('financial_goals').select('*').eq('user_id', uid).eq('is_completed', false),
    ])

    const ctx = buildContext(txR.data || [], cR.data || [], dR.data || [], gR.data || [])

    const key = process.env.GEMINI_API_KEY
    if (!key) return NextResponse.json({ reply: 'Falta GEMINI_API_KEY. Configúrala en Vercel.' })

    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Embed system + context as first turn — works in ALL SDK versions without systemInstruction
    const systemTurn = {
      role: 'user',
      parts: [{ text: `${ctx.system}\n\n${ctx.data}\n\nConfirma que has recibido mi información financiera y estás listo para asesorarme.` }]
    }
    const systemResponse = {
      role: 'model',
      parts: [{ text: 'Perfecto, he recibido toda tu información financiera. Estoy listo para asesorarte como tu copiloto financiero personal. ¿En qué te puedo ayudar?' }]
    }

    // Build full history: system turns + previous conversation + current message
    const history = [
      systemTurn,
      systemResponse,
      ...messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
    ]

    const chat = model.startChat({ history })
    const last = messages[messages.length - 1]
    const result = await chat.sendMessage(last.content)
    const reply = result.response.text()

    return NextResponse.json({ reply })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    if (msg.includes('quota') || msg.includes('429')) {
      return NextResponse.json({ reply: '⚠️ Límite de Gemini alcanzado (plan gratuito: 15 req/min). Espera 1 minuto e intenta de nuevo.' })
    }
    console.error('Chat error:', msg)
    return NextResponse.json({ reply: `Error: ${msg}` })
  }
}

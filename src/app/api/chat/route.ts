// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

function getGemini() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY no configurada. Ve a aistudio.google.com/app/apikey')
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-2.0-flash' })
}

function fmt(n) { return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n || 0) }

function buildContext(tx, cards, debts, goals) {
  const now = new Date()
  const thisMonth = now.toISOString().slice(0, 7)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1).toISOString().slice(0, 7)
  const gastosEste = tx.filter(t => t.type === 'gasto' && t.date?.startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0)
  const gastosAnte = tx.filter(t => t.type === 'gasto' && t.date?.startsWith(lastMonth)).reduce((s, t) => s + t.amount, 0)
  const ingresosEste = tx.filter(t => t.type === 'ingreso' && t.date?.startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0)
  const byCat = {}
  tx.filter(t => t.type === 'gasto').forEach(t => { const c = t.category || 'Otros'; byCat[c] = (byCat[c] || 0) + t.amount })
  const topCats = Object.entries(byCat).sort(([,a],[,b]) => b-a).slice(0, 8)
  const totalTarjetas = cards.reduce((s, c) => s + (c.current_balance || 0), 0)
  const totalPrestamos = debts.reduce((s, d) => s + (d.current_balance || 0), 0)
  const cuotasMinimas = cards.reduce((s, c) => s + (c.minimum_payment || 0), 0)
  const cuotasPrestamos = debts.reduce((s, d) => s + (d.monthly_payment || 0), 0)
  const totalCompromisos = cuotasMinimas + cuotasPrestamos
  const ratioDeuda = ingresosEste > 0 ? (totalCompromisos / ingresosEste * 100).toFixed(1) : 'N/A'
  const liquidez = Math.max(0, ingresosEste - gastosEste - totalCompromisos)
  const todasDeudas = [
    ...cards.filter(c => c.current_balance > 0).map(c => ({ nombre: c.bank + ' ' + c.name, saldo: c.current_balance, tasa: c.tcea || 0, minimo: c.minimum_payment || 0 })),
    ...debts.filter(d => d.current_balance > 0).map(d => ({ nombre: d.name, saldo: d.current_balance, tasa: d.tea || 0, minimo: d.monthly_payment || 0 }))
  ]
  const avalancha = [...todasDeudas].sort((a, b) => b.tasa - a.tasa)
  const bolaDeNieve = [...todasDeudas].sort((a, b) => a.saldo - b.saldo)
  return `SITUACION FINANCIERA REAL

MES ACTUAL (${thisMonth}):
- Ingresos: S/ ${fmt(ingresosEste)}
- Gastos: S/ ${fmt(gastosEste)} (mes anterior: S/ ${fmt(gastosAnte)})
- Balance: S/ ${fmt(ingresosEste - gastosEste)}
- Compromisos fijos: S/ ${fmt(totalCompromisos)}/mes
- Liquidez estimada: S/ ${fmt(liquidez)}
- Ratio deuda/ingreso: ${ratioDeuda}% ${parseFloat(ratioDeuda) > 35 ? 'ALTO' : parseFloat(ratioDeuda) > 20 ? 'MODERADO' : 'SALUDABLE'}

TARJETAS (${cards.length}):
${cards.map(c => `- ${c.bank} ${c.name}: Deuda S/${fmt(c.current_balance)} | Limite S/${c.credit_limit ? fmt(c.credit_limit) : 'N/A'} | TCEA ${c.tcea || '?'}% | Pago min S/${fmt(c.minimum_payment || 0)} | Vence dia ${c.payment_due_date || '?'}`).join('\n') || 'Sin tarjetas'}
TOTAL TARJETAS: S/ ${fmt(totalTarjetas)}

PRESTAMOS (${debts.length}):
${debts.map(d => `- ${d.name}: Saldo S/${fmt(d.current_balance)} | Cuota S/${fmt(d.monthly_payment || 0)}/mes | TEA ${d.tea || '?'}% | ${d.remaining_installments || '?'} cuotas`).join('\n') || 'Sin prestamos'}
TOTAL DEUDA: S/ ${fmt(totalTarjetas + totalPrestamos)}

OBJETIVOS (${goals.length}):
${goals.map(g => `- ${g.icon} ${g.name}: S/${fmt(g.current_amount)}/S/${fmt(g.target_amount)}`).join('\n') || 'Sin objetivos'}

TOP GASTOS:
${topCats.map(([c, a]) => `- ${c}: S/ ${fmt(a)}`).join('\n')}

ORDEN AVALANCHA (mayor tasa primero):
${avalancha.map((d, i) => `${i+1}. ${d.nombre}: S/${fmt(d.saldo)} al ${d.tasa}% min S/${fmt(d.minimo)}/mes`).join('\n') || 'Sin deudas'}

ORDEN BOLA DE NIEVE (menor saldo primero):
${bolaDeNieve.map((d, i) => `${i+1}. ${d.nombre}: S/${fmt(d.saldo)}`).join('\n') || 'Sin deudas'}

ULTIMAS 15 TRANSACCIONES:
${tx.slice(0, 15).map(t => `${t.date?.slice(0,10)} ${t.type==='ingreso'?'+':'-'}S/${fmt(t.amount)} | ${t.merchant||t.description?.slice(0,25)} | ${t.category}`).join('\n')}`
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    const { messages } = await req.json()
    const supabase = createServiceClient()
    const uid = session.user.id
    const [txRes, cardsRes, debtsRes, goalsRes] = await Promise.all([
      supabase.from('transactions').select('amount,type,category,description,merchant,date,bank').eq('user_id', uid).order('date', { ascending: false }).limit(200),
      supabase.from('credit_cards').select('*').eq('user_id', uid).eq('is_active', true),
      supabase.from('debts').select('*').eq('user_id', uid).eq('is_active', true),
      supabase.from('financial_goals').select('*').eq('user_id', uid).eq('is_completed', false),
    ])
    const context = buildContext(txRes.data || [], cardsRes.data || [], debtsRes.data || [], goalsRes.data || [])
    const systemPrompt = `Eres un asesor financiero personal experto para peruanos con profundo conocimiento del sistema financiero peruano (SBS, TCEA, TEA, AFP, CTS, gratificaciones).

${context}

MISION: dar consejos ESPECIFICOS, ACCIONABLES y con NUMEROS EXACTOS basados en la situacion real del usuario.
CAPACIDADES: calcula Avalancha vs Bola de Nieve, optimiza pagos por tarjeta, gestiona liquidez, detecta gastos innecesarios, planifica objetivos.
REGLAS: sé directo con numeros. Usa S/. Habla como peruano.`

    const model = getGemini()
    const history = messages.slice(0, -1).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    const chat = model.startChat({ history, systemInstruction: systemPrompt })
    const lastMsg = messages[messages.length - 1]
    const result = await chat.sendMessage(lastMsg.content)
    return NextResponse.json({ reply: result.response.text() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    if (msg.includes('GEMINI_API_KEY')) return NextResponse.json({ reply: 'Falta GEMINI_API_KEY. Ve a aistudio.google.com/app/apikey' })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

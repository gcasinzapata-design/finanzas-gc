// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createHash } from 'crypto'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

function getModel() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY no configurada. Ve a aistudio.google.com/app/apikey')
  return new GoogleGenerativeAI(key).getGenerativeModel(
    { model: 'gemini-1.5-flash' },
    { apiVersion: 'v1' }
  )
}

function makeHash(userId, date, amount, description) {
  return createHash('md5')
    .update(`${userId}|${date}|${Math.round(Number(amount) * 100)}|${String(description).slice(0, 50)}`)
    .digest('hex')
}

const PROMPT = `Analiza este Estado de Cuenta bancario o de tarjeta de crédito peruano.
Extrae TODAS las transacciones sin omitir ninguna.

Responde SOLO con JSON válido sin markdown:
{
  "bank": "nombre del banco",
  "account_type": "cuenta_ahorros|cuenta_corriente|tarjeta_credito|tarjeta_debito",
  "period": "período (ej: Enero 2025)",
  "currency": "PEN" o "USD",
  "opening_balance": número o null,
  "closing_balance": número o null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descripción exacta",
      "amount": número positivo,
      "type": "gasto" o "ingreso",
      "category": "Restaurantes|Supermercados|Alimentación|Transporte|Salud|Entretenimiento|Compras|Servicios|Educación|Vivienda|Suscripciones|Viajes|Deudas|Otros",
      "merchant": "nombre del comercio o null",
      "reference": "número de operación o null"
    }
  ]
}

REGLAS:
- Tarjeta: consumos = gasto, pagos a la tarjeta = ingreso
- Cuenta: retiros/débitos/cargos = gasto, depósitos/créditos = ingreso
- Montos SIEMPRE positivos
- Incluye comisiones, intereses, ITF
- Si el monto aparece entre paréntesis = gasto`

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const contentType = req.headers.get('content-type') || ''

  // CONFIRM: save transactions (JSON body)
  if (contentType.includes('application/json')) {
    try {
      const body = await req.json()
      const { importId, transactions, currency, bank } = body
      if (!transactions?.length) return NextResponse.json({ error: 'Sin transacciones' }, { status: 400 })

      const supabase = createServiceClient()
      const userId = session.user.id
      let inserted = 0, skipped = 0

      for (const tx of transactions) {
        if (tx.skip || tx.duplicate) { skipped++; continue }
        const { error } = await supabase.from('transactions').upsert({
          user_id: userId,
          bank: bank || 'Banco',
          amount: Math.abs(Number(tx.amount) || 0),
          currency: currency || 'PEN',
          type: tx.type || 'gasto',
          category: tx.category || 'Otros',
          description: tx.description || '',
          merchant: tx.merchant || null,
          date: tx.date ? new Date(tx.date + 'T12:00:00').toISOString() : new Date().toISOString(),
          source: 'eecc',
          raw_text: tx.description?.slice(0, 200),
          eecc_hash: tx.hash,
          eecc_import_id: importId || null,
        }, { onConflict: 'user_id,eecc_hash' })

        if (!error) inserted++
        else { console.error('EECC insert error:', error.message); skipped++ }
      }

      await supabase.from('eecc_imports').update({
        status: 'completed', total_inserted: inserted, total_duplicates: skipped,
      }).eq('id', importId)

      return NextResponse.json({ success: true, inserted, skipped, message: `${inserted} transacciones importadas` })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
    }
  }

  // ANALYZE: process file (FormData)
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Archivo supera 20MB' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type?.includes('pdf') ? 'application/pdf' : (file.type || 'image/jpeg')

    const model = getModel()
    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      PROMPT,
    ])

    const raw = result.response.text().replace(/```json|```/g, '').trim()
    let parsed
    try { parsed = JSON.parse(raw) }
    catch { return NextResponse.json({ error: 'No pude leer el archivo. Verifica que sea un EECC legible y no protegido.' }, { status: 422 }) }

    if (!parsed.transactions?.length) {
      return NextResponse.json({ error: 'No encontré transacciones. ¿Es un estado de cuenta bancario?' }, { status: 422 })
    }

    const supabase = createServiceClient()
    const userId = session.user.id
    const enriched = []

    for (const tx of parsed.transactions) {
      const hash = makeHash(userId, tx.date || '', tx.amount || 0, tx.description || '')
      const { data: existing } = await supabase
        .from('transactions').select('id')
        .eq('user_id', userId).eq('eecc_hash', hash).maybeSingle()
      enriched.push({ ...tx, hash, duplicate: !!existing, amount: Math.abs(Number(tx.amount) || 0) })
    }

    const { data: importRecord } = await supabase.from('eecc_imports').insert({
      user_id: userId,
      filename: file.name,
      bank: parsed.bank || 'Desconocido',
      period: parsed.period || '',
      total_found: enriched.length,
      status: 'pending',
    }).select().single()

    const newTx = enriched.filter(t => !t.duplicate)
    const dupTx = enriched.filter(t => t.duplicate)

    return NextResponse.json({
      success: true,
      importId: importRecord?.id,
      bank: parsed.bank,
      account_type: parsed.account_type,
      period: parsed.period,
      currency: parsed.currency || 'PEN',
      opening_balance: parsed.opening_balance,
      closing_balance: parsed.closing_balance,
      transactions: enriched,
      summary: {
        total: enriched.length,
        new: newTx.length,
        duplicates: dupTx.length,
        total_gastos: enriched.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0),
        total_ingresos: enriched.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    if (msg.includes('quota') || msg.includes('429')) {
      return NextResponse.json({ error: 'Límite de Gemini alcanzado. Espera 1 minuto e intenta de nuevo.' }, { status: 429 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const supabase = createServiceClient()
  const { data } = await supabase.from('eecc_imports').select('*')
    .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20)
  return NextResponse.json({ imports: data || [] })
}

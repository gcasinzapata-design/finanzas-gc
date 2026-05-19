// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createHash } from 'crypto'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

function getModel() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY no configurada')
  // Default v1beta — supports gemini-1.5-flash + PDF
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-1.5-flash' })
}

function makeHash(userId, date, amount, description) {
  return createHash('md5')
    .update(`${userId}|${date}|${Math.round(Number(amount) * 100)}|${String(description).slice(0, 50)}`)
    .digest('hex')
}

const PROMPT = `Analiza este Estado de Cuenta (EECC) bancario peruano.
Extrae TODAS las transacciones sin omitir ninguna.

Responde SOLO con JSON válido sin markdown:
{
  "bank": "nombre del banco",
  "account_type": "cuenta_ahorros|cuenta_corriente|tarjeta_credito|tarjeta_debito",
  "period": "período (ej: Abril 2026)",
  "currency": "PEN" o "USD",
  "opening_balance": número o null,
  "closing_balance": número o null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descripción exacta del movimiento",
      "amount": número positivo,
      "type": "gasto" o "ingreso",
      "category": "Restaurantes|Supermercados|Alimentación|Transporte|Salud|Entretenimiento|Compras|Servicios|Educación|Vivienda|Suscripciones|Viajes|Deudas|Otros",
      "merchant": "nombre del comercio o null",
      "reference": "número de operación o null"
    }
  ]
}

REGLAS CRITICAS:
- CUENTA DE AHORROS: columna CARGOS/DEBE = gasto | columna ABONOS/HABER = ingreso
- TARJETA CREDITO: consumos/compras = gasto | pagos a la tarjeta = ingreso
- Montos SIEMPRE positivos en el JSON
- Incluye TODAS las filas: comisiones, ITF, transferencias, yapes, plins, haberes
- Fechas en formato YYYY-MM-DD usando el año del período del EECC
- Para "WARDA": es un débito automático de seguros/servicios = gasto, categoría Servicios
- Para "TRAN.CTAS.TERC.BM": transferencia recibida = ingreso, categoría Otros
- Para "HABERES": sueldo/ingreso = ingreso, categoría Otros
- Para "PAG.T.PROP": pago de tarjeta propia = gasto, categoría Deudas
- Para "PAGCRED EFEC BM": pago de préstamo = gasto, categoría Deudas`

async function tryDecryptPdf(buffer, password) {
  // Try to use pdfjs-dist to extract text from password-protected PDF
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => null)
    if (!pdfjs) return null

    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), password }).promise
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map(item => item.str).join(' ') + '\n'
    }
    return text
  } catch {
    return null
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const contentType = req.headers.get('content-type') || ''

  // CONFIRM: save transactions
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
        const type = tx.type === 'ingreso' ? 'ingreso' : 'gasto'
        const { error } = await supabase.from('transactions').upsert({
          user_id: userId,
          bank: bank || 'Banco',
          amount: Math.abs(Number(tx.amount) || 0),
          currency: currency || 'PEN',
          type,
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
        else { console.error('EECC upsert error:', error.message); skipped++ }
      }
      await supabase.from('eecc_imports').update({
        status: 'completed', total_inserted: inserted, total_duplicates: skipped,
      }).eq('id', importId)
      return NextResponse.json({ success: true, inserted, skipped, message: `${inserted} transacciones importadas` })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
    }
  }

  // ANALYZE: process file
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const password = formData.get('password') || ''

    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Archivo supera 20MB' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const isPDF = file.type?.includes('pdf') || file.name?.toLowerCase().endsWith('.pdf')
    const model = getModel()
    let result

    if (isPDF && password) {
      // Try to extract text first for password-protected PDFs
      const extractedText = await tryDecryptPdf(buffer, password)
      if (extractedText) {
        // Send as text prompt
        result = await model.generateContent(`${PROMPT}\n\nCONTENIDO DEL EECC:\n${extractedText}`)
      } else {
        // Fallback: send raw PDF with password note
        const base64 = Buffer.from(buffer).toString('base64')
        result = await model.generateContent([
          { inlineData: { data: base64, mimeType: 'application/pdf' } },
          PROMPT,
        ])
      }
    } else {
      // Normal file (no password)
      const base64 = Buffer.from(buffer).toString('base64')
      const mimeType = isPDF ? 'application/pdf' : (file.type || 'image/jpeg')
      result = await model.generateContent([
        { inlineData: { data: base64, mimeType } },
        PROMPT,
      ])
    }

    const raw = result.response.text().replace(/```json|```/g, '').trim()
    let parsed
    try { parsed = JSON.parse(raw) }
    catch { return NextResponse.json({ error: 'No pude leer el archivo. Verifica que sea un EECC legible.' }, { status: 422 }) }

    if (!parsed.transactions?.length) {
      return NextResponse.json({ error: 'No encontré transacciones. ¿Es un estado de cuenta bancario?' }, { status: 422 })
    }

    const supabase = createServiceClient()
    const userId = session.user.id
    const enriched = []
    for (const tx of parsed.transactions) {
      const hash = makeHash(userId, tx.date || '', tx.amount || 0, tx.description || '')
      const { data: existing } = await supabase.from('transactions').select('id').eq('user_id', userId).eq('eecc_hash', hash).maybeSingle()
      enriched.push({ ...tx, hash, duplicate: !!existing, amount: Math.abs(Number(tx.amount) || 0), type: tx.type === 'ingreso' ? 'ingreso' : 'gasto' })
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
        duplicates: enriched.filter(t => t.duplicate).length,
        total_gastos: enriched.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0),
        total_ingresos: enriched.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    if (msg.includes('quota') || msg.includes('429')) return NextResponse.json({ error: 'Límite Gemini alcanzado. Espera 1 minuto.' }, { status: 429 })
    console.error('EECC error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const supabase = createServiceClient()
  const { data } = await supabase.from('eecc_imports').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20)
  return NextResponse.json({ imports: data || [] })
}

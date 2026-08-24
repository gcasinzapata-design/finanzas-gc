// @ts-nocheck
// EECC Parser — multi-file, extracts text with pdf-parse, sends to Claude Haiku
// maxDuration 60s to avoid Vercel timeout on Hobby plan
export const maxDuration = 60
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'
import { createHash } from 'crypto'

function makeHash(userId: string, date: string, amount: number, desc: string) {
  return createHash('md5')
    .update(`${userId}|eecc|${date}|${Math.round(amount * 100)}|${desc.slice(0, 40)}`)
    .digest('hex')
}

const SYSTEM = `Eres un experto en estados de cuenta bancarios peruanos.
Extrae TODAS las transacciones del texto. Responde SOLO con JSON válido, sin markdown ni explicaciones.

Formato exacto:
{
  "bank": "nombre del banco",
  "period": "Mes Año",
  "currency": "PEN" o "USD",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descripción exacta del EECC",
      "merchant": "nombre limpio del comercio",
      "amount": número positivo,
      "type": "gasto" | "ingreso" | "transferencia",
      "category": "Restaurantes|Delivery|Supermercados|Markets|Transporte|Gasolina|Salud|Suscripciones|Servicios|Hogar|Internet|Club|Mascotas|Viajes|Compras|Entretenimiento|Cuotas Préstamos|Pago Tarjeta|Ahorro|Impuestos|Intereses|Sueldo|Otros"
    }
  ]
}

REGLAS:
- CUENTA AHORROS: CARGO/DEBE = gasto | ABONO/HABER = ingreso
- TARJETA CRÉDITO: CONSUMO/CARGO = gasto | PAGO = transferencia (Pago Tarjeta)
- Montos SIEMPRE positivos
- Sueldo/Haberes = ingreso, category: Sueldo
- WARDA = category: Ahorro, type: transferencia
- Intereses/mora = gasto, category: Intereses
- Cuota préstamo = gasto, category: Cuotas Préstamos
- Yape/Plin recibido = ingreso | Yape/Plin enviado = gasto, category: Yape/Plin
- Real Club = category: Club
- Netflix/Spotify/Apple/Rappi Pro/Claro/Amazon Prime = Suscripciones, type: gasto
- Tambo/Listo/OXXO/Brisas Market/IZI = Markets
- Wong/Vivanda/Tottus/Metro/Plaza Vea = Supermercados
- ITF = Impuestos, type: gasto
- Si no puedes determinar fecha, usa el primer día del período`

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid build issues
  const pdfParse = (await import('pdf-parse')).default
  try {
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch {
    // If pdf-parse fails (e.g. password protected), return empty
    return ''
  }
}

async function parseWithClaude(text: string, filename: string): Promise<any> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY en variables de entorno de Vercel')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Archivo: ${filename}\n\nTexto del EECC:\n${text.slice(0, 25000)}`
      }]
    })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Claude API error ${res.status}: ${err?.error?.message || 'Unknown'}`)
  }

  const data = await res.json()
  const raw = data.content?.[0]?.text?.replace(/```json|```/g, '').trim() || ''
  const parsed = JSON.parse(raw)
  if (!parsed.transactions?.length) throw new Error('No se encontraron transacciones')
  return parsed
}

// POST: parse one or multiple EECC files
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const contentType = req.headers.get('content-type') || ''

  // ── Confirm insertion (JSON body with transactions) ──────────────────────
  if (contentType.includes('application/json')) {
    const { transactions, importId, currency, bank } = await req.json()
    if (!transactions?.length) return NextResponse.json({ error: 'Sin transacciones' }, { status: 400 })

    const supabase = createServiceClient()
    const uid = session.user.id
    let inserted = 0, skipped = 0, errors: string[] = []

    for (const tx of transactions) {
      if (tx.skip) { skipped++; continue }
      const { error } = await supabase.from('transactions').upsert({
        user_id: uid,
        bank: tx.bank || bank || 'Banco',
        amount: Number(tx.amount),
        currency: tx.currency || currency || 'PEN',
        amount_pen: tx.currency === 'USD' ? Number(tx.amount) * 3.72 : Number(tx.amount),
        fx_rate: tx.currency === 'USD' ? 3.72 : 1.0,
        type: tx.type || 'gasto',
        category: tx.category || 'Otros',
        description: tx.description || tx.merchant || '—',
        merchant: tx.merchant || null,
        date: `${tx.date}T12:00:00+00:00`,
        source: 'eecc',
        is_recurring: false,
        eecc_hash: tx.hash,
      }, { onConflict: 'eecc_hash', ignoreDuplicates: true })

      if (error) errors.push(error.message)
      else inserted++
    }

    return NextResponse.json({ success: true, inserted, skipped, errors })
  }

  // ── Parse PDF files ──────────────────────────────────────────────────────
  const formData = await req.formData()
  const files = formData.getAll('file') as File[]
  const password = formData.get('password') as string || ''

  if (!files.length) return NextResponse.json({ error: 'Sube al menos un archivo' }, { status: 400 })

  const uid = session.user.id
  const supabase = createServiceClient()
  const results: any[] = []

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())

      // Extract text from PDF
      let text = await extractTextFromPDF(buffer)

      if (!text || text.length < 100) {
        results.push({
          filename: file.name,
          error: `No se pudo leer el PDF "${file.name}". Si está protegido con contraseña, primero quítale la contraseña en Adobe o Preview (Mac) antes de subirlo.`,
          transactions: []
        })
        continue
      }

      // Parse with Claude Haiku
      const parsed = await parseWithClaude(text, file.name)

      // Enrich with hashes + dedup check
      const enriched = []
      for (const tx of parsed.transactions) {
        const hash = makeHash(uid, tx.date || '', Number(tx.amount) || 0, tx.description || '')
        const { data: existing } = await supabase
          .from('transactions').select('id')
          .eq('user_id', uid).eq('eecc_hash', hash).maybeSingle()
        enriched.push({
          ...tx,
          bank: parsed.bank || 'Banco',
          currency: parsed.currency || 'PEN',
          amount: Math.abs(Number(tx.amount) || 0),
          hash,
          duplicate: !!existing,
          status: existing ? 'duplicate' : 'new',
        })
      }

      results.push({
        filename: file.name,
        bank: parsed.bank,
        period: parsed.period,
        currency: parsed.currency || 'PEN',
        transactions: enriched,
        summary: {
          total: enriched.length,
          new: enriched.filter(t => !t.duplicate).length,
          duplicates: enriched.filter(t => t.duplicate).length,
        }
      })
    } catch (err: any) {
      results.push({
        filename: file.name,
        error: err.message || 'Error al procesar',
        transactions: []
      })
    }
  }

  return NextResponse.json({ success: true, results, filesProcessed: files.length })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const supabase = createServiceClient()
  const { data } = await supabase.from('eecc_imports')
    .select('*').eq('user_id', session.user.id)
    .order('created_at', { ascending: false }).limit(20)
  return NextResponse.json({ imports: data || [] })
}

// @ts-nocheck
export const maxDuration = 60
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'
import { callAI } from '@/lib/ai'
import { createHash } from 'crypto'

function makeHash(uid: string, date: string, amount: number, desc: string) {
  return createHash('md5').update(`${uid}|eecc|${date}|${Math.round(amount*100)}|${desc.slice(0,40)}`).digest('hex')
}

const SYSTEM = `Eres un experto en estados de cuenta bancarios peruanos. Extrae TODAS las transacciones del texto proporcionado. Responde SOLO con JSON válido (sin markdown, sin backticks, sin explicaciones).

Formato exacto requerido:
{"bank":"nombre banco","period":"Mes Año","currency":"PEN o USD","transactions":[{"date":"YYYY-MM-DD","description":"texto exacto","merchant":"comercio limpio","amount":número_positivo,"type":"gasto|ingreso|transferencia","category":"Restaurantes|Delivery|Supermercados|Markets|Transporte|Gasolina|Salud|Suscripciones|Servicios|Hogar|Internet|Club|Mascotas|Viajes|Compras|Entretenimiento|Cuotas Préstamos|Pago Tarjeta|Ahorro|Impuestos|Intereses|Sueldo|Yape/Plin|Otros"}]}

REGLAS CRÍTICAS:
- CUENTA AHORROS: CARGO/DEBE=gasto | ABONO/HABER=ingreso
- TARJETA CRÉDITO: CONSUMO/COMPRA=gasto | PAGO/ABONO=transferencia(Pago Tarjeta)
- Montos SIEMPRE positivos
- Sueldo/Haberes=ingreso,Sueldo | WARDA=transferencia,Ahorro
- Intereses/mora=gasto,Intereses | Cuota préstamo=gasto,Cuotas Préstamos
- Yape enviado=gasto | Yape recibido=ingreso
- Netflix/Spotify/Apple/Claro/Rappi Pro=gasto,Suscripciones
- Tambo/Listo/OXXO/Brisas Market=gasto,Markets
- Wong/Vivanda/Tottus/Metro/Plaza Vea=gasto,Supermercados
- Real Club=gasto,Club | ITF=gasto,Impuestos`

async function extractText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  try {
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch { return '' }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = session.user.id
  const contentType = req.headers.get('content-type') || ''

  // ── Confirm insert ────────────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    const { transactions, bank, currency } = await req.json()
    if (!transactions?.length) return NextResponse.json({ error: 'Sin transacciones' }, { status: 400 })
    const supabase = createServiceClient()
    let inserted = 0; const errors: string[] = []
    for (const tx of transactions) {
      const { error } = await supabase.from('transactions').upsert({
        user_id: uid, bank: tx.bank || bank || 'Banco',
        amount: Number(tx.amount), currency: tx.currency || currency || 'PEN',
        amount_pen: tx.currency === 'USD' ? Number(tx.amount)*3.72 : Number(tx.amount),
        fx_rate: tx.currency === 'USD' ? 3.72 : 1.0,
        type: tx.type || 'gasto', category: tx.category || 'Otros',
        description: tx.description || tx.merchant || '—', merchant: tx.merchant || null,
        date: `${tx.date?.slice(0,10)}T12:00:00+00:00`, source: 'eecc', is_recurring: false, eecc_hash: tx.hash,
      }, { onConflict: 'eecc_hash', ignoreDuplicates: true })
      if (error) errors.push(error.message); else inserted++
    }
    return NextResponse.json({ success: true, inserted, errors })
  }

  // ── Parse PDF files ───────────────────────────────────────────────────────
  const formData = await req.formData()
  const files = formData.getAll('file') as File[]
  if (!files.length) return NextResponse.json({ error: 'Sube al menos un archivo' }, { status: 400 })

  const supabase = createServiceClient()
  const results: any[] = []

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const text = await extractText(buffer)

      if (!text || text.length < 100) {
        results.push({ filename: file.name, error: `No se pudo leer "${file.name}". Si está protegido con contraseña, primero quítale la password: en Mac → Preview → Archivo → Exportar PDF (sin contraseña). En Windows → imprime a "Microsoft Print to PDF".`, transactions: [] })
        continue
      }

      // Parse with AI (Claude Haiku → Gemini Flash fallback)
      const raw = await callAI(`Archivo: ${file.name}\n\nTexto del EECC:\n${text.slice(0, 25000)}`, SYSTEM, 4096)
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if (!parsed.transactions?.length) throw new Error('No se encontraron transacciones en el documento')

      // Check duplicates
      const enriched = []
      for (const tx of parsed.transactions) {
        const hash = makeHash(uid, tx.date||'', Number(tx.amount)||0, tx.description||'')
        const { data: existing } = await supabase.from('transactions').select('id').eq('user_id', uid).eq('eecc_hash', hash).maybeSingle()
        enriched.push({ ...tx, bank: parsed.bank||'Banco', currency: parsed.currency||'PEN', amount: Math.abs(Number(tx.amount)||0), hash, duplicate: !!existing, status: existing?'duplicate':'new' })
      }

      results.push({
        filename: file.name, bank: parsed.bank, period: parsed.period, currency: parsed.currency||'PEN', transactions: enriched,
        summary: { total: enriched.length, new: enriched.filter(t=>!t.duplicate).length, duplicates: enriched.filter(t=>t.duplicate).length }
      })
    } catch (err: any) {
      results.push({ filename: file.name, error: err.message||'Error al procesar', transactions: [] })
    }
  }
  return NextResponse.json({ success: true, results, filesProcessed: files.length })
}

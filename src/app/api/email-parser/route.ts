// @ts-nocheck
// Email parser — reads BCP/BBVA/IBK notification emails from Gmail
// Uses Claude to extract transaction data (more reliable than regex)
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { google } from 'googleapis'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'
import { createHash } from 'crypto'

function mkhash(uid: string, date: string, amount: number, desc: string) {
  return createHash('md5')
    .update(`${uid}|email|${date}|${Math.round(amount * 100)}|${desc.slice(0, 40)}`)
    .digest('hex')
}

function extractText(payload: any): string {
  if (!payload) return ''
  const find = (parts: any[], mime: string): string => {
    for (const p of parts || []) {
      if (p.mimeType === mime && p.body?.data)
        return Buffer.from(p.body.data, 'base64').toString('utf-8')
      if (p.parts) { const n = find(p.parts, mime); if (n) return n }
    }
    return ''
  }
  const plain = find(payload.parts, 'text/plain')
  if (plain) return plain
  const html = find(payload.parts, 'text/html')
  if (html) return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s{2,}/g, ' ').trim()
  if (payload.body?.data) return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  return ''
}

async function parseEmailWithClaude(emailText: string, from: string, subject: string): Promise<any | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null

  const prompt = `Analiza este email bancario peruano y extrae la transacción si la hay.
Responde SOLO con JSON (sin markdown). Si NO es un email de transacción bancaria, responde: {"no_transaction": true}

Formato cuando SÍ hay transacción:
{
  "bank": "BCP" | "BBVA" | "Interbank",
  "type": "gasto" | "ingreso",
  "amount": número positivo,
  "currency": "PEN" | "USD",
  "merchant": "nombre del comercio o destinatario",
  "date": "YYYY-MM-DD",
  "category": "categoría apropiada"
}

Email:
De: ${from}
Asunto: ${subject}
Cuerpo:
${emailText.slice(0, 2000)}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  if (!res.ok) return null
  const data = await res.json()
  const raw = data.content?.[0]?.text?.replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(raw)
    if (parsed.no_transaction) return null
    return parsed
  } catch { return null }
}

function isBankEmail(from: string, subject: string): boolean {
  const fromL = from.toLowerCase()
  const subL = subject.toLowerCase()
  const bankDomains = [
    'bcp.com.pe', 'notificaciones.bcp', 'bancadirecta.bcp',
    'bbva.pe', 'bbva.com',
    'interbank.com.pe', 'tbk.pe',
    'scotiabank.com.pe',
  ]
  const bankSubjects = [
    'cargo', 'consumo', 'pago', 'compra', 'transferencia', 'retiro',
    'abono', 'alerta', 'movimiento', 'yape', 'operación'
  ]
  const fromMatch = bankDomains.some(d => fromL.includes(d))
  const subjectMatch = bankSubjects.some(s => subL.includes(s))
  return fromMatch || (fromMatch && subjectMatch)
}

// GET /api/email-parser?days=7&dry=true  → preview without inserting
// GET /api/email-parser?days=7           → parse + insert
// GET /api/email-parser?debug=true       → show raw email list (diagnostic)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.accessToken)
    return NextResponse.json({ error: 'No autenticado. Cierra sesión y vuelve a entrar.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') || '7'), 30)
  const dry = searchParams.get('dry') === 'true'
  const debug = searchParams.get('debug') === 'true'
  const uid = session.user.id

  const oAuth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oAuth.setCredentials({ access_token: session.accessToken })
  const gmail = google.gmail({ version: 'v1', auth: oAuth })

  const after = Math.floor((Date.now() - days * 86400000) / 1000)

  // Search for bank notification emails — broad query to catch all formats
  const queries = [
    `(from:*bcp.com.pe OR from:*notificaciones.bcp*) after:${after}`,
    `(from:*bbva.pe OR from:*bbva.com) after:${after}`,
    `(from:*interbank.com.pe OR from:*tbk.pe) after:${after}`,
    // Also catch by subject
    `subject:(cargo OR consumo OR "realizó" OR "transferencia" OR yape) from:(*bcp* OR *bbva* OR *interbank*) after:${after}`,
  ]

  const msgIds = new Set<string>()
  for (const q of queries) {
    try {
      const r = await gmail.users.messages.list({ userId: 'me', q, maxResults: 50 })
      ;(r.data.messages || []).forEach(m => msgIds.add(m.id!))
    } catch (e) {
      console.log('Gmail search error:', e.message)
    }
  }

  if (debug) {
    // Return raw email list for debugging
    const emails: any[] = []
    for (const id of Array.from(msgIds).slice(0, 10)) {
      try {
        const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] })
        const hdrs = msg.data.payload?.headers || []
        emails.push({
          id,
          from: hdrs.find(h => h.name === 'From')?.value,
          subject: hdrs.find(h => h.name === 'Subject')?.value,
          date: hdrs.find(h => h.name === 'Date')?.value,
        })
      } catch {}
    }
    return NextResponse.json({ totalFound: msgIds.size, emails, days })
  }

  const parsed: any[] = []
  const skipped: string[] = []
  const errors: any[] = []

  // Process in batches to avoid timeout
  const idsToProcess = Array.from(msgIds).slice(0, 30)

  for (const id of idsToProcess) {
    try {
      const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
      const hdrs = msg.data.payload?.headers || []
      const from = hdrs.find(h => h.name?.toLowerCase() === 'from')?.value || ''
      const subject = hdrs.find(h => h.name?.toLowerCase() === 'subject')?.value || ''
      const body = extractText(msg.data.payload)

      if (!isBankEmail(from, subject)) {
        skipped.push(`${subject} (${from.slice(0, 30)})`)
        continue
      }

      const tx = await parseEmailWithClaude(body, from, subject)
      if (!tx) { skipped.push(`No transaction: ${subject}`); continue }

      const fxRate = tx.currency === 'USD' ? 3.72 : 1.0
      const hash = mkhash(uid, tx.date || new Date().toISOString().slice(0,10), tx.amount, tx.merchant || subject)

      parsed.push({ ...tx, hash, amount_pen: Math.round(tx.amount * fxRate * 100) / 100, fx_rate: fxRate, gmail_id: id, subject, from: from.slice(0, 60) })
    } catch (e: any) {
      errors.push({ id, error: e.message })
    }
  }

  if (dry) {
    return NextResponse.json({ preview: true, days, totalEmails: msgIds.size, parsed: parsed.length, skipped: skipped.length, transactions: parsed, skippedSample: skipped.slice(0, 5), errors })
  }

  // Insert
  const supabase = createServiceClient()
  let inserted = 0

  for (const tx of parsed) {
    const { error } = await supabase.from('transactions').upsert({
      user_id: uid, bank: tx.bank || 'Banco', amount: tx.amount,
      currency: tx.currency || 'PEN', amount_pen: tx.amount_pen, fx_rate: tx.fx_rate,
      type: tx.type || 'gasto', category: tx.category || 'Otros',
      description: tx.merchant || tx.subject || '—', merchant: tx.merchant || null,
      date: `${tx.date}T12:00:00+00:00`, source: 'email', is_recurring: false, eecc_hash: tx.hash,
    }, { onConflict: 'eecc_hash', ignoreDuplicates: true })
    if (!error) inserted++
    else errors.push({ merchant: tx.merchant, error: error.message })
  }

  return NextResponse.json({ success: true, days, totalEmails: msgIds.size, parsed: parsed.length, inserted, duplicates: parsed.length - inserted, skipped: skipped.length, errors, transactions: parsed })
}

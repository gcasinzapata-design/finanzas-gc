// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { google } from 'googleapis'
import { authOptions } from '@/lib/authOptions'
import { parseEmailTransaction, categorizeTransaction } from '@/lib/bankParsers'
import { createServiceClient } from '@/lib/supabase'

function extractBody(payload) {
  if (!payload) return ''
  const parts = payload.parts || []

  const findByMime = (ps, mime) => {
    for (const p of ps) {
      if (p.mimeType === mime && p.body?.data)
        return Buffer.from(p.body.data, 'base64').toString('utf-8')
      if (p.parts) { const n = findByMime(p.parts, mime); if (n) return n }
    }
    return ''
  }

  // Try plain text first, then HTML
  let body = findByMime(parts, 'text/plain')
  if (!body) {
    const html = findByMime(parts, 'text/html')
    if (html) {
      body = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, ' ')
        .replace(/\s+/g, ' ').trim()
    }
  }
  if (!body && payload.body?.data)
    body = Buffer.from(payload.body.data, 'base64').toString('utf-8')

  return body.slice(0, 4000)
}

// GET — diagnóstico
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    auth.setCredentials({ access_token: session.accessToken })
    const gmail = google.gmail({ version: 'v1', auth })
    const since = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: `(consumo OR cargo OR abono OR transferencia OR pago OR soles) after:${since}`,
      maxResults: 5,
    })
    const samples = []
    for (const msg of (res.data.messages || [])) {
      const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
      const hdrs = full.data.payload?.headers || []
      const from = hdrs.find(h => h.name === 'From')?.value || ''
      const subject = hdrs.find(h => h.name === 'Subject')?.value || ''
      const dateH = hdrs.find(h => h.name === 'Date')?.value || ''
      const body = extractBody(full.data.payload)
      const parsed = parseEmailTransaction(from, subject, subject + '\n' + body, dateH)
      samples.push({ from, subject, dateH, bodySnippet: body.slice(0, 300), parsed })
    }
    return NextResponse.json({ total: res.data.messages?.length || 0, samples })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function POST(_req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!session.accessToken) return NextResponse.json({ error: 'Sin acceso a Gmail. Cierra sesión y vuelve a entrar.' }, { status: 401 })

  try {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    auth.setCredentials({ access_token: session.accessToken })
    const gmail = google.gmail({ version: 'v1', auth })
    const since = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60

    // Broad queries to catch all financial emails
    const queries = [
      `from:(bcp interbank scotiabank bbva yape plin mibanco falabella ripley diners amex) after:${since}`,
      `from:(bcp.com.pe viabcp.com interbank.pe scotiabank.com.pe bbvaperu.com bbva.pe) after:${since}`,
      `(consumo OR cargo OR abono OR transferencia) (soles OR "S/") after:${since}`,
      `subject:(consumo OR cargo OR abono OR transferencia OR "operacion" OR "operación") after:${since}`,
      `("estado de cuenta" OR "movimiento" OR "transaccion" OR "transacción") after:${since}`,
    ]

    const allIds = new Set()
    for (const q of queries) {
      try {
        const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 150 })
        for (const m of (res.data.messages || [])) { if (m.id) allIds.add(m.id) }
      } catch { continue }
    }

    // Skip already imported
    const supabase = createServiceClient()
    const userId = session.user.id
    const { data: existing } = await supabase
      .from('transactions').select('gmail_message_id')
      .eq('user_id', userId).eq('source', 'gmail').not('gmail_message_id', 'is', null)
    const existingIds = new Set((existing || []).map(r => r.gmail_message_id))
    const newIds = Array.from(allIds).filter(id => !existingIds.has(id))

    let inserted = 0, skipped = 0, noAmount = 0
    const batchLimit = 80

    for (const msgId of newIds.slice(0, batchLimit)) {
      try {
        const full = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' })
        const hdrs = full.data.payload?.headers || []
        const from = hdrs.find(h => h.name === 'From')?.value || ''
        const subject = hdrs.find(h => h.name === 'Subject')?.value || ''
        const dateH = hdrs.find(h => h.name === 'Date')?.value || ''
        const body = extractBody(full.data.payload)
        const fullText = subject + '\n' + body

        const parsed = parseEmailTransaction(from, subject, fullText, dateH)
        if (!parsed) { noAmount++; continue }

        const category = categorizeTransaction(parsed.description, parsed.merchant)

        const { error } = await supabase.from('transactions').upsert({
          user_id: userId,
          bank: parsed.bank,
          amount: parsed.amount,
          currency: 'PEN',
          type: parsed.type,
          category,
          description: parsed.description,
          merchant: parsed.merchant,
          date: parsed.date,
          source: 'gmail',
          raw_text: subject.slice(0, 200),
          gmail_message_id: msgId,
        }, { onConflict: 'gmail_message_id' })

        if (!error) inserted++; else skipped++
      } catch { skipped++; continue }
    }

    const remaining = Math.max(0, newIds.length - batchLimit)
    return NextResponse.json({
      success: true,
      total: allIds.size,
      new: newIds.length,
      inserted,
      skipped,
      noAmount,
      remaining,
      message: inserted > 0
        ? `✅ ${inserted} transacciones importadas de ${Math.min(newIds.length, batchLimit)} correos revisados.${remaining > 0 ? ` Presiona de nuevo para ${remaining} más.` : ''}`
        : `Se revisaron ${Math.min(newIds.length, batchLimit)} correos. ${noAmount} sin montos detectables. Abre /api/gmail en el navegador para ver un diagnóstico detallado.`,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

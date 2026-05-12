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
  const find = (ps, mime) => {
    for (const p of ps) {
      if (p.mimeType === mime && p.body?.data)
        return Buffer.from(p.body.data, 'base64').toString('utf-8').slice(0, 3000)
      if (p.parts) { const n = find(p.parts, mime); if (n) return n }
    }
    return ''
  }
  let body = find(parts, 'text/plain') || ''
  if (!body) {
    const html = find(parts, 'text/html')
    if (html) body = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  }
  if (!body && payload.body?.data) body = Buffer.from(payload.body.data, 'base64').toString('utf-8').slice(0, 3000)
  return body
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ access_token: session.accessToken })
  const gmail = google.gmail({ version: 'v1', auth })
  const since = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60
  const res = await gmail.users.messages.list({ userId: 'me', q: `("S/" OR soles OR consumo OR cargo OR abono) after:${since}`, maxResults: 5 })
  const samples = []
  for (const msg of (res.data.messages || [])) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
    const hdrs = full.data.payload?.headers || []
    const from = hdrs.find(h => h.name === 'From')?.value || ''
    const subject = hdrs.find(h => h.name === 'Subject')?.value || ''
    const body = extractBody(full.data.payload)
    const parsed = parseEmailTransaction(from, subject, subject + ' ' + body)
    samples.push({ from, subject, bodySnippet: body.slice(0, 200), parsed })
  }
  return NextResponse.json({ samples })
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
    const queries = [
      `("S/" OR "S/.") (consumo OR cargo OR abono OR pago OR transferencia) after:${since}`,
      `from:(bcp interbank scotiabank bbva yape plin mibanco falabella ripley diners) after:${since}`,
      `from:(bcp.com.pe viabcp.com interbank.pe scotiabank.com.pe bbvaperu.com bbva.pe) after:${since}`,
      `subject:(consumo OR cargo OR abono OR transferencia) after:${since}`,
    ]
    const allIds = new Set()
    for (const q of queries) {
      try {
        const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 150 })
        for (const m of (res.data.messages || [])) { if (m.id) allIds.add(m.id) }
      } catch { continue }
    }
    const supabase = createServiceClient()
    const userId = session.user.id
    const { data: existing } = await supabase.from('transactions').select('gmail_message_id').eq('user_id', userId).eq('source', 'gmail').not('gmail_message_id', 'is', null)
    const existingIds = new Set((existing || []).map(r => r.gmail_message_id))
    const newIds = Array.from(allIds).filter(id => !existingIds.has(id))
    let inserted = 0, skipped = 0, noAmount = 0
    for (const msgId of newIds.slice(0, 80)) {
      try {
        const full = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' })
        const hdrs = full.data.payload?.headers || []
        const from = hdrs.find(h => h.name === 'From')?.value || ''
        const subject = hdrs.find(h => h.name === 'Subject')?.value || ''
        const dateH = hdrs.find(h => h.name === 'Date')?.value || ''
        const body = extractBody(full.data.payload)
        const parsed = parseEmailTransaction(from, subject, subject + ' ' + body)
        if (!parsed) { noAmount++; continue }
        const category = categorizeTransaction(parsed.description, parsed.merchant)
        let txDate = new Date().toISOString()
        if (dateH) { const d = new Date(dateH); if (!isNaN(d.getTime())) txDate = d.toISOString() }
        const { error } = await supabase.from('transactions').upsert({
          user_id: userId, bank: parsed.bank, amount: parsed.amount, currency: 'PEN',
          type: parsed.type, category, description: parsed.description, merchant: parsed.merchant,
          date: txDate, source: 'gmail', raw_text: subject.slice(0, 200), gmail_message_id: msgId,
        }, { onConflict: 'gmail_message_id' })
        if (!error) inserted++; else skipped++
      } catch { skipped++; continue }
    }
    const remaining = Math.max(0, newIds.length - 80)
    return NextResponse.json({
      success: true, total: allIds.size, new: newIds.length, inserted, skipped, noAmount, remaining,
      message: inserted > 0
        ? `✅ ${inserted} transacciones importadas de ${Math.min(newIds.length, 80)} correos.${remaining > 0 ? ` Presiona de nuevo para importar ${remaining} más.` : ''}`
        : `Se revisaron ${Math.min(newIds.length, 80)} correos. ${noAmount} sin montos. Revisa /api/gmail para diagnóstico.`,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

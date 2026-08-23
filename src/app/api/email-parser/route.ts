// @ts-nocheck
// Parses bank notification emails (BCP, BBVA, IBK) → auto-inserts transactions
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { google } from 'googleapis'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'
import { createHash } from 'crypto'

function mkhash(uid, date, amount, desc) {
  return createHash('md5')
    .update(`${uid}|email|${date}|${Math.round(amount * 100)}|${desc.slice(0, 40)}`)
    .digest('hex')
}

// ── Patterns per bank sender ────────────────────────────────────────────────
const PARSERS = [
  {
    bank: 'BCP', currency: 'PEN', type: 'gasto',
    senders: ['bcp.com.pe', 'notificaciones.bcp'],
    patterns: [
      /cargo de S\/\s*([\d,]+\.?\d*)\s+en\s+(.+?)\s+el\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /consumo de S\/\s*([\d,]+\.?\d*)\s+en\s+(.+?)[\.\n\r]/i,
      /compra.*?S\/\s*([\d,]+\.?\d*)\s+en\s+(.+?)[\.\n\r]/i,
      /S\/\s*([\d,]+\.?\d*).*?en\s+(.+?)[\.\n\r]/i,
    ],
  },
  {
    bank: 'BCP', currency: 'USD', type: 'gasto',
    senders: ['bcp.com.pe', 'notificaciones.bcp'],
    patterns: [
      /cargo de \$\s*([\d,]+\.?\d*)\s+en\s+(.+?)\s+el\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /\$\s*([\d,]+\.?\d*).*?en\s+(.+?)[\.\n\r]/i,
    ],
  },
  {
    bank: 'BBVA', currency: 'PEN', type: 'gasto',
    senders: ['bbva.pe', 'bbva.com'],
    patterns: [
      /Monto[:\s]+S\/\s*([\d,]+\.?\d*)[\s\S]{0,80}?Comercio[:\s]+(.+?)[\n\r]/i,
      /consumo.*?S\/\s*([\d,]+\.?\d*).*?en\s+(.+?)[\.\n\r]/i,
      /cargo.*?S\/\s*([\d,]+\.?\d*).*?en\s+(.+?)[\.\n\r]/i,
    ],
  },
  {
    bank: 'Interbank', currency: 'PEN', type: 'gasto',
    senders: ['interbank.com.pe', 'tbk.pe'],
    patterns: [
      /cargo.*?S\/\s*([\d,]+\.?\d*).*?en\s+(.+?)[\.\n\r]/i,
      /consumo.*?S\/\s*([\d,]+\.?\d*).*?en\s+(.+?)[\.\n\r]/i,
      /S\/\s*([\d,]+\.?\d*).*?en\s+(.+?)[\.\n\r]/i,
    ],
  },
  {
    bank: 'BCP', currency: 'PEN', type: 'ingreso',
    senders: ['bcp.com.pe', 'yape'],
    patterns: [
      /recibiste S\/\s*([\d,]+\.?\d*)\s+de\s+(.+?)[\.\n\r]/i,
      /abono.*?S\/\s*([\d,]+\.?\d*).*?de\s+(.+?)[\.\n\r]/i,
      /depositó S\/\s*([\d,]+\.?\d*).*?de\s+(.+?)[\.\n\r]/i,
    ],
  },
]

function catFromMerchant(m) {
  const d = (m || '').toLowerCase()
  if (/rappi|pedidos ya|dlc\*rappi/.test(d)) return 'Delivery'
  if (/uber|cabify|indriver/.test(d)) return 'Transporte'
  if (/netflix|spotify|apple|disney|amazon prime|claro claro|hbo/.test(d)) return 'Suscripciones'
  if (/wong|vivanda|tottus|pvea|plaza vea|cencosud|metro /.test(d)) return 'Supermercados'
  if (/tambo|listo|oxxo|brisas market|izi/.test(d)) return 'Markets'
  if (/servicentro|primax|combustible|pecsa|go combustibles/.test(d)) return 'Gasolina'
  if (/restaur|sushi|pizza|pollo|chifa|burger|cafe|osaka|canta rana|granja azul|oakberry/.test(d)) return 'Restaurantes'
  if (/farmacia|botica|clinica|hospital|veterinaria/.test(d)) return 'Salud'
  if (/falabella|saga|ripley/.test(d)) return 'Compras'
  if (/real club/.test(d)) return 'Club'
  if (/yape|plin/.test(d)) return 'Yape/Plin'
  if (/luz del sur|sedapal|fiberlux|nubyx/.test(d)) return 'Servicios'
  return 'Otros'
}

function parseEmail(text, from) {
  const fromL = (from || '').toLowerCase()
  for (const p of PARSERS) {
    if (!p.senders.some(s => fromL.includes(s))) continue
    for (const pattern of p.patterns) {
      const m = text.match(pattern)
      if (!m) continue
      const amount = parseFloat(m[1].replace(',', ''))
      if (isNaN(amount) || amount <= 0) continue
      const merchant = (m[2] || '').trim().replace(/\s{2,}/g, ' ').slice(0, 60)
      let date = new Date().toISOString().slice(0, 10)
      if (m[3]) {
        try {
          const [d, mo, y] = m[3].split('/')
          date = `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
        } catch {}
      }
      return { amount, merchant, date, bank: p.bank, type: p.type, currency: p.currency }
    }
  }
  return null
}

function extractText(payload) {
  if (!payload) return ''
  const find = (parts, mime) => {
    for (const p of (parts || [])) {
      if (p.mimeType === mime && p.body?.data)
        return Buffer.from(p.body.data, 'base64').toString('utf-8')
      if (p.parts) { const n = find(p.parts, mime); if (n) return n }
    }
    return ''
  }
  const t = find(payload.parts, 'text/plain')
  if (t) return t
  const h = find(payload.parts, 'text/html')
  if (h) return h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (payload.body?.data) return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  return ''
}

// GET ?days=7&dry=true → preview
// GET ?days=7         → parse + insert
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.accessToken)
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') || '7'), 30)
  const dry = searchParams.get('dry') === 'true'
  const uid = session.user.id

  const oAuth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oAuth.setCredentials({ access_token: session.accessToken })
  const gmail = google.gmail({ version: 'v1', auth: oAuth })

  const after = Math.floor((Date.now() - days * 86400000) / 1000)
  const queries = [
    `from:(bcp.com.pe OR notificaciones.bcp.com.pe) after:${after}`,
    `from:(bbva.pe OR bbva.com) after:${after}`,
    `from:(interbank.com.pe OR tbk.pe) after:${after}`,
  ]

  const msgIds = new Set<string>()
  for (const q of queries) {
    try {
      const r = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100 })
      ;(r.data.messages || []).forEach(m => msgIds.add(m.id!))
    } catch {}
  }

  const parsed: any[] = [], skipped: any[] = [], errors: any[] = []

  for (const id of msgIds) {
    try {
      const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
      const hdrs = msg.data.payload?.headers || []
      const from = hdrs.find(h => h.name?.toLowerCase() === 'from')?.value || ''
      const subject = hdrs.find(h => h.name?.toLowerCase() === 'subject')?.value || ''
      const body = extractText(msg.data.payload)
      const fullText = `${subject}\n${body}`

      const tx = parseEmail(fullText, from)
      if (!tx) { skipped.push({ subject, from: from.slice(0, 50) }); continue }

      const hash = mkhash(uid, tx.date, tx.amount, tx.merchant)
      const fxRate = tx.currency === 'USD' ? 3.72 : 1.0

      parsed.push({
        ...tx,
        hash,
        amount_pen: Math.round(tx.amount * fxRate * 100) / 100,
        fx_rate: fxRate,
        category: catFromMerchant(tx.merchant),
        gmail_message_id: id,
        subject,
        from: from.slice(0, 60),
      })
    } catch (e: any) {
      errors.push({ id, error: e.message })
    }
  }

  if (dry) {
    return NextResponse.json({
      preview: true, days,
      totalEmails: msgIds.size,
      parsed: parsed.length,
      skipped: skipped.length,
      transactions: parsed,
      skippedList: skipped.slice(0, 10),
      errors,
    })
  }

  // Insert
  const supabase = createServiceClient()
  let inserted = 0

  for (const tx of parsed) {
    const { error } = await supabase.from('transactions').upsert({
      user_id: uid, bank: tx.bank, amount: tx.amount,
      currency: tx.currency, amount_pen: tx.amount_pen, fx_rate: tx.fx_rate,
      type: tx.type, category: tx.category,
      description: `${tx.merchant} (email alert)`, merchant: tx.merchant,
      date: `${tx.date}T12:00:00+00:00`,
      source: 'email', is_recurring: false, eecc_hash: tx.hash,
    }, { onConflict: 'eecc_hash', ignoreDuplicates: true })

    if (error) errors.push({ merchant: tx.merchant, error: error.message })
    else inserted++
  }

  return NextResponse.json({
    success: true, days, totalEmails: msgIds.size,
    parsed: parsed.length, inserted,
    duplicates: parsed.length - inserted,
    skipped: skipped.length, errors,
    transactions: parsed,
  })
}

// @ts-nocheck
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { google } from 'googleapis'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'
import { callAI } from '@/lib/ai'
import { createHash } from 'crypto'

function mkhash(uid: string, date: string, amount: number, desc: string) {
  return createHash('md5').update(`${uid}|email|${date}|${Math.round(amount*100)}|${desc.slice(0,40)}`).digest('hex')
}

function extractText(payload: any): string {
  if (!payload) return ''
  const find = (parts: any[], mime: string): string => {
    for (const p of parts||[]) {
      if (p.mimeType===mime && p.body?.data) return Buffer.from(p.body.data,'base64').toString('utf-8')
      if (p.parts) { const n=find(p.parts,mime); if(n) return n }
    }
    return ''
  }
  const plain = find(payload.parts,'text/plain')
  if (plain) return plain
  const html = find(payload.parts,'text/html')
  if (html) return html.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s{2,}/g,' ').trim()
  if (payload.body?.data) return Buffer.from(payload.body.data,'base64').toString('utf-8')
  return ''
}

const BANK_DOMAINS = ['bcp.com.pe','notificaciones.bcp','bancadirecta.bcp','bbva.pe','bbva.com','interbank.com.pe','tbk.pe','scotiabank.com.pe','yape']
function isBankEmail(from: string, subject: string) {
  const f = from.toLowerCase(), s = subject.toLowerCase()
  const fromBank = BANK_DOMAINS.some(d => f.includes(d))
  const subjectBank = ['cargo','consumo','compra','transferencia','retiro','abono','alerta','movimiento','yape','operación','pago','realize'].some(k => s.includes(k))
  return fromBank || (subjectBank && (f.includes('bcp')||f.includes('bbva')||f.includes('interbank')||f.includes('scotiabank')))
}

// GET ?days=N → parse and insert
// GET ?days=N&dry=true → preview
// GET ?debug=true → show raw found emails (diagnostic)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.accessToken)
    return NextResponse.json({ error: 'No autenticado. Cierra sesión y vuelve a entrar en la app.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days')||'7'), 30)
  const dry = searchParams.get('dry')==='true'
  const debug = searchParams.get('debug')==='true'
  const uid = session.user.id

  const oAuth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  oAuth.setCredentials({ access_token: session.accessToken })
  const gmail = google.gmail({ version:'v1', auth:oAuth })

  const after = Math.floor((Date.now()-days*86400000)/1000)
  const queries = [
    `from:(*bcp*) after:${after}`,
    `from:(*bbva*) after:${after}`,
    `from:(*interbank* OR *tbk*) after:${after}`,
    `subject:(cargo OR consumo OR compra OR transferencia OR yape OR alerta) after:${after}`,
  ]

  const msgIds = new Set<string>()
  for (const q of queries) {
    try {
      const r = await gmail.users.messages.list({ userId:'me', q, maxResults:30 })
      ;(r.data.messages||[]).forEach(m => msgIds.add(m.id!))
    } catch(e: any) { console.log('Gmail search:', e.message) }
  }

  if (debug) {
    const emails: any[] = []
    for (const id of Array.from(msgIds).slice(0,15)) {
      try {
        const msg = await gmail.users.messages.get({ userId:'me', id, format:'metadata', metadataHeaders:['From','Subject','Date'] })
        const hdrs = msg.data.payload?.headers||[]
        emails.push({ id, from:hdrs.find(h=>h.name==='From')?.value, subject:hdrs.find(h=>h.name==='Subject')?.value, date:hdrs.find(h=>h.name==='Date')?.value })
      } catch{}
    }
    return NextResponse.json({ totalFound:msgIds.size, emails, days, hint: msgIds.size===0?'No se encontraron emails bancarios. Verifica que tu Gmail tiene emails de alertas de BCP/BBVA/IBK.' : 'Emails encontrados. Usa ?dry=true para ver transacciones detectadas.' })
  }

  const parsed: any[] = [], skipped: string[] = [], errors: any[] = []

  for (const id of Array.from(msgIds).slice(0,20)) {
    try {
      const msg = await gmail.users.messages.get({ userId:'me', id, format:'full' })
      const hdrs = msg.data.payload?.headers||[]
      const from = hdrs.find(h=>h.name?.toLowerCase()==='from')?.value||''
      const subject = hdrs.find(h=>h.name?.toLowerCase()==='subject')?.value||''
      const body = extractText(msg.data.payload)

      if (!isBankEmail(from, subject)) { skipped.push(subject.slice(0,50)); continue }

      const aiPrompt = `Analiza este email bancario peruano y extrae la transacción SI hay una.
Responde SOLO con JSON (sin markdown). Si NO es un email de transacción, responde: {"no_transaction":true}

Formato cuando SÍ hay transacción:
{"bank":"BCP|BBVA|Interbank","type":"gasto|ingreso","amount":número,"currency":"PEN|USD","merchant":"comercio","date":"YYYY-MM-DD","category":"categoría"}

De: ${from}
Asunto: ${subject}
Cuerpo: ${body.slice(0,1500)}`

      const raw = await callAI(aiPrompt, undefined, 300)
      const parsed_tx = JSON.parse(raw.replace(/```json|```/g,'').trim())
      if (parsed_tx.no_transaction) { skipped.push(`No tx: ${subject.slice(0,40)}`); continue }

      const fxRate = parsed_tx.currency==='USD'?3.72:1.0
      const date = parsed_tx.date||new Date().toISOString().slice(0,10)
      const hash = mkhash(uid, date, parsed_tx.amount, parsed_tx.merchant||subject)
      parsed.push({ ...parsed_tx, hash, amount_pen:Math.round(parsed_tx.amount*fxRate*100)/100, fx_rate:fxRate, gmail_id:id, subject, from:from.slice(0,60) })
    } catch(e: any) {
      errors.push({ id, error:e.message })
    }
  }

  if (dry) return NextResponse.json({ preview:true, days, totalEmails:msgIds.size, parsed:parsed.length, skipped:skipped.length, transactions:parsed, skippedSample:skipped.slice(0,8), errors })

  const supabase = createServiceClient()
  let inserted = 0
  for (const tx of parsed) {
    const { error } = await supabase.from('transactions').upsert({
      user_id:uid, bank:tx.bank||'Banco', amount:tx.amount, currency:tx.currency||'PEN', amount_pen:tx.amount_pen, fx_rate:tx.fx_rate,
      type:tx.type||'gasto', category:tx.category||'Otros', description:tx.merchant||tx.subject||'—', merchant:tx.merchant||null,
      date:`${tx.date}T12:00:00+00:00`, source:'email', is_recurring:false, eecc_hash:tx.hash,
    }, { onConflict:'eecc_hash', ignoreDuplicates:true })
    if (!error) inserted++
  }
  return NextResponse.json({ success:true, days, totalEmails:msgIds.size, parsed:parsed.length, inserted, skipped:skipped.length, errors, transactions:parsed })
}

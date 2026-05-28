// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import Anthropic from '@anthropic-ai/sdk'
import { authOptions } from '@/lib/authOptions'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) return NextResponse.json({ error: 'Falta ANTHROPIC_API_KEY' }, { status: 500 })

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = (file.type?.includes('pdf') ? 'application/pdf' : (file.type || 'image/jpeg')) as any

    const client = new Anthropic({ apiKey: key })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: `Analiza esta boleta o recibo y extrae los datos. Responde SOLO con JSON sin markdown:
{"merchant":"nombre del comercio","date":"YYYY-MM-DD","total":número,"currency":"PEN o USD","payment_method":"efectivo|visa|mastercard|yape|débito o null","items":[{"name":"producto","qty":número o null,"price":precio o null}]}
Para campos no legibles usa null.` }
        ]
      }]
    })

    const raw = response.content[0]?.text?.replace(/```json|```/g, '').trim() || ''
    let parsed
    try { parsed = JSON.parse(raw) }
    catch { return NextResponse.json({ error: 'No pude leer el archivo.' }, { status: 422 }) }
    return NextResponse.json({ result: parsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

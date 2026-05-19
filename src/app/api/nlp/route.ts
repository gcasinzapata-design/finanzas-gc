// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'Texto requerido' }, { status: 400 })

    const key = process.env.GEMINI_API_KEY
    if (!key) return NextResponse.json({ error: 'Falta GEMINI_API_KEY' }, { status: 500 })

    const today = new Date().toISOString().slice(0, 10)
    // v1beta default — supports gemini-1.5-flash
    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent(
      `Analiza este texto en español peruano y extrae la transacción financiera.
Texto: "${text}"
Hoy: ${today}

Responde SOLO con JSON sin markdown:
{"amount":número,"currency":"PEN","type":"gasto o ingreso","merchant":"nombre o null","description":"descripción breve","category":"Restaurantes|Supermercados|Alimentación|Transporte|Salud|Entretenimiento|Compras|Servicios|Educación|Vivienda|Suscripciones|Viajes|Deudas|Otros","payment_type":"credito|debito|yape|plin|efectivo|transferencia|otro","payment_method":"nombre o null","date":"${today}"}
Si no hay monto claro: {"error":"no_amount"}`
    )

    const raw = result.response.text().replace(/```json|```/g, '').trim()
    let parsed
    try { parsed = JSON.parse(raw) }
    catch { return NextResponse.json({ error: 'No pude interpretar. Intenta: "Yape a Juan S/50 almuerzo"' }, { status: 422 }) }

    if (parsed.error || !parsed.amount) {
      return NextResponse.json({ error: 'No encontré un monto. Ejemplo: "Yape a Priscila S/60 almuerzo"' }, { status: 422 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase.from('transactions').insert({
      user_id: session.user.id,
      amount: Number(parsed.amount),
      currency: parsed.currency || 'PEN',
      type: parsed.type === 'ingreso' ? 'ingreso' : 'gasto',
      category: parsed.category || 'Otros',
      description: parsed.description || text.slice(0, 200),
      merchant: parsed.merchant || null,
      date: new Date(parsed.date || today).toISOString(),
      source: 'nlp',
      payment_type: parsed.payment_type || 'otro',
      payment_method: parsed.payment_method || null,
      bank: parsed.payment_method || 'Otro',
      raw_text: text,
    }).select().single()

    if (error) {
      console.error('NLP insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, transaction: data, parsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    if (msg.includes('quota') || msg.includes('429')) return NextResponse.json({ error: 'Límite Gemini. Espera 1 minuto.' }, { status: 429 })
    console.error('NLP error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

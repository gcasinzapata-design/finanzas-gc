// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { authOptions } from '@/lib/authOptions'

function getModel() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY no configurada')
  return new GoogleGenerativeAI(key).getGenerativeModel(
    { model: 'gemini-1.5-flash' },
    { apiVersion: 'v1' }
  )
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo supera los 20MB' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type?.includes('pdf') ? 'application/pdf' : (file.type || 'image/jpeg')

    const model = getModel()
    const prompt = `Analiza esta boleta, recibo, voucher o estado de cuenta y extrae la información.
Responde SOLO con JSON válido sin markdown:
{
  "merchant": "nombre del comercio o banco",
  "date": "YYYY-MM-DD",
  "total": número del total o monto principal,
  "currency": "PEN" o "USD",
  "payment_method": "efectivo|visa|mastercard|yape|débito|transferencia o null",
  "items": [{"name": "producto o movimiento", "qty": número o null, "price": precio o null}]
}
Si es estado de cuenta: extrae el total de consumos del período como "total".
Para campos no legibles usa null.`

    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      prompt,
    ])

    const raw = result.response.text().replace(/```json|```/g, '').trim()
    let parsed
    try { parsed = JSON.parse(raw) }
    catch { return NextResponse.json({ error: 'No pude leer el archivo. Verifica que sea una imagen o PDF legible.' }, { status: 422 }) }

    return NextResponse.json({ result: parsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    if (msg.includes('quota') || msg.includes('429')) {
      return NextResponse.json({ error: 'Límite de Gemini alcanzado (plan gratuito). Espera 1 minuto e intenta de nuevo.' }, { status: 429 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

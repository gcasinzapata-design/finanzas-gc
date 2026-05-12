// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { authOptions } from '@/lib/authOptions'

function getGemini() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY no configurada')
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-1.5-flash' })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const model = getGemini()
    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      'Analiza esta boleta/recibo y extrae la información. Responde SOLO con JSON sin markdown: {"merchant":"nombre","date":"YYYY-MM-DD","total":número,"currency":"PEN","payment_method":"efectivo|visa|mastercard|yape|débito o null","items":[{"name":"producto","qty":número o null,"price":precio o null}]}. Si no puedes leer un campo usa null.',
    ])
    const raw = result.response.text().replace(/\`\`\`json|\`\`\`/g, '').trim()
    const parsed = JSON.parse(raw)
    return NextResponse.json({ result: parsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

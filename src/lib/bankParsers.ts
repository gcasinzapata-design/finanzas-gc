type Category = 'Alimentación'|'Restaurantes'|'Supermercados'|'Transporte'|'Salud'|'Entretenimiento'|'Compras'|'Servicios'|'Educación'|'Vivienda'|'Suscripciones'|'Viajes'|'Deudas'|'Otros'

export interface ParsedTransaction {
  bank: string; amount: number; type: 'gasto'|'ingreso'
  description: string; merchant?: string; date: string; raw_text: string
}

function normalizeDate(raw: string): string {
  const dmy = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
  if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}`).toISOString()
  return new Date().toISOString()
}

export function parseEmailTransaction(from: string, subject: string, body: string): ParsedTransaction | null {
  const text = `${subject} ${body}`.toLowerCase()
  const raw = `${subject} ${body}`

  let bank = 'Banco'
  if (/bcp|viabcp|banco de cr/i.test(raw+from)) bank = 'BCP'
  else if (/interbank|ibk/i.test(raw+from)) bank = 'Interbank'
  else if (/scotiabank/i.test(raw+from)) bank = 'Scotiabank'
  else if (/bbva/i.test(raw+from)) bank = 'BBVA'
  else if (/yape/i.test(raw+from)) bank = 'Yape'
  else if (/plin/i.test(raw+from)) bank = 'Plin'

  const amountPatterns = [/s\/\.?\s*([\d,]+\.?\d{0,2})/i, /soles\s+([\d,]+\.?\d{0,2})/i, /monto[:\s]+([\d,]+\.?\d{0,2})/i, /importe[:\s]+([\d,]+\.?\d{0,2})/i, /\$\s*([\d,]+\.?\d{0,2})/]
  let amount = 0
  for (const pat of amountPatterns) {
    const m = raw.match(pat)
    if (m) { const v = parseFloat(m[1].replace(/,/g,'')); if (v>0 && v<500000) { amount=v; break } }
  }
  if (!amount) return null

  const incomeWords = ['abono','depósito','deposito','transferencia recibida','pago recibido','crédito en cuenta','ingreso']
  const type = incomeWords.some(w => text.includes(w)) ? 'ingreso' : 'gasto'

  let merchant: string|undefined
  const mPat = raw.match(/(?:en|comercio|establecimiento)[:\s]+([A-Za-záéíóúñÁÉÍÓÚÑ0-9\s\.\-]{3,40}?)(?:\s*[\n\r\.,]|$)/im)
  if (mPat) merchant = mPat[1].trim().slice(0,50)

  const dateMatch = raw.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/)
  const date = dateMatch ? normalizeDate(dateMatch[0]) : new Date().toISOString()

  return { bank, amount, type, description: subject.slice(0,200), merchant, date, raw_text: raw.slice(0,500) }
}

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  'Restaurantes': ['restaurante','pizza','kfc','mcdonalds','burger','bembos','chifa','sushi','delivery','rappi','pedidos'],
  'Supermercados': ['wong','plaza vea','tottus','metro','vivanda','mass','tambo','makro'],
  'Alimentación': ['comida','café','panadería','mercado','minimarket'],
  'Transporte': ['uber','cabify','taxi','beat','indriver','gasolina','grifo','repsol','pecsa','primax','parking'],
  'Salud': ['farmacia','clínica','clinica','hospital','médico','botica','inkafarma','mifarma'],
  'Entretenimiento': ['netflix','spotify','disney','hbo','steam','cine'],
  'Compras': ['ripley','falabella','saga','oechsle','amazon','ropa','zapatos'],
  'Servicios': ['luz','agua','internet','claro','movistar','entel','bitel','sedapal','enel'],
  'Educación': ['universidad','instituto','colegio','udemy','coursera','platzi'],
  'Vivienda': ['alquiler','condominio','mantenimiento','hipoteca'],
  'Suscripciones': ['suscripción','suscripcion','membresía','membresia'],
  'Viajes': ['latam','avianca','sky','hotel','airbnb','vuelo','pasaje'],
  'Deudas': ['cuota','préstamo','crédito personal','financiera'],
  'Otros': [],
}

export function categorizeTransaction(description: string, merchant?: string): Category {
  const text = `${description} ${merchant||''}`.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    if (category === 'Otros') continue
    if (keywords.some(kw => text.includes(kw))) return category
  }
  return 'Otros'
}

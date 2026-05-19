// @ts-nocheck
type Category = 'Alimentación'|'Restaurantes'|'Supermercados'|'Transporte'|'Salud'|'Entretenimiento'|'Compras'|'Servicios'|'Educación'|'Vivienda'|'Suscripciones'|'Viajes'|'Deudas'|'Otros'

export interface ParsedTransaction {
  bank: string; amount: number; type: 'gasto'|'ingreso'
  description: string; merchant?: string; date: string; raw_text: string
}

function detectBank(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('bcp') || t.includes('viabcp') || t.includes('banco de credito') || t.includes('banco de crédito')) return 'BCP'
  if (t.includes('interbank') || t.includes('ibk')) return 'Interbank'
  if (t.includes('scotiabank')) return 'Scotiabank'
  if (t.includes('bbva')) return 'BBVA'
  if (t.includes('yape')) return 'Yape'
  if (t.includes('plin')) return 'Plin'
  if (t.includes('mibanco')) return 'Mibanco'
  if (t.includes('falabella')) return 'Falabella'
  if (t.includes('ripley')) return 'Ripley'
  if (t.includes('american express') || t.includes('amex')) return 'Amex'
  return 'Banco'
}

function extractAmount(text: string): number {
  // Try many patterns in order of specificity
  const patterns = [
    // S/ 1,234.56 or S/. 1,234.56
    /s\/\.?\s*([\d]{1,3}(?:[,\s][\d]{3})*(?:[.,]\d{1,2})?)/gi,
    // "soles" preceded by number
    /([\d]{1,3}(?:[,\s][\d]{3})*(?:[.,]\d{1,2})?)\s*soles/gi,
    // monto/importe/total/amount + number
    /(?:monto|importe|total|amount|valor|cargo|abono|cobro|pago)[:\s*]+(?:s\/\.?\s*)?([\d]{1,3}(?:[,\s][\d]{3})*(?:[.,]\d{1,2})?)/gi,
    // USD / $
    /\$\s*([\d]{1,3}(?:[,\s][\d]{3})*(?:[.,]\d{1,2})?)/g,
    // Plain number with decimal (last resort)
    /\b([\d]{1,6}[.,]\d{2})\b/g,
  ]

  for (const pat of patterns) {
    pat.lastIndex = 0
    const matches = [...text.matchAll(pat)]
    for (const m of matches) {
      const raw = (m[1] || m[0]).replace(/[,\s]/g, '').replace(',', '.')
      const val = parseFloat(raw)
      if (val > 0.5 && val < 500000) return val
    }
  }
  return 0
}

function detectType(text: string): 'gasto'|'ingreso' {
  const t = text.toLowerCase()
  const incomeWords = [
    'abono', 'depósito', 'deposito', 'transferencia recibida', 'pago recibido',
    'crédito en cuenta', 'credito en cuenta', 'ingreso', 'reembolso',
    'devolucion', 'devolución', 'sueldo', 'salario', 'honorario',
    'recibiste', 'te enviaron', 'te transferieron', 'te abonaron',
  ]
  if (incomeWords.some(w => t.includes(w))) return 'ingreso'
  return 'gasto'
}

function extractMerchant(text: string): string|undefined {
  const patterns = [
    /(?:en|comercio|establecimiento|tienda|merchant)[:\s]+([A-Za-záéíóúñÁÉÍÓÚÑ0-9\s\.\-&']{3,40}?)(?:\s*[\n\r\.,;]|$)/im,
    /(?:yapaste a|yape a|enviaste a|pagaste a|pagado a|pago a)[:\s]+([A-Za-záéíóúñÁÉÍÓÚÑ0-9\s]{3,30}?)(?:\s*[\n\r\.,;]|$)/im,
    /(?:compra en|consumo en|pago en)[:\s]+([A-Za-záéíóúñÁÉÍÓÚÑ0-9\s\.\-]{3,40}?)(?:\s*[\n\r\.,;]|$)/im,
    /(?:beneficiario|destinatario)[:\s]+([A-Za-záéíóúñÁÉÍÓÚÑ0-9\s]{3,40}?)(?:\s*[\n\r\.,;]|$)/im,
  ]
  for (const pat of patterns) {
    const m = text.match(pat)
    if (m && m[1]?.trim().length > 2) return m[1].trim().slice(0, 50)
  }
  return undefined
}

function extractDate(text: string, fallbackDate?: string): string {
  const patterns = [
    /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,  // DD/MM/YYYY
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,  // YYYY-MM-DD
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/i,
  ]
  const months: Record<string,string> = {
    enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',
    julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'
  }
  for (const pat of patterns) {
    const m = text.match(pat)
    if (m) {
      try {
        if (m[2] && isNaN(Number(m[2]))) {
          // "1 de enero de 2024" format
          return new Date(`${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}`).toISOString()
        } else if (m[1].length === 4) {
          return new Date(`${m[1]}-${m[2]}-${m[3]}`).toISOString()
        } else {
          return new Date(`${m[3]}-${m[2]}-${m[1]}`).toISOString()
        }
      } catch { continue }
    }
  }
  if (fallbackDate) {
    const d = new Date(fallbackDate)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

export function parseEmailTransaction(from: string, subject: string, body: string, dateHeader?: string): ParsedTransaction|null {
  const fullText = `${subject}\n${body}`
  const amount = extractAmount(fullText)
  if (!amount) return null

  // Must look like a financial email
  const financialKeywords = [
    'consumo','cargo','abono','pago','transferencia','compra','débito','debito',
    'crédito','credito','operacion','operación','soles','s/','tarjeta','cuenta',
    'yape','plin','estado de cuenta','movimiento','transaccion','transacción'
  ]
  const hasFinancial = financialKeywords.some(w => fullText.toLowerCase().includes(w))
  if (!hasFinancial) return null

  return {
    bank: detectBank(from + ' ' + fullText),
    amount,
    type: detectType(fullText),
    description: subject.slice(0, 200),
    merchant: extractMerchant(fullText),
    date: extractDate(fullText, dateHeader),
    raw_text: fullText.slice(0, 500),
  }
}

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  'Restaurantes':    ['restaurante','pizza','kfc','mcdonalds','burger','bembos','chifa','sushi','pollo a la brasa','delivery','rappi','pedidos ya','almuerzo','cena','desayuno'],
  'Supermercados':   ['wong','plaza vea','tottus','metro','vivanda','mass','tambo','makro','costco','plaza'],
  'Alimentación':    ['comida','café','cafe','panadería','panaderia','mercado','minimarket','bodega'],
  'Transporte':      ['uber','cabify','taxi','beat','indriver','gasolina','combustible','grifo','repsol','pecsa','primax','parking','estacionamiento','peaje'],
  'Salud':           ['farmacia','clínica','clinica','hospital','médico','medico','botica','inkafarma','mifarma','arcángel','arcangel','laboratorio','dentista'],
  'Entretenimiento': ['netflix','spotify','disney','hbo','youtube','steam','cine','larcomar','teatro','concierto'],
  'Compras':         ['ripley','falabella','saga','oechsle','amazon','mercadolibre','ropa','zapatos','tienda','retail','zara','h&m'],
  'Servicios':       ['luz','agua','internet','claro','movistar','entel','bitel','sedapal','enel','luz del sur','gas natural','telefonica'],
  'Educación':       ['universidad','instituto','colegio','udemy','coursera','platzi','libro','academia'],
  'Vivienda':        ['alquiler','condominio','mantenimiento','hipoteca','arrendamiento'],
  'Suscripciones':   ['suscripción','suscripcion','membresía','membresia','mensualidad','plan'],
  'Viajes':          ['latam','avianca','sky','hotel','airbnb','booking','vuelo','pasaje','turismo'],
  'Deudas':          ['cuota','préstamo','prestamo','crédito personal','credito personal','financiera'],
  'Otros':           [],
}

export function categorizeTransaction(description: string, merchant?: string): Category {
  const text = `${description} ${merchant || ''}`.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    if (category === 'Otros') continue
    if (keywords.some(kw => text.includes(kw))) return category
  }
  return 'Otros'
}

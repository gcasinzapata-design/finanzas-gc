export interface StatementPeriod {
  month?: number
  year?: number
  confidence: number
}

export function detectStatementPeriod(
  statementText: string
): StatementPeriod {
  const yearMatch = statementText.match(/20\d{2}/)

  const monthMap: Record<string, number> = {
    ENERO: 1,
    FEBRERO: 2,
    MARZO: 3,
    ABRIL: 4,
    MAYO: 5,
    JUNIO: 6,
    JULIO: 7,
    AGOSTO: 8,
    SEPTIEMBRE: 9,
    OCTUBRE: 10,
    NOVIEMBRE: 11,
    DICIEMBRE: 12
  }

  const normalized = statementText.toUpperCase()

  for (const [monthName, month] of Object.entries(monthMap)) {
    if (normalized.includes(monthName)) {
      return {
        month,
        year: yearMatch ? Number(yearMatch[0]) : undefined,
        confidence: 0.9
      }
    }
  }

  return {
    confidence: 0.1
  }
}

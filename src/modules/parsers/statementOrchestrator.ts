import { detectInstitution } from './detectInstitution'
import { detectStatementPeriod } from './detectStatementPeriod'
import { productDetection } from './productDetection'

export interface ParsedStatementMetadata {
  institution: string
  product: string
  category: string
  month?: number
  year?: number
}

export function statementOrchestrator(
  rawText: string
): ParsedStatementMetadata {
  const institution = detectInstitution(rawText)

  const period = detectStatementPeriod(rawText)

  const product = productDetection(rawText)

  return {
    institution: institution.institution,
    product: product.product,
    category: product.category,
    month: period.month,
    year: period.year
  }
}

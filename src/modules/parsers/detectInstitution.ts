export interface InstitutionDetection {
  institution: string
  product?: string
  confidence: number
}

export function detectInstitution(
  statementText: string
): InstitutionDetection {
  const normalized = statementText.toUpperCase()

  if (normalized.includes('BANCO DE CREDITO')) {
    return {
      institution: 'BCP',
      confidence: 0.98
    }
  }

  if (normalized.includes('INTERBANK')) {
    return {
      institution: 'INTERBANK',
      confidence: 0.98
    }
  }

  if (normalized.includes('BBVA')) {
    return {
      institution: 'BBVA',
      confidence: 0.98
    }
  }

  return {
    institution: 'UNKNOWN',
    confidence: 0.1
  }
}

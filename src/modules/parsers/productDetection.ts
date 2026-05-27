export interface ProductDetection {
  product: string
  category: string
  confidence: number
}

export function productDetection(
  statementText: string
): ProductDetection {
  const normalized = statementText.toUpperCase()

  if (
    normalized.includes('TARJETA DE CRÉDITO') ||
    normalized.includes('TARJETA CREDITO') ||
    normalized.includes('ESTADO DE CUENTA TARJETA')
  ) {
    return {
      product: 'Tarjeta de Crédito',
      category: 'tarjeta_credito',
      confidence: 0.95
    }
  }

  if (
    normalized.includes('TARJETA DE DÉBITO') ||
    normalized.includes('TARJETA DEBITO')
  ) {
    return {
      product: 'Tarjeta de Débito',
      category: 'tarjeta_debito',
      confidence: 0.95
    }
  }

  if (normalized.includes('CUENTA CORRIENTE')) {
    return {
      product: 'Cuenta Corriente',
      category: 'cuenta_corriente',
      confidence: 0.9
    }
  }

  if (
    normalized.includes('CUENTA AHORROS') ||
    normalized.includes('CUENTA DE AHORROS')
  ) {
    return {
      product: 'Cuenta de Ahorros',
      category: 'cuenta_ahorros',
      confidence: 0.9
    }
  }

  return {
    product: 'Producto Bancario',
    category: 'otro',
    confidence: 0.1
  }
}

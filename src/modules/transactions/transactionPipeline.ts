import { normalizeMerchant } from './normalizeMerchant'
import { categorizeTransaction } from '../categories/categorizeTransaction'

export function processTransaction(transaction: any) {
  const normalizedMerchant = normalizeMerchant(
    transaction.merchant
  )

  const categorization =
    categorizeTransaction(normalizedMerchant)

  return {
    ...transaction,
    normalizedMerchant,
    category: categorization.category,
    subcategory: categorization.subcategory,
    categorizationConfidence:
      categorization.confidence
  }
}

import { CATEGORY_RULES } from './categoryRules'

export function categorizeTransaction(merchant: string) {
  const normalized = merchant.toUpperCase()

  for (const rule of CATEGORY_RULES) {
    const matched = rule.match.some(pattern =>
      normalized.includes(pattern)
    )

    if (matched) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        confidence: 0.95
      }
    }
  }

  return {
    category: 'Other',
    subcategory: 'Uncategorized',
    confidence: 0.2
  }
}

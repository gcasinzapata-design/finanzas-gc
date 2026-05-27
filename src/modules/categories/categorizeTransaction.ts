// ============================================================
// categorizeTransaction.ts
// Transaction Categorization Engine - Finanzas GC
// Automatic categorization with confidence scoring,
// subcategories, and essential vs non-essential classification
// ============================================================

import { CATEGORY_RULES } from './categoryRules'

export type TransactionCategory =
    | 'Food'
  | 'Groceries'
  | 'Transport'
  | 'Debt'
  | 'Entertainment'
  | 'Subscriptions'
  | 'Utilities'
  | 'Health'
  | 'Pets'
  | 'Business'
  | 'Investments'
  | 'Shopping'
  | 'Education'
  | 'Travel'
  | 'Other'

export interface CategoryResult {
    category: TransactionCategory
    subcategory: string
    confidence: number           // 0-1
  isEssential: boolean         // essential vs discretionary
  emoji: string                // visual indicator
}

// Essential categories = needs (not wants)
const ESSENTIAL_CATEGORIES: TransactionCategory[] = [
    'Groceries',
    'Utilities',
    'Health',
    'Transport',
    'Debt',
    'Education',
  ]

const CATEGORY_EMOJIS: Record<TransactionCategory, string> = {
    Food: '🍽️',
    Groceries: '🛒',
    Transport: '🚗',
    Debt: '💳',
    Entertainment: '🎬',
    Subscriptions: '📱',
    Utilities: '💡',
    Health: '🏥',
    Pets: '🐾',
    Business: '💼',
    Investments: '📈',
    Shopping: '🛍️',
    Education: '📚',
    Travel: '✈️',
    Other: '📦',
}

export function categorizeTransaction(
    merchant: string,
    amount?: number,
    description?: string
  ): CategoryResult {
    if (!merchant) {
          return {
                  category: 'Other',
                  subcategory: 'Sin clasificar',
                  confidence: 0.1,
                  isEssential: false,
                  emoji: CATEGORY_EMOJIS['Other'],
          }
    }

  const normalized = (merchant + ' ' + (description ?? '')).toUpperCase().trim()

  for (const rule of CATEGORY_RULES) {
        const matched = rule.match.some((pattern) => normalized.includes(pattern))
        if (matched) {
                const category = rule.category as TransactionCategory
                return {
                          category,
                          subcategory: rule.subcategory,
                          confidence: 0.95,
                          isEssential: ESSENTIAL_CATEGORIES.includes(category),
                          emoji: CATEGORY_EMOJIS[category] ?? '📦',
                }
        }
  }

  // Heuristic fallback: large amounts might be debt payments
  if (amount && amount > 500) {
        const upperMerchant = merchant.toUpperCase()
        if (upperMerchant.includes('BCP') || upperMerchant.includes('BBVA') ||
                    upperMerchant.includes('INTERBANK') || upperMerchant.includes('SCOTIABANK')) {
                return {
                          category: 'Debt',
                          subcategory: 'Pago banco',
                          confidence: 0.7,
                          isEssential: true,
                          emoji: CATEGORY_EMOJIS['Debt'],
                }
        }
  }

  return {
        category: 'Other',
        subcategory: 'Sin clasificar',
        confidence: 0.2,
        isEssential: false,
        emoji: CATEGORY_EMOJIS['Other'],
  }
}

// ── Batch categorization ─────────────────────────────────────
export function categorizeTransactions(
    transactions: Array<{ merchant: string; amount?: number; description?: string }>
  ): CategoryResult[] {
    return transactions.map((t) => categorizeTransaction(t.merchant, t.amount, t.description))
}

// ── Spending breakdown by category ───────────────────────────
export function buildSpendingBreakdown(
    transactions: Array<{ merchant: string; amount: number; description?: string }>
  ): Record<TransactionCategory, { total: number; count: number; isEssential: boolean }> {
    const breakdown = {} as Record<TransactionCategory, { total: number; count: number; isEssential: boolean }>

  for (const tx of transactions) {
        const result = categorizeTransaction(tx.merchant, tx.amount, tx.description)
        const cat = result.category
        if (!breakdown[cat]) {
                breakdown[cat] = { total: 0, count: 0, isEssential: result.isEssential }
        }
        breakdown[cat].total += tx.amount
        breakdown[cat].count += 1
  }

  return breakdown
}

// ── Essential vs Non-essential split ─────────────────────────
export function splitEssentialSpending(
    transactions: Array<{ merchant: string; amount: number; description?: string }>
  ): { essential: number; discretionary: number; essentialRatio: number } {
    let essential = 0
    let discretionary = 0

  for (const tx of transactions) {
        const result = categorizeTransaction(tx.merchant, tx.amount, tx.description)
        if (result.isEssential) essential += tx.amount
        else discretionary += tx.amount
  }

  const total = essential + discretionary
    return {
          essential,
          discretionary,
          essentialRatio: total > 0 ? essential / total : 0,
    }
}

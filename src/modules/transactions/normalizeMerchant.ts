export function normalizeMerchant(merchant: string | null | undefined): string {
  if (!merchant) return ''
  return merchant
    .toUpperCase()
    .replace(/DLC\*/g, '')
    .replace(/PYU\*/g, '')
    .replace(/MP\*/g, '')
    .trim()
}

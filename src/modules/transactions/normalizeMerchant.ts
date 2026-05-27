export function normalizeMerchant(merchant: string) {
  return merchant
    .toUpperCase()
    .replace(/DLC\*/g, '')
    .replace(/PYU\*/g, '')
    .replace(/MP\*/g, '')
    .trim()
}

export interface StatementRegistryItem {
  fileName: string
  institution: string
  product?: string
  month?: number
  year?: number
  duplicated: boolean
  processed: boolean
}

export function buildRegistryKey(
  statement: StatementRegistryItem
) {
  return [
    statement.institution,
    statement.product,
    statement.month,
    statement.year
  ].join('_')
}

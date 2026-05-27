export interface NetWorthInput {
  assets: number
  liabilities: number
}

export function calculateNetWorth(
  input: NetWorthInput
) {
  return input.assets - input.liabilities
}

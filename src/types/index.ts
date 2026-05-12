export type TransactionType = 'gasto' | 'ingreso' | 'transferencia'
export type PaymentType = 'credito'|'debito'|'yape'|'plin'|'efectivo'|'transferencia'|'otro'
export type Category = 'Alimentación'|'Restaurantes'|'Supermercados'|'Transporte'|'Salud'|'Entretenimiento'|'Compras'|'Servicios'|'Educación'|'Vivienda'|'Suscripciones'|'Viajes'|'Deudas'|'Otros'

export interface Transaction {
  id: string; user_id: string; bank: string; amount: number; currency: string
  type: TransactionType; category: string|null; description: string; merchant?: string
  date: string; source: string; payment_method?: string; payment_type?: string
  notes?: string; tags?: string[]; raw_text?: string; gmail_message_id?: string
  eecc_hash?: string; eecc_import_id?: string; created_at: string
}
export interface CreditCard {
  id: string; user_id: string; bank: string; name: string; last_four?: string
  credit_limit?: number; current_balance: number; available_credit?: number
  tea?: number; tcea?: number; cut_date?: number; payment_due_date?: number
  minimum_payment?: number; color: string; is_active: boolean; created_at: string
}
export interface Debt {
  id: string; user_id: string; name: string; type: string; institution?: string
  original_amount: number; current_balance: number; monthly_payment?: number
  tea?: number; tcea?: number; total_installments?: number; remaining_installments?: number
  next_payment_date?: string; is_active: boolean; notes?: string; created_at: string
}
export interface FinancialGoal {
  id: string; user_id: string; name: string; type: string; target_amount: number
  current_amount: number; target_date?: string; monthly_contribution?: number
  is_completed: boolean; color: string; icon: string; notes?: string; created_at: string
}
export interface ChatMessage { role: 'user'|'assistant'; content: string }

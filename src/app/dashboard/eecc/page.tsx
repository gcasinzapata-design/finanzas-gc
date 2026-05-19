'use client'
import { useState, useRef, useCallback } from 'react'
import {
  Upload, FileText, Check, X, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, History,
  TrendingUp, TrendingDown, RefreshCw
} from 'lucide-react'

interface EECCTransaction {
  date: string
  description: string
  amount: number
  type: 'gasto' | 'ingreso'
  category: string
  merchant: string | null
  reference: string | null
  hash: string
  duplicate: boolean
  skip?: boolean
}

interface EECCResult {
  importId: string
  bank: string
  account_type: string
  period: string
  currency: string
  opening_balance: number | null
  closing_balance: number | null
  transactions: EECCTransaction[]
  summary: {
    total: number
    new: number
    duplicates: number
    gastos: number
    ingresos: number
    total_gastos: number
    total_ingresos: number
  }
}

interface ImportHistory {
  id: string
  filename: string
  bank: string
  period: string
  total_found: number
  total_inserted: number
  status: string
  created_at: string
}

const CAT_COLORS: Record<string, string> = {
  'Restaurantes': '#f97316', 'Supermercados': '#84cc16', 'Alimentación': '#fb923c',
  'Transporte': '#3b82f6', 'Salud': '#10b981', 'Entretenimiento': '#8b5cf6',
  'Compras': '#f43f5e', 'Servicios': '#eab308', 'Educación': '#06b6d4',
  'Vivienda': '#64748b', 'Suscripciones': '#ec4899', 'Viajes': '#f59e0b',
  'Deudas': '#ef4444', 'Otros': '#94a3b8',
}

const CATEGORIES = ['Restaurantes','Supermercados','Alimentación','Transporte','Salud',
  'Entretenimiento','Compras','Servicios','Educación','Vivienda','Suscripciones','Viajes','Deudas','Otros']

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

export default function EECCPage() {
  const [dragging, setDragging] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [result, setResult] = useState<EECCResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<EECCTransaction[]>([])
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmResult, setConfirmResult] = useState<{inserted: number; skipped: number} | null>(null)
  const [history, setHistory] = useState<ImportHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file) return
    setError(null)
    setResult(null)
    setConfirmed(false)
    setConfirmResult(null)
    setLoading(true)
    setLoadingMsg('Leyendo archivo...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (password) formData.append('password', password)
      setLoadingMsg('Gemini IA analizando transacciones...')
      const res = await fetch('/api/eecc', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setResult(data)
      setTransactions(data.transactions || [])
    } catch (e) {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setLoading(false)
    setLoadingMsg('')
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function confirmImport() {
    if (!result) return
    setConfirming(true)
    try {
      const toImport = transactions.filter(t => !t.skip)
      const res = await fetch(`/api/eecc?confirm=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          importId: result.importId,
          transactions: toImport,
          currency: result.currency,
          bank: result.bank,
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setConfirmResult({ inserted: data.inserted, skipped: data.skipped })
      setConfirmed(true)
    } catch { setError('Error guardando transacciones') }
    setConfirming(false)
  }

  async function loadHistory() {
    const res = await fetch('/api/eecc')
    const data = await res.json()
    setHistory(data.imports || [])
    setShowHistory(true)
  }

  function toggleSkip(idx: number) {
    setTransactions(prev => prev.map((t, i) => i === idx ? { ...t, skip: !t.skip } : t))
  }

  function updateCategory(idx: number, category: string) {
    setTransactions(prev => prev.map((t, i) => i === idx ? { ...t, category } : t))
  }

  function updateType(idx: number, type: 'gasto' | 'ingreso') {
    setTransactions(prev => prev.map((t, i) => i === idx ? { ...t, type } : t))
  }

  const toImport = transactions.filter(t => !t.skip && !t.duplicate)
  const duplicates = transactions.filter(t => t.duplicate)
  const manualSkipped = transactions.filter(t => t.skip && !t.duplicate)

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Importar Estado de Cuenta</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Sube tu EECC bancario (PDF o imagen) y la IA extrae todas las transacciones
          </p>
        </div>
        <button onClick={loadHistory}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl border border-slate-700 transition-colors">
          <History className="w-4 h-4" /> Historial
        </button>
      </div>

      {/* Upload zone */}
      {!result && !loading && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-white font-semibold text-lg mb-2">
            Arrastra tu EECC aquí o haz click
          </p>
          <p className="text-slate-400 text-sm mb-4">PDF, JPG, PNG — Máx. 20MB</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['BCP', 'Interbank', 'Scotiabank', 'BBVA', 'Amex', 'Visa', 'Mastercard', 'Yape'].map(b => (
              <span key={b} className="px-2.5 py-1 bg-slate-700/50 text-slate-400 text-xs rounded-lg">{b}</span>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <input
              type="password"
              placeholder="Contraseña del PDF (si está protegido)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-slate-500 placeholder-slate-500"
            />
            {password && <span className="text-emerald-400 text-xs">🔑 Clave ingresada</span>}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="border-2 border-dashed border-blue-500/30 bg-blue-500/5 rounded-2xl p-12 text-center">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold">{loadingMsg}</p>
          <p className="text-slate-400 text-sm mt-1">Esto puede tomar 15-30 segundos según el tamaño del archivo...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-rose-300 font-medium">{error}</p>
            <button onClick={() => { setError(null); setResult(null) }}
              className="text-rose-400/70 text-sm mt-1 hover:underline">
              Intentar con otro archivo
            </button>
          </div>
        </div>
      )}

      {/* Confirmed result */}
      {confirmed && confirmResult && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-emerald-300 font-bold text-lg">¡Importación exitosa!</p>
              <p className="text-emerald-400/70 text-sm">
                {confirmResult.inserted} transacciones guardadas · {confirmResult.skipped} omitidas
              </p>
            </div>
          </div>
          <button
            onClick={() => { setResult(null); setConfirmed(false); setTransactions([]) }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition-colors">
            <Upload className="w-4 h-4" /> Importar otro EECC
          </button>
        </div>
      )}

      {/* Preview */}
      {result && !confirmed && (
        <div className="space-y-5">
          {/* Info del EECC */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-bold">{result.bank}</p>
                  <p className="text-slate-400 text-sm">
                    {result.account_type?.replace('_', ' ')} · {result.period}
                  </p>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                {result.opening_balance !== null && (
                  <div><p className="text-slate-500 text-xs">Saldo inicial</p><p className="text-slate-200 font-semibold">S/ {fmt(result.opening_balance)}</p></div>
                )}
                {result.closing_balance !== null && (
                  <div><p className="text-slate-500 text-xs">Saldo final</p><p className="text-slate-200 font-semibold">S/ {fmt(result.closing_balance)}</p></div>
                )}
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-1">Total encontradas</p>
              <p className="text-white text-2xl font-bold">{result.summary.total}</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-emerald-400 text-xs mb-1">Nuevas a importar</p>
              <p className="text-emerald-300 text-2xl font-bold">{toImport.length}</p>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
              <p className="text-rose-400 text-xs mb-1">Total gastos</p>
              <p className="text-rose-300 text-2xl font-bold">S/ {fmt(result.summary.total_gastos)}</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-blue-400 text-xs mb-1">Total ingresos</p>
              <p className="text-blue-300 text-2xl font-bold">S/ {fmt(result.summary.total_ingresos)}</p>
            </div>
          </div>

          {duplicates.length > 0 && (
            <button
              onClick={() => setShowDuplicates(!showDuplicates)}
              className="flex items-center gap-2 text-amber-400 text-sm hover:text-amber-300"
            >
              <AlertTriangle className="w-4 h-4" />
              {duplicates.length} transacciones ya existen en tu cuenta (duplicadas)
              {showDuplicates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}

          {/* Tabla de transacciones */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">
                Transacciones detectadas
                <span className="ml-2 text-slate-400 font-normal">
                  ({toImport.length} nuevas · {duplicates.length} duplicadas · {manualSkipped.length} omitidas)
                </span>
              </h3>
              <p className="text-slate-500 text-xs">Edita categorías o desactiva lo que no quieras importar</p>
            </div>

            <div className="divide-y divide-slate-800">
              {transactions.map((tx, idx) => {
                if (tx.duplicate && !showDuplicates) return null
                const isSkipped = tx.skip
                const isDup = tx.duplicate
                const expanded = expandedIdx === idx

                return (
                  <div key={idx} className={`transition-colors ${isSkipped || isDup ? 'opacity-40' : ''} ${isDup ? 'bg-amber-500/5' : ''}`}>
                    <div className="flex items-center gap-3 px-5 py-3">
                      {/* Toggle skip */}
                      {!isDup && (
                        <button
                          onClick={() => toggleSkip(idx)}
                          className={`w-5 h-5 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${
                            isSkipped ? 'border-slate-600 bg-transparent' : 'border-emerald-500 bg-emerald-500'
                          }`}
                        >
                          {!isSkipped && <Check className="w-3 h-3 text-white" />}
                        </button>
                      )}
                      {isDup && (
                        <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        </div>
                      )}

                      {/* Fecha */}
                      <span className="text-slate-500 text-xs w-20 flex-shrink-0">
                        {tx.date ? new Date(tx.date + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '—'}
                      </span>

                      {/* Descripción */}
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-sm truncate">{tx.description}</p>
                        {tx.merchant && tx.merchant !== tx.description && (
                          <p className="text-slate-500 text-xs">{tx.merchant}</p>
                        )}
                      </div>

                      {/* Categoría */}
                      <select
                        value={tx.category}
                        onChange={e => updateCategory(idx, e.target.value)}
                        disabled={isSkipped || isDup}
                        onClick={e => e.stopPropagation()}
                        className="text-xs rounded-lg px-2 py-1 border border-transparent focus:border-slate-600 focus:outline-none bg-transparent"
                        style={{ color: CAT_COLORS[tx.category] || '#94a3b8' }}
                      >
                        {CATEGORIES.map(c => (
                          <option key={c} value={c} style={{ background: '#1e293b', color: CAT_COLORS[c] }}>{c}</option>
                        ))}
                      </select>

                      {/* Tipo */}
                      <button
                        onClick={() => !isDup && updateType(idx, tx.type === 'gasto' ? 'ingreso' : 'gasto')}
                        className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                          tx.type === 'ingreso' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {tx.type === 'ingreso' ? '+' : '-'}
                      </button>

                      {/* Monto */}
                      <span className={`text-sm font-bold w-24 text-right flex-shrink-0 ${
                        tx.type === 'ingreso' ? 'text-emerald-400' : 'text-slate-200'
                      }`}>
                        {result.currency === 'USD' ? '$' : 'S/'} {fmt(tx.amount)}
                      </span>

                      {isDup && <span className="text-amber-400 text-xs">Duplicado</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => { setResult(null); setTransactions([]) }}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm"
            >
              <X className="w-4 h-4" /> Cancelar y subir otro
            </button>
            <div className="flex items-center gap-3">
              <p className="text-slate-400 text-sm">
                Se importarán <span className="text-white font-semibold">{toImport.length}</span> transacciones
              </p>
              <button
                onClick={confirmImport}
                disabled={confirming || toImport.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
              >
                {confirming ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                ) : (
                  <><Check className="w-4 h-4" /> Confirmar importación</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      {showHistory && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Historial de importaciones</h3>
            <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No hay importaciones previas</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {history.map(imp => (
                <div key={imp.id} className="flex items-center gap-4 px-5 py-3">
                  <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{imp.filename}</p>
                    <p className="text-slate-500 text-xs">{imp.bank} · {imp.period}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-slate-300">{imp.total_inserted} importadas</p>
                    <p className="text-slate-500">{new Date(imp.created_at).toLocaleDateString('es-PE')}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    imp.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    imp.status === 'error' ? 'bg-rose-500/20 text-rose-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {imp.status === 'completed' ? '✓' : imp.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

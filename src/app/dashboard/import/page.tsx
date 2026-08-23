// @ts-nocheck
'use client'
import { useState, useRef, useCallback } from 'react'
import { Upload, Mail, PenLine, CheckCircle, XCircle, AlertCircle, RefreshCw, ChevronDown, Zap, Loader } from 'lucide-react'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n || 0)}`
const BANKS = ['BCP Visa Sapphire', 'BCP AMEX', 'BCP', 'BBVA', 'Interbank Visa Infinite', 'Interbank', 'Manual']
const CATS = ['Restaurantes','Delivery','Markets','Supermercados','Transporte','Gasolina','Entretenimiento','Suscripciones','Servicios','Alquiler','Seguros','Internet','Hogar','Mascotas','Viajes','Compras','Salud','Club','Cuotas Préstamos','Yape/Plin','Impuestos','Intereses','Otros']
const STATUS_ICON = { new: '🆕', duplicate_exact: '✅', duplicate_fuzzy: '⚠️' }
const STATUS_CLR = { new: '#22c55e', duplicate_exact: '#64748b', duplicate_fuzzy: '#f59e0b' }

function Badge({ status }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: STATUS_CLR[status] + '20', color: STATUS_CLR[status] }}>
      {STATUS_ICON[status]} {status === 'new' ? 'Nueva' : status === 'duplicate_exact' ? 'Duplicado exacto' : 'Posible dup.'}
    </span>
  )
}

// ── Tab 1: Email Parser ───────────────────────────────────────────────────────
function EmailParserTab() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [days, setDays] = useState(7)
  const [inserting, setInserting] = useState(false)

  async function preview() {
    setLoading(true); setResult(null)
    const r = await fetch(`/api/email-parser?days=${days}&dry=true`)
    setResult(await r.json())
    setLoading(false)
  }

  async function insert() {
    setInserting(true)
    const r = await fetch(`/api/email-parser?days=${days}`)
    setResult(await r.json())
    setInserting(false)
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-start gap-3 mb-4">
          <Mail size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-white">Lector de emails bancarios</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Lee los emails de alerta de BCP, BBVA e Interbank de tu Gmail y extrae las transacciones automáticamente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm" style={{ color: 'var(--text-2)' }}>Últimos:</label>
          <div className="flex gap-2">
            {[3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: days === d ? 'var(--blue)' : 'var(--bg-card2)', border: `1px solid ${days === d ? 'var(--blue)' : 'var(--border)'}`, color: days === d ? '#fff' : 'var(--text-2)' }}>
                {d} días
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={preview} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-1)', opacity: loading ? 0.6 : 1 }}>
            {loading ? <Loader size={13} className="animate-spin" /> : <Mail size={13} />}
            Vista previa
          </button>
          {result?.parsed > 0 && !result?.inserted && (
            <button onClick={insert} disabled={inserting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--blue)', opacity: inserting ? 0.6 : 1 }}>
              {inserting ? <Loader size={13} className="animate-spin" /> : <Zap size={13} />}
              Insertar {result.parsed} transacciones
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            {[
              { l: 'Emails revisados', v: result.totalEmails, c: '#94a3b8' },
              { l: 'Transacciones', v: result.parsed, c: '#3b82f6' },
              { l: result.inserted != null ? 'Insertadas' : 'Para insertar', v: result.inserted ?? result.parsed, c: '#22c55e' },
              { l: 'Sin parsear', v: result.skipped, c: '#64748b' },
            ].map((k, i) => (
              <div key={i} className="card p-3 text-center">
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{k.l}</p>
                <p className="text-2xl font-bold num mt-1" style={{ color: k.c }}>{k.v}</p>
              </div>
            ))}
          </div>

          {result.transactions?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm font-semibold text-white">Transacciones detectadas</p>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                {result.transactions.map((tx, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{tx.merchant}</p>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{tx.date} · {tx.bank} · {tx.category}</p>
                    </div>
                    <p className="text-sm font-bold num text-white">{S(tx.amount_pen)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.inserted != null && (
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <p className="text-sm font-semibold text-green-400">✅ {result.inserted} transacciones insertadas · {result.duplicates} ya existían</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Manual Entry ───────────────────────────────────────────────────────
function ManualEntryTab() {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: today, amount: '', currency: 'PEN', type: 'gasto',
    category: 'Otros', merchant: '', bank: 'Manual', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.amount || !form.merchant) return setError('Completa monto y descripción')
    setSaving(true); setError(null); setSuccess(null)
    const r = await fetch('/api/transactions/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await r.json()
    setSaving(false)
    if (data.success) {
      setSuccess(data.transaction)
      setForm(f => ({ ...f, amount: '', merchant: '', notes: '' }))
    } else {
      setError(data.error)
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <PenLine size={16} className="text-purple-400" />
        <h2 className="font-semibold text-white">Ingreso manual</h2>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
          Efectivo · Yape · Cualquier gasto no registrado
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Fecha</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm text-white"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }} />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Monto</label>
          <div className="flex gap-2">
            <select value={form.currency} onChange={e => set('currency', e.target.value)}
              className="px-2 py-2 rounded-xl text-sm"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
              <option value="PEN">S/</option>
              <option value="USD">$</option>
            </select>
            <input type="number" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl text-sm text-white font-bold"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }} />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Descripción / Comercio</label>
        <input placeholder="Ej: Almuerzo con cliente, Efectivo taxi, Yape a María..." value={form.merchant}
          onChange={e => set('merchant', e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm text-white"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Tipo</label>
          <div className="flex gap-1.5">
            {[['gasto', '↓', '#ef4444'], ['ingreso', '↑', '#22c55e']].map(([v, icon, c]) => (
              <button key={v} onClick={() => set('type', v)}
                className="flex-1 py-2 rounded-xl text-xs font-medium"
                style={{ background: form.type === v ? c + '20' : 'var(--bg-card2)', border: `1px solid ${form.type === v ? c : 'var(--border)'}`, color: form.type === v ? c : 'var(--text-2)' }}>
                {icon} {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Categoría</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}
            className="w-full px-2 py-2 rounded-xl text-sm"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Banco / Medio</label>
          <select value={form.bank} onChange={e => set('bank', e.target.value)}
            className="w-full px-2 py-2 rounded-xl text-sm"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
            {BANKS.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Notas (opcional)</label>
        <input placeholder="Contexto adicional..." value={form.notes} onChange={e => set('notes', e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm text-white"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }} />
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>
          ❌ {error}
        </div>
      )}
      {success && (
        <div className="px-3 py-2 rounded-xl text-sm text-green-400" style={{ background: 'rgba(34,197,94,0.1)' }}>
          ✅ Transacción registrada: {success.merchant} — {S(success.amount_pen)}
        </div>
      )}

      <button onClick={submit} disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
        style={{ background: saving ? 'var(--border)' : 'var(--blue)' }}>
        {saving ? <Loader size={14} className="animate-spin" /> : <PenLine size={14} />}
        {saving ? 'Guardando...' : 'Registrar transacción'}
      </button>
    </div>
  )
}

// ── Tab 3: EECC Upload + Validation ──────────────────────────────────────────
function EECCUploadTab() {
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [validating, setValidating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [validated, setValidated] = useState(null)
  const [confirmed, setConfirmed] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const fileRef = useRef(null)

  const drop = useCallback(e => {
    e.preventDefault()
    const f = e.dataTransfer?.files[0] || e.target.files[0]
    if (f?.name.endsWith('.pdf') || f?.name.endsWith('.PDF')) setFile(f)
  }, [])

  async function parseFile() {
    if (!file) return
    setParsing(true); setParsed(null); setValidated(null); setConfirmed(null)
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/eecc', { method: 'POST', body: fd })
    const data = await r.json()
    setParsed(data)
    setParsing(false)

    if (data.transactions?.length) await validate(data.transactions)
  }

  async function validate(txs) {
    setValidating(true)
    const r = await fetch('/api/eecc/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: txs }),
    })
    const data = await r.json()
    setValidated(data)
    // Auto-select only "new" ones
    setSelected(new Set(data.transactions.filter(t => t.status === 'new').map((_, i) => i)))
    setValidating(false)
  }

  async function confirm() {
    if (!validated || !selected.size) return
    setConfirming(true)
    const toInsert = validated.transactions.filter((_, i) => selected.has(i))
    const r = await fetch('/api/eecc/validate', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: toInsert }),
    })
    const data = await r.json()
    setConfirmed(data)
    setConfirming(false)
  }

  const toggleAll = (status) => {
    if (!validated) return
    const indices = validated.transactions.map((t, i) => ({ t, i })).filter(({ t }) => t.status === status).map(({ i }) => i)
    const allSelected = indices.every(i => selected.has(i))
    const next = new Set(selected)
    if (allSelected) indices.forEach(i => next.delete(i))
    else indices.forEach(i => next.add(i))
    setSelected(next)
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={drop} onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors"
        style={{ borderColor: file ? 'var(--blue)' : 'var(--border)', background: file ? 'rgba(59,130,246,0.05)' : 'var(--bg-card)' }}>
        <input ref={fileRef} type="file" accept=".pdf,.PDF" className="hidden" onChange={drop} />
        <Upload size={28} className="mx-auto mb-3" style={{ color: file ? '#3b82f6' : 'var(--text-3)' }} />
        {file ? (
          <div>
            <p className="font-semibold text-white">{file.name}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{(file.size / 1024).toFixed(0)} KB · PDF bancario</p>
          </div>
        ) : (
          <div>
            <p className="font-medium" style={{ color: 'var(--text-2)' }}>Arrastra un EECC o haz clic</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>BCP · BBVA · Interbank · PDF protegido o libre</p>
          </div>
        )}
      </div>

      {file && !validated && (
        <button onClick={parseFile} disabled={parsing}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
          style={{ background: parsing ? 'var(--border)' : 'var(--blue)' }}>
          {parsing || validating ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
          {parsing ? 'Parseando EECC...' : validating ? 'Validando contra DB...' : 'Procesar EECC'}
        </button>
      )}

      {/* Validation results */}
      {validated && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: 'Nuevas 🆕', v: validated.summary.new, c: '#22c55e', status: 'new' },
              { l: 'Duplicadas ✅', v: validated.summary.duplicate_exact, c: '#64748b', status: 'duplicate_exact' },
              { l: 'Revisar ⚠️', v: validated.summary.duplicate_fuzzy, c: '#f59e0b', status: 'duplicate_fuzzy' },
            ].map((k, i) => (
              <button key={i} onClick={() => toggleAll(k.status)}
                className="card p-3 text-center hover:opacity-80 transition-opacity">
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{k.l}</p>
                <p className="text-2xl font-bold num mt-1" style={{ color: k.c }}>{k.v}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>click para seleccionar</p>
              </button>
            ))}
          </div>

          {/* Transaction list */}
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold text-white">
                {selected.size} seleccionadas de {validated.transactions.length}
              </p>
              <button onClick={() => setSelected(new Set(validated.transactions.map((_, i) => i)))}
                className="text-xs" style={{ color: 'var(--blue)' }}>Seleccionar todas</button>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
              {validated.transactions.map((tx, i) => (
                <div key={i}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.02]"
                  onClick={() => {
                    const next = new Set(selected)
                    if (next.has(i)) next.delete(i); else next.add(i)
                    setSelected(next)
                  }}>
                  <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: selected.has(i) ? 'var(--blue)' : 'var(--border)', border: `1px solid ${selected.has(i) ? 'var(--blue)' : 'var(--border2)'}` }}>
                    {selected.has(i) && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{tx.merchant || tx.description?.slice(0, 30)}</p>
                      <Badge status={tx.status} />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {tx.date} · {tx.bank} · {tx.category}
                      {tx.reason && <span className="ml-2" style={{ color: STATUS_CLR[tx.status] }}>— {tx.reason}</span>}
                    </p>
                  </div>
                  <p className="text-sm font-bold num text-white flex-shrink-0">
                    {S(Number(tx.amount_pen || tx.amount))}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {!confirmed && (
            <button onClick={confirm} disabled={confirming || !selected.size}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: !selected.size ? 'var(--border)' : '#059669', opacity: confirming ? 0.7 : 1 }}>
              {confirming ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {confirming ? 'Insertando...' : `Insertar ${selected.size} transacciones seleccionadas`}
            </button>
          )}

          {confirmed && (
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <p className="text-sm font-semibold text-green-400">
                ✅ {confirmed.inserted} transacciones insertadas correctamente
                {confirmed.errors?.length > 0 && ` · ${confirmed.errors.length} errores`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'email', label: '📧 Emails bancarios', icon: Mail },
  { id: 'manual', label: '✏️ Entrada manual', icon: PenLine },
  { id: 'eecc', label: '📄 Subir EECC', icon: Upload },
]

export default function ImportPage() {
  const [tab, setTab] = useState('email')

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-3xl mx-auto" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div>
        <h1 className="text-xl font-bold text-white">Importar Transacciones</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
          3 formas de mantener tus finanzas actualizadas — sin duplicados
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-card)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 text-xs md:text-sm font-medium rounded-xl transition-all"
            style={{ background: tab === t.id ? 'var(--blue)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--text-3)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'email' && <EmailParserTab />}
      {tab === 'manual' && <ManualEntryTab />}
      {tab === 'eecc' && <EECCUploadTab />}
    </div>
  )
}

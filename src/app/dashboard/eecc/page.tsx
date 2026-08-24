// @ts-nocheck
'use client'
import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, X, Check, Loader2, AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

const S = (n) => `S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:2}).format(n||0)}`
const CAT_CLR = { Restaurantes:'#f97316',Delivery:'#fb923c',Supermercados:'#22c55e',Markets:'#4ade80',Transporte:'#3b82f6',Gasolina:'#78716c',Salud:'#10b981',Suscripciones:'#ec4899',Servicios:'#eab308',Hogar:'#a16207',Internet:'#6366f1',Club:'#d97706',Mascotas:'#14b8a6',Viajes:'#a78bfa',Compras:'#f43f5e',Entretenimiento:'#8b5cf6','Cuotas Préstamos':'#ef4444','Pago Tarjeta':'#94a3b8',Ahorro:'#22d3ee',Impuestos:'#dc2626',Intereses:'#16a34a',Sueldo:'#22c55e','Yape/Plin':'#7c3aed',Otros:'#64748b' }

function FileCard({ result, onToggle, selected }) {
  const [open, setOpen] = useState(false)
  const hasError = !!result.error
  const newTxs = result.transactions?.filter(t => !t.duplicate) || []
  const dupTxs = result.transactions?.filter(t => t.duplicate) || []

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 cursor-pointer border-b" style={{borderColor:'var(--border)'}} onClick={()=>setOpen(o=>!o)}>
        <FileText size={16} style={{color: hasError?'#ef4444':'#22c55e', flexShrink:0}}/>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{result.filename}</p>
          {!hasError && <p className="text-xs" style={{color:'var(--text-3)'}}>{result.bank} · {result.period} · {result.summary?.new} nuevas · {result.summary?.duplicates} ya existían</p>}
          {hasError && <p className="text-xs text-red-400">{result.error}</p>}
        </div>
        {!hasError && (
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{background:'#22c55e'}}>{result.summary?.new} nuevas</span>
            {open ? <ChevronDown size={14} style={{color:'var(--text-3)'}}/> : <ChevronRight size={14} style={{color:'var(--text-3)'}}/>}
          </div>
        )}
      </div>

      {open && !hasError && (
        <div className="max-h-80 overflow-y-auto divide-y" style={{borderColor:'var(--border)'}}>
          {result.transactions?.map((tx, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]"
              style={{opacity: tx.duplicate ? 0.45 : 1}}>
              <input type="checkbox" 
                checked={!tx.duplicate && selected.has(`${result.filename}-${i}`)}
                disabled={tx.duplicate}
                onChange={() => onToggle(result.filename, i)}
                className="flex-shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{tx.merchant||tx.description?.slice(0,35)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{background:(CAT_CLR[tx.category]||'#64748b')+'20',color:CAT_CLR[tx.category]||'#94a3b8',fontSize:10}}>{tx.category}</span>
                  <span className="text-xs" style={{color:'var(--text-3)'}}>{tx.date}</span>
                  {tx.duplicate && <span className="text-xs" style={{color:'var(--text-3)'}}>✓ ya existe</span>}
                </div>
              </div>
              <p className={`text-sm font-bold num flex-shrink-0 ${tx.type==='ingreso'?'text-green-400':tx.type==='transferencia'?'text-blue-400':'text-white'}`}>
                {tx.type==='ingreso'?'+':tx.type==='gasto'?'−':'↔'}{S(tx.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EECCPage() {
  const [files, setFiles] = useState([])
  const [password, setPassword] = useState('73325648')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [results, setResults] = useState([]) // array of file results
  const [selected, setSelected] = useState(new Set())
  const [inserting, setInserting] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFiles = useCallback((newFiles) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      const toAdd = Array.from(newFiles).filter(f => !existing.has(f.name))
      return [...prev, ...toAdd]
    })
    setResults([])
    setDone(null)
    setError(null)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    const dropped = e.dataTransfer?.files
    if (dropped?.length) handleFiles(dropped)
  }, [handleFiles])

  function removeFile(name) {
    setFiles(prev => prev.filter(f => f.name !== name))
  }

  async function processFiles() {
    if (!files.length) return
    setLoading(true)
    setError(null)
    setResults([])
    setSelected(new Set())

    const newSelected = new Set()
    const allResults = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setLoadingMsg(`Procesando ${file.name} (${i+1}/${files.length})…`)
      try {
        const fd = new FormData()
        fd.append('file', file)
        if (password) fd.append('password', password)

        const res = await fetch('/api/eecc', { method: 'POST', body: fd })
        const data = await res.json()

        if (data.results?.[0]) {
          const r = data.results[0]
          allResults.push(r)
          // Auto-select all new transactions
          if (!r.error) {
            r.transactions?.forEach((tx, idx) => {
              if (!tx.duplicate) newSelected.add(`${r.filename}-${idx}`)
            })
          }
        } else {
          allResults.push({ filename: file.name, error: data.error || 'Error al procesar', transactions: [] })
        }
      } catch (err) {
        allResults.push({ filename: file.name, error: err.message, transactions: [] })
      }
    }

    setResults(allResults)
    setSelected(newSelected)
    setLoading(false)
    setLoadingMsg('')
  }

  function toggleTx(filename, idx) {
    const key = `${filename}-${idx}`
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function insertSelected() {
    setInserting(true)
    setError(null)
    const toInsert = []

    results.forEach(result => {
      result.transactions?.forEach((tx, idx) => {
        if (selected.has(`${result.filename}-${idx}`)) {
          toInsert.push({ ...tx, bank: result.bank })
        }
      })
    })

    if (!toInsert.length) { setInserting(false); return }

    const res = await fetch('/api/eecc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: toInsert })
    })
    const data = await res.json()
    setInserting(false)
    if (data.success) {
      setDone({ inserted: data.inserted, skipped: data.skipped || 0 })
      setSelected(new Set())
    } else {
      setError(data.error)
    }
  }

  const totalNew = results.reduce((s,r) => s + (r.summary?.new||0), 0)
  const totalDup = results.reduce((s,r) => s + (r.summary?.duplicates||0), 0)
  const selectedCount = selected.size

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-3xl mx-auto" style={{background:'var(--bg-base)',minHeight:'100vh'}}>
      <div>
        <h1 className="text-xl font-bold text-white">Importar EECCs</h1>
        <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>
          Sube varios PDFs a la vez · Claude Haiku los analiza · Dedup automático
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop} onDragOver={e=>e.preventDefault()}
        onClick={()=>inputRef.current?.click()}
        className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors"
        style={{borderColor:files.length?'var(--blue)':'var(--border)',background:files.length?'rgba(59,130,246,0.05)':'var(--bg-card)'}}>
        <input ref={inputRef} type="file" accept=".pdf,.PDF" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)}/>
        <Upload size={28} className="mx-auto mb-3" style={{color:files.length?'#3b82f6':'var(--text-3)'}}/>
        <p className="font-medium" style={{color:files.length?'#fff':'var(--text-2)'}}>
          {files.length ? `${files.length} archivo${files.length>1?'s':''} seleccionado${files.length>1?'s':''}` : 'Arrastra PDFs aquí o haz clic'}
        </p>
        <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>
          BCP · BBVA · Interbank · Múltiples archivos · PDFs SIN contraseña
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.name} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <FileText size={14} style={{color:'var(--text-3)',flexShrink:0}}/>
              <p className="text-sm text-white flex-1 truncate">{f.name}</p>
              <p className="text-xs" style={{color:'var(--text-3)'}}>{(f.size/1024).toFixed(0)} KB</p>
              <button onClick={()=>removeFile(f.name)} className="p-1 hover:bg-white/10 rounded">
                <X size={12} style={{color:'var(--text-3)'}}/>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Password */}
      <div className="flex items-center gap-3">
        <label className="text-sm flex-shrink-0" style={{color:'var(--text-2)'}}>Contraseña PDF (si aplica):</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Ej: 12345678"
          className="flex-1 max-w-xs px-3 py-2 rounded-xl text-sm text-white"
          style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}/>
        <p className="text-xs" style={{color:'var(--text-3)'}}>⚠️ Los PDFs protegidos deben desprotegerse primero</p>
      </div>

      {/* Important note about protected PDFs */}
      <div className="px-4 py-3 rounded-xl" style={{background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.2)'}}>
        <p className="text-xs" style={{color:'#fbbf24'}}>
          <strong>Nota sobre PDFs protegidos:</strong> Para quitar contraseña en Mac: abre en Preview → Archivo → Exportar como PDF (sin marcar contraseña). En Windows: imprime a "Microsoft Print to PDF". En móvil: usa Smallpdf o iLovePDF.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)'}}>
          <p className="text-sm text-red-400">❌ {error}</p>
        </div>
      )}

      {/* Process button */}
      {files.length > 0 && !results.length && (
        <button onClick={processFiles} disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
          style={{background:loading?'var(--border)':'var(--blue)'}}>
          {loading ? <><Loader2 size={14} className="animate-spin"/>{loadingMsg}</> : <>Analizar {files.length} archivo{files.length>1?'s':''} con IA</>}
        </button>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center">
              <p className="text-xs" style={{color:'var(--text-3)'}}>Archivos</p>
              <p className="text-2xl font-bold text-white">{results.length}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xs" style={{color:'var(--text-3)'}}>Transacciones nuevas</p>
              <p className="text-2xl font-bold text-green-400">{totalNew}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xs" style={{color:'var(--text-3)'}}>Ya existían</p>
              <p className="text-2xl font-bold" style={{color:'var(--text-3)'}}>{totalDup}</p>
            </div>
          </div>

          {results.map((r, i) => (
            <FileCard key={i} result={r} onToggle={toggleTx} selected={selected}/>
          ))}

          {!done && totalNew > 0 && (
            <button onClick={insertSelected} disabled={inserting || !selectedCount}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{background:!selectedCount?'var(--border)':'#059669'}}>
              {inserting ? <><Loader2 size={14} className="animate-spin"/>Insertando…</> 
                : <>✅ Insertar {selectedCount} transacciones seleccionadas</>}
            </button>
          )}

          {done && (
            <div className="px-4 py-3 rounded-xl" style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.3)'}}>
              <p className="text-sm font-semibold text-green-400">
                ✅ {done.inserted} transacciones insertadas · {done.skipped} ya existían
              </p>
              <button onClick={()=>{setFiles([]);setResults([]);setDone(null)}} className="mt-2 text-xs text-green-400 underline">
                Cargar más archivos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

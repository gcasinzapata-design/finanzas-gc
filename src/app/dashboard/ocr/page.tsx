'use client'
import { useState, useRef } from 'react'
import { Camera, Upload, Loader2, Check } from 'lucide-react'

export default function OCRPage() {
  const [file, setFile] = useState<File|null>(null)
  const [preview, setPreview] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFile(f); setSaved(false); setResult(null); setError(null)
    if(f.type.startsWith('image/')) { const r=new FileReader(); r.onload=e=>setPreview(e.target?.result as string); r.readAsDataURL(f) }
    else setPreview(null)
  }

  async function processFile() {
    if(!file) return
    setLoading(true); setError(null)
    try {
      const formData = new FormData(); formData.append('file',file)
      const res = await fetch('/api/ocr',{method:'POST',body:formData})
      const data = await res.json()
      if(data.error) throw new Error(data.error)
      setResult(data.result||data)
    } catch(e:unknown) { setError(e instanceof Error?e.message:'Error procesando') }
    setLoading(false)
  }

  async function saveTransaction() {
    if(!result) return
    setLoading(true)
    try {
      await fetch('/api/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        amount:result.total||0, currency:result.currency||'PEN', type:'gasto',
        merchant:result.merchant, description:`Boleta: ${result.merchant||'Desconocido'}`,
        date:result.date?new Date(result.date).toISOString():new Date().toISOString(),
        source:'ocr', category:'Otros',
      })})
      setSaved(true)
    } catch { setError('Error guardando') }
    setLoading(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-PE',{minimumFractionDigits:2}).format(n||0)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Escanear Recibo</h1>
        <p className="text-slate-400 text-sm mt-1">Sube una foto de boleta o voucher — la IA extrae los datos</p>
      </div>
      <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f)}}
        className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center hover:border-slate-500 transition-colors cursor-pointer"
        onClick={()=>inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f)}} />
        {preview ? <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-xl object-contain" /> : (
          <div className="space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto"><Upload className="w-7 h-7 text-slate-400" /></div>
            <p className="text-slate-300 font-medium">Arrastra una imagen o haz clic</p>
            <p className="text-slate-500 text-sm">JPG, PNG, PDF · Máx. 10MB</p>
          </div>
        )}
      </div>
      {file&&!result && (
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5 text-slate-400" />
            <div><p className="text-slate-200 text-sm font-medium">{file.name}</p><p className="text-slate-500 text-xs">{(file.size/1024).toFixed(0)} KB</p></div>
          </div>
          <button onClick={processFile} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm rounded-lg disabled:opacity-50">
            {loading?<><Loader2 className="w-4 h-4 animate-spin"/>Procesando...</>:'Extraer datos'}
          </button>
        </div>
      )}
      {error && <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-300 text-sm">{error}</div>}
      {result && (
        <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2"><Check className="w-5 h-5 text-emerald-400"/><h3 className="text-white font-semibold">Datos extraídos</h3></div>
          <div className="grid grid-cols-2 gap-3">
            {result.merchant&&<div className="bg-slate-800 rounded-xl p-3"><p className="text-slate-400 text-xs mb-1">Comercio</p><p className="text-white font-medium text-sm">{result.merchant}</p></div>}
            {result.total!==undefined&&<div className="bg-slate-800 rounded-xl p-3"><p className="text-slate-400 text-xs mb-1">Total</p><p className="text-white font-medium text-sm">{result.currency||'S/'} {fmt(result.total)}</p></div>}
            {result.date&&<div className="bg-slate-800 rounded-xl p-3"><p className="text-slate-400 text-xs mb-1">Fecha</p><p className="text-white font-medium text-sm">{result.date}</p></div>}
            {result.payment_method&&<div className="bg-slate-800 rounded-xl p-3"><p className="text-slate-400 text-xs mb-1">Medio de pago</p><p className="text-white font-medium text-sm">{result.payment_method}</p></div>}
          </div>
          {saved ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm"><Check className="w-4 h-4"/>Transacción guardada</div>
          ) : (
            <button onClick={saveTransaction} disabled={loading} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium rounded-xl disabled:opacity-50">
              {loading?'Guardando...':'Guardar transacción'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

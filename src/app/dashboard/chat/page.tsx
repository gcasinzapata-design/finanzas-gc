'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Zap, Brain, Check, X, ChevronDown } from 'lucide-react'

interface Message { role: 'user' | 'assistant'; content: string }

const NLP_EXAMPLES = [
  'Yape a Priscila S/60 almuerzo',
  'Hoy me pagaron sueldo S/8000',
  'Taxi a Miraflores S/25 efectivo',
  'Netflix cobró S/40.9 tarjeta débito',
  'Pagué luz Enel S/85 Yape',
]

const ADVISOR_PROMPTS = [
  { label: '🔴 Avalancha o bola de nieve?', q: 'Qué estrategia me conviene para eliminar mis deudas, avalancha o bola de nieve? Muéstrame los números exactos de cada una.' },
  { label: '💳 Optimizar mis tarjetas', q: 'En qué tarjeta debo hacer qué tipo de compras? Cuánto debo pagar en cada una este mes? Dame un plan específico.' },
  { label: '💰 Cuánta liquidez mantener?', q: 'Cuánto efectivo/saldo debería mantener disponible dado mi flujo actual? Tengo fondo de emergencia suficiente?' },
  { label: '📉 Dónde puedo ahorrar?', q: 'Analiza mis gastos y dime en qué categorías estoy gastando de más. Qué podría reducir sin afectar mi calidad de vida?' },
  { label: '🎯 Son alcanzables mis objetivos?', q: 'Con mi situación actual, puedo alcanzar mis objetivos financieros? Qué debería priorizar primero?' },
  { label: '📊 Resumen ejecutivo', q: 'Dame un resumen ejecutivo de mi situación financiera: fortalezas, debilidades y las 3 acciones más urgentes.' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n || 0)
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'registro' | 'chat'>('chat')
  const [nlpResult, setNlpResult] = useState<any>(null)
  const [showAll, setShowAll] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, nlpResult, loading])

  async function sendNLP(text: string) {
    setLoading(true)
    setNlpResult(null)
    try {
      const res = await fetch('/api/nlp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      setNlpResult(await res.json())
    } catch {
      setNlpResult({ error: 'Error de conexión' })
    }
    setLoading(false)
  }

  async function sendChat(text: string) {
    const updated: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(updated)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || 'Error al responder' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión' }])
    }
    setLoading(false)
  }

  function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    if (mode === 'registro') sendNLP(text)
    else sendChat(text)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const visiblePrompts = showAll ? ADVISOR_PROMPTS : ADVISOR_PROMPTS.slice(0, 4)
  const parsed = nlpResult?.parsed

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">Copiloto Financiero IA</h1>
            <p className="text-slate-400 text-xs">Asesor personal · Registro rápido · Gratis con Gemini</p>
          </div>
          <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => { setMode('chat'); setNlpResult(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'chat' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Brain className="w-3.5 h-3.5" /> Asesor IA
            </button>
            <button
              onClick={() => { setMode('registro'); setNlpResult(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'registro' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Zap className="w-3.5 h-3.5" /> Registro rápido
            </button>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }} className="space-y-4">
        {/* Asesor prompts */}
        {mode === 'chat' && messages.length === 0 && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-5 h-5 text-blue-400" />
                <h3 className="text-white font-bold">Tu asesor financiero personal</h3>
              </div>
              <p className="text-slate-300 text-sm">Analiza tu situación real: deudas, tarjetas, gastos. Te da estrategias con números exactos.</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium mb-2">PREGUNTAS FRECUENTES</p>
              <div className="space-y-2">
                {visiblePrompts.map(({ label, q }) => (
                  <button
                    key={label}
                    onClick={() => setInput(q)}
                    className="w-full text-left px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl text-slate-300 text-sm transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full mt-2 py-2 text-slate-500 text-xs hover:text-slate-300 flex items-center justify-center gap-1"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                {showAll ? 'Ver menos' : 'Ver más preguntas'}
              </button>
            </div>
          </div>
        )}

        {/* Chat messages */}
        {mode === 'chat' && messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-200'}`}>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{m.content}</pre>
            </div>
          </div>
        ))}

        {/* Registro NLP */}
        {mode === 'registro' && !nlpResult && (
          <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-white font-semibold text-sm">Registro en lenguaje natural</h3>
            </div>
            <p className="text-slate-400 text-sm mb-4">Escribe cualquier gasto o ingreso como hablarías:</p>
            <div className="space-y-2">
              {NLP_EXAMPLES.map(ex => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="block w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-slate-300 text-sm transition-colors"
                >
                  &quot;{ex}&quot;
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'registro' && nlpResult && (
          <div className="space-y-3">
            {/* Assistant bubble */}
            <div className="flex justify-start">
              <div className={`max-w-[90%] rounded-2xl px-4 py-3 border ${nlpResult.error ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800 border-slate-700'}`}>
                {nlpResult.error ? (
                  <div>
                    <p className="text-rose-300 text-sm font-medium">❌ {nlpResult.error}</p>
                    {nlpResult.suggestion && <p className="text-rose-400/70 text-xs mt-1">{nlpResult.suggestion}</p>}
                  </div>
                ) : parsed ? (
                  <div>
                    <p className="text-emerald-400 text-sm font-semibold mb-2">✅ ¡Listo! Registré tu {parsed.type}:</p>
                    <div className="text-slate-200 text-sm space-y-1">
                      <p>💰 <span className="font-bold">{parsed.currency === 'USD' ? '$' : 'S/'} {fmt(parsed.amount)}</span>{parsed.merchant ? ` en ${parsed.merchant}` : ''}</p>
                      <p>🏷️ Categoría: <span className="text-slate-300">{parsed.category}</span></p>
                      {(parsed.payment_method || parsed.payment_type) && (
                        <p>💳 Medio: <span className="text-slate-300">{parsed.payment_method || parsed.payment_type}</span></p>
                      )}
                      <p>📅 Fecha: <span className="text-slate-300">{parsed.date ? new Date(parsed.date).toLocaleDateString('es-PE', {day:'numeric',month:'long'}) : 'Hoy'}</span></p>
                    </div>
                    <button onClick={() => setNlpResult(null)} className="text-emerald-400 text-xs mt-3 hover:underline block">
                      + Registrar otro gasto
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-300 text-sm">{nlpResult.message || 'Registrado'}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className={`flex ${mode === 'registro' ? 'justify-center' : 'justify-start'}`}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <span className="text-slate-400 text-xs">{mode === 'registro' ? 'Procesando...' : 'Analizando...'}</span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input — FIXED at bottom */}
      <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-900">
        {mode === 'chat' && messages.length > 0 && (
          <button onClick={() => setMessages([])} className="text-slate-500 text-xs hover:text-slate-300 mb-2 block">
            ← Nueva consulta
          </button>
        )}
        <div className="flex gap-3 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={mode === 'registro' ? 'Yape a Juan S/50 almuerzo...' : 'Pregunta sobre tus finanzas...'}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-500"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white transition-colors disabled:opacity-40 ${mode === 'registro' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-blue-500 hover:bg-blue-400'}`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

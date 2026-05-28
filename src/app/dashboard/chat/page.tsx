'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, TrendingDown, CreditCard, PiggyBank, BarChart3, Zap, RefreshCw } from 'lucide-react'

interface Message { role: 'user' | 'assistant'; content: string }

const QUICK_PROMPTS = [
  { icon: '🔴', label: 'Estrategia de deudas', q: 'Qué estrategia me conviene para eliminar mis deudas más rápido? Muéstrame avalancha vs bola de nieve con números exactos y cuántos meses tardaría en cada estrategia.' },
  { icon: '💳', label: 'Plan de tarjetas', q: 'Dame un plan específico: en qué tarjeta debo pagar qué tipo de compras, cuánto pagar en cada una este mes, y cómo reducir los intereses.' },
  { icon: '📉', label: 'Optimizar gastos', q: 'Analiza mis gastos históricos y dime en qué categorías estoy gastando más de lo necesario. Dame 3 acciones concretas para reducir gastos.' },
  { icon: '💰', label: 'Flujo de caja', q: 'Con mi sueldo y compromisos actuales, cuánta liquidez real tengo disponible al mes? Estoy en riesgo de déficit?' },
  { icon: '🎯', label: 'Resumen ejecutivo', q: 'Dame un resumen ejecutivo de mi situación financiera: semáforo (rojo/amarillo/verde) por área, los 3 problemas más urgentes y las 3 acciones inmediatas.' },
  { icon: '📊', label: 'Proyección 12 meses', q: 'Si sigo pagando igual, cómo estará mi deuda total en 12 meses? Muéstrame mes a mes con las deudas que se cancelarían primero.' },
  { icon: '🚨', label: 'BBVA sin datos', q: 'No tengo el EECC del BBVA Mastercard Black cargado. Cómo debería priorizar esa tarjeta en mi estrategia sabiendo que tiene TCEA 69.99%?' },
  { icon: '🏦', label: 'BCP vs IBK', q: 'Comparando mis préstamos BCP Grande (TEA 13.5%) vs IBK Visa Access (TEA 11.22%), cuál debería liquidar primero? Muéstrame el ahorro en intereses.' },
]

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const lines = msg.content.split('\n').filter(l => l.trim())

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-600 to-blue-600'}`}>
        {isUser ? <User size={14} className="text-white"/> : <Sparkles size={14} className="text-white"/>}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isUser ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-tl-sm'}`}>
        <div className={`text-sm space-y-1.5 ${isUser ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
          {lines.map((line, i) => {
            if (line.startsWith('##')) return <p key={i} className="font-bold text-base mt-2 first:mt-0">{line.replace(/^#+\s/, '')}</p>
            if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>
            if (line.startsWith('- ') || line.startsWith('• ')) return <p key={i} className="pl-2">{line}</p>
            if (line.match(/^\d+\./)) return <p key={i} className="pl-2">{line}</p>
            return <p key={i}>{line}</p>
          })}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  async function sendMessage(text?: string) {
    const content = text || input.trim()
    if (!content || loading) return
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.reply || 'Sin respuesta' }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: '❌ Error de conexión. Intenta de nuevo.' }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-3xl mx-auto p-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Sparkles size={18} className="text-white"/>
          </div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white">Copiloto Financiero IA</h1>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
              Powered by Claude · Datos EECC actualizados
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <RefreshCw size={12}/> Nueva conversación
          </button>
        )}
      </div>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">

        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-800">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">👋 Hola Gian Carlo</p>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Soy tu copiloto financiero. Tengo acceso a todos tus movimientos EECC (Feb–Abr 2026), 
                tus tarjetas y préstamos activos. Puedo ayudarte a diseñar estrategias de pago, 
                analizar gastos y proyectar tu situación financiera.
              </p>
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide px-1">Preguntas frecuentes</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => sendMessage(p.q)}
                  className="flex items-start gap-2.5 p-3 text-left bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors group">
                  <span className="text-base flex-shrink-0 mt-0.5">{p.icon}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-400 font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <MessageBubble key={i} msg={msg}/>)}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Sparkles size={14} className="text-white animate-pulse"/>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Pregunta sobre tus finanzas..."
          className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition flex items-center gap-1.5 text-sm font-medium">
          <Send size={14}/>
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

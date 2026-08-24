// @ts-nocheck
// Unified AI caller — Claude Haiku → Gemini Flash fallback (free)
// Use this in all API routes instead of calling Anthropic directly

export async function callAI(prompt: string, systemPrompt?: string, maxTokens = 4096): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  // ── 1. Try Claude Haiku ──────────────────────────────────────────────────
  if (anthropicKey) {
    try {
      const messages: any[] = [{ role: 'user', content: prompt }]
      const body: any = { model: 'claude-haiku-4-5', max_tokens: maxTokens, messages }
      if (systemPrompt) body.system = systemPrompt

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.content?.[0]?.text
        if (text) return text
      }

      // 402 = no credits → fall through to Gemini
      if (res.status !== 402) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`Anthropic ${res.status}: ${err?.error?.message || 'error'}`)
      }
    } catch (e: any) {
      if (!e.message?.includes('402') && !e.message?.includes('credit')) throw e
      // else fall through to Gemini
    }
  }

  // ── 2. Gemini Flash (free) ───────────────────────────────────────────────
  if (geminiKey) {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
        }),
      }
    )
    if (res.ok) {
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return text
    }
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini error ${res.status}: ${JSON.stringify(err).slice(0, 100)}`)
  }

  throw new Error('No hay servicio de IA disponible. Configura ANTHROPIC_API_KEY o GEMINI_API_KEY en Vercel.')
}

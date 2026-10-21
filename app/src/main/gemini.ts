// Streaming client for the Gemini generative-language REST API. Like deepgram.ts, this talks the
// wire protocol directly (fetch + server-sent events) rather than pulling in an SDK, so the main
// process build stays dependency-light. The API key travels in the x-goog-api-key header, never the URL.

interface ModelChoice {
  id: string
  // Least reasoning each model allows, for the fastest first token (an interview copilot needs speed over depth).
  thinkingLevel: 'minimal' | 'low' | 'medium' | 'high'
}

// Tried in order; a 404 (model unavailable to this key) falls through to the next. flash-lite is the
// low-latency default and uniquely accepts "minimal" thinking; 3.8-flash is the heavier fallback ("minimal" 400s there).
const MODELS: ModelChoice[] = [
  { id: 'gemini-3.5-flash-lite', thinkingLevel: 'minimal' },
  { id: 'gemini-3.8-flash', thinkingLevel: 'low' }
]

const endpoint = (model: string): string =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`

// Transient server-side conditions worth a quick retry before giving up (overload, rate limit, gateway).
const RETRYABLE = new Set([429, 500, 502, 503, 504])
const MAX_ATTEMPTS = 3

export interface GeminiImage {
  mimeType: string
  /** Base64-encoded image bytes. */
  data: string
}

export interface GeminiRequest {
  apiKey: string
  system: string
  user: string
  /** Screenshots sent with the question (e.g. a coding problem on screen). */
  images?: readonly GeminiImage[]
  /** Overrides the default answer budget (e.g. for longer post-call notes). */
  maxOutputTokens?: number
  signal?: AbortSignal
}

/** Yields answer text fragments as they stream in. Throws a readable Error on HTTP/API failure. */
export async function* streamGemini(req: GeminiRequest): AsyncGenerator<string> {
  const response = await connect(req)
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline: number
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      const text = extractText(payload)
      if (text) yield text
    }
  }
}

function requestBody(req: GeminiRequest, model: ModelChoice): string {
  const images = req.images ?? []
  // Images go first, as Gemini recommends; the question text then refers to them.
  const parts = [
    ...images.map(({ mimeType, data }) => ({ inlineData: { mimeType, data } })),
    { text: req.user }
  ]
  return JSON.stringify({
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      // A screenshot is usually a coding problem, whose answer (code + explanation) needs more room.
      maxOutputTokens: req.maxOutputTokens ?? (images.length > 0 ? 2048 : 1024),
      temperature: 0.7,
      thinkingConfig: { thinkingLevel: model.thinkingLevel }
    }
  })
}

/**
 * Opens the SSE stream. Tries each model in order (404 → next model), retrying transient failures
 * (429/5xx) with a short backoff. Returns a response with a body, or throws a readable Error.
 */
async function connect(req: GeminiRequest): Promise<Response> {
  let lastError = new Error('Gemini request failed.')
  for (const model of MODELS) {
    const options: RequestInit = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': req.apiKey },
      body: requestBody(req, model),
      signal: req.signal
    }
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let response: Response
      try {
        response = await fetch(endpoint(model.id), options)
      } catch (error) {
        if (req.signal?.aborted) throw error
        lastError = error as Error
        if (attempt < MAX_ATTEMPTS) await delay(500 * attempt, req.signal)
        continue
      }
      if (response.ok && response.body) return response
      lastError = new Error(describeError(response.status, await response.text().catch(() => '')))
      if (response.status === 404) break // model not available to this key — try the next model
      if (!RETRYABLE.has(response.status)) throw lastError
      if (attempt < MAX_ATTEMPTS) await delay(500 * attempt, req.signal)
    }
  }
  throw lastError
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true }
    )
  })
}

function extractText(payload: string): string {
  try {
    const json = JSON.parse(payload)
    const parts = json?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) return ''
    // Skip reasoning ("thought") parts so they never leak into the spoken answer.
    return parts
      .filter((part: { thought?: boolean }) => !part?.thought)
      .map((part: { text?: string }) => part?.text ?? '')
      .join('')
  } catch {
    return ''
  }
}

function describeError(status: number, body: string): string {
  try {
    const message = JSON.parse(body)?.error?.message
    if (message) return `Gemini error (${status}): ${message}`
  } catch {
    // fall through to a generic message
  }
  if (status === 400 || status === 403) return 'Gemini rejected the request — check the API key in Settings.'
  if (status === 429) return 'Gemini rate limit reached. Wait a moment and try again.'
  return `Gemini request failed (HTTP ${status}).`
}

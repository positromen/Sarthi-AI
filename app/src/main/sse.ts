// Shared plumbing for streaming LLM providers: open a server-sent-events response through a chain of models
// (with retries), then read its `data:` payloads. Each provider supplies only its request shape and error rules.

// Transient server-side conditions worth a quick retry before giving up (overload, rate limit, gateway).
const RETRYABLE = new Set([429, 500, 502, 503, 504])
const MAX_ATTEMPTS = 3

export interface StreamChain<M> {
  /** Tried in order. */
  models: readonly M[]
  request: (model: M) => { url: string; init: RequestInit }
  /** True when this model can't serve the request (retired, or not available to this key): try the next model. */
  unavailable: (status: number, body: string) => boolean
  /** Turns an HTTP failure into a message fit for the overlay. */
  describe: (status: number, body: string) => string
  fallbackMessage: string
  signal?: AbortSignal
}

/**
 * Opens the stream: each model in order, retrying transient failures (429/5xx, network) with a short backoff,
 * moving on when a model is unavailable, and throwing at once on anything else (bad key, bad request).
 */
export async function openStream<M>(chain: StreamChain<M>): Promise<Response> {
  let lastError = new Error(chain.fallbackMessage)
  for (const model of chain.models) {
    const { url, init } = chain.request(model)
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let response: Response
      try {
        response = await fetch(url, { ...init, signal: chain.signal })
      } catch (error) {
        if (chain.signal?.aborted) throw error
        lastError = error as Error
        if (attempt < MAX_ATTEMPTS) await delay(500 * attempt, chain.signal)
        continue
      }
      if (response.ok && response.body) return response
      const body = await response.text().catch(() => '')
      lastError = new Error(chain.describe(response.status, body))
      if (chain.unavailable(response.status, body)) break
      if (!RETRYABLE.has(response.status)) throw lastError
      if (attempt < MAX_ATTEMPTS) await delay(500 * attempt, chain.signal)
    }
  }
  throw lastError
}

/** Yields each non-empty `data:` payload of an SSE response, skipping the OpenAI-style `[DONE]` sentinel. */
export async function* sseData(response: Response): AsyncGenerator<string> {
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
      if (payload && payload !== '[DONE]') yield payload
    }
  }
}

/** The provider's own error message from a JSON error body, if there is one. */
export function errorMessage(body: string): string | null {
  try {
    return JSON.parse(body)?.error?.message ?? null
  } catch {
    return null
  }
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

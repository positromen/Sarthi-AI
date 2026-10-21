// Streaming client for the Gemini generative-language REST API. Like deepgram.ts, this talks the
// wire protocol directly (fetch + server-sent events) rather than pulling in an SDK, so the main
// process build stays dependency-light. The API key travels in the x-goog-api-key header, never the URL.
import type { LlmRequest } from './llm-types'
import { errorMessage, openStream, sseData } from './sse'

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

/** Yields answer text fragments as they stream in. Throws a readable Error on HTTP/API failure. */
export async function* streamGemini(req: LlmRequest): AsyncGenerator<string> {
  const response = await openStream({
    models: MODELS,
    request: (model) => ({
      url: endpoint(model.id),
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': req.apiKey },
        body: requestBody(req, model)
      }
    }),
    unavailable: (status) => status === 404,
    describe: describeError,
    fallbackMessage: 'Gemini request failed.',
    signal: req.signal
  })
  for await (const payload of sseData(response)) {
    const text = extractText(payload)
    if (text) yield text
  }
}

function requestBody(req: LlmRequest, model: ModelChoice): string {
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
  const message = errorMessage(body)
  if (message) return `Gemini error (${status}): ${message}`
  if (status === 400 || status === 403) return 'Gemini rejected the request — check the API key in Settings.'
  if (status === 429) return 'Gemini rate limit reached. Wait a moment and try again.'
  return `Gemini request failed (HTTP ${status}).`
}

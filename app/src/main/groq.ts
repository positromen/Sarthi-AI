// Streaming client for Groq's OpenAI-compatible chat API (raw fetch + SSE, no SDK). Groq's first token arrives in
// about a second, against 6–60 s on Gemini's free tier. The key travels in the Authorization header.
import type { LlmRequest } from './llm-types'
import { errorMessage, openStream, sseData } from './sse'

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

// Production text models as of Oct 2026 (Llama 3.x was retired for free keys in Aug 2026). 120b first for quality;
// 20b is the faster fallback. Both are reasoning models: keep effort low and the reasoning out of the reply.
const TEXT_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']
// The only vision model open to every key. It takes at most 3 images, so llm.ts prefers Gemini for screenshots.
const VISION_MODEL = 'qwen/qwen3.8-27b'
const VISION_MAX_IMAGES = 3
// gpt-oss counts its (hidden) reasoning against max_completion_tokens, so the answer budget needs headroom on top.
const REASONING_HEADROOM = 1024

function requestBody(req: LlmRequest, model: string): string {
  const images = (req.images ?? []).slice(-VISION_MAX_IMAGES)
  const answerBudget = req.maxOutputTokens ?? (images.length > 0 ? 2048 : 1024)
  const user =
    images.length > 0
      ? [
          { type: 'text', text: req.user },
          ...images.map(({ mimeType, data }) => ({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } }))
        ]
      : req.user
  const reasoning =
    model === VISION_MODEL
      ? { reasoning_format: 'hidden' }
      : { reasoning_effort: 'low', include_reasoning: false }
  return JSON.stringify({
    model,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: user }
    ],
    stream: true,
    temperature: 0.7,
    max_completion_tokens: answerBudget + REASONING_HEADROOM,
    ...reasoning
  })
}

/** Yields answer text fragments as they stream in. Throws a readable Error on HTTP/API failure. */
export async function* streamGroq(req: LlmRequest): AsyncGenerator<string> {
  const response = await openStream({
    models: req.images?.length ? [VISION_MODEL] : TEXT_MODELS,
    request: (model) => ({
      url: ENDPOINT,
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${req.apiKey}` },
        body: requestBody(req, model)
      }
    }),
    // A retired model answers 400 "model_decommissioned"; one this key can't use answers 404.
    unavailable: (status, body) => status === 404 || (status === 400 && /decommissioned|model_not_found/i.test(body)),
    describe: describeError,
    fallbackMessage: 'Groq request failed.',
    signal: req.signal
  })
  for await (const payload of sseData(response)) {
    let json
    try {
      json = JSON.parse(payload)
    } catch {
      continue
    }
    // The final chunk carries the totals: Groq's own `x_groq.usage`, or OpenAI-style `usage`.
    const usage = json?.x_groq?.usage ?? json?.usage
    if (usage) req.onUsage?.({ input: usage.prompt_tokens ?? 0, output: usage.completion_tokens ?? 0 })
    // Only `content` is the answer; `reasoning` deltas (if any slip through) are dropped.
    const content = json?.choices?.[0]?.delta?.content
    if (typeof content === 'string' && content) yield content
  }
}

function describeError(status: number, body: string): string {
  const message = errorMessage(body)
  if (message) return `Groq error (${status}): ${message}`
  if (status === 401 || status === 403) return 'Groq rejected the API key — check it in Settings.'
  if (status === 429) return 'Groq rate limit reached. Wait a moment and try again.'
  return `Groq request failed (HTTP ${status}).`
}

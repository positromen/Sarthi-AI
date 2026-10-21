// Streaming client for Claude through the official Anthropic SDK. Optional: the user brings a paid key. The key
// travels in the x-api-key header; the SDK retries 429/5xx/529 on its own.
import Anthropic, { APIError, AuthenticationError } from '@anthropic-ai/sdk'
import type { LlmRequest } from './llm-types'

const MODEL = 'claude-opus-5-5'
// Opus 5.5 always thinks; effort is the speed control. Thinking counts against max_tokens, so leave room for it on
// top of the answer.
const THINKING_HEADROOM = 6000
// If Opus declines, the API retries on a fallback model server-side instead of returning the refusal.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

function userContent(req: LlmRequest): Anthropic.Beta.BetaContentBlockParam[] | string {
  const images = req.images ?? []
  if (images.length === 0) return req.user
  return [
    ...images.map(({ mimeType, data }) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: mimeType as 'image/jpeg', data }
    })),
    { type: 'text' as const, text: req.user }
  ]
}

/** Yields answer text fragments as they stream in; thinking is dropped. Throws a readable Error on failure. */
export async function* streamAnthropic(req: LlmRequest, fetchImpl?: typeof fetch): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: req.apiKey, maxRetries: 2, ...(fetchImpl ? { fetch: fetchImpl } : {}) })
  const answerBudget = req.maxOutputTokens ?? (req.images?.length ? 2048 : 1024)
  let refused = false
  let started = false
  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: answerBudget + THINKING_HEADROOM,
        system: req.system,
        messages: [{ role: 'user', content: userContent(req) }],
        output_config: { effort: 'low' },
        fallbacks: 'default',
        betas: [FALLBACK_BETA]
      },
      { signal: req.signal }
    )
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        started = true
        yield event.delta.text
      } else if (event.type === 'message_delta' && event.delta.stop_reason === 'refusal') {
        refused = true
      }
    }
  } catch (error) {
    throw new Error(describeError(error))
  }
  if (refused && !started) throw new Error('Claude declined to answer this one.')
}

function describeError(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Anthropic rejected the API key — check it in Settings.'
  if (error instanceof APIError && error.status === 429) return 'Anthropic rate limit reached. Wait a moment and try again.'
  if (error instanceof APIError && error.status) return `Anthropic error (${error.status}): ${error.message}`
  return (error as Error)?.message || 'Anthropic request failed.'
}

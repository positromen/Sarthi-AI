// Routes an answer request to the provider the user chose, falling back to the others on failure.
// Pure routing: keys and provider clients are passed in, so this stays testable without Electron.
import type { AiCall, ApiKeyName, LlmProvider } from '../shared/types'
import { streamAnthropic } from './anthropic'
import { streamGemini } from './gemini'
import { streamGroq } from './groq'
import type { LlmRequest, TokenCount } from './llm-types'

export type ProviderStreams = Record<LlmProvider, (req: LlmRequest) => AsyncGenerator<string>>

const PROVIDERS: ProviderStreams = { gemini: streamGemini, groq: streamGroq, anthropic: (req) => streamAnthropic(req) }

// Claude is optional and paid, so it comes last unless the user picked it.
const FALLBACK_ORDER: LlmProvider[] = ['gemini', 'groq', 'anthropic']

function providerOrder(preferred: LlmProvider, hasImages: boolean): LlmProvider[] {
  // Gemini reads all five screenshots and Claude reads them well; Groq's only open vision model takes three.
  if (hasImages) return ['gemini', 'anthropic', 'groq']
  return [preferred, ...FALLBACK_ORDER.filter((provider) => provider !== preferred)]
}

// Rough English average, for providers that don't report token counts.
const CHARS_PER_TOKEN = 4

function callUsage(provider: LlmProvider, reported: TokenCount | null, prompt: string, answer: string): AiCall {
  if (reported) return { provider, inputTokens: reported.input, outputTokens: reported.output, estimated: false }
  return {
    provider,
    inputTokens: Math.ceil(prompt.length / CHARS_PER_TOKEN),
    outputTokens: Math.ceil(answer.length / CHARS_PER_TOKEN),
    estimated: true
  }
}

/**
 * Streams an answer from the chosen provider. If it fails before sending any text, the next provider with a key is
 * tried; once text has streamed, a failure is final, since splicing two models' answers together would read as
 * nonsense. `onUsage` hears about every call that produced text, including one cut off midway (it was billed).
 */
export async function* streamAnswer(
  req: Omit<LlmRequest, 'apiKey' | 'onUsage'> & { provider: LlmProvider; onUsage?: (call: AiCall) => void },
  getKey: (name: ApiKeyName) => string | null,
  streams: ProviderStreams = PROVIDERS
): AsyncGenerator<string> {
  const order = providerOrder(req.provider, Boolean(req.images?.length)).filter((provider) => getKey(provider))
  if (order.length === 0) throw new Error('Add your Gemini or Groq key in Settings (Ctrl+Shift+S).')

  let firstError: Error | null = null
  for (const provider of order) {
    let started = false
    let answer = ''
    let reported: TokenCount | null = null
    const { onUsage, ...request } = req
    try {
      for await (const delta of streams[provider]({ ...request, apiKey: getKey(provider)!, onUsage: (t) => (reported = t) })) {
        started = true
        answer += delta
        yield delta
      }
      return
    } catch (error) {
      if (started || req.signal?.aborted) throw error
      firstError ??= error as Error
      console.warn(`${provider} failed, trying the next provider:`, (error as Error).message)
    } finally {
      if (started) onUsage?.(callUsage(provider, reported, req.system + req.user, answer))
    }
  }
  throw firstError!
}

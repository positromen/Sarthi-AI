// Routes an answer request to the provider the user chose, falling back to the others on failure.
// Pure routing: keys and provider clients are passed in, so this stays testable without Electron.
import type { ApiKeyName, LlmProvider } from '../shared/types'
import { streamAnthropic } from './anthropic'
import { streamGemini } from './gemini'
import { streamGroq } from './groq'
import type { LlmRequest } from './llm-types'

export type ProviderStreams = Record<LlmProvider, (req: LlmRequest) => AsyncGenerator<string>>

const PROVIDERS: ProviderStreams = { gemini: streamGemini, groq: streamGroq, anthropic: (req) => streamAnthropic(req) }

// Claude is optional and paid, so it comes last unless the user picked it.
const FALLBACK_ORDER: LlmProvider[] = ['gemini', 'groq', 'anthropic']

function providerOrder(preferred: LlmProvider, hasImages: boolean): LlmProvider[] {
  // Gemini reads all five screenshots and Claude reads them well; Groq's only open vision model takes three.
  if (hasImages) return ['gemini', 'anthropic', 'groq']
  return [preferred, ...FALLBACK_ORDER.filter((provider) => provider !== preferred)]
}

/**
 * Streams an answer from the chosen provider. If it fails before sending any text, the next provider with a key is
 * tried; once text has streamed, a failure is final, since splicing two models' answers together would read as
 * nonsense.
 */
export async function* streamAnswer(
  req: Omit<LlmRequest, 'apiKey'> & { provider: LlmProvider },
  getKey: (name: ApiKeyName) => string | null,
  streams: ProviderStreams = PROVIDERS
): AsyncGenerator<string> {
  const order = providerOrder(req.provider, Boolean(req.images?.length)).filter((provider) => getKey(provider))
  if (order.length === 0) throw new Error('Add your Gemini or Groq key in Settings (Ctrl+Shift+S).')

  let firstError: Error | null = null
  for (const provider of order) {
    let started = false
    try {
      for await (const delta of streams[provider]({ ...req, apiKey: getKey(provider)! })) {
        started = true
        yield delta
      }
      return
    } catch (error) {
      if (started || req.signal?.aborted) throw error
      firstError ??= error as Error
      console.warn(`${provider} failed, trying the next provider:`, (error as Error).message)
    }
  }
  throw firstError!
}

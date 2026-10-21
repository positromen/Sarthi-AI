// Routes an answer request to the provider the user chose, falling back to the other one on failure.
// Pure routing: keys and provider clients are passed in, so this stays testable without Electron.
import type { ApiKeyName, LlmProvider } from '../shared/types'
import { streamGemini } from './gemini'
import { streamGroq } from './groq'
import type { LlmRequest } from './llm-types'

type Provider = 'gemini' | 'groq'
export type ProviderStreams = Record<Provider, (req: LlmRequest) => AsyncGenerator<string>>

const PROVIDERS: ProviderStreams = { gemini: streamGemini, groq: streamGroq }

function providerOrder(preferred: LlmProvider, hasImages: boolean): Provider[] {
  // Gemini reads all five screenshots; Groq's only open vision model takes three and is a preview.
  if (hasImages) return ['gemini', 'groq']
  return preferred === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq']
}

/**
 * Streams an answer from the chosen provider (Anthropic is not wired yet, so it behaves like Gemini). If that
 * provider fails before sending any text, the other one is tried; once text has streamed, a failure is final,
 * since splicing two models' answers together would read as nonsense.
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

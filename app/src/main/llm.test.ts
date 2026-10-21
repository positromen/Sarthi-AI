import { describe, expect, it } from 'vitest'
import type { ApiKeyName } from '../shared/types'
import type { LlmRequest } from './llm-types'
import { streamAnswer, type ProviderStreams } from './llm'

type Call = { provider: string; apiKey: string; images: number }

/** Fake providers: each either streams its reply or throws (optionally after some text). */
function fakes(behaviour: Record<'gemini' | 'groq', string | Error | { partial: string; then: Error }>) {
  const calls: Call[] = []
  const make = (provider: 'gemini' | 'groq') =>
    async function* (req: LlmRequest): AsyncGenerator<string> {
      calls.push({ provider, apiKey: req.apiKey, images: req.images?.length ?? 0 })
      const b = behaviour[provider]
      if (b instanceof Error) throw b
      if (typeof b === 'string') {
        yield b
        return
      }
      yield b.partial
      throw b.then
    }
  const streams: ProviderStreams = { gemini: make('gemini'), groq: make('groq') }
  return { calls, streams }
}

const keys = (...have: ApiKeyName[]) => (name: ApiKeyName) => (have.includes(name) ? `${name}-key` : null)

async function collect(stream: AsyncGenerator<string>): Promise<string> {
  let text = ''
  for await (const piece of stream) text += piece
  return text
}

const base = { system: 's', user: 'u' }

describe('streamAnswer', () => {
  it('uses Gemini by default and Groq when chosen, each with its own key', async () => {
    const a = fakes({ gemini: 'G', groq: 'Q' })
    expect(await collect(streamAnswer({ ...base, provider: 'gemini' }, keys('gemini', 'groq'), a.streams))).toBe('G')
    expect(a.calls).toEqual([{ provider: 'gemini', apiKey: 'gemini-key', images: 0 }])

    const b = fakes({ gemini: 'G', groq: 'Q' })
    expect(await collect(streamAnswer({ ...base, provider: 'groq' }, keys('gemini', 'groq'), b.streams))).toBe('Q')
    expect(b.calls).toEqual([{ provider: 'groq', apiKey: 'groq-key', images: 0 }])
  })

  it('falls back to the other provider when the chosen one fails before answering', async () => {
    const f = fakes({ gemini: 'G', groq: new Error('Groq error (503)') })
    expect(await collect(streamAnswer({ ...base, provider: 'groq' }, keys('gemini', 'groq'), f.streams))).toBe('G')
    expect(f.calls.map((c) => c.provider)).toEqual(['groq', 'gemini'])
  })

  it('does not fall back once part of an answer has streamed (it would splice two answers)', async () => {
    const f = fakes({ gemini: 'G', groq: { partial: 'Half an ', then: new Error('connection reset') } })
    await expect(collect(streamAnswer({ ...base, provider: 'groq' }, keys('gemini', 'groq'), f.streams))).rejects.toThrow(
      'connection reset'
    )
    expect(f.calls.map((c) => c.provider)).toEqual(['groq'])
  })

  it('reports the chosen provider’s error when both fail', async () => {
    const f = fakes({ gemini: new Error('Gemini down'), groq: new Error('Groq down') })
    await expect(collect(streamAnswer({ ...base, provider: 'groq' }, keys('gemini', 'groq'), f.streams))).rejects.toThrow(
      'Groq down'
    )
  })

  it('sends screenshots to Gemini first even when Groq is chosen (it sees all five; Groq’s vision model takes three)', async () => {
    const f = fakes({ gemini: 'G', groq: 'Q' })
    const images = [{ mimeType: 'image/jpeg', data: 'x' }]
    await collect(streamAnswer({ ...base, provider: 'groq', images }, keys('gemini', 'groq'), f.streams))
    expect(f.calls).toEqual([{ provider: 'gemini', apiKey: 'gemini-key', images: 1 }])
  })

  it('skips a provider without a key, and asks for one when neither has a key', async () => {
    const f = fakes({ gemini: 'G', groq: 'Q' })
    expect(await collect(streamAnswer({ ...base, provider: 'gemini' }, keys('groq'), f.streams))).toBe('Q')
    await expect(collect(streamAnswer({ ...base, provider: 'gemini' }, keys(), f.streams))).rejects.toThrow(/Settings/)
  })

  it('stops without falling back when the request was cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    const f = fakes({ gemini: new Error('aborted'), groq: 'Q' })
    await expect(
      collect(streamAnswer({ ...base, provider: 'gemini', signal: controller.signal }, keys('gemini', 'groq'), f.streams))
    ).rejects.toThrow('aborted')
    expect(f.calls.map((c) => c.provider)).toEqual(['gemini'])
  })
})

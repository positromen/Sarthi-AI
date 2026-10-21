import { describe, expect, it } from 'vitest'
import type { ApiKeyName } from '../shared/types'
import type { LlmRequest } from './llm-types'
import { streamAnswer, type ProviderStreams } from './llm'

type Call = { provider: string; apiKey: string; images: number }

/** Fake providers: each either streams its reply or throws (optionally after some text). */
type Name = 'gemini' | 'groq' | 'anthropic'

function fakes(behaviour: Partial<Record<Name, string | Error | { partial: string; then: Error }>>) {
  const calls: Call[] = []
  const make = (provider: Name) =>
    async function* (req: LlmRequest): AsyncGenerator<string> {
      calls.push({ provider, apiKey: req.apiKey, images: req.images?.length ?? 0 })
      const b = behaviour[provider] ?? provider.charAt(0).toUpperCase()
      if (b instanceof Error) throw b
      if (typeof b === 'string') {
        yield b
        return
      }
      yield b.partial
      throw b.then
    }
  const streams: ProviderStreams = { gemini: make('gemini'), groq: make('groq'), anthropic: make('anthropic') }
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

  it('uses Claude when chosen, and falls back to Gemini then Groq', async () => {
    const a = fakes({ anthropic: 'C' })
    expect(await collect(streamAnswer({ ...base, provider: 'anthropic' }, keys('gemini', 'groq', 'anthropic'), a.streams))).toBe('C')
    expect(a.calls).toEqual([{ provider: 'anthropic', apiKey: 'anthropic-key', images: 0 }])

    const b = fakes({ anthropic: new Error('Claude declined'), gemini: new Error('Gemini down') })
    expect(await collect(streamAnswer({ ...base, provider: 'anthropic' }, keys('gemini', 'groq', 'anthropic'), b.streams))).toBe('G')
    expect(b.calls.map((c) => c.provider)).toEqual(['anthropic', 'gemini', 'groq'])
  })

  it('leaves Claude out unless it has a key, and tries it last when another provider is chosen', async () => {
    const a = fakes({ gemini: new Error('Gemini down'), groq: new Error('Groq down') })
    await expect(collect(streamAnswer({ ...base, provider: 'gemini' }, keys('gemini', 'groq'), a.streams))).rejects.toThrow('Gemini down')
    expect(a.calls.map((c) => c.provider)).toEqual(['gemini', 'groq'])

    const b = fakes({ gemini: new Error('Gemini down'), groq: new Error('Groq down') })
    expect(await collect(streamAnswer({ ...base, provider: 'groq' }, keys('gemini', 'groq', 'anthropic'), b.streams))).toBe('A')
    expect(b.calls.map((c) => c.provider)).toEqual(['groq', 'gemini', 'anthropic'])
  })

  it('sends screenshots Gemini first, then Claude, then Groq', async () => {
    const images = [{ mimeType: 'image/jpeg', data: 'x' }]
    const f = fakes({ gemini: new Error('Gemini down') })
    expect(await collect(streamAnswer({ ...base, provider: 'groq', images }, keys('gemini', 'groq', 'anthropic'), f.streams))).toBe('A')
    expect(f.calls.map((c) => c.provider)).toEqual(['gemini', 'anthropic'])
  })
})

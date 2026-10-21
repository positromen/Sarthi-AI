import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamGemini } from './gemini'

const LITE = 'gemini-3.5-flash-lite'
const FLASH = 'gemini-3.8-flash'
const REQUEST = { apiKey: 'test-key', system: 'sys', user: 'Tell me about yourself.' }

const sse = (...events: object[]): string => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
const chunk = (...parts: object[]) => ({ candidates: [{ content: { parts } }] })

// Streams the body in pieces so SSE lines straddle chunk boundaries, as they do on the wire.
function okResponse(body: string, pieces = 3): Response {
  const size = Math.ceil(body.length / pieces)
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < body.length; i += size) controller.enqueue(encoder.encode(body.slice(i, i + size)))
      controller.close()
    }
  })
  return new Response(stream, { status: 200 })
}

const errorResponse = (status: number, message?: string): Response =>
  new Response(message ? JSON.stringify({ error: { message } }) : '', { status })

const modelOf = (call: unknown[]): string => String(call[0]).match(/models\/([^:]+):/)![1]
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string)

async function collect(stream: AsyncGenerator<string>): Promise<string> {
  let text = ''
  for await (const piece of stream) text += piece
  return text
}

// Runs the stream with fake timers so the retry backoff doesn't slow the suite.
async function run(): Promise<string> {
  const result = collect(streamGemini(REQUEST))
  result.catch(() => {}) // asserted by the caller; avoid an unhandled rejection while timers run
  await vi.runAllTimersAsync()
  return result
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('streamGemini', () => {
  it('streams from flash-lite first, with minimal thinking and the key in a header', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(sse(chunk({ text: 'Hello ' }), chunk({ text: 'there.' }))))

    await expect(run()).resolves.toBe('Hello there.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    expect(modelOf(call)).toBe(LITE)
    expect(String(call[0])).not.toContain('test-key')
    expect((call[1] as RequestInit).headers).toMatchObject({ 'x-goog-api-key': 'test-key' })
    expect(bodyOf(call).generationConfig.thinkingConfig.thinkingLevel).toBe('minimal')
  })

  it('drops reasoning ("thought") parts from the answer', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(sse(chunk({ text: 'Let me think…', thought: true }, { text: 'Answer.' })))
    )

    await expect(run()).resolves.toBe('Answer.')
  })

  it('skips to flash with low thinking when flash-lite returns 404', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(404, 'model not found'))
      .mockResolvedValueOnce(okResponse(sse(chunk({ text: 'From flash.' }))))

    await expect(run()).resolves.toBe('From flash.')
    expect(fetchMock.mock.calls.map(modelOf)).toEqual([LITE, FLASH])
    expect(bodyOf(fetchMock.mock.calls[1]).generationConfig.thinkingConfig.thinkingLevel).toBe('low')
  })

  it('retries a 503 three times on flash-lite, then falls through to flash', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse(sse(chunk({ text: 'Recovered.' }))))

    await expect(run()).resolves.toBe('Recovered.')
    expect(fetchMock.mock.calls.map(modelOf)).toEqual([LITE, LITE, LITE, FLASH])
  })

  it('throws immediately on a 400 without trying another model', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(400, 'API key not valid'))

    await expect(run()).rejects.toThrow('Gemini error (400): API key not valid')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws the last error once every model is exhausted', async () => {
    fetchMock.mockResolvedValue(errorResponse(429))

    await expect(run()).rejects.toThrow('Gemini rate limit reached')
    expect(fetchMock.mock.calls.map(modelOf)).toEqual([LITE, LITE, LITE, FLASH, FLASH, FLASH])
  })
})

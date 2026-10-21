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

  it('sends screenshots as inlineData parts ahead of the question text', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(sse(chunk({ text: 'def solve(): ...' }))))

    const images = [
      { mimeType: 'image/jpeg', data: 'AAAA' },
      { mimeType: 'image/jpeg', data: 'BBBB' }
    ]
    await collect(streamGemini({ ...REQUEST, images }))
    const body = bodyOf(fetchMock.mock.calls[0])
    expect(body.contents[0].parts).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } },
      { inlineData: { mimeType: 'image/jpeg', data: 'BBBB' } },
      { text: REQUEST.user }
    ])
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThan(1024)
  })

  it('sends a text-only request when there are no screenshots', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(sse(chunk({ text: 'Hi.' }))))

    await collect(streamGemini(REQUEST))
    const body = bodyOf(fetchMock.mock.calls[0])
    expect(body.contents[0].parts).toEqual([{ text: REQUEST.user }])
    expect(body.generationConfig.maxOutputTokens).toBe(1024)
  })

  it('throws the last error once every model is exhausted', async () => {
    fetchMock.mockResolvedValue(errorResponse(429))

    await expect(run()).rejects.toThrow('Gemini rate limit reached')
    expect(fetchMock.mock.calls.map(modelOf)).toEqual([LITE, LITE, LITE, FLASH, FLASH, FLASH])
  })
})

describe('streamGemini usage', () => {
  it('reports the final token counts, thinking included in output', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(
        sse(
          { ...chunk({ text: 'Hi.' }), usageMetadata: { promptTokenCount: 50 } },
          { ...chunk({ text: '' }), usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 12, thoughtsTokenCount: 30 } }
        )
      )
    )
    const onUsage = vi.fn()
    const result = collect(streamGemini({ ...REQUEST, onUsage }))
    await vi.runAllTimersAsync()
    await expect(result).resolves.toBe('Hi.')
    expect(onUsage).toHaveBeenLastCalledWith({ input: 50, output: 42 })
  })
})

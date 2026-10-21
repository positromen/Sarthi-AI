import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamGroq } from './groq'

const BIG = 'openai/gpt-oss-120b'
const SMALL = 'openai/gpt-oss-20b'
const VISION = 'qwen/qwen3.8-27b'
const REQUEST = { apiKey: 'gsk-test', system: 'sys', user: 'Why this role?' }

const delta = (fields: Record<string, string>) => ({ choices: [{ index: 0, delta: fields }] })
const sse = (...events: object[]): string =>
  `${events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')}data: [DONE]\n\n`

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

const errorResponse = (status: number, message?: string, code?: string): Response =>
  new Response(message ? JSON.stringify({ error: { message, code } }) : '', { status })

const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string)
const modelOf = (call: unknown[]): string => bodyOf(call).model

async function collect(stream: AsyncGenerator<string>): Promise<string> {
  let text = ''
  for await (const piece of stream) text += piece
  return text
}

async function run(request: Parameters<typeof streamGroq>[0] = REQUEST): Promise<string> {
  const result = collect(streamGroq(request))
  result.catch(() => {})
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

describe('streamGroq', () => {
  it('streams from gpt-oss-120b with low reasoning effort, reasoning excluded and the key in a header', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(sse(delta({ content: 'I build ' }), delta({ content: 'OT tools.' }))))

    await expect(run()).resolves.toBe('I build OT tools.')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(init.headers).toMatchObject({ authorization: 'Bearer gsk-test' })
    expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({
      model: BIG,
      stream: true,
      reasoning_effort: 'low',
      include_reasoning: false,
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'Why this role?' }
      ]
    })
  })

  it('leaves room for reasoning tokens on top of the answer budget', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(sse(delta({ content: 'ok' }))))
    await run({ ...REQUEST, maxOutputTokens: 2048 })
    expect(bodyOf(fetchMock.mock.calls[0]).max_completion_tokens).toBeGreaterThan(2048)
  })

  it('never lets reasoning text into the answer', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(sse(delta({ reasoning: 'The user wants…' }), delta({ content: 'Answer.' }), delta({ role: 'assistant' })))
    )
    await expect(run()).resolves.toBe('Answer.')
  })

  it('moves to gpt-oss-20b when the first model is retired or missing', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(400, 'The model has been decommissioned', 'model_decommissioned'))
      .mockResolvedValueOnce(okResponse(sse(delta({ content: 'From 20b.' }))))
    await expect(run()).resolves.toBe('From 20b.')
    expect(fetchMock.mock.calls.map(modelOf)).toEqual([BIG, SMALL])

    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce(errorResponse(404, 'model not found'))
      .mockResolvedValueOnce(okResponse(sse(delta({ content: 'Again.' }))))
    await expect(run()).resolves.toBe('Again.')
    expect(fetchMock.mock.calls.map(modelOf)).toEqual([BIG, SMALL])
  })

  it('retries a 503 three times, then falls through to the next model', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse(sse(delta({ content: 'Recovered.' }))))
    await expect(run()).resolves.toBe('Recovered.')
    expect(fetchMock.mock.calls.map(modelOf)).toEqual([BIG, BIG, BIG, SMALL])
  })

  it('throws a readable error on a rejected key without trying other models', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401, 'Invalid API Key', 'invalid_api_key'))
    await expect(run()).rejects.toThrow('Groq error (401): Invalid API Key')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends screenshots to the vision model, newest three only, as data-URL image parts', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(sse(delta({ content: 'Use a sliding window.' }))))
    const images = ['A', 'B', 'C', 'D'].map((data) => ({ mimeType: 'image/jpeg', data }))
    await run({ ...REQUEST, images })

    const body = bodyOf(fetchMock.mock.calls[0])
    expect(body.model).toBe(VISION)
    expect(body.reasoning_format).toBe('hidden')
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: 'Why this role?' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,B' } },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,C' } },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,D' } }
    ])
  })
})

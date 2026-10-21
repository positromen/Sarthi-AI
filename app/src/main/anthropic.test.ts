import { describe, expect, it, vi } from 'vitest'
import { streamAnthropic } from './anthropic'

const REQUEST = { apiKey: 'sk-ant-test', system: 'sys', user: 'Why this role?' }

// The Messages API streaming wire format (event: … / data: …), as the SDK parses it.
function sse(events: object[]): Response {
  const body = events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

const message = (stopReason: string, blocks: object[]) => [
  { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
  ...blocks,
  { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 5 } },
  { type: 'message_stop' }
]

const thinkingThenText = (...texts: string[]) => [
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'secret reasoning' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  ...texts.map((text) => ({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } })),
  { type: 'content_block_stop', index: 1 }
]

async function collect(stream: AsyncGenerator<string>): Promise<string> {
  let text = ''
  for await (const piece of stream) text += piece
  return text
}

const call = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return { url, headers: new Headers(init.headers), body: JSON.parse(init.body as string) }
}

describe('streamAnthropic', () => {
  it('asks Claude Opus 5.5 at low effort with the refusal fallback, and streams only the answer text', async () => {
    const fetchMock = vi.fn(async () => sse(message('end_turn', thinkingThenText('I build ', 'OT tools.'))))
    await expect(collect(streamAnthropic(REQUEST, fetchMock as unknown as typeof fetch))).resolves.toBe('I build OT tools.')

    const { url, headers, body } = call(fetchMock)
    expect(url).toContain('/v1/messages')
    expect(headers.get('x-api-key')).toBe('sk-ant-test')
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01')
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      stream: true,
      system: 'sys',
      output_config: { effort: 'low' },
      fallbacks: 'default'
    })
    expect(body.thinking).toBeUndefined()
    expect(body.max_tokens).toBeGreaterThan(4000) // room for thinking on top of the answer
  })

  it('sends screenshots as base64 image blocks ahead of the question', async () => {
    const fetchMock = vi.fn(async () => sse(message('end_turn', thinkingThenText('ok'))))
    const images = [{ mimeType: 'image/jpeg', data: 'AAAA' }]
    await collect(streamAnthropic({ ...REQUEST, images }, fetchMock as unknown as typeof fetch))
    expect(call(fetchMock).body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
          { type: 'text', text: 'Why this role?' }
        ]
      }
    ])
  })

  it('treats a refusal with no answer as a failure, so the router can try another provider', async () => {
    const fetchMock = vi.fn(async () => sse(message('refusal', [])))
    await expect(collect(streamAnthropic(REQUEST, fetchMock as unknown as typeof fetch))).rejects.toThrow(/declined/i)
  })

  it('explains a rejected key without retrying', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        })
    )
    await expect(collect(streamAnthropic(REQUEST, fetchMock as unknown as typeof fetch))).rejects.toThrow(
      'Anthropic rejected the API key — check it in Settings.'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

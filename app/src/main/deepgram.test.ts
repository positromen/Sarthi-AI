import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildListenUrl, DeepgramStream } from './deepgram'

describe('buildListenUrl', () => {
  it('requests 2-channel 16 kHz linear16 with utterance-end events', () => {
    const url = new URL(buildListenUrl('en'))
    expect(url.origin + url.pathname).toBe('wss://api.deepgram.com/v1/listen')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '2',
      multichannel: 'true',
      interim_results: 'true',
      utterance_end_ms: '1000',
      language: 'en'
    })
  })
})

class FakeSocket {
  static readonly OPEN = 1
  static last: FakeSocket
  readyState = FakeSocket.OPEN
  binaryType = ''
  sent: unknown[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null

  constructor() {
    FakeSocket.last = this
  }

  send(data: unknown): void {
    this.sent.push(data)
  }

  close(): void {}

  /** JSON control messages sent so far, by type. */
  controls(type: string): number {
    return this.sent.filter((d) => typeof d === 'string' && JSON.parse(d).type === type).length
  }

  receive(message: object): void {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
}

const result = (channel: number, transcript: string, flags: Record<string, boolean>) => ({
  type: 'Results',
  channel_index: [channel, 2],
  is_final: true,
  speech_final: false,
  channel: { alternatives: [{ transcript }] },
  ...flags
})

describe('DeepgramStream', () => {
  let stream: DeepgramStream
  let socket: FakeSocket
  const frame = new ArrayBuffer(3200)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeSocket)
    stream = new DeepgramStream()
    stream.connect('key', 'en')
    socket = FakeSocket.last
    socket.onopen?.()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Deepgram closes a stream after ~10 s with no data; with silence skipped, KeepAlive is what holds it open.
  it('sends KeepAlive often enough to survive long silences', () => {
    vi.advanceTimersByTime(30_000)
    expect(socket.controls('KeepAlive')).toBeGreaterThanOrEqual(6)
  })

  it('asks Deepgram to finalize once audio stops arriving, but not while it flows', () => {
    for (let i = 0; i < 40; i++) {
      stream.send(frame)
      vi.advanceTimersByTime(50)
    }
    expect(socket.controls('Finalize')).toBe(0)
    vi.advanceTimersByTime(600)
    expect(socket.controls('Finalize')).toBe(1)
    vi.advanceTimersByTime(5000)
    expect(socket.controls('Finalize')).toBe(1)
  })

  it('ends the turn on a finalize result, so words are never left pending', () => {
    const turns: string[][] = []
    stream.on('turn', (speaker, text) => turns.push([speaker, text]))
    socket.receive(result(1, 'What is your notice period', { from_finalize: true }))
    expect(turns).toEqual([['interviewer', 'What is your notice period']])
  })

  it('still ends the turn on speech_final, joining earlier final fragments', () => {
    const turns: string[][] = []
    stream.on('turn', (speaker, text) => turns.push([speaker, text]))
    socket.receive(result(0, 'I have worked', {}))
    socket.receive(result(0, 'on PLC security.', { speech_final: true }))
    expect(turns).toEqual([['you', 'I have worked on PLC security.']])
  })
})

import { EventEmitter } from 'node:events'
import { SPEAKER_BY_CHANNEL, type Speaker } from '../shared/types'

export const SAMPLE_RATE = 16000
export const CHANNELS = 2
// Deepgram closes a stream after ~10 s without data. The renderer skips silence, so KeepAlive must hold the
// connection through long quiet stretches; Deepgram recommends every 3–5 s.
const KEEPALIVE_MS = 4000
// Frames arrive every ~50 ms while audio flows. A longer gap means the renderer's speech gate closed.
const AUDIO_GAP_MS = 500

interface ResultsMessage {
  type: 'Results'
  channel_index: [number, number]
  is_final: boolean
  speech_final: boolean
  /** Set on results produced by our Finalize message. */
  from_finalize?: boolean
  channel: { alternatives: { transcript: string }[] }
}

interface UtteranceEndMessage {
  type: 'UtteranceEnd'
  channel: [number, number]
}

export interface DeepgramEvents {
  open: []
  interim: [speaker: Speaker, text: string]
  turn: [speaker: Speaker, text: string]
  error: [message: string]
  close: []
}

export function buildListenUrl(language: string): string {
  const params = new URLSearchParams({
    model: 'nova-3',
    language,
    encoding: 'linear16',
    sample_rate: String(SAMPLE_RATE),
    channels: String(CHANNELS),
    multichannel: 'true',
    interim_results: 'true',
    utterance_end_ms: '1000',
    endpointing: '300',
    smart_format: 'true',
    punctuate: 'true'
  })
  return `wss://api.deepgram.com/v1/listen?${params}`
}

/**
 * One live Deepgram connection carrying interleaved stereo PCM. Finalized words are buffered per channel
 * and flushed as a complete turn on speech_final or UtteranceEnd, whichever comes first.
 */
export class DeepgramStream extends EventEmitter<DeepgramEvents> {
  private socket: WebSocket | null = null
  private keepAlive: NodeJS.Timeout | null = null
  private audioGap: NodeJS.Timeout | null = null
  private pending: string[][] = SPEAKER_BY_CHANNEL.map(() => [])

  connect(apiKey: string, language: string): void {
    const socket = new WebSocket(buildListenUrl(language), ['token', apiKey])
    socket.binaryType = 'arraybuffer'
    socket.onopen = () => {
      this.keepAlive = setInterval(() => this.sendJson({ type: 'KeepAlive' }), KEEPALIVE_MS)
      this.emit('open')
    }
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') this.handleMessage(JSON.parse(event.data))
    }
    socket.onerror = () => this.emit('error', 'Deepgram connection failed (check the API key and network)')
    socket.onclose = (event) => {
      this.cleanup()
      if (event.code !== 1000 && event.reason) this.emit('error', `Deepgram closed: ${event.reason}`)
      this.emit('close')
    }
    this.socket = socket
  }

  send(frame: ArrayBuffer): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    this.socket.send(frame)
    // When audio stops (silence skipped), have Deepgram finalize what it heard. The gate already sends enough
    // trailing silence for a normal turn end; this is the backstop so no words sit pending until the next burst.
    if (this.audioGap) clearTimeout(this.audioGap)
    this.audioGap = setTimeout(() => {
      this.audioGap = null
      this.sendJson({ type: 'Finalize' })
    }, AUDIO_GAP_MS)
  }

  close(): void {
    if (!this.socket) return
    for (let channel = 0; channel < CHANNELS; channel++) this.flush(channel)
    this.sendJson({ type: 'CloseStream' })
    this.socket.close(1000)
  }

  private handleMessage(message: ResultsMessage | UtteranceEndMessage | { type: string }): void {
    if (message.type === 'Results') {
      const result = message as ResultsMessage
      const channel = result.channel_index[0]
      const text = result.channel.alternatives[0]?.transcript.trim() ?? ''
      if (result.is_final) {
        if (text) this.pending[channel].push(text)
        if (result.speech_final || result.from_finalize) this.flush(channel)
        else if (text) this.emit('interim', SPEAKER_BY_CHANNEL[channel], this.pending[channel].join(' '))
      } else if (text) {
        this.emit('interim', SPEAKER_BY_CHANNEL[channel], [...this.pending[channel], text].join(' '))
      }
    } else if (message.type === 'UtteranceEnd') {
      this.flush((message as UtteranceEndMessage).channel[0])
    }
  }

  private flush(channel: number): void {
    const text = this.pending[channel].join(' ').trim()
    this.pending[channel] = []
    if (text) this.emit('turn', SPEAKER_BY_CHANNEL[channel], text)
  }

  private sendJson(message: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  private cleanup(): void {
    if (this.keepAlive) clearInterval(this.keepAlive)
    this.keepAlive = null
    if (this.audioGap) clearTimeout(this.audioGap)
    this.audioGap = null
    this.socket = null
  }
}

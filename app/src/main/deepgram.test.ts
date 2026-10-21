import { describe, expect, it } from 'vitest'
import { buildListenUrl } from './deepgram'

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

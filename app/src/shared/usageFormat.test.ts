import { describe, expect, it } from 'vitest'
import { formatAudio, formatTokens, sessionUsageLine } from './usageFormat'

describe('usage formatting', () => {
  it('formats audio time for people, not seconds', () => {
    expect(formatAudio(0)).toBe('0 min')
    expect(formatAudio(45)).toBe('45 s')
    expect(formatAudio(12 * 60 + 29)).toBe('12 min')
    expect(formatAudio(65 * 60)).toBe('1 h 5 min')
  })

  it('shortens token counts', () => {
    expect(formatTokens(850)).toBe('850')
    expect(formatTokens(9_240)).toBe('9.2k')
    expect(formatTokens(12_400)).toBe('12k')
    expect(formatTokens(1_250_000)).toBe('1.3M')
  })

  it('summarises a session in one line, marking estimated tokens', () => {
    expect(sessionUsageLine({ audioSeconds: 720, aiCalls: 6, tokens: 9_240, estimated: true })).toBe('12 min audio · 6 AI calls · ≈9.2k tokens')
    expect(sessionUsageLine({ audioSeconds: 0, aiCalls: 1, tokens: 320, estimated: false })).toBe('1 AI call · 320 tokens')
    expect(sessionUsageLine({ audioSeconds: 0, aiCalls: 0, tokens: 0, estimated: false })).toBe('')
    expect(sessionUsageLine(undefined)).toBe('')
  })
})

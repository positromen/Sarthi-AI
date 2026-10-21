import { describe, expect, it } from 'vitest'
import { emptyPrompt, formatElapsed, missingKeys, turnOpacity } from './view'

describe('missingKeys', () => {
  it('lists required keys that are not saved, in setup order', () => {
    expect(missingKeys({ deepgram: true, gemini: false, groq: false, anthropic: false })).toEqual(['gemini', 'groq'])
    expect(missingKeys({ deepgram: true, gemini: true, groq: true, anthropic: false })).toEqual([])
  })

  it('reports nothing missing until the status has loaded, so setup never flashes on start', () => {
    expect(missingKeys(null)).toEqual([])
  })
})

describe('turnOpacity', () => {
  it('steps older transcript lines down so the newest is obvious', () => {
    expect([0, 1, 2, 3, 4, 9].map(turnOpacity)).toEqual([1, 0.8, 0.62, 0.48, 0.4, 0.4])
  })
})

describe('formatElapsed', () => {
  it('shows seconds, then minutes past a minute', () => {
    expect(formatElapsed(0)).toBe('0s')
    expect(formatElapsed(18_400)).toBe('18s')
    expect(formatElapsed(65_000)).toBe('1m 05s')
  })
})

describe('emptyPrompt', () => {
  it('tells an idle user how to start', () => {
    expect(emptyPrompt('idle', true)).toMatchObject({ text: 'Press Listen', keys: 'toggle-listening' })
  })

  it('says it is connecting', () => {
    expect(emptyPrompt('connecting', true)).toMatchObject({ text: 'Connecting to Deepgram…', keys: null })
  })

  it('while listening, waits for a question or offers the answer hotkey', () => {
    expect(emptyPrompt('listening', true)).toMatchObject({ text: 'Waiting for a question. Answer now with', keys: 'answer' })
    expect(emptyPrompt('listening', false).text).toMatch(/auto-answer is off/i)
  })

  it('after a session error, points at the banner', () => {
    expect(emptyPrompt('error', true).text).toMatch(/Fix the issue above/)
  })
})

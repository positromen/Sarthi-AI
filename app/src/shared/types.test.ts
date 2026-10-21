import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, withDefaults } from './types'

describe('withDefaults', () => {
  it('fills missing fields from the defaults', () => {
    expect(withDefaults({ autoAnswer: false })).toEqual({ ...DEFAULT_SETTINGS, autoAnswer: false })
  })

  it('carries the pre-4.3 transcriptionLanguage over to listeningLanguage', () => {
    const settings = withDefaults({ transcriptionLanguage: 'hi' })
    expect(settings.listeningLanguage).toBe('hi')
    expect(settings).not.toHaveProperty('transcriptionLanguage')
  })

  it('prefers listeningLanguage when both are stored', () => {
    expect(withDefaults({ transcriptionLanguage: 'hi', listeningLanguage: 'multi' }).listeningLanguage).toBe('multi')
  })
})

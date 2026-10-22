import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, parseSettings, withDefaults } from './types'

describe('withDefaults', () => {
  it('fills missing fields from the defaults', () => {
    expect(withDefaults({ autoAnswer: false })).toEqual({ ...DEFAULT_SETTINGS, autoAnswer: false })
  })

  it('carries the pre-4.3 transcriptionLanguage over to listeningLanguage', () => {
    const settings = withDefaults({ transcriptionLanguage: 'hi' })
    expect(settings.listeningLanguage).toBe('hi')
    expect(settings).not.toHaveProperty('transcriptionLanguage')
  })

  // In live testing answers felt slower with silence skipped, so audio streams continuously unless opted in.
  it('leaves Skip silence off by default', () => {
    expect(withDefaults({}).vadEnabled).toBe(false)
  })

  it('prefers listeningLanguage when both are stored', () => {
    expect(withDefaults({ transcriptionLanguage: 'hi', listeningLanguage: 'multi' }).listeningLanguage).toBe('multi')
  })
})

describe('withDefaults overlayPosition', () => {
  it('keeps a valid saved position and drops a malformed one', () => {
    expect(withDefaults({ overlayPosition: { x: 10, y: 20 } }).overlayPosition).toEqual({ x: 10, y: 20 })
    expect(withDefaults({ overlayPosition: { x: 'a', y: 2 } }).overlayPosition).toBeNull()
    expect(withDefaults({}).overlayPosition).toBeNull()
  })
})

describe('parseSettings', () => {
  it('reads a settings file saved with a UTF-8 byte-order mark (as some Windows editors write it)', () => {
    expect(parseSettings('﻿{"privateMode": false}').privateMode).toBe(false)
  })
})

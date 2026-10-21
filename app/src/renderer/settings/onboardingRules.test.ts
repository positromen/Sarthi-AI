import { describe, expect, it } from 'vitest'
import { canContinue, hasSpeech, ONBOARDING_STEPS } from './onboardingRules'

const keys = (deepgram: boolean, gemini: boolean, groq: boolean) => ({ deepgram, gemini, groq, anthropic: false })

describe('onboarding', () => {
  it('has the five steps from the design', () => {
    expect(ONBOARDING_STEPS).toEqual(['Welcome', 'API keys', 'Résumé', 'Audio check', 'Ready'])
  })

  it('only leaves the keys step once all three required keys are saved', () => {
    expect(canContinue(2, keys(true, true, false))).toBe(false)
    expect(canContinue(2, keys(true, true, true))).toBe(true)
    expect(canContinue(2, null)).toBe(false)
  })

  it('never blocks the other steps (résumé and audio can be skipped)', () => {
    for (const step of [1, 3, 4, 5]) expect(canContinue(step, keys(false, false, false))).toBe(true)
  })
})

describe('hasSpeech', () => {
  it('treats a level above the noise threshold as heard', () => {
    expect(hasSpeech(0)).toBe(false)
    expect(hasSpeech(0.004)).toBe(false)
    expect(hasSpeech(0.03)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/types'
import { answerPreview, languageSample, pageFromHash, profileStrength } from './model'

describe('pageFromHash', () => {
  it('opens the page named in the hash', () => {
    expect(pageFromHash('#history')).toBe('history')
    expect(pageFromHash('#privacy')).toBe('privacy')
  })

  it('falls back to Setup for an empty or unknown hash', () => {
    expect(pageFromHash('')).toBe('setup')
    expect(pageFromHash('#nope')).toBe('setup')
  })
})

describe('profileStrength', () => {
  const resume = 'x'.repeat(1200)
  it('grows with résumé, job description and notes, and says what to add next', () => {
    expect(profileStrength({ resume: '', jobDescription: '', notes: '' })).toMatchObject({ level: 'Empty', score: 0 })
    expect(profileStrength({ resume: 'short', jobDescription: '', notes: '' })).toMatchObject({ level: 'Weak', score: 1 })
    expect(profileStrength({ resume, jobDescription: '', notes: '' })).toMatchObject({ level: 'Fair', score: 2 })
    expect(profileStrength({ resume, jobDescription: 'y'.repeat(300), notes: '' })).toMatchObject({
      level: 'Good',
      score: 3,
      hint: 'Add talking points in Notes to reach Strong'
    })
    expect(profileStrength({ resume, jobDescription: 'y'.repeat(300), notes: 'z'.repeat(150) })).toMatchObject({
      level: 'Strong',
      score: 4
    })
  })

  it('ignores whitespace when measuring', () => {
    expect(profileStrength({ resume: '   \n  ', jobDescription: '', notes: '' }).level).toBe('Empty')
  })
})

describe('answerPreview', () => {
  it('uses bullets or paragraphs as chosen', () => {
    expect(answerPreview({ ...DEFAULT_SETTINGS, responseFormat: 'bullets' })).toMatch(/^- /m)
    expect(answerPreview({ ...DEFAULT_SETTINGS, responseFormat: 'paragraph' })).not.toMatch(/^- /m)
  })

  it('labels STAR parts only when STAR is on', () => {
    expect(answerPreview({ ...DEFAULT_SETTINGS, useStarMethod: true })).toMatch(/\*\*Situation:\*\*/)
    expect(answerPreview({ ...DEFAULT_SETTINGS, useStarMethod: false })).not.toMatch(/Situation:/)
  })

  it('gets longer with the length setting and adds fillers when asked', () => {
    const size = (responseLength: 'short' | 'medium' | 'long') =>
      answerPreview({ ...DEFAULT_SETTINGS, responseLength }).length
    expect(size('short')).toBeLessThan(size('medium'))
    expect(size('medium')).toBeLessThan(size('long'))
    expect(answerPreview({ ...DEFAULT_SETTINGS, useFillerWords: true })).toMatch(/Honestly|you know/i)
  })
})

describe('languageSample', () => {
  it('shows a sample in the chosen answer language, English by default', () => {
    expect(languageSample('hinglish')).toMatch(/aapki company/i)
    expect(languageSample('hi')).toMatch(/[ऀ-ॿ]/)
    expect(languageSample('xx')).toBe(languageSample('en'))
  })
})

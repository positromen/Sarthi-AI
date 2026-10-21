import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type TranscriptTurn } from '../shared/types'
import { buildSystemPrompt, buildUserPrompt } from './prompt'

describe('buildSystemPrompt', () => {
  it('reflects bullet format and the STAR method', () => {
    const prompt = buildSystemPrompt({ ...DEFAULT_SETTINGS, responseFormat: 'bullets', useStarMethod: true })
    expect(prompt).toMatch(/bullet/i)
    expect(prompt).toMatch(/STAR/)
  })

  it('reflects paragraph format, tone, and drops STAR when off', () => {
    const prompt = buildSystemPrompt({
      ...DEFAULT_SETTINGS,
      responseFormat: 'paragraph',
      responseTone: 'confident',
      useStarMethod: false
    })
    expect(prompt).toMatch(/paragraph/i)
    expect(prompt).toMatch(/confident/i)
    expect(prompt).not.toMatch(/STAR/)
  })

  it('always answers in character, even off-profile or from a garbled transcript', () => {
    const prompt = buildSystemPrompt({ ...DEFAULT_SETTINGS, resume: 'OT security engineer' })
    expect(prompt).toMatch(/never break character/i)
    expect(prompt).toMatch(/speech recognition/i)
  })

  it('asks for the answer in the chosen output language', () => {
    expect(buildSystemPrompt({ ...DEFAULT_SETTINGS })).toMatch(/answer in English/)
    expect(buildSystemPrompt({ ...DEFAULT_SETTINGS, outputLanguage: 'hi' })).toMatch(/answer in Hindi/)
    expect(buildSystemPrompt({ ...DEFAULT_SETTINGS, outputLanguage: 'hinglish' })).toMatch(/Hinglish.*Roman/)
  })

  it('includes profile text when provided and omits empty profile sections', () => {
    const withProfile = buildSystemPrompt({ ...DEFAULT_SETTINGS, resume: 'Senior engineer at Acme', jobDescription: '', notes: '' })
    expect(withProfile).toContain('Senior engineer at Acme')
    expect(withProfile).toMatch(/résumé/i)
    expect(withProfile).not.toMatch(/Job description:/)

    const noProfile = buildSystemPrompt({ ...DEFAULT_SETTINGS })
    expect(noProfile).not.toMatch(/Candidate résumé/i)
  })
})

describe('buildUserPrompt', () => {
  it('includes the question and recent context labelled by speaker', () => {
    const turns: TranscriptTurn[] = [
      { id: 1, speaker: 'interviewer', text: 'Why do you want this role?', at: 0 },
      { id: 2, speaker: 'you', text: 'I am excited about the mission.', at: 1 }
    ]
    const prompt = buildUserPrompt('Why do you want this role?', turns)
    expect(prompt).toContain('Why do you want this role?')
    expect(prompt).toContain('Interviewer:')
    expect(prompt).toContain('Me:')
  })

  it('mentions attached screenshots only when there are some', () => {
    expect(buildUserPrompt('Solve this.', [], { screenshots: 2 })).toMatch(/2 screenshots/)
    expect(buildUserPrompt('Solve this.', [], { screenshots: 1 })).toMatch(/1 screenshot\b/)
    expect(buildUserPrompt('Solve this.', [])).not.toMatch(/screenshot/i)
  })

  // A fully Hindi transcript pulled flash-lite into Hindi despite the system prompt; repeat the rule last.
  it('ends with the answer-language rule, even for a question in another language', () => {
    const prompt = buildUserPrompt('भारत का शेक्सपियर किसे कहा जाता है?', [], { outputLanguage: 'en' })
    expect(prompt.split('\n').at(-1)).toMatch(/answer in English/)
    expect(buildUserPrompt('Why this role?', [], { outputLanguage: 'hi' })).toMatch(/answer in Hindi/)
  })
})

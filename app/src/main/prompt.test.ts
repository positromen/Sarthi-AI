import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type TranscriptTurn } from '../shared/types'
import { buildNotesPrompt, buildSystemPrompt, buildUserPrompt } from './prompt'

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

  it('narrows a large profile to the parts relevant to the question', () => {
    // ~10k characters, past the 8k point where retrieval starts.
    const filler = Array.from({ length: 200 }, (_, i) => `Coursework module ${i}: lectures, labs and exams.`).join('\n\n')
    const settings = { ...DEFAULT_SETTINGS, resume: `Siddhesh Sakle.\n\nBuilt Vigilo, a PLC tampering detector.\n\n${filler}` }
    const prompt = buildSystemPrompt(settings, 'How did you detect PLC tampering?')
    expect(prompt).toContain('Vigilo, a PLC tampering detector')
    expect(prompt).not.toContain('Coursework module 199')
    expect(prompt).toMatch(/most relevant/i)
    // Without a question (or with a small profile) the whole profile is kept.
    expect(buildSystemPrompt(settings)).toContain('Coursework module 199')
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

describe('buildNotesPrompt', () => {
  const turns: TranscriptTurn[] = [
    { id: 1, speaker: 'interviewer', text: 'Why should we hire you?', at: 0 },
    { id: 2, speaker: 'you', text: 'Because I ship secure systems.', at: 1 }
  ]

  it('gives the coach the labelled transcript and asks for structured feedback', () => {
    const { system, user } = buildNotesPrompt(turns, { ...DEFAULT_SETTINGS, jobDescription: 'Security engineer role' })
    expect(system).toMatch(/coach/i)
    expect(system).toMatch(/to improve/i)
    expect(system).toMatch(/prepare/i)
    expect(system).toContain('Security engineer role')
    expect(user).toContain('Interviewer: Why should we hire you?')
    expect(user).toContain('Me: Because I ship secure systems.')
  })

  it('writes the notes in the chosen answer language', () => {
    expect(buildNotesPrompt(turns, { ...DEFAULT_SETTINGS, outputLanguage: 'hi' }).user).toMatch(/in Hindi/)
  })

  it('keeps the end of a very long transcript', () => {
    const long: TranscriptTurn[] = Array.from({ length: 4000 }, (_, i) => ({
      id: i,
      speaker: 'interviewer',
      text: `Question number ${i} with some padding words to make it long`,
      at: i
    }))
    const { user } = buildNotesPrompt(long, DEFAULT_SETTINGS)
    expect(user).toContain('Question number 3999')
    expect(user).not.toContain('Question number 0 ')
    expect(user.length).toBeLessThan(70_000)
  })
})

describe('question modes', () => {
  it('uses STAR only for behavioral questions, when STAR is on', () => {
    const settings = { ...DEFAULT_SETTINGS, useStarMethod: true }
    expect(buildSystemPrompt(settings, 'Tell me about a time you failed')).toMatch(/STAR/)
    expect(buildSystemPrompt(settings, 'How would you design a cache?')).not.toMatch(/STAR/)
    expect(buildSystemPrompt({ ...settings, useStarMethod: false }, 'Tell me about a time you failed')).not.toMatch(/STAR/)
  })

  it('leads technical answers with the direct answer and trade-offs', () => {
    expect(buildSystemPrompt(DEFAULT_SETTINGS, 'How would you design a cache?')).toMatch(/trade-offs/i)
  })

  it('asks coding answers for approach, fenced code and complexity', () => {
    const prompt = buildSystemPrompt(DEFAULT_SETTINGS, 'Solve this', 1)
    expect(prompt).toMatch(/fenced code block/i)
    expect(prompt).toMatch(/complexity/i)
  })

  it('always explains the formatting the overlay can render, including LaTeX math', () => {
    expect(buildSystemPrompt(DEFAULT_SETTINGS, 'Tell me about yourself')).toMatch(/LaTeX/)
  })
})

describe('buildNotesPrompt headings', () => {
  it('keeps the section headings in English so the report can be laid out, whatever the notes language', () => {
    const { system } = buildNotesPrompt([], { ...DEFAULT_SETTINGS, outputLanguage: 'hi' })
    expect(system).toMatch(/headings exactly as written, in English/i)
  })
})

describe('no background hedging', () => {
  it('forbids the "my expertise is X rather than Y" opener flash-lite still produced', () => {
    const prompt = buildSystemPrompt(DEFAULT_SETTINGS, 'How many dialects does Hindi have?')
    expect(prompt).toMatch(/while my expertise is/i)
    expect(prompt).toMatch(/never/i)
  })
})

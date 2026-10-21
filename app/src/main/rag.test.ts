import { describe, expect, it } from 'vitest'
import { Bm25Index, chunkText, selectProfile, tokenize } from './rag'

describe('tokenize', () => {
  it('lowercases, drops stopwords and folds simple English suffixes', () => {
    expect(tokenize('Tell me about the PLCs you were Securing')).toEqual(['plc', 'secur'])
  })

  it('keeps Devanagari words whole, vowel signs included', () => {
    expect(tokenize('हिंदी शिक्षक का अनुभव')).toEqual(['हिंदी', 'शिक्षक', 'अनुभव'])
  })
})

describe('chunkText', () => {
  it('packs short paragraphs together up to the size limit', () => {
    const chunks = chunkText('resume', 'Alpha one.\n\nBeta two.\n\nGamma three.', 25)
    expect(chunks.map((c) => c.text)).toEqual(['Alpha one.\nBeta two.', 'Gamma three.'])
    expect(chunks.map((c) => c.index)).toEqual([0, 1])
  })

  it('splits a long paragraph by lines and sentences, never exceeding the limit', () => {
    const text = `${'Built a cyber range for OT labs. '.repeat(10)}\nShort line.`
    const chunks = chunkText('notes', text, 120)
    expect(chunks.length).toBeGreaterThan(2)
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(120)
    expect(chunks.at(-1)!.text).toContain('Short line.')
  })

  it('hard-splits a single word-wall longer than the limit', () => {
    for (const chunk of chunkText('jd', 'x'.repeat(250), 100)) expect(chunk.text.length).toBeLessThanOrEqual(100)
  })

  it('returns nothing for blank text', () => {
    expect(chunkText('notes', '  \n\n ')).toEqual([])
  })
})

describe('Bm25Index', () => {
  it('ranks the chunk that matches the question above unrelated ones', () => {
    const chunks = [
      ...chunkText('resume', 'Enjoys cooking Italian food and hiking on weekends.'),
      ...chunkText('resume', 'Built Vigilo, a PLC tampering detector for Modbus and S7 industrial networks.'),
      ...chunkText('resume', 'Volunteered at a local library.')
    ]
    const scores = new Bm25Index(chunks).score('How did you detect PLC tampering?')
    expect(scores.indexOf(Math.max(...scores))).toBe(1)
    expect(scores[0]).toBe(0)
  })
})

// A profile well past the ~8k-character threshold: filler sections plus one specific fact.
const filler = (topic: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${topic} paragraph ${i}: general duties, meetings, reports and coordination.`).join('\n\n')
const resume = [
  'Siddhesh Sakle — OT/ICS security engineer.',
  filler('Internship', 60),
  'Designed a Kubernetes autoscaling controller that cut cloud cost by 30 percent.',
  filler('Coursework', 60)
].join('\n\n')
const profile = { resume, jobDescription: 'Platform Engineer at Acme.\n\nOwn Kubernetes clusters.', notes: '' }

describe('selectProfile', () => {
  it('passes a small profile through unchanged, even when only part of it matches', () => {
    const para = (topic: string) => `${topic}. ${'Details of the work and its outcomes. '.repeat(15)}`
    const small = {
      resume: [para('Cooking club'), para('PLC security research'), para('Chess team')].join('\n\n'),
      jobDescription: 'A role.',
      notes: 'A note.'
    }
    expect(selectProfile(small, 'PLC security')).toEqual(small)
  })

  it('always keeps the role, even when the question does not touch the job description', () => {
    const selected = selectProfile(profile, 'autoscaling controller cost', 3000)
    expect(selected.jobDescription).toContain('Platform Engineer at Acme')
  })

  it('prefers the strongest match and stays within budget when many chunks match', () => {
    // Fifteen ~670-char paragraphs that each mention Kubernetes once, then one that is all about the question.
    const weak = Array.from(
      { length: 15 },
      (_, i) => `Project ${i}: ${'routine maintenance and reporting tasks. '.repeat(16)}Used Kubernetes.`
    )
    const strong = `Kubernetes autoscaling: ${'designed the Kubernetes autoscaling controller and tuned autoscaling policies. '.repeat(8)}`
    const crowded = { resume: ['Siddhesh Sakle.', ...weak, strong].join('\n\n'), jobDescription: '', notes: '' }

    const selected = selectProfile(crowded, 'Kubernetes autoscaling', 2000)
    expect(selected.resume).toContain('tuned autoscaling policies')
    expect(selected.resume.length).toBeLessThanOrEqual(2050)
  })

  it('keeps the relevant fact, the résumé opening and the role, within budget', () => {
    const selected = selectProfile(profile, 'Tell me about your Kubernetes autoscaling work', 3000)
    expect(selected.resume).toContain('Kubernetes autoscaling controller')
    expect(selected.resume.startsWith('Siddhesh Sakle')).toBe(true)
    expect(selected.jobDescription).toContain('Platform Engineer at Acme')
    const total = selected.resume.length + selected.jobDescription.length + selected.notes.length
    expect(total).toBeLessThanOrEqual(3200)
    expect(selected.resume).not.toContain('Coursework paragraph 59')
  })

  it('keeps chunks in document order, marking gaps', () => {
    const selected = selectProfile(profile, 'Kubernetes autoscaling', 3000)
    expect(selected.resume.indexOf('Siddhesh')).toBeLessThan(selected.resume.indexOf('autoscaling'))
    expect(selected.resume).toContain('…')
  })

  it('falls back to the opening sections when the question has no keywords', () => {
    const selected = selectProfile(profile, 'Tell me about yourself', 3000)
    expect(selected.resume.startsWith('Siddhesh Sakle')).toBe(true)
    expect(selected.resume).toContain('Internship paragraph 0')
  })
})

import { describe, expect, it } from 'vitest'
import { exportFileName, sessionToHtml, sessionToMarkdown } from './sessionExport'
import type { SessionRecord } from './types'

const start = new Date(2026, 9, 22, 14, 5).getTime()
const RECORD: SessionRecord = {
  id: String(start),
  startedAt: start,
  endedAt: start + 38 * 60_000,
  turns: [
    { id: 1, speaker: 'interviewer', text: 'Why Kafka?', at: start + 65_000 },
    { id: 2, speaker: 'you', text: 'Throughput, mostly.', at: start + 70_000 }
  ],
  answers: [{ question: 'Why Kafka?', text: '- **Throughput** at scale', at: start + 66_000 }],
  notes: 'Overall\n- Good.',
  usage: { audioSeconds: 1720, aiCalls: 6, tokens: 9240, estimated: true }
}

describe('sessionToMarkdown', () => {
  it('writes the title, date, length, usage, notes, answers and a timestamped transcript', () => {
    expect(sessionToMarkdown(RECORD)).toBe(
      [
        '# Why Kafka?',
        '',
        '2026-10-22 14:05 · 38 min · 2 turns · 1 answer  ',
        '29 min audio · 6 AI calls · ≈9.2k tokens',
        '',
        '## Notes',
        '',
        'Overall\n- Good.',
        '',
        '## Answers',
        '',
        '### Why Kafka?',
        '',
        '*01:06*',
        '',
        '- **Throughput** at scale',
        '',
        '## Transcript',
        '',
        '- **01:05 Interviewer:** Why Kafka?',
        '- **01:10 Me:** Throughput, mostly.',
        ''
      ].join('\n')
    )
  })

  it('leaves out empty sections and marks an unfinished session', () => {
    const md = sessionToMarkdown({ ...RECORD, endedAt: null, notes: null, answers: [], usage: undefined })
    expect(md).toContain('· Unfinished ·')
    expect(md).not.toContain('## Notes')
    expect(md).not.toContain('## Answers')
  })
})

describe('sessionToHtml', () => {
  it('escapes everything that came from speech or the model', () => {
    const html = sessionToHtml({
      ...RECORD,
      turns: [{ id: 1, speaker: 'interviewer', text: '<script>alert(1)</script> & "x"', at: start }],
      answers: [{ question: '<img src=x onerror=alert(1)>', text: '</pre><b>', at: start }]
    })
    expect(html).not.toMatch(/<script>|<img|<\/pre><b>/)
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('is a standalone page that loads nothing from outside', () => {
    const html = sessionToHtml(RECORD)
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain("default-src 'none'")
    expect(html).not.toMatch(/src=|href=/)
  })
})

describe('exportFileName', () => {
  it('names the file after the session start, with characters Windows allows', () => {
    expect(exportFileName(RECORD)).toBe('Sarthi session 2026-10-22 14-05')
  })
})

import { describe, expect, it } from 'vitest'
import { filterSessions, formatClock, formatWhen, parseNotes } from './historyView'
import type { SessionSummary } from '../../shared/types'

const NOTES = `Overall
- A strong technical round.
- The design answer drifted before naming trade-offs.

Went well
- Quantified the result (6 h to 40 min).

To improve
- Name trade-offs first.

Prepare next
- Consistency vs availability for ledgers.
- A mentoring story.`

describe('parseNotes', () => {
  it('splits the four sections', () => {
    expect(parseNotes(NOTES)).toEqual({
      overall: ['A strong technical round.', 'The design answer drifted before naming trade-offs.'],
      wentWell: ['Quantified the result (6 h to 40 min).'],
      toImprove: ['Name trade-offs first.'],
      prepareNext: ['Consistency vs availability for ledgers.', 'A mentoring story.']
    })
  })

  it('accepts markdown-styled headings and a prose overall', () => {
    const styled = '## Overall\nSolid round overall.\n\n**Went well:**\n* Clear intro\n### To improve —\n- Pace\n**Prepare next**\n1. System design'
    expect(parseNotes(styled)).toEqual({
      overall: ['Solid round overall.'],
      wentWell: ['Clear intro'],
      toImprove: ['Pace'],
      prepareNext: ['System design']
    })
  })

  it('gives up (so the raw text is shown) when the sections are not there', () => {
    expect(parseNotes('Just a paragraph of feedback without headings.')).toBeNull()
    expect(parseNotes('Overall\n- only one section')).toBeNull()
  })
})

describe('formatClock', () => {
  it('shows mm:ss from the session start', () => {
    expect(formatClock(1000, 1000)).toBe('00:00')
    expect(formatClock(1000, 1000 + 61_000)).toBe('01:01')
    expect(formatClock(0, 3_725_000)).toBe('62:05')
  })
})

describe('formatWhen', () => {
  const now = new Date(2026, 9, 22, 18, 0).getTime()
  it('says Today for today, otherwise weekday and date', () => {
    expect(formatWhen(new Date(2026, 9, 22, 14, 5).getTime(), now)).toBe('Today, 14:05')
    expect(formatWhen(new Date(2026, 9, 20, 11, 30).getTime(), now)).toBe('Tue 20 Oct, 11:30')
  })
})

describe('filterSessions', () => {
  const s = (id: string, hasNotes: boolean, endedAt: number | null): SessionSummary => ({
    id, startedAt: Number(id), endedAt, turnCount: 1, answerCount: 0, title: id, hasNotes
  })
  const list = [s('3', true, 4), s('2', false, null), s('1', false, 2)]
  it('filters by notes or unfinished', () => {
    expect(filterSessions(list, 'all').map((x) => x.id)).toEqual(['3', '2', '1'])
    expect(filterSessions(list, 'notes').map((x) => x.id)).toEqual(['3'])
    expect(filterSessions(list, 'unfinished').map((x) => x.id)).toEqual(['2'])
  })
})

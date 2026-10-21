// Pure logic for the History page: notes report parsing, time labels and list filters.
import type { SessionSummary } from '../../shared/types'

export interface NotesReport {
  overall: string[]
  wentWell: string[]
  toImprove: string[]
  prepareNext: string[]
}

const SECTIONS: [keyof NotesReport, RegExp][] = [
  ['overall', /^overall$/i],
  ['wentWell', /^went well$/i],
  ['toImprove', /^to improve$/i],
  ['prepareNext', /^prepare next$/i]
]

// A heading line, however the model styled it: "## Overall", "**Went well:**", "To improve —".
function headingOf(line: string): keyof NotesReport | null {
  const bare = line
    .replace(/^#{1,6}\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/[:—–-]\s*$/, '')
    .trim()
  return SECTIONS.find(([, pattern]) => pattern.test(bare))?.[0] ?? null
}

/**
 * Splits post-call notes into the report's four sections (the prompt asks for these English headings). Returns null
 * when fewer than two sections are found, so the caller shows the raw text instead of a half-empty report.
 */
export function parseNotes(text: string): NotesReport | null {
  const report: NotesReport = { overall: [], wentWell: [], toImprove: [], prepareNext: [] }
  let current: keyof NotesReport | null = null
  let found = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const heading = headingOf(line)
    if (heading) {
      current = heading
      found++
      continue
    }
    if (current) report[current].push(line.replace(/^([-*•]|\d+[.)])\s+/, ''))
  }
  return found >= 2 ? report : null
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** "mm:ss" since the session started (minutes keep counting past 59). */
export function formatClock(startedAt: number, at: number): string {
  const seconds = Math.max(0, Math.floor((at - startedAt) / 1000))
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Today, 14:05" or "Tue 20 Oct, 11:30" (with the year when it isn't this year). */
export function formatWhen(at: number, now = Date.now()): string {
  const date = new Date(at)
  const today = new Date(now)
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`
  const year = date.getFullYear() === today.getFullYear() ? '' : ` ${date.getFullYear()}`
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}${year}, ${time}`
}

/** "Tue 21 Oct 2026, 14:05", for the detail header. */
export function formatFullDate(at: number): string {
  const date = new Date(at)
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export type HistoryFilter = 'all' | 'notes' | 'unfinished'

export function filterSessions(sessions: SessionSummary[], filter: HistoryFilter): SessionSummary[] {
  if (filter === 'notes') return sessions.filter((s) => s.hasNotes)
  if (filter === 'unfinished') return sessions.filter((s) => s.endedAt === null)
  return sessions
}

/** "38 min · 42 turns · 6 answers", or "Unfinished · …" for a session the app quit during. */
export function sessionMeta(s: SessionSummary): string {
  const length = s.endedAt === null ? 'Unfinished' : `${Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000))} min`
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return `${length} · ${plural(s.turnCount, 'turn')} · ${plural(s.answerCount, 'answer')}`
}

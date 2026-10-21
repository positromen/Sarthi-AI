// A saved session as a Markdown file or a print-ready HTML page (main turns the page into a PDF).
import { sessionTitle } from './sessionTitle'
import type { SessionRecord, TranscriptTurn } from './types'
import { sessionUsageLine } from './usageFormat'

const pad = (n: number) => String(n).padStart(2, '0')

function stamp(at: number, timeSeparator: string): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${timeSeparator}${pad(d.getMinutes())}`
}

/** mm:ss from the start of the session. */
function clock(startedAt: number, at: number): string {
  const seconds = Math.max(0, Math.floor((at - startedAt) / 1000))
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function meta(record: SessionRecord): string {
  const length =
    record.endedAt === null ? 'Unfinished' : `${Math.max(1, Math.round((record.endedAt - record.startedAt) / 60_000))} min`
  return `${stamp(record.startedAt, ':')} · ${length} · ${plural(record.turns.length, 'turn')} · ${plural(record.answers.length, 'answer')}`
}

const speaker = (turn: TranscriptTurn) => (turn.speaker === 'you' ? 'Me' : 'Interviewer')

export function sessionToMarkdown(record: SessionRecord): string {
  const usage = sessionUsageLine(record.usage)
  const lines = [`# ${sessionTitle(record)}`, '', usage ? `${meta(record)}  ` : meta(record)]
  if (usage) lines.push(usage)
  if (record.notes) lines.push('', '## Notes', '', record.notes)
  if (record.answers.length > 0) {
    lines.push('', '## Answers')
    for (const answer of record.answers) {
      lines.push('', `### ${answer.question}`, '', `*${clock(record.startedAt, answer.at)}*`, '', answer.text)
    }
  }
  if (record.turns.length > 0) {
    lines.push('', '## Transcript', '')
    for (const turn of record.turns) lines.push(`- **${clock(record.startedAt, turn.at)} ${speaker(turn)}:** ${turn.text}`)
  }
  return `${lines.join('\n')}\n`
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const STYLE = `
body { font: 11pt/1.5 "Segoe UI", system-ui, sans-serif; color: #111; margin: 0; }
h1 { font-size: 17pt; margin: 0 0 4pt; }
h2 { font-size: 13pt; margin: 18pt 0 6pt; border-bottom: 1px solid #ccc; padding-bottom: 2pt; }
h3 { font-size: 11pt; margin: 12pt 0 2pt; }
.meta, .time { color: #666; font-size: 9.5pt; }
.text { white-space: pre-wrap; margin: 4pt 0 0; }
.turn { margin: 3pt 0; }
.who { font-weight: 600; }
`

/**
 * A standalone page for printing to PDF. Everything in it came from speech recognition or a model, so all of it is
 * escaped, and its CSP blocks any loading or scripts. Answers keep their Markdown as plain text.
 */
export function sessionToHtml(record: SessionRecord): string {
  const usage = sessionUsageLine(record.usage)
  const parts = [
    `<h1>${escapeHtml(sessionTitle(record))}</h1>`,
    `<div class="meta">${escapeHtml(meta(record))}${usage ? `<br>${escapeHtml(usage)}` : ''}</div>`
  ]
  if (record.notes) parts.push('<h2>Notes</h2>', `<div class="text">${escapeHtml(record.notes)}</div>`)
  if (record.answers.length > 0) {
    parts.push('<h2>Answers</h2>')
    for (const answer of record.answers) {
      parts.push(
        `<h3>${escapeHtml(answer.question)}</h3>`,
        `<div class="time">${clock(record.startedAt, answer.at)}</div>`,
        `<div class="text">${escapeHtml(answer.text)}</div>`
      )
    }
  }
  if (record.turns.length > 0) {
    parts.push('<h2>Transcript</h2>')
    for (const turn of record.turns) {
      parts.push(
        `<div class="turn"><span class="time">${clock(record.startedAt, turn.at)}</span> <span class="who">${speaker(turn)}:</span> ${escapeHtml(turn.text)}</div>`
      )
    }
  }
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`,
    `<title>${escapeHtml(sessionTitle(record))}</title>`,
    `<style>${STYLE}</style>`,
    '</head><body>',
    ...parts,
    '</body></html>'
  ].join('\n')
}

/** "Sarthi session 2026-10-22 14-05" (no colon: Windows file names can't have one). */
export function exportFileName(record: SessionRecord): string {
  return `Sarthi session ${stamp(record.startedAt, '-')}`
}

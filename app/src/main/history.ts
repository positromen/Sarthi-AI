import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SessionRecord, SessionSummary, TranscriptTurn } from '../shared/types'

// Session ids are start times in ms. Anything else coming from the renderer is refused before it touches the disk.
const ID_PATTERN = /^\d{1,16}$/
const TITLE_LENGTH = 80

export interface HistoryOptions {
  /** Oldest sessions beyond this are deleted, so history can't grow without bound on a user's disk. */
  maxSessions?: number
  /** An in-progress session is written this long after its last change, so a crash loses little. */
  saveDelayMs?: number
  /** Called after every write or delete (to refresh open history views). */
  onChange?: () => void
}

function summarize(record: SessionRecord): SessionSummary {
  const first = record.turns.find((turn) => turn.speaker === 'interviewer') ?? record.turns[0]
  const title = first?.text ?? record.answers[0]?.question ?? 'Untitled session'
  return {
    id: record.id,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    turnCount: record.turns.length,
    answerCount: record.answers.length,
    title: title.length > TITLE_LENGTH ? `${title.slice(0, TITLE_LENGTH - 1)}…` : title,
    hasNotes: Boolean(record.notes)
  }
}

/** Saves each listening session (transcript + answers + notes) as one JSON file. Plain fs, so it is testable. */
export class HistoryStore {
  private current: SessionRecord | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private readonly maxSessions: number
  private readonly saveDelayMs: number
  private readonly onChange: () => void

  constructor(
    private readonly dir: string,
    { maxSessions = 100, saveDelayMs = 2000, onChange = () => {} }: HistoryOptions = {}
  ) {
    this.maxSessions = maxSessions
    this.saveDelayMs = saveDelayMs
    this.onChange = onChange
  }

  begin(now = Date.now()): void {
    if (this.current) this.finish(now)
    this.current = { id: String(now), startedAt: now, endedAt: null, turns: [], answers: [], notes: null }
  }

  addTurn(turn: TranscriptTurn): void {
    if (!this.current) return
    this.current.turns.push(turn)
    this.scheduleSave()
  }

  addAnswer(question: string, text: string, at = Date.now()): void {
    if (!this.current) return
    this.current.answers.push({ question, text, at })
    this.scheduleSave()
  }

  /** Ends the current session; returns its summary, or null if there was nothing worth keeping. */
  finish(now = Date.now()): SessionSummary | null {
    const record = this.current
    this.current = null
    this.clearTimer()
    if (!record || (record.turns.length === 0 && record.answers.length === 0)) return null
    record.endedAt = now
    this.write(record)
    this.prune()
    this.onChange()
    return summarize(record)
  }

  /** Newest first. Unreadable files are skipped rather than breaking the list. */
  list(): SessionSummary[] {
    return this.ids()
      .map((id) => this.get(id))
      .filter((record): record is SessionRecord => record !== null)
      .map(summarize)
      .sort((a, b) => b.startedAt - a.startedAt)
  }

  get(id: string): SessionRecord | null {
    if (!ID_PATTERN.test(id)) return null
    try {
      return JSON.parse(readFileSync(this.path(id), 'utf8')) as SessionRecord
    } catch {
      return null
    }
  }

  setNotes(id: string, notes: string): SessionRecord | null {
    const record = this.get(id)
    if (!record) return null
    record.notes = notes
    this.write(record)
    this.onChange()
    return record
  }

  remove(id: string): boolean {
    if (!ID_PATTERN.test(id) || !existsSync(this.path(id))) return false
    rmSync(this.path(id))
    this.onChange()
    return true
  }

  private path(id: string): string {
    return join(this.dir, `${id}.json`)
  }

  private ids(): string[] {
    if (!existsSync(this.dir)) return []
    return readdirSync(this.dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .filter((id) => ID_PATTERN.test(id))
  }

  private write(record: SessionRecord): void {
    mkdirSync(this.dir, { recursive: true })
    writeFileSync(this.path(record.id), JSON.stringify(record))
  }

  private scheduleSave(): void {
    this.clearTimer()
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      if (this.current) this.write(this.current)
    }, this.saveDelayMs)
  }

  private clearTimer(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
  }

  private prune(): void {
    const ids = this.ids().sort((a, b) => Number(b) - Number(a))
    for (const id of ids.slice(this.maxSessions)) rmSync(this.path(id), { force: true })
  }
}

let store: HistoryStore | null = null

/** Called once at startup with a folder under the user's own userData, so every install keeps its own history. */
export function initHistory(dir: string, options?: HistoryOptions): HistoryStore {
  store = new HistoryStore(dir, options)
  return store
}

export function getHistory(): HistoryStore | null {
  return store
}

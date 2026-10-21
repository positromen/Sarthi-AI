import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AiCall, UsageReport, UsageTotals } from '../shared/types'

export interface UsageOptions {
  /** Writes are throttled to one per this long: audio arrives every ~100 ms and must not starve the save. */
  saveDelayMs?: number
  keepDays?: number
  keepMonths?: number
}

interface UsageFile {
  days: Record<string, UsageTotals>
  months: Record<string, UsageTotals>
}

const empty = (): UsageTotals => ({ audioSeconds: 0, ai: {} })
const pad = (n: number) => String(n).padStart(2, '0')
// Local calendar keys: "today" is the user's own day.
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const dayKey = (d: Date) => `${monthKey(d)}-${pad(d.getDate())}`

function load(file: string): UsageFile {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as Partial<UsageFile>
    return { days: data.days ?? {}, months: data.months ?? {} }
  } catch {
    return { days: {}, months: {} }
  }
}

/** Keeps only the newest `keep` entries (keys sort by date). */
function trim(record: Record<string, UsageTotals>, keep: number): void {
  for (const key of Object.keys(record).sort().slice(0, -keep)) delete record[key]
}

/**
 * Counts what the user's own API keys are spending: Deepgram audio seconds and AI calls/tokens per provider, per
 * day and per month. Free-tier limits are left to each provider's console, since they change.
 */
export class UsageStore {
  private readonly data: UsageFile
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private readonly saveDelayMs: number
  private readonly keepDays: number
  private readonly keepMonths: number

  constructor(
    private readonly file: string,
    { saveDelayMs = 5000, keepDays = 62, keepMonths = 24 }: UsageOptions = {}
  ) {
    this.data = load(file)
    this.saveDelayMs = saveDelayMs
    this.keepDays = keepDays
    this.keepMonths = keepMonths
  }

  addAudio(seconds: number, at = Date.now()): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    for (const totals of this.buckets(at)) totals.audioSeconds += seconds
    this.scheduleSave()
  }

  addAi(call: AiCall, at = Date.now()): void {
    for (const totals of this.buckets(at)) {
      const ai = (totals.ai[call.provider] ??= { calls: 0, inputTokens: 0, outputTokens: 0, estimated: false })
      ai.calls += 1
      ai.inputTokens += Math.max(0, Math.round(call.inputTokens) || 0)
      ai.outputTokens += Math.max(0, Math.round(call.outputTokens) || 0)
      ai.estimated ||= call.estimated
    }
    this.scheduleSave()
  }

  report(now = Date.now()): UsageReport {
    const date = new Date(now)
    return {
      today: structuredClone(this.data.days[dayKey(date)] ?? empty()),
      month: structuredClone(this.data.months[monthKey(date)] ?? empty())
    }
  }

  /** Writes pending changes now (on quit). */
  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    trim(this.data.days, this.keepDays)
    trim(this.data.months, this.keepMonths)
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.data))
  }

  private buckets(at: number): UsageTotals[] {
    const date = new Date(at)
    return [(this.data.days[dayKey(date)] ??= empty()), (this.data.months[monthKey(date)] ??= empty())]
  }

  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => this.flush(), this.saveDelayMs)
  }
}

let store: UsageStore | null = null

export function initUsage(file: string, options?: UsageOptions): UsageStore {
  store = new UsageStore(file, options)
  return store
}

export function getUsage(): UsageStore | null {
  return store
}

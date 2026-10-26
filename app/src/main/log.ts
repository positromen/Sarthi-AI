// A small local log for bug reports: warnings and errors from main and the windows, redacted before they touch the
// disk. Nothing is sent anywhere; the user copies it from About when they choose to.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ApiKeyStatus, LlmProvider } from '../shared/types'

const REDACTED = '[redacted]'
// Longer entries are cut: an HTTP error can carry a whole response (headers, cookies, HTML).
const MAX_ENTRY_CHARS = 500
// A cookie value is anything followed by a cookie attribute, as in set-cookie headers that error dumps include.
const COOKIE = /\b([\w-]+)=[^;\s"',]+(?=;\s*(?:path|expires|domain|secure|httponly|samesite|max-age)\b)/gi

// Key shapes: Google (AIza…), Groq (gsk_…), Anthropic (sk-ant-…), Deepgram (40 hex), and any auth header value.
const PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /gsk_[0-9A-Za-z]{20,}/g,
  /sk-ant-[0-9A-Za-z_-]{10,}/g,
  /\b[0-9a-f]{32,}\b/gi,
  /\b(Token|Bearer)\s+[^\s"',]+/g
]

export function redact(text: string, secrets: readonly string[] = []): string {
  let out = text
  for (const secret of secrets) {
    // Very short values would blank ordinary words; real keys are long.
    if (secret.length >= 8) out = out.split(secret).join(REDACTED)
  }
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, (_match, scheme?: string) =>
      typeof scheme === 'string' && /^(Token|Bearer)$/.test(scheme) ? `${scheme} ${REDACTED}` : REDACTED
    )
  }
  return out.replace(COOKIE, `$1=${REDACTED}`)
}

export type LogLevel = 'warn' | 'error'

export interface LogOptions {
  /** Past this, the file moves to `.1` (replacing the older one) and a new file starts. */
  maxBytes?: number
  /** The user's saved key values, redacted wherever they appear. */
  secrets?: () => readonly string[]
}

export class LogFile {
  private readonly maxBytes: number
  private readonly secrets: () => readonly string[]

  constructor(
    private readonly file: string,
    { maxBytes = 1024 * 1024, secrets = () => [] }: LogOptions = {}
  ) {
    this.maxBytes = maxBytes
    this.secrets = secrets
  }

  write(level: LogLevel, message: string, at = new Date()): void {
    const flat = redact(message, this.secrets()).replace(/\r?\n/g, ' ⏎ ')
    const entry = flat.length > MAX_ENTRY_CHARS ? `${flat.slice(0, MAX_ENTRY_CHARS)}… [cut]` : flat
    const line = `${at.toISOString()} ${level.toUpperCase()} ${entry}\n`
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      if (existsSync(this.file) && statSync(this.file).size + Buffer.byteLength(line) > this.maxBytes) {
        renameSync(this.file, `${this.file}.1`)
      }
      appendFileSync(this.file, line)
    } catch {
      // Logging must never break the app.
    }
  }

  /** The last `lines` lines, reaching into the rotated `.1` file when the current one is still short. */
  tail(lines: number): string {
    const read = (path: string) => {
      try {
        return readFileSync(path, 'utf8')
      } catch {
        return ''
      }
    }
    const all = (read(`${this.file}.1`) + read(this.file)).trimEnd()
    return all ? all.split('\n').slice(-lines).join('\n') : ''
  }
}

export interface DebugFacts {
  app: string
  electron: string
  chrome: string
  os: string
  provider: LlmProvider
  privateMode: boolean
  keys: ApiKeyStatus
  log: string
}

/** What "Copy debug info" puts on the clipboard: facts for a bug report, with keys as yes/no only. */
export function debugReport(facts: DebugFacts): string {
  const keys = Object.entries(facts.keys)
    .map(([name, saved]) => `${name} ${saved ? 'yes' : 'no'}`)
    .join(', ')
  return [
    `Sarthi AI ${facts.app} · Electron ${facts.electron} · Chrome ${facts.chrome} · ${facts.os}`,
    `AI provider: ${facts.provider}`,
    `Private mode: ${facts.privateMode ? 'on' : 'off'}`,
    `Keys: ${keys}`,
    '',
    'Recent log:',
    facts.log || '(empty)'
  ].join('\n')
}

let log: LogFile | null = null

/** Starts the log and mirrors main's console.warn/console.error into it. */
export function initLog(file: string, options?: LogOptions): LogFile {
  const current = new LogFile(file, options)
  log = current
  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      current.write(level, args.map((a) => (a instanceof Error ? (a.stack ?? a.message) : String(a))).join(' '))
    }
  }
  return current
}

export function getLog(): LogFile | null {
  return log
}

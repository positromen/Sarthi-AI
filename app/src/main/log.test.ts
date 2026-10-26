import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { debugReport, LogFile, redact } from './log'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sarthi-log-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('redact', () => {
  it('hides every key shape the app handles, even inside error messages and URLs', () => {
    const text = [
      'Gemini error: key AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW invalid',
      'groq gsk_abcdefghijklmnopqrstuvwxyz0123456789ABCD',
      'claude sk-ant-api03-AbCdEf_GhIjKl-MnOpQrStUv',
      'deepgram 0123456789abcdef0123456789abcdef01234567',
      'header authorization: Token dg-secret-value and Bearer xyz.abc-123'
    ].join('\n')
    const out = redact(text)
    for (const secret of ['AIzaSy', 'gsk_', 'sk-ant-', '0123456789abcdef', 'dg-secret-value', 'xyz.abc-123']) {
      expect(out).not.toContain(secret)
    }
    expect(out).toContain('Gemini error: key [redacted] invalid')
  })

  it('hides the user’s saved key values whatever their shape', () => {
    expect(redact('failed with my-weird-key-42 here', ['my-weird-key-42'])).toBe('failed with [redacted] here')
  })

  it('hides cookie and session values that error dumps can carry', () => {
    const out = redact('"set-cookie": [ "_gh_sess=abc123SECRET%3D%3D; path=/; HttpOnly", "_octo=GH1.1.58; expires=x" ]')
    expect(out).not.toMatch(/abc123SECRET|GH1\.1\.58/)
    expect(out).toContain('_gh_sess=[redacted]')
  })

  it('leaves ordinary text alone', () => {
    const text = 'Deepgram closed: 1006 · gemini-3.5-flash-lite returned 503 at 2026-10-22T14:05:00Z'
    expect(redact(text)).toBe(text)
  })
})

describe('LogFile', () => {
  it('appends timestamped, redacted lines', () => {
    const log = new LogFile(join(dir, 'sarthi.log'), { secrets: () => ['hunter2-key'] })
    log.write('error', 'request failed for hunter2-key', new Date('2026-10-22T08:35:00Z'))
    expect(readFileSync(join(dir, 'sarthi.log'), 'utf8')).toBe('2026-10-22T08:35:00.000Z ERROR request failed for [redacted]\n')
  })

  it('caps each entry, so one huge error dump cannot flood the log or debug info', () => {
    const log = new LogFile(join(dir, 'sarthi.log'))
    log.write('warn', `Update check failed: ${'x'.repeat(5000)}`)
    const line = readFileSync(join(dir, 'sarthi.log'), 'utf8').trimEnd()
    expect(line.length).toBeLessThan(700)
    expect(line).toMatch(/… \[cut\]$/)
  })

  it('rotates to one .1 file once it passes the size cap', () => {
    const file = join(dir, 'sarthi.log')
    const log = new LogFile(file, { maxBytes: 200 })
    for (let i = 0; i < 10; i++) log.write('warn', `line ${i} ${'x'.repeat(40)}`)
    expect(existsSync(`${file}.1`)).toBe(true)
    expect(readFileSync(file, 'utf8').length).toBeLessThanOrEqual(200)
    expect(log.tail(3).split('\n')).toHaveLength(3)
    expect(log.tail(3)).toContain('line 9')
  })

  it('reads an empty tail when nothing was logged', () => {
    expect(new LogFile(join(dir, 'none.log')).tail(10)).toBe('')
  })
})

describe('debugReport', () => {
  it('lists versions, settings that matter and which keys exist, never key values', () => {
    const report = debugReport({
      app: '0.9.0',
      electron: '44.0.0',
      chrome: '146.0',
      os: 'Windows 10.0.26300',
      provider: 'gemini',
      privateMode: true,
      keys: { deepgram: true, gemini: true, groq: false, anthropic: false },
      log: '2026-10-22T08:35:00.000Z WARN gemini failed'
    })
    expect(report).toContain('Sarthi AI 0.9.0')
    expect(report).toContain('Keys: deepgram yes, gemini yes, groq no, anthropic no')
    expect(report).toContain('Private mode: on')
    expect(report).toContain('WARN gemini failed')
  })
})

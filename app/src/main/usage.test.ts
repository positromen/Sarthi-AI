import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiCall } from '../shared/types'
import { UsageStore } from './usage'

let dir: string
let file: string

// Local times, since "today" and "this month" are the user's own calendar.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
const call = (provider: AiCall['provider'], inputTokens: number, outputTokens: number, estimated = false): AiCall => ({
  provider,
  inputTokens,
  outputTokens,
  estimated
})

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sarthi-usage-'))
  file = join(dir, 'usage.json')
})

afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

describe('UsageStore', () => {
  it('adds audio and AI calls into today and this month, per provider', () => {
    const store = new UsageStore(file)
    store.addAudio(30, at(2026, 10, 21))
    store.addAudio(90, at(2026, 10, 22, 9))
    store.addAi(call('gemini', 1000, 200), at(2026, 10, 22, 10))
    store.addAi(call('gemini', 500, 100, true), at(2026, 10, 22, 11))
    store.addAi(call('groq', 800, 300), at(2026, 10, 20))

    expect(store.report(at(2026, 10, 22, 18))).toEqual({
      today: {
        audioSeconds: 90,
        ai: { gemini: { calls: 2, inputTokens: 1500, outputTokens: 300, estimated: true } }
      },
      month: {
        audioSeconds: 120,
        ai: {
          gemini: { calls: 2, inputTokens: 1500, outputTokens: 300, estimated: true },
          groq: { calls: 1, inputTokens: 800, outputTokens: 300, estimated: false }
        }
      }
    })
  })

  it('starts a new day and a new month at local midnight', () => {
    const store = new UsageStore(file)
    store.addAudio(60, at(2026, 10, 31, 23))
    expect(store.report(at(2026, 11, 1, 0))).toEqual({ today: { audioSeconds: 0, ai: {} }, month: { audioSeconds: 0, ai: {} } })
  })

  it('persists across restarts, writing at most once per delay while audio streams in', () => {
    vi.useFakeTimers()
    const store = new UsageStore(file, { saveDelayMs: 5000 })
    for (let i = 0; i < 100; i++) {
      store.addAudio(0.1, at(2026, 10, 22))
      vi.advanceTimersByTime(100)
    }
    // Ten seconds of continuous frames: the first write landed after 5 s instead of waiting for a pause.
    expect(JSON.parse(readFileSync(file, 'utf8')).months['2026-10'].audioSeconds).toBeGreaterThan(4)
    store.flush()
    expect(new UsageStore(file).report(at(2026, 10, 22)).month.audioSeconds).toBeCloseTo(10)
  })

  it('keeps only recent days and months, so the file stays small', () => {
    const store = new UsageStore(file, { keepDays: 2, keepMonths: 2 })
    store.addAudio(1, at(2026, 8, 1))
    store.addAudio(1, at(2026, 9, 1))
    store.addAudio(1, at(2026, 10, 1))
    store.addAudio(1, at(2026, 10, 2))
    store.flush()
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    expect(Object.keys(saved.days).sort()).toEqual(['2026-10-01', '2026-10-02'])
    expect(Object.keys(saved.months).sort()).toEqual(['2026-09', '2026-10'])
  })

  it('starts empty from a missing or corrupt file, and ignores nonsense amounts', () => {
    writeFileSync(file, '{not json')
    const store = new UsageStore(file)
    store.addAudio(Number.NaN, at(2026, 10, 22))
    store.addAudio(-5, at(2026, 10, 22))
    expect(store.report(at(2026, 10, 22)).today).toEqual({ audioSeconds: 0, ai: {} })
  })
})

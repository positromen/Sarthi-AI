import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Speaker, TranscriptTurn } from '../shared/types'
import { HistoryStore } from './history'

let dir: string
let nextId = 1

const turn = (speaker: Speaker, text: string): TranscriptTurn => ({ id: nextId++, speaker, text, at: nextId })

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sarthi-history-'))
})

afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

describe('HistoryStore', () => {
  it('saves a finished session and lists it with a title from the first interviewer turn', () => {
    const store = new HistoryStore(dir)
    store.begin(1000)
    store.addTurn(turn('you', 'Hello.'))
    store.addTurn(turn('interviewer', 'Tell me about yourself.'))
    store.addAnswer('Tell me about yourself.', '- I build OT security tools.', 1500)
    const summary = store.finish(2000)

    expect(summary).toMatchObject({
      id: '1000',
      startedAt: 1000,
      endedAt: 2000,
      turnCount: 2,
      answerCount: 1,
      title: 'Tell me about yourself.',
      hasNotes: false
    })
    expect(new HistoryStore(dir).get('1000')).toMatchObject({
      turns: [{ text: 'Hello.' }, { text: 'Tell me about yourself.' }],
      answers: [{ question: 'Tell me about yourself.', text: '- I build OT security tools.', at: 1500 }],
      notes: null
    })
  })

  it('does not save a session where nothing was said or answered', () => {
    const store = new HistoryStore(dir)
    store.begin(1000)
    expect(store.finish(2000)).toBeNull()
    expect(store.list()).toEqual([])
  })

  it('saves answers to typed questions outside a Listen session, grouping those within 30 minutes', () => {
    const store = new HistoryStore(dir)
    store.addAnswer('Why us?', 'Because.', 1_000)
    store.addAnswer('Notice period?', 'Thirty days.', 1_000 + 10 * 60_000)
    store.addAnswer('Salary?', 'Market rate.', 1_000 + 50 * 60_000)

    const sessions = store.list()
    expect(sessions.map((s) => [s.title, s.answerCount, s.endedAt !== null])).toEqual([
      ['Salary?', 1, true],
      ['Why us?', 2, true]
    ])
    expect(store.get(sessions[1].id)?.endedAt).toBe(1_000 + 10 * 60_000)
  })

  it('does not mix typed answers into a running Listen session', () => {
    const store = new HistoryStore(dir)
    store.begin(5_000)
    store.addAnswer('During the call', 'Answer.', 6_000)
    store.finish(7_000)
    expect(store.list().map((s) => s.answerCount)).toEqual([1])
  })

  it('autosaves an in-progress session so a crash loses at most a few seconds', () => {
    vi.useFakeTimers()
    const store = new HistoryStore(dir, { saveDelayMs: 2000 })
    store.begin(1000)
    store.addTurn(turn('interviewer', 'Walk me through your project.'))
    expect(readdirSync(dir)).toEqual([])
    vi.advanceTimersByTime(2000)
    expect(new HistoryStore(dir).get('1000')).toMatchObject({ endedAt: null, turns: [{ text: 'Walk me through your project.' }] })
  })

  it('lists newest first and prunes beyond the cap', () => {
    const store = new HistoryStore(dir, { maxSessions: 2 })
    for (const start of [1000, 2000, 3000]) {
      store.begin(start)
      store.addTurn(turn('interviewer', `Question at ${start}?`))
      store.finish(start + 500)
    }
    expect(store.list().map((s) => s.id)).toEqual(['3000', '2000'])
  })

  it('stores notes and deletes sessions', () => {
    const store = new HistoryStore(dir)
    store.begin(1000)
    store.addTurn(turn('interviewer', 'Any questions for us?'))
    store.finish(2000)

    expect(store.setNotes('1000', 'Went well.')?.notes).toBe('Went well.')
    expect(store.list()[0].hasNotes).toBe(true)
    expect(store.remove('1000')).toBe(true)
    expect(store.list()).toEqual([])
  })

  it('rejects ids that are not plain session ids, so the renderer cannot reach other files', () => {
    const store = new HistoryStore(dir)
    expect(store.get('../settings')).toBeNull()
    expect(store.remove('..\\..\\x')).toBe(false)
    expect(store.setNotes('1000/../../x', 'n')).toBeNull()
  })

  it('skips corrupt files when listing', () => {
    writeFileSync(join(dir, '5000.json'), '{not json')
    expect(new HistoryStore(dir).list()).toEqual([])
  })

  it('notifies on every saved change', () => {
    const onChange = vi.fn()
    const store = new HistoryStore(dir, { onChange })
    store.begin(1000)
    store.addTurn(turn('interviewer', 'Strengths?'))
    store.finish(2000)
    store.setNotes('1000', 'ok')
    store.remove('1000')
    expect(onChange).toHaveBeenCalledTimes(3)
  })
})

describe('HistoryStore.search', () => {
  it('finds sessions by title, transcript or answer text, case-insensitively, newest first', () => {
    const store = new HistoryStore(dir)
    store.begin(1000)
    store.addTurn(turn('interviewer', 'Tell me about Kafka consumers.'))
    store.finish(1500)
    store.begin(2000)
    store.addTurn(turn('interviewer', 'Why this role?'))
    store.addAnswer('Why this role?', 'Because of the payments scale.', 2100)
    store.finish(2500)
    store.begin(3000)
    store.addTurn(turn('you', 'I tuned KAFKA lag alerts.'))
    store.finish(3500)

    expect(store.search('kafka').map((s) => s.id)).toEqual(['3000', '1000'])
    expect(store.search('payments').map((s) => s.id)).toEqual(['2000'])
    expect(store.search('  ').map((s) => s.id)).toEqual(['3000', '2000', '1000'])
    expect(store.search('nothing like this')).toEqual([])
  })
})

describe('session titles', () => {
  it('use the first answered question, not the greeting that usually opens a call', () => {
    const store = new HistoryStore(dir)
    store.begin(1000)
    store.addTurn(turn('interviewer', 'Hi, thanks for joining. Can you hear me?'))
    store.addTurn(turn('interviewer', 'What is the hardest scaling problem you have solved?'))
    store.addAnswer('What is the hardest scaling problem you have solved?', '- Partitioned the batch.', 1200)
    expect(store.finish(2000)?.title).toBe('What is the hardest scaling problem you have solved?')
  })
})

describe('session usage', () => {
  const call = (inputTokens: number, outputTokens: number, estimated = false) =>
    ({ provider: 'gemini', inputTokens, outputTokens, estimated }) as const

  it('totals audio, AI calls and tokens for a Listen session', () => {
    const store = new HistoryStore(dir)
    store.begin(1000)
    store.addAudio(30)
    store.addAudio(15.5)
    store.addTurn(turn('interviewer', 'Why Kafka?'))
    store.addAnswer('Why Kafka?', 'Throughput.', 1100, call(900, 100))
    store.addAnswer('And Flink?', 'State.', 1200, call(400, 50, true))
    store.finish(2000)
    expect(store.get('1000')?.usage).toEqual({ audioSeconds: 45.5, aiCalls: 2, tokens: 1450, estimated: true })
  })

  it('counts typed answers outside a session too, with no audio', () => {
    const store = new HistoryStore(dir)
    store.addAudio(10) // not listening: nowhere to add it
    store.addAnswer('Why us?', 'Because.', 1_000, call(300, 20))
    expect(store.get('1000')?.usage).toEqual({ audioSeconds: 0, aiCalls: 1, tokens: 320, estimated: false })
  })
})

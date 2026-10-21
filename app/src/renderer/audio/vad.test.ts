import { describe, expect, it } from 'vitest'
import type { VadSensitivity } from '../../shared/types'
import { SpeechGate } from './vad'

// Timing at the worklet's 50 ms frames: 10 pre-roll frames, 30 hangover frames, 2 attack frames.
const SILENCE: Level = [0, 0]
const MIC_SPEECH: Level = [0.1, 0]

type Level = [mic: number, system: number]

function gate(sensitivity: VadSensitivity = 'normal', enabled = true): SpeechGate {
  return new SpeechGate({ enabled, sensitivity })
}

/** Feeds frames tagged with their index; returns the indices the gate emitted, in order. */
function feed(g: SpeechGate, levels: Level[], start = 0): number[] {
  const out: number[] = []
  levels.forEach(([mic, system], i) => {
    for (const frame of g.push(Int16Array.of(start + i), mic, system)) out.push(frame[0])
  })
  return out
}

const repeat = (level: Level, n: number): Level[] => Array.from({ length: n }, () => level)
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i)

describe('SpeechGate', () => {
  it('sends nothing while both channels are silent', () => {
    const g = gate()
    expect(feed(g, repeat(SILENCE, 200))).toEqual([])
    expect(g.isOpen).toBe(false)
  })

  it('opens after two speech frames and first replays 500 ms of pre-roll, in order', () => {
    const g = gate()
    const emitted = feed(g, [...repeat(SILENCE, 20), ...repeat(MIC_SPEECH, 10)])
    // Speech starts at frame 20 and is confirmed at 21; pre-roll is the 10 frames ending there.
    expect(emitted).toEqual(range(12, 29))
    expect(g.isOpen).toBe(true)
  })

  it('opens on interviewer (system) speech alone', () => {
    expect(feed(gate(), [...repeat(SILENCE, 5), ...repeat([0, 0.1], 3)])).toEqual(range(0, 7))
  })

  it('ignores a single-frame click', () => {
    const g = gate()
    expect(feed(g, [...repeat(SILENCE, 10), [0.3, 0], ...repeat(SILENCE, 10)])).toEqual([])
    expect(g.isOpen).toBe(false)
  })

  it('keeps sending through pauses shorter than 1.5 s, so sentences stay whole', () => {
    const levels = [...repeat(MIC_SPEECH, 10), ...repeat(SILENCE, 25), ...repeat(MIC_SPEECH, 10)]
    expect(feed(gate(), levels)).toEqual(range(0, 44))
  })

  it('sends 1.5 s of trailing silence, then stops (Deepgram needs that silence to end the turn)', () => {
    const g = gate()
    const emitted = feed(g, [...repeat(MIC_SPEECH, 10), ...repeat(SILENCE, 60)])
    expect(emitted).toEqual(range(0, 39))
    expect(g.isOpen).toBe(false)
  })

  it('ignores steady background noise, yet still opens for speech over it', () => {
    const g = gate()
    expect(feed(g, repeat([0.01, 0], 200))).toEqual([])
    // Syllables over the same noise, with the noise showing through between them.
    const speech = Array.from({ length: 20 }, (_, i): Level => (i % 4 === 3 ? [0.012, 0] : [0.1, 0]))
    expect(feed(g, speech, 200).length).toBeGreaterThan(0)
    expect(g.isOpen).toBe(true)
  })

  it('stays open through a minute of continuous loud speech (the noise floor cannot climb past speech)', () => {
    const g = gate()
    feed(g, repeat(MIC_SPEECH, 2))
    feed(g, repeat([0.12, 0], 1200), 2)
    expect(g.isOpen).toBe(true)
  })

  it('stays open through a minute of moderate speech: the floor follows the dips between words, not the average', () => {
    const g = gate()
    // 0.04 RMS sits below the loud-speech cap, so only a floor taken from the 0.005 dips keeps it counting as speech.
    const speech = Array.from({ length: 1200 }, (_, i): Level => (i % 4 === 3 ? [0.005, 0] : [0.04, 0]))
    const emitted = feed(g, speech)
    expect(emitted).toEqual(range(0, 1199))
    expect(g.isOpen).toBe(true)
  })

  it('caps pre-roll at 500 ms, however long the silence before', () => {
    const emitted = feed(gate(), [...repeat(SILENCE, 100), ...repeat(MIC_SPEECH, 2)])
    expect(emitted).toEqual(range(92, 101))
  })

  it('passes every frame straight through when disabled', () => {
    expect(feed(gate('normal', false), repeat(SILENCE, 5))).toEqual(range(0, 4))
  })

  it('high sensitivity catches quiet speech that normal ignores', () => {
    const quiet = [...repeat(SILENCE, 5), ...repeat([0.003, 0], 5)]
    expect(feed(gate('high'), quiet).length).toBeGreaterThan(0)
    expect(feed(gate('normal'), quiet)).toEqual([])
  })

  it('low sensitivity ignores murmur that normal sends', () => {
    const murmur = [...repeat(SILENCE, 5), ...repeat([0.006, 0], 5)]
    expect(feed(gate('normal'), murmur).length).toBeGreaterThan(0)
    expect(feed(gate('low'), murmur)).toEqual([])
  })
})

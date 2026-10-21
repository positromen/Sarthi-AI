import { describe, expect, it } from 'vitest'
import { concatInt16, floatToInt16, interleaveStereoInt16, rmsLevel } from './pcm'

describe('concatInt16', () => {
  it('joins frames in order into one buffer', () => {
    expect([...concatInt16([Int16Array.of(1, 2), Int16Array.of(3), Int16Array.of(4, 5)])]).toEqual([1, 2, 3, 4, 5])
  })

  it('returns an empty array for no frames', () => {
    expect(concatInt16([]).length).toBe(0)
  })
})

describe('floatToInt16', () => {
  it('maps the float range onto the full Int16 range', () => {
    expect(floatToInt16(0)).toBe(0)
    expect(floatToInt16(1)).toBe(32767)
    expect(floatToInt16(-1)).toBe(-32768)
  })

  it('clamps out-of-range samples', () => {
    expect(floatToInt16(1.5)).toBe(32767)
    expect(floatToInt16(-3)).toBe(-32768)
  })
})

describe('interleaveStereoInt16', () => {
  it('writes mic to the left (even) and system audio to the right (odd) slots', () => {
    const out = interleaveStereoInt16(new Float32Array([1, 0]), new Float32Array([-1, 0.5]))
    expect([...out]).toEqual([32767, -32768, 0, 16384])
  })

  it('fills a missing channel with silence', () => {
    const out = interleaveStereoInt16(undefined, new Float32Array([1, 1]))
    expect([...out]).toEqual([0, 32767, 0, 32767])
  })

  it('produces the byte length Deepgram expects for 50 ms at 16 kHz', () => {
    const frame = new Float32Array(800)
    expect(interleaveStereoInt16(frame, frame).buffer.byteLength).toBe(800 * 2 * 2)
  })
})

describe('rmsLevel', () => {
  it('is zero for silence or no input', () => {
    expect(rmsLevel(new Float32Array(4))).toBe(0)
    expect(rmsLevel(undefined)).toBe(0)
  })

  it('equals the amplitude of a constant signal', () => {
    expect(rmsLevel(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5)
  })
})

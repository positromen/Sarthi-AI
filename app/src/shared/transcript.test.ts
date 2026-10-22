import { describe, expect, it } from 'vitest'
import { insertByTime, isEcho } from './transcript'
import type { TranscriptTurn } from './types'

let id = 1
const said = (speaker: TranscriptTurn['speaker'], text: string, at: number): TranscriptTurn => ({ id: id++, speaker, text, at })

describe('isEcho', () => {
  it('drops my line when it repeats what the interviewer said moments before or after (speakers into the mic)', () => {
    expect(isEcho(said('you', 'Okay. So as you are ready.', 50_200), [said('interviewer', 'Okay. So as you are ready,', 51_600)])).toBe(true)
    expect(isEcho(said('you', 'Introduce yourself.', 3_000), [said('interviewer', 'Introduce yourself.', 4_500)])).toBe(true)
  })

  it('matches an interviewer line that transcription split into pieces', () => {
    const interviewer = [said('interviewer', 'Tell me better what', 16_000), said('interviewer', 'exactly you are looking for.', 17_700)]
    expect(isEcho(said('you', 'Tell me better what exactly you are looking for.', 16_400), interviewer)).toBe(true)
  })

  it('keeps my real answer, even when it repeats a word or two of the question', () => {
    const interviewer = [said('interviewer', 'Introduce yourself.', 4_500)]
    expect(isEcho(said('you', 'Sure, so you want me to introduce myself.', 6_000), interviewer)).toBe(false)
  })

  it('keeps the same words when they were said well apart in time', () => {
    expect(isEcho(said('you', 'Hello?', 61_100), [said('interviewer', 'Hello?', 41_700)])).toBe(false)
  })

  it('works for Hindi in Devanagari', () => {
    expect(isEcho(said('you', 'आप हमारी कंपनी क्यों जॉइन करना चाहते हैं?', 10_000), [said('interviewer', 'आप हमारी कंपनी क्यों जॉइन करना चाहते हैं', 11_000)])).toBe(true)
  })

  it('never treats my line as echo when the interviewer said nothing', () => {
    expect(isEcho(said('you', 'I built the reconciliation service.', 10_000), [])).toBe(false)
  })
})

describe('insertByTime', () => {
  it('places a line that was held back at its spoken time, not at the end', () => {
    const a = said('interviewer', 'Question one?', 1_000)
    const b = said('interviewer', 'Question two?', 5_000)
    const late = said('you', 'My answer.', 3_000)
    expect(insertByTime([a, b], late).map((t) => t.text)).toEqual(['Question one?', 'My answer.', 'Question two?'])
    expect(insertByTime([a], b).map((t) => t.text)).toEqual(['Question one?', 'Question two?'])
  })
})

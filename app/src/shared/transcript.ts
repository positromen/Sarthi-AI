// Transcript rules shared by main (session, history) and the overlay.
import type { TranscriptTurn } from './types'

/** How long main holds one of my lines before showing it, so the interviewer's copy of an echo can arrive. */
export const ECHO_HOLD_MS = 3000
/** Interviewer lines this close in time to mine are compared with it. */
export const ECHO_WINDOW_MS = 8000
// Share of my words that must appear in the interviewer's nearby lines. High enough that answering in my own words
// (which reuses a word or two of the question) never counts.
const ECHO_SHARE = 0.6

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

/**
 * Whether my line is really the interviewer's voice: without headphones the mic picks up the call from the speakers,
 * so their words reach my channel too, sometimes before their own channel finalizes and sometimes split differently.
 */
export function isEcho(mine: TranscriptTurn, interviewer: readonly TranscriptTurn[], windowMs = ECHO_WINDOW_MS): boolean {
  const mineWords = words(mine.text)
  if (mineWords.length === 0) return false
  const nearby = new Set(
    interviewer.filter((turn) => Math.abs(turn.at - mine.at) <= windowMs).flatMap((turn) => words(turn.text))
  )
  if (nearby.size === 0) return false
  const shared = mineWords.filter((word) => nearby.has(word)).length
  return shared / mineWords.length >= ECHO_SHARE
}

/** Inserts a turn in spoken-time order (a held line can arrive after a later one). */
export function insertByTime(turns: readonly TranscriptTurn[], turn: TranscriptTurn): TranscriptTurn[] {
  const index = turns.findIndex((other) => other.at > turn.at)
  return index === -1 ? [...turns, turn] : [...turns.slice(0, index), turn, ...turns.slice(index)]
}

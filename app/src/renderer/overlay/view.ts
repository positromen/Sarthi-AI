// Pure view logic for the overlay, kept out of the components so it can be unit-tested.
import { REQUIRED_KEYS, type ApiKeyName, type ApiKeyStatus, type ListeningStatus } from '../../shared/types'
import type { ShortcutAction } from '../shortcuts'

/** Required keys not yet saved. Null status (still loading) counts as complete so "Finish setup" never flashes. */
export function missingKeys(status: ApiKeyStatus | null): ApiKeyName[] {
  if (!status) return []
  return REQUIRED_KEYS.filter((name) => !status[name])
}

const TURN_OPACITY = [1, 0.8, 0.62, 0.48, 0.4]

/** Opacity for a transcript line `fromEnd` lines before the newest. */
export const turnOpacity = (fromEnd: number): number => TURN_OPACITY[Math.min(fromEnd, TURN_OPACITY.length - 1)]

export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

export interface EmptyPrompt {
  text: string
  /** Shortcut shown as keycaps after the text, if any. */
  keys: ShortcutAction | null
  tail?: string
}

/** What the answer area says before there is an answer. */
export function emptyPrompt(status: ListeningStatus, autoAnswer: boolean): EmptyPrompt {
  switch (status) {
    case 'idle':
      return {
        text: 'Press Listen',
        keys: 'toggle-listening',
        tail: 'to start. Sarthi transcribes both sides and answers the interviewer’s questions.'
      }
    case 'connecting':
      return { text: 'Connecting to Deepgram…', keys: null }
    case 'error':
      return { text: 'Listening stopped. Fix the issue above, then press Listen.', keys: null }
    case 'listening':
      return autoAnswer
        ? { text: 'Waiting for a question. Answer now with', keys: 'answer' }
        : { text: 'Auto-answer is off. Answer the last question with', keys: 'answer' }
  }
}

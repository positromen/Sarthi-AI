import type { SessionRecord } from '../shared/types'
import { streamGemini } from './gemini'
import { getHistory } from './history'
import { getKey } from './keys'
import { buildNotesPrompt } from './prompt'
import { getSettings } from './store'

// Four sections of bullets over a whole call need more room than a single answer.
const NOTES_MAX_TOKENS = 2048

/** Generates post-call coaching notes for a saved session, stores them with it, and returns the updated record. */
export async function generateNotes(id: string): Promise<SessionRecord> {
  const history = getHistory()
  const record = history?.get(id)
  if (!history || !record) throw new Error('That session is no longer in history.')
  if (record.turns.length === 0) throw new Error('This session has no transcript to review.')
  const apiKey = getKey('gemini')
  if (!apiKey) throw new Error('Add your Gemini key in Settings first.')

  const { system, user } = buildNotesPrompt(record.turns, getSettings())
  let text = ''
  for await (const delta of streamGemini({ apiKey, system, user, maxOutputTokens: NOTES_MAX_TOKENS })) text += delta
  if (!text.trim()) throw new Error('Gemini returned empty notes. Try again.')
  return history.setNotes(id, text.trim())!
}

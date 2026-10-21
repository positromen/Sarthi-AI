import type { SessionRecord } from '../shared/types'
import { getHistory } from './history'
import { getKey } from './keys'
import { streamAnswer } from './llm'
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

  const settings = getSettings()
  const { system, user } = buildNotesPrompt(record.turns, settings)
  let text = ''
  const request = { provider: settings.llmProvider, system, user, maxOutputTokens: NOTES_MAX_TOKENS }
  for await (const delta of streamAnswer(request, getKey)) text += delta
  if (!text.trim()) throw new Error('The AI returned empty notes. Try again.')
  return history.setNotes(id, text.trim())!
}

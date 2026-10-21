import { IPC } from '../shared/ipc'
import type { SessionState, TranscriptTurn } from '../shared/types'
import { generateAnswer } from './answer'
import { DeepgramStream } from './deepgram'
import { getHistory } from './history'
import { getKey } from './keys'
import { isQuestion } from './question'
import { getSettings } from './store'
import { broadcast } from './windows'

let stream: DeepgramStream | null = null
let turns: TranscriptTurn[] = []
let nextTurnId = 1
let state: SessionState = { status: 'idle' }

function setState(next: SessionState): SessionState {
  state = next
  broadcast(IPC.sessionState, state)
  return state
}

export function getSessionState(): SessionState {
  return state
}

export function getTurns(): readonly TranscriptTurn[] {
  return turns
}

export function startSession(): SessionState {
  if (stream) return state
  const apiKey = getKey('deepgram')
  if (!apiKey) return setState({ status: 'error', error: 'Add your Deepgram key in Settings (Ctrl+Shift+S)' })

  turns = []
  getHistory()?.begin()
  const current = new DeepgramStream()
  stream = current
  stream.on('open', () => setState({ status: 'listening' }))
  stream.on('interim', (speaker, text) => broadcast(IPC.transcriptInterim, { speaker, text }))
  stream.on('turn', (speaker, text) => {
    const turn: TranscriptTurn = { id: nextTurnId++, speaker, text, at: Date.now() }
    turns.push(turn)
    getHistory()?.addTurn(turn)
    broadcast(IPC.transcriptTurn, turn)
    if (speaker === 'interviewer' && getSettings().autoAnswer && isQuestion(text)) {
      void generateAnswer(text, turns)
    }
  })
  stream.on('error', (message) => setState({ status: 'error', error: message }))
  stream.on('close', () => {
    // A quick stop/start can leave an old stream closing after a new one started.
    if (stream !== current) return
    stream = null
    getHistory()?.finish()
    if (state.status !== 'error') setState({ status: 'idle' })
  })
  stream.connect(apiKey, getSettings().listeningLanguage)
  return setState({ status: 'connecting' })
}

export function stopSession(): SessionState {
  stream?.close()
  return state
}

export function pushAudioFrame(frame: ArrayBuffer): void {
  stream?.send(frame)
}

/**
 * Manually answer a typed question, or else the most recent interviewer question (the Ctrl+Shift+Enter hotkey).
 * Typing is the fallback when transcription misses or mangles a question.
 */
export function requestManualAnswer(typed?: string): void {
  const question = typed?.trim() || [...turns].reverse().find((turn) => turn.speaker === 'interviewer')?.text
  void generateAnswer(question ?? '', turns)
}

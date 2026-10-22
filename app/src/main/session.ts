import { IPC } from '../shared/ipc'
import { ECHO_HOLD_MS, insertByTime, isEcho } from '../shared/transcript'
import type { SessionState, TranscriptTurn } from '../shared/types'
import { generateAnswer } from './answer'
import { CHANNELS, DeepgramStream, SAMPLE_RATE } from './deepgram'
import { getHistory } from './history'
import { getKey } from './keys'
import { isQuestion } from './question'
import { getSettings } from './store'
import { getUsage } from './usage'
import { broadcast } from './windows'

let stream: DeepgramStream | null = null
let turns: TranscriptTurn[] = []
let nextTurnId = 1
let state: SessionState = { status: 'idle' }
// My lines wait here for ECHO_HOLD_MS before they are shown, in case they are the interviewer heard through speakers.
const held = new Map<TranscriptTurn, NodeJS.Timeout>()

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
    if (speaker === 'you') {
      held.set(turn, setTimeout(() => release(turn), ECHO_HOLD_MS))
      return
    }
    commit(turn)
    if (getSettings().autoAnswer && isQuestion(text)) void generateAnswer(text, turns)
  })
  stream.on('error', (message) => setState({ status: 'error', error: message }))
  stream.on('close', () => {
    // A quick stop/start can leave an old stream closing after a new one started.
    if (stream !== current) return
    stream = null
    for (const turn of [...held.keys()]) release(turn)
    getHistory()?.finish()
    if (state.status !== 'error') setState({ status: 'idle' })
  })
  stream.connect(apiKey, getSettings().listeningLanguage)
  return setState({ status: 'connecting' })
}

function commit(turn: TranscriptTurn): void {
  turns = insertByTime(turns, turn)
  getHistory()?.addTurn(turn)
  broadcast(IPC.transcriptTurn, turn)
}

/** Shows a held line of mine, unless the interviewer said the same thing around then (echo). */
function release(turn: TranscriptTurn): void {
  const timer = held.get(turn)
  if (!timer) return
  clearTimeout(timer)
  held.delete(turn)
  if (!isEcho(turn, turns.filter((t) => t.speaker === 'interviewer'))) commit(turn)
}

export function stopSession(): SessionState {
  stream?.close()
  return state
}

// Frames are 16-bit samples.
const BYTES_PER_SECOND = SAMPLE_RATE * CHANNELS * 2

export function pushAudioFrame(frame: ArrayBuffer): void {
  if (!stream?.send(frame)) return
  const seconds = frame.byteLength / BYTES_PER_SECOND
  getUsage()?.addAudio(seconds)
  getHistory()?.addAudio(seconds)
}

/**
 * Manually answer a typed question, or else the most recent interviewer question (the Ctrl+Shift+Enter hotkey).
 * Typing is the fallback when transcription misses or mangles a question.
 */
export function requestManualAnswer(typed?: string): void {
  const question = typed?.trim() || [...turns].reverse().find((turn) => turn.speaker === 'interviewer')?.text
  void generateAnswer(question ?? '', turns)
}

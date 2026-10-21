import { IPC } from '../shared/ipc'
import type { AnswerState, TranscriptTurn } from '../shared/types'
import { streamGemini } from './gemini'
import { getKey } from './keys'
import { buildSystemPrompt, buildUserPrompt } from './prompt'
import { getSettings } from './store'
import { broadcast } from './windows'

let state: AnswerState = { status: 'idle', text: '', question: null }
// A monotonically increasing token: a newer question supersedes any answer still streaming.
let generation = 0
let controller: AbortController | null = null

function setState(next: AnswerState): void {
  state = next
  broadcast(IPC.answerState, state)
}

export function getAnswerState(): AnswerState {
  return state
}

export async function generateAnswer(question: string, context: readonly TranscriptTurn[]): Promise<void> {
  const q = question.trim()
  if (!q) {
    setState({ status: 'error', text: '', question: null, error: 'No interviewer question yet — start listening first.' })
    return
  }

  const apiKey = getKey('gemini')
  if (!apiKey) {
    setState({ status: 'error', text: '', question: q, error: 'Add your Gemini key in Settings (Ctrl+Shift+S).' })
    return
  }

  controller?.abort()
  const ctrl = new AbortController()
  controller = ctrl
  const mine = ++generation
  const superseded = (): boolean => mine !== generation

  setState({ status: 'thinking', text: '', question: q })
  const settings = getSettings()
  try {
    let text = ''
    for await (const delta of streamGemini({
      apiKey,
      system: buildSystemPrompt(settings),
      user: buildUserPrompt(q, context),
      signal: ctrl.signal
    })) {
      if (superseded()) return
      text += delta
      setState({ status: 'streaming', text, question: q })
    }
    if (superseded()) return
    setState({ status: 'done', text, question: q })
  } catch (error) {
    if (ctrl.signal.aborted || superseded()) return
    setState({ status: 'error', text: '', question: q, error: (error as Error).message })
  } finally {
    if (controller === ctrl) controller = null
  }
}

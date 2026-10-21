import { IPC } from '../shared/ipc'
import type { AnswerState, TranscriptTurn } from '../shared/types'
import { getHistory } from './history'
import { getKey } from './keys'
import { streamAnswer } from './llm'
import { buildSystemPrompt, buildUserPrompt } from './prompt'
import { getScreenshotImages } from './screenshot'
import { getSettings } from './store'
import { broadcast } from './windows'

// Used for a manual answer when nobody has asked anything yet but there is something on screen to solve.
const SCREEN_QUESTION = 'Solve or answer what is shown in the screenshots.'

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
  // Screenshots taken earlier stay in the strip, but are only sent while the setting allows them.
  const images = getSettings().screenshotsEnabled ? getScreenshotImages() : []
  const q = question.trim() || (images.length > 0 ? SCREEN_QUESTION : '')
  if (!q) {
    setState({ status: 'error', text: '', question: null, error: 'No interviewer question yet — start listening, or take a screenshot (Ctrl+Shift+C).' })
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
    const request = {
      provider: settings.llmProvider,
      system: buildSystemPrompt(settings, q, images.length),
      user: buildUserPrompt(q, context, { screenshots: images.length, outputLanguage: settings.outputLanguage }),
      images,
      signal: ctrl.signal
    }
    // A missing key surfaces as the error state below, naming which keys to add.
    for await (const delta of streamAnswer(request, getKey)) {
      if (superseded()) return
      text += delta
      setState({ status: 'streaming', text, question: q })
    }
    if (superseded()) return
    setState({ status: 'done', text, question: q })
    getHistory()?.addAnswer(q, text)
  } catch (error) {
    if (ctrl.signal.aborted || superseded()) return
    setState({ status: 'error', text: '', question: q, error: (error as Error).message })
  } finally {
    if (controller === ctrl) controller = null
  }
}

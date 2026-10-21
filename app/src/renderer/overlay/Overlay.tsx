import { useEffect, useRef } from 'react'
import type { Speaker } from '../../shared/types'
import { useSettings } from '../useSettings'
import { useAnswer } from './useAnswer'
import { useListening } from './useListening'
import { useScreenshots } from './useScreenshots'

const SCROLL_STEP = 120

const SPEAKER_LABEL: Record<Speaker, string> = { you: 'You', interviewer: 'Interviewer' }
const SPEAKER_COLOR: Record<Speaker, string> = { you: 'text-sky-300', interviewer: 'text-leaf' }

const STATUS_STYLE = {
  idle: 'bg-ink text-white/60',
  connecting: 'bg-amber-400/15 text-amber-300',
  listening: 'bg-leaf/15 text-leaf',
  error: 'bg-red-500/15 text-red-300'
} as const

function LevelMeter({ label, level }: { label: string; level: number }) {
  // RMS of speech is small; scale so normal talking fills most of the bar.
  const width = Math.min(100, Math.round(level * 400))
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-white/45">
      <span className="w-14">{label}</span>
      <div className="h-1 w-16 overflow-hidden rounded bg-white/10">
        <div className="h-full bg-leaf transition-[width] duration-75" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

export function Overlay() {
  const [settings] = useSettings()
  const listening = useListening()
  const { answer, generate } = useAnswer()
  const screenshots = useScreenshots()
  const answerRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef(listening.toggle)
  toggleRef.current = listening.toggle
  const generateRef = useRef(generate)
  generateRef.current = generate

  useEffect(
    () =>
      window.sarthi.onHotkey((key) => {
        if (key === 'scroll-up') answerRef.current?.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' })
        else if (key === 'scroll-down') answerRef.current?.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' })
        else if (key === 'toggle-listening') void toggleRef.current()
        else if (key === 'answer') void generateRef.current()
      }),
    []
  )

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight })
  }, [listening.turns, listening.interim])

  // Follow the answer as it streams in, unless the user has scrolled up to re-read.
  useEffect(() => {
    if (answer.status === 'streaming' || answer.status === 'thinking') {
      answerRef.current?.scrollTo({ top: answerRef.current.scrollHeight })
    }
  }, [answer.text, answer.status])

  // The window ignores the mouse except while the pointer is over the card.
  const interactive = {
    onMouseEnter: () => window.sarthi.setOverlayInteractive(true),
    onMouseLeave: () => window.sarthi.setOverlayInteractive(false)
  }
  const { session, turns, interim, levels, active } = listening

  return (
    <div className="flex h-full flex-col p-2">
      <div
        {...interactive}
        className="flex max-h-full flex-col overflow-hidden rounded-xl border border-line bg-panel text-[#e7efe9] shadow-2xl"
        style={{ opacity: settings?.overlayOpacity ?? 0.92 }}
      >
        <header className="flex items-center justify-between border-b border-line px-3 py-2 text-xs">
          <span className="font-semibold tracking-wide text-leaf">Sarthi AI</span>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLE[session.status]}`}>
              {session.status}
            </span>
            {settings?.privateMode && (
              <span className="rounded-full bg-leaf/15 px-2 py-0.5 text-[11px] text-leaf">private</span>
            )}
            <button
              className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                active ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30' : 'bg-leaf/20 text-leaf hover:bg-leaf/30'
              }`}
              onClick={() => void listening.toggle()}
              title="Start/stop listening (Ctrl+Shift+L)"
            >
              {active ? 'Stop' : 'Listen'}
            </button>
            <button
              className="rounded px-2 py-0.5 text-[11px] font-medium text-white/60 hover:bg-white/10 hover:text-white"
              onClick={screenshots.capture}
              title="Screenshot the screen for the next answer (Ctrl+Shift+C)"
            >
              Shot
            </button>
            <button
              className="rounded px-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => window.sarthi.openSettings()}
              title="Settings (Ctrl+Shift+S)"
            >
              ⚙
            </button>
          </div>
        </header>

        {session.error && (
          <div className="border-b border-line bg-red-500/10 px-3 py-1.5 text-xs text-red-200">{session.error}</div>
        )}

        {active && (
          <div className="flex gap-4 border-b border-line px-3 py-1.5">
            <LevelMeter label="You (mic)" level={levels.mic} />
            <LevelMeter label="Interviewer" level={levels.system} />
          </div>
        )}

        {screenshots.shots.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line px-3 py-1.5">
            {screenshots.shots.map((shot) => (
              <div key={shot.id} className="group relative shrink-0">
                <img src={shot.thumbnail} alt="Screenshot" className="h-12 rounded border border-line" />
                <button
                  className="absolute top-0.5 right-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-black/80 text-[10px] text-white/80 group-hover:flex hover:text-white"
                  onClick={() => screenshots.remove(shot.id)}
                  title="Remove screenshot"
                >
                  ×
                </button>
              </div>
            ))}
            <span className="shrink-0 text-[10px] text-white/40">sent with each answer</span>
          </div>
        )}

        <section ref={transcriptRef} className="max-h-44 space-y-1 overflow-y-auto border-b border-line px-3 py-2 text-xs">
          {turns.length === 0 && !interim.you && !interim.interviewer && (
            <p className="text-white/40">
              {active ? 'Listening…' : 'Press Listen (Ctrl+Shift+L) to start transcribing.'}
            </p>
          )}
          {turns.map((turn) => (
            <p key={turn.id}>
              <span className={`font-semibold ${SPEAKER_COLOR[turn.speaker]}`}>{SPEAKER_LABEL[turn.speaker]}: </span>
              {turn.text}
            </p>
          ))}
          {(['interviewer', 'you'] as const).map(
            (speaker) =>
              interim[speaker] && (
                <p key={speaker} className="text-white/50 italic">
                  <span className={`font-semibold not-italic ${SPEAKER_COLOR[speaker]}`}>{SPEAKER_LABEL[speaker]}: </span>
                  {interim[speaker]}
                </p>
              )
          )}
        </section>

        <div ref={answerRef} className="max-h-60 min-h-24 overflow-y-auto px-3 py-3 text-sm leading-relaxed">
          {answer.question && answer.status !== 'idle' && (
            <p className="mb-1.5 text-[11px] text-white/40 italic">Q: {answer.question}</p>
          )}
          {answer.status === 'error' ? (
            <span className="text-red-300">{answer.error}</span>
          ) : answer.status === 'thinking' ? (
            <span className="text-white/50">Thinking…</span>
          ) : answer.text ? (
            <p className="whitespace-pre-wrap">{answer.text}</p>
          ) : (
            <span className="text-white/40">
              Press Ctrl+Shift+Enter for an answer{settings?.autoAnswer ? ', or wait for a question.' : '.'}
            </span>
          )}
        </div>

        <footer className="border-t border-line px-3 py-1.5 text-[10px] text-white/35">
          Ctrl+Shift+L listen · Ctrl+Shift+Enter answer · Ctrl+Shift+C screenshot · Ctrl+Shift+H hide · Ctrl+Shift+P private · Ctrl+Alt+Arrows move
        </footer>
      </div>
    </div>
  )
}

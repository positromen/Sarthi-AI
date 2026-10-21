// The overlay card's sections (Sarthi UI design, states A1–A16). Everything clickable lives inside the card: the
// window ignores the mouse elsewhere, so nothing here may float outside it.
import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'
import type { AnswerState, ApiKeyName, ListeningStatus, ScreenshotInfo, Speaker, TranscriptTurn } from '../../shared/types'
import type { AudioLevels } from '../audio/capture'
import { keysFor, shortcutLabel, shortcuts } from '../shortcuts'
import { Banner, Button, IconButton, Keys, LevelMeter, Pill } from '../ui/components'
import { Icon, Logo, StopIcon } from '../ui/icons'
import { AnswerContent } from './AnswerContent'
import { emptyPrompt, formatElapsed, turnOpacity } from './view'

const PILL_LABEL: Record<ListeningStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  listening: 'Listening',
  error: 'Error'
}

// ── Header ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export function Header({
  status,
  privateMode,
  setupNeeded,
  active,
  sheetOpen,
  screenshotsAllowed,
  onToggleListen,
  onScreenshot,
  onSettings,
  onCompact,
  onToggleSheet
}: {
  status: ListeningStatus
  privateMode: boolean
  setupNeeded: boolean
  active: boolean
  sheetOpen: boolean
  screenshotsAllowed: boolean
  onToggleListen: () => void
  onScreenshot: () => void
  onSettings: () => void
  onCompact: () => void
  onToggleSheet: () => void
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line pr-2 pl-3">
      <Logo size={16} />
      <span className="text-[13px] font-semibold tracking-[.01em]">Sarthi</span>
      <span className="ml-1">
        <Pill tone={status}>{PILL_LABEL[status]}</Pill>
      </span>
      {privateMode ? (
        <span title="Hidden from screen share" className="inline-flex items-center gap-1 text-[11px] text-fg-3">
          <Icon name="private" size={12} />
          Private
        </span>
      ) : (
        <span className="inline-flex h-5 items-center gap-1 rounded-[10px] bg-warn/12 px-[7px] text-[11px] font-medium text-warn">
          <Icon name="visible" size={12} />
          Visible
        </span>
      )}
      <span className="flex-1" />
      {active ? (
        <button
          type="button"
          onClick={onToggleListen}
          title={`Stop listening (${shortcutLabel('toggle-listening')})`}
          className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-danger-solid/28 bg-danger-solid/12 pr-[11px] pl-[9px] text-xs font-semibold whitespace-nowrap text-danger transition-colors duration-120 hover:bg-danger-solid/20 focus-ring-danger"
        >
          <StopIcon />
          Stop
        </button>
      ) : (
        <Button
          variant="primary"
          size={28}
          icon="mic"
          disabled={setupNeeded}
          onClick={onToggleListen}
          title={setupNeeded ? 'Finish setup first' : `Start listening (${shortcutLabel('toggle-listening')})`}
          className="pr-[11px] pl-[9px]"
        >
          Listen
        </Button>
      )}
      <IconButton
        icon="camera"
        label={screenshotsAllowed ? `Screenshot · ${shortcutLabel('screenshot')}` : 'Screenshots are off in Settings'}
        disabled={!screenshotsAllowed}
        onClick={onScreenshot}
      />
      <IconButton icon="collapse" label="Compact view" onClick={onCompact} />
      <IconButton icon="settings" label={`Settings · ${shortcutLabel('open-settings')}`} onClick={onSettings} />
      <IconButton icon="help" label="Shortcuts" active={sheetOpen} onClick={onToggleSheet} />
    </div>
  )
}

/** Answer-only header (A15): the question on one line, a live dot, and a way back to the full card. */
export function CompactHeader({ status, question, onExpand }: { status: ListeningStatus; question: string | null; onExpand: () => void }) {
  const dot = { idle: 'bg-fg-3', connecting: 'bg-warn', listening: 'bg-leaf', error: 'bg-danger' }[status]
  return (
    <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-hover pr-1.5 pl-3">
      <Logo size={14} />
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} title={PILL_LABEL[status]} />
      <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{question ? `Q · ${question}` : 'Waiting for a question'}</span>
      <IconButton icon="expand" label="Full view" size={26} onClick={onExpand} />
    </div>
  )
}

// ── Banners ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function VisibleStrip({ onHide }: { onHide: () => void }) {
  return (
    <Banner
      tone="warn"
      icon="visible"
      className="border-b py-[7px] pr-2.5"
      action={
        <button
          type="button"
          onClick={onHide}
          className="inline-flex h-6 items-center gap-1.5 rounded-sm bg-warn/14 px-2 text-[11.5px] font-semibold whitespace-nowrap text-warn-soft hover:bg-warn/22 focus-ring"
        >
          Hide it <Keys keys={keysFor('toggle-private')} tone="warn" />
        </button>
      }
    >
      This window is visible to screen share.
    </Banner>
  )
}

export function SessionErrorBanner({ message, onOpenSettings }: { message: string; onOpenSettings: () => void }) {
  return (
    <Banner
      tone="error"
      icon="warning"
      className="border-b pr-2.5"
      action={
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex h-6 items-center rounded-sm bg-danger-solid/14 px-[9px] text-[11.5px] font-semibold whitespace-nowrap text-danger-soft hover:bg-danger-solid/22 focus-ring-danger"
        >
          Open Settings
        </button>
      }
    >
      {message}
    </Banner>
  )
}

// ── Setup (A1) ──────────────────────────────────────────────────────────────────────────────────────────────────────

const KEY_LABEL: Partial<Record<ApiKeyName, string>> = { deepgram: 'Deepgram key', gemini: 'Gemini key', groq: 'Groq key' }

export function SetupCard({ missing, onOpenSetup }: { missing: ApiKeyName[]; onOpenSetup: () => void }) {
  return (
    <div className="flex flex-col gap-3.5 px-5 pt-[22px] pb-5">
      <div className="flex flex-col gap-1.5">
        <div className="text-[15px] font-semibold">Finish setup to start</div>
        <div className="text-[13px] leading-normal text-pretty text-fg-2">
          Sarthi needs a Deepgram key to transcribe the call, and Gemini and Groq keys to write answers. All three are free
          to create and stay encrypted on this PC.
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-line">
        {(['deepgram', 'gemini', 'groq'] as const).map((name, i) => {
          const saved = !missing.includes(name)
          return (
            <div key={name} className={`flex items-center gap-2.5 px-3 py-[9px] text-[12.5px] ${i > 0 ? 'border-t border-line' : ''}`}>
              {saved ? (
                <span className="flex size-4 items-center justify-center rounded-full bg-leaf/15 text-leaf">
                  <Icon name="check" size={11} strokeWidth={2.5} />
                </span>
              ) : (
                <span className="size-4 rounded-full border-[1.5px] border-dashed border-[#4a5a4f]" />
              )}
              <span className="flex-1">{KEY_LABEL[name]}</span>
              <span className={`text-[11.5px] whitespace-nowrap ${saved ? 'text-leaf' : 'text-fg-3'}`}>{saved ? 'Saved' : 'Not set'}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2.5">
        <Button variant="primary" iconRight="arrowRight" onClick={onOpenSetup}>
          Open Setup
        </Button>
        <Keys keys={keysFor('open-settings')} />
      </div>
    </div>
  )
}

// ── Meters, screenshots, transcript ────────────────────────────────────────────────────────────────────────────────

export function Meters({ levels, showSending }: { levels: AudioLevels; showSending: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-5 border-b border-hover px-3 py-2 animate-fade-in">
      <div className="flex items-center gap-[7px] text-[11px] text-fg-muted">
        <Icon name="mic" size={12} />
        You
        <LevelMeter level={levels.mic} tone="you" />
      </div>
      <div className="flex items-center gap-[7px] text-[11px] text-fg-muted">
        <Icon name="systemAudio" size={12} />
        Interviewer
        <LevelMeter level={levels.system} tone="interviewer" />
      </div>
      {showSending && (
        <span
          className={`ml-auto text-[10px] ${levels.sending ? 'text-leaf' : 'text-fg-3'}`}
          title="Audio goes to Deepgram only around speech (Settings → Privacy & overlay → Skip silence)"
        >
          {levels.sending ? '● sending' : '○ silence skipped'}
        </span>
      )}
    </div>
  )
}

export function ShotStrip({ shots, onRemove }: { shots: ScreenshotInfo[]; onRemove: (id: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-hover px-3 py-2 animate-fade-in">
      {shots.map((shot) => (
        <div key={shot.id} className="group relative h-12 w-[78px] shrink-0 overflow-hidden rounded-[5px] border border-line-strong hover:border-[#4a5a4f]">
          <img src={shot.thumbnail} alt="Screenshot" className="size-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(shot.id)}
            title="Remove screenshot"
            aria-label="Remove screenshot"
            className="absolute top-[3px] right-[3px] hidden size-4 items-center justify-center rounded-full bg-black/80 text-fg group-hover:flex focus-visible:flex focus-ring"
          >
            <Icon name="close" size={10} strokeWidth={2.5} />
          </button>
        </div>
      ))}
      <div className="ml-1 flex flex-col gap-px text-[11px] leading-[1.35]">
        <span className="text-fg-2">{shots.length} of 5</span>
        <span className="text-fg-3">Sent with each answer</span>
      </div>
    </div>
  )
}

const SPEAKER: Record<Speaker, { label: string; color: string }> = {
  you: { label: 'You', color: 'text-you' },
  interviewer: { label: 'Interviewer', color: 'text-leaf' }
}

const VISIBLE_TURNS = 12

export function Transcript({ turns, interim }: { turns: TranscriptTurn[]; interim: Partial<Record<Speaker, string>> }) {
  const ref = useRef<HTMLDivElement>(null)
  const lines: { key: string; speaker: Speaker; text: string; interim: boolean }[] = [
    ...turns.slice(-VISIBLE_TURNS).map((t) => ({ key: `t${t.id}`, speaker: t.speaker, text: t.text, interim: false })),
    ...(['interviewer', 'you'] as const)
      .filter((speaker) => interim[speaker])
      .map((speaker) => ({ key: `i-${speaker}`, speaker, text: `${interim[speaker]}…`, interim: true }))
  ]

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [turns, interim])

  return (
    <div
      ref={ref}
      className="flex max-h-[170px] shrink-0 flex-col gap-[5px] overflow-y-auto border-b border-line px-3 py-2.5 [scrollbar-width:none]"
    >
      {lines.length === 0 && <div className="text-[12.5px] text-fg-3">Listening…</div>}
      {lines.map((line, i) => (
        <div
          key={line.key}
          className="grid grid-cols-[78px_minmax(0,1fr)] gap-2 text-[12.5px] leading-[1.45] transition-opacity duration-200 animate-fade-in"
          style={{ opacity: turnOpacity(lines.length - 1 - i) }}
        >
          <span className={`pt-0.5 text-[10.5px] font-semibold tracking-[.05em] uppercase ${SPEAKER[line.speaker].color}`}>
            {SPEAKER[line.speaker].label}
          </span>
          <span className={line.interim ? 'text-fg-muted italic' : 'text-fg-soft'}>{line.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Answer area (A2–A13) ────────────────────────────────────────────────────────────────────────────────────────────

/** Milliseconds since the calling component mounted, ticking each second (Thinking mounts when an answer starts). */
function useElapsed(): number {
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(start)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now - start
}

function Thinking({ provider }: { provider: string }) {
  const elapsed = useElapsed()
  return (
    <div className="flex flex-col gap-2" role="status">
      <div className="relative mt-1 h-0.5 overflow-hidden rounded-[1px] bg-white/7">
        <div className="absolute inset-y-0 left-[30%] w-[28%] animate-sweep bg-linear-to-r from-leaf/0 via-leaf to-leaf/0" />
      </div>
      <div className="flex items-baseline justify-between text-[13px] text-fg-soft">
        <span>Thinking…</span>
        <span className="text-[13px] font-semibold text-fg tabular-nums">{formatElapsed(elapsed)}</span>
      </div>
      <div className="text-[11.5px] leading-[1.45] text-pretty text-fg-3">
        {provider === 'groq'
          ? 'Groq usually starts within a couple of seconds.'
          : 'The free tier can take up to a minute to start. Once it does, the answer arrives in a couple of seconds.'}
      </div>
    </div>
  )
}

export function AnswerArea({
  answer,
  status,
  autoAnswer,
  provider,
  compact,
  scrollRef,
  onRetry,
  onReanswer
}: {
  answer: AnswerState
  status: ListeningStatus
  autoAnswer: boolean
  provider: string
  compact: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  onRetry: () => void
  onReanswer: () => void
}) {
  const [moreBelow, setMoreBelow] = useState(false)
  const measure = () => {
    const el = scrollRef.current
    if (el) setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }

  // Follow the stream unless the user has scrolled up to re-read; then re-check whether there is more below.
  useEffect(() => {
    const el = scrollRef.current
    if (el && (answer.status === 'streaming' || answer.status === 'thinking')) el.scrollTo({ top: el.scrollHeight })
    measure()
  }, [answer.text, answer.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const prompt = emptyPrompt(status, autoAnswer)
  const showQuestion = !compact && answer.question && answer.status !== 'idle'
  let body: ReactNode
  if (answer.status === 'thinking') body = <Thinking provider={provider} />
  else if (answer.status === 'error') {
    body = (
      <div className="flex gap-2.5 rounded-md border border-danger-solid/22 bg-danger-solid/8 px-3 py-2.5">
        <Icon name="alert" size={16} className="mt-px shrink-0 text-danger" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="text-[13px] leading-[1.45] text-danger-soft">{answer.error}</div>
          {answer.question && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-[26px] items-center gap-1.5 rounded-sm bg-danger-solid/14 px-2.5 text-xs font-semibold text-danger-soft hover:bg-danger-solid/22 focus-ring-danger"
              >
                <Icon name="reAnswer" size={12} strokeWidth={2} />
                Retry
              </button>
              <span className="text-[11px] text-fg-2">or type the question below</span>
            </div>
          )}
        </div>
      </div>
    )
  } else if (answer.text) body = <AnswerContent text={answer.text} streaming={answer.status === 'streaming'} />
  else {
    body = (
      <div className="flex flex-wrap items-center gap-1.5 text-[13px] leading-normal text-fg-3">
        <span>{prompt.text}</span>
        {prompt.keys && <Keys keys={keysFor(prompt.keys)} />}
        {prompt.tail && <span>{prompt.tail}</span>}
      </div>
    )
  }

  return (
    <>
      <div className="relative min-h-24 flex-[1_1_auto] overflow-hidden" style={{ maxHeight: compact ? 300 : 240 }}>
        <div ref={scrollRef} onScroll={measure} className="h-full max-h-[inherit] overflow-y-auto px-4 pt-3.5 pb-4 [scrollbar-width:none]">
          {showQuestion && (
            <div className="mb-2.5 flex gap-[7px] text-xs leading-[1.45] text-fg-muted">
              <span className="shrink-0 font-bold text-leaf">Q</span>
              <span>{answer.question}</span>
            </div>
          )}
          {body}
        </div>
        {moreBelow && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-panel/0 to-panel" />
        )}
      </div>
      {!compact && answer.status === 'done' && (
        <div className="flex shrink-0 items-center gap-2 pr-3 pb-2.5 pl-4">
          <Button size={26} icon="reAnswer" onClick={onReanswer} title={`Answer again (${shortcutLabel('answer')} answers the latest question)`}>
            Re-answer
          </Button>
          <span className="flex-1" />
          {moreBelow && (
            <span className="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap text-fg-2">
              More below <span className="text-fg-3">Ctrl Shift ↓</span>
            </span>
          )}
        </div>
      )}
    </>
  )
}

// ── Shortcut cheat-sheet (A16) and ask box ──────────────────────────────────────────────────────────────────────────

export function ShortcutSheet() {
  return (
    <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-fg">Shortcuts</span>
        <span className="text-[11px] text-fg-3">Global · work from any app</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {shortcuts().map((shortcut) => (
          <div key={shortcut.action} className="flex h-7 items-center justify-between gap-2 border-b border-hover">
            <span className="text-xs text-fg-soft">{shortcut.label}</span>
            <Keys keys={shortcut.keys} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function AskBox({ inputRef, onAsk }: { inputRef: RefObject<HTMLInputElement | null>; onAsk: (question: string) => void }) {
  const [typed, setTyped] = useState('')
  const hasText = typed.trim().length > 0
  // Typing is the emergency path when transcription misses or garbles the interviewer's question.
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!hasText) return
    onAsk(typed)
    setTyped('')
    inputRef.current?.blur()
  }
  // The overlay window is non-focusable so clicks never steal focus from the meeting. Typing is the exception:
  // take focus on the first click, and hand it back (blur) after Enter, Esc or clicking elsewhere.
  const takeFocus = async (event: MouseEvent) => {
    if (document.hasFocus()) return
    event.preventDefault()
    await window.sarthi.setOverlayFocusable(true)
    inputRef.current?.focus()
  }
  return (
    <form onSubmit={submit} className="flex shrink-0 items-center gap-1.5 border-t border-line py-2 pr-2 pl-2.5">
      <label
        onMouseDown={(e) => void takeFocus(e)}
        className="group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-ink pr-1.5 pl-2.5 transition-[border-color,box-shadow] duration-120 focus-within:border-leaf focus-within:shadow-[0_0_0_3px_rgba(74,222,128,0.18)]"
      >
        <input
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={() => void window.sarthi.setOverlayFocusable(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setTyped('')
              e.currentTarget.blur()
            }
          }}
          placeholder="Type a question and press Enter"
          aria-label="Type a question"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-fg outline-none placeholder:text-[#6b7a70]"
        />
        <span className="inline-flex items-center gap-[3px] opacity-80">
          {hasText ? (
            <>
              <Keys keys={['Esc']} />
              <span className="text-[10.5px] whitespace-nowrap text-fg-3">clear</span>
            </>
          ) : (
            <Keys keys={keysFor('focus-ask')} />
          )}
        </span>
      </label>
      <Button type="submit" variant={hasText ? 'primary' : 'secondary'} disabled={!hasText} className="h-8 px-3 text-xs">
        Ask
      </Button>
    </form>
  )
}

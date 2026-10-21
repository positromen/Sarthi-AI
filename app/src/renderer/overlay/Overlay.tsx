import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../useSettings'
import {
  AnswerArea,
  AskBox,
  CompactHeader,
  Header,
  Meters,
  SessionErrorBanner,
  SetupCard,
  ShortcutSheet,
  ShotStrip,
  Transcript,
  VisibleStrip
} from './parts'
import { useAnswer } from './useAnswer'
import { useKeyStatus } from './useKeyStatus'
import { useListening } from './useListening'
import { useScreenshots } from './useScreenshots'
import { missingKeys } from './view'

const SCROLL_STEP = 120

export function Overlay() {
  const [settings, update] = useSettings()
  const listening = useListening()
  const { answer, generate } = useAnswer()
  const screenshots = useScreenshots()
  const keyStatus = useKeyStatus()
  const [sheetOpen, setSheetOpen] = useState(false)
  const answerRef = useRef<HTMLDivElement>(null)
  const askRef = useRef<HTMLInputElement>(null)

  // Hotkey handlers read the latest values through refs, so the subscription is made once.
  const latest = useRef({ toggle: listening.toggle, generate })
  latest.current = { toggle: listening.toggle, generate }

  useEffect(
    () =>
      window.sarthi.onHotkey((key) => {
        if (key === 'scroll-up') answerRef.current?.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' })
        else if (key === 'scroll-down') answerRef.current?.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' })
        else if (key === 'toggle-listening') void latest.current.toggle()
        else if (key === 'answer') void latest.current.generate()
        else if (key === 'focus-ask') {
          setSheetOpen(false)
          askRef.current?.focus()
        }
      }),
    []
  )

  useEffect(() => {
    if (!sheetOpen) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [sheetOpen])

  if (!settings) return null

  const { session, turns, interim, levels, active } = listening
  const missing = missingKeys(keyStatus)
  const setupNeeded = missing.length > 0
  const compact = settings.overlayCompact
  const reanswer = () => void generate(answer.question ?? undefined)
  const answerArea = (
    <AnswerArea
      answer={answer}
      status={session.status}
      autoAnswer={settings.autoAnswer}
      provider={settings.llmProvider}
      compact={compact}
      scrollRef={answerRef}
      onRetry={reanswer}
      onReanswer={reanswer}
    />
  )

  // The window ignores the mouse except while the pointer is over the card.
  const interactive = {
    onMouseEnter: () => window.sarthi.setOverlayInteractive(true),
    onMouseLeave: () => window.sarthi.setOverlayInteractive(false)
  }

  return (
    <div className="relative h-full">
      <div
        {...interactive}
        className="absolute top-2 right-2 left-2 flex max-h-[624px] flex-col overflow-hidden rounded-card border border-line bg-panel text-fg shadow-card"
        style={{ opacity: settings.overlayOpacity }}
      >
        {compact ? (
          <>
            <CompactHeader status={session.status} question={answer.question} onExpand={() => update({ overlayCompact: false })} />
            {answerArea}
          </>
        ) : (
          <>
            <Header
              status={session.status}
              privateMode={settings.privateMode}
              setupNeeded={setupNeeded}
              active={active}
              sheetOpen={sheetOpen}
              screenshotsAllowed={settings.screenshotsEnabled}
              onToggleListen={() => void listening.toggle()}
              onScreenshot={screenshots.capture}
              onSettings={() => window.sarthi.openSettings()}
              onCompact={() => {
                setSheetOpen(false)
                update({ overlayCompact: true })
              }}
              onToggleSheet={() => setSheetOpen(!sheetOpen)}
            />
            {!settings.privateMode && <VisibleStrip onHide={() => update({ privateMode: true })} />}
            {session.error && (
              <SessionErrorBanner
                message={session.error}
                onOpenSettings={() => window.sarthi.openSettings(/key/i.test(session.error ?? '') ? 'setup' : undefined)}
              />
            )}
            {setupNeeded ? (
              <SetupCard missing={missing} onOpenSetup={() => window.sarthi.openSettings('setup')} />
            ) : (
              <>
                {active && <Meters levels={levels} showSending={settings.vadEnabled} />}
                {screenshots.shots.length > 0 && <ShotStrip shots={screenshots.shots} onRemove={screenshots.remove} />}
                {sheetOpen ? (
                  <ShortcutSheet />
                ) : (
                  <>
                    {active && <Transcript turns={turns} interim={interim} />}
                    {answerArea}
                  </>
                )}
                <AskBox inputRef={askRef} onAsk={(question) => void generate(question)} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

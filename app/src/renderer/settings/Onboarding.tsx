// First-run onboarding (design B1–B5): takes the whole window, without the sidebar. Welcome → keys → résumé →
// audio check → ready. Only the keys step blocks; everything else can be done later in the Control Center.
import { useEffect, useState, type ReactNode } from 'react'
import type { Settings } from '../../shared/types'
import { openMicMeter, openSystemMeter, playTestTone, type Meter } from '../audio/meters'
import { keysFor } from '../shortcuts'
import { Button, Keys, SegmentMeter } from '../ui/components'
import { Icon, Logo, type IconName } from '../ui/icons'
import { canContinue, hasSpeech, ONBOARDING_STEPS } from './onboardingRules'
import { KeyRow, KEYS, useKeyStatusLive } from './pages/SetupPage'

const cleanError = (error: unknown): string =>
  (error as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

function Fact({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-panel border border-line bg-panel p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-leaf/12 text-leaf">
        <Icon name={icon} size={18} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold">{title}</span>
        <span className="text-[12.5px] leading-normal text-fg-muted">{children}</span>
      </div>
    </div>
  )
}

function StepHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-1.5">
      <h1 className="text-[26px] leading-tight font-semibold">{title}</h1>
      <p className="text-[13.5px] leading-normal text-pretty text-fg-2">{children}</p>
    </div>
  )
}

// ── Step 3: résumé ──────────────────────────────────────────────────────────────────────────────────────────────────

function ResumeStep({ settings, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState<{ name: string; chars: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const upload = async () => {
    setBusy(true)
    setError(null)
    try {
      const file = await window.sarthi.importDocument()
      if (!file) return
      update({ resume: settings.resume.trim() ? `${settings.resume.trim()}\n\n${file.text}` : file.text })
      setLoaded({ name: file.name, chars: file.text.length })
    } catch (e) {
      setError(cleanError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <StepHeading title="Add your résumé">
        Answers draw on your real experience. The text stays on this PC and a long résumé doesn't slow answers down.
      </StepHeading>
      <div className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-line-strong bg-panel px-6 py-8 text-center">
        <Button variant="secondary" icon="upload" busy={busy} onClick={() => void upload()}>
          {busy ? 'Reading…' : 'Upload file'}
        </Button>
        <span className="text-xs text-fg-3">.pdf, .docx, .txt or .md · or paste text in Profile later</span>
      </div>
      {loaded && (
        <div className="mt-3 flex items-center gap-3 rounded-panel border border-line bg-panel px-4 py-3">
          <Icon name="file" size={18} className="text-fg-2" />
          <div className="flex flex-1 flex-col">
            <span className="text-[13px]">{loaded.name}</span>
            <span className="text-xs text-fg-3">{loaded.chars.toLocaleString()} characters extracted</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-leaf">
            <Icon name="check" size={13} strokeWidth={2.25} /> Loaded
          </span>
        </div>
      )}
      {!loaded && settings.resume.trim() && (
        <p className="mt-3 text-xs text-leaf">A résumé is already saved ({settings.resume.trim().length.toLocaleString()} characters).</p>
      )}
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      <p className="mt-4 text-[12.5px] text-fg-3">You can add the job description and notes later in Profile.</p>
    </>
  )
}

// ── Step 4: audio check ─────────────────────────────────────────────────────────────────────────────────────────────

function AudioStep({ onHeard }: { onHeard: (side: 'mic' | 'system') => void }) {
  const [mic, setMic] = useState(0)
  const [system, setSystem] = useState(0)
  const [label, setLabel] = useState('')
  const [errors, setErrors] = useState<{ mic?: string; system?: string }>({})
  const [heard, setHeard] = useState({ mic: false, system: false })

  useEffect(() => {
    let cancelled = false
    const meters: Meter[] = []
    const keep = (meter: Meter) => (cancelled ? meter.stop() : meters.push(meter))
    openMicMeter(setMic)
      .then((meter) => {
        keep(meter)
        setLabel(meter.label)
      })
      .catch((e) => setErrors((prev) => ({ ...prev, mic: (e as Error).message })))
    openSystemMeter(setSystem)
      .then(keep)
      .catch((e) => setErrors((prev) => ({ ...prev, system: (e as Error).message })))
    return () => {
      cancelled = true
      meters.forEach((meter) => meter.stop())
    }
  }, [])

  // Once a side has been heard it stays confirmed, even when the room goes quiet again.
  useEffect(() => {
    if (hasSpeech(mic) && !heard.mic) {
      setHeard((h) => ({ ...h, mic: true }))
      onHeard('mic')
    }
    if (hasSpeech(system) && !heard.system) {
      setHeard((h) => ({ ...h, system: true }))
      onHeard('system')
    }
  }, [mic, system, heard, onHeard])

  const side = (
    title: string,
    tone: 'you' | 'interviewer',
    level: number,
    ok: boolean,
    waiting: string,
    detail: ReactNode,
    error?: string
  ) => (
    <div className="flex flex-col gap-3 rounded-panel border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold">{title}</span>
        {error ? (
          <span className="text-xs text-danger">Not available</span>
        ) : ok ? (
          <span className="inline-flex items-center gap-1 text-xs text-leaf">
            <Icon name="check" size={13} strokeWidth={2.25} /> {tone === 'you' ? 'Hearing you' : 'Hearing it'}
          </span>
        ) : (
          <span className="text-xs text-fg-3">{waiting}</span>
        )}
      </div>
      <SegmentMeter level={level} tone={tone} />
      <div className="text-xs text-fg-3">{error ?? detail}</div>
    </div>
  )

  return (
    <>
      <StepHeading title="Check your audio">
        Sarthi hears you through the mic and the interviewer through your PC's audio output.
      </StepHeading>
      <div className="flex flex-col gap-3">
        {side('You · microphone', 'you', mic, heard.mic, 'Say something…', label ? `${label} · Windows default` : 'Windows default microphone', errors.mic)}
        {side(
          'Interviewer · system audio',
          'interviewer',
          system,
          heard.system,
          'Waiting for sound',
          <span className="flex items-center justify-between gap-3">
            Play any video, or a test sound, to confirm the other side is heard.
            <Button size={28} icon="play" onClick={playTestTone}>
              Play test sound
            </Button>
          </span>,
          errors.system
        )}
      </div>
    </>
  )
}

// ── Shell ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export function Onboarding({ settings, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const [step, setStep] = useState(1)
  const [keyStatus, setKeyStatus] = useKeyStatusLive()
  const [heard, setHeard] = useState({ mic: false, system: false })
  const last = ONBOARDING_STEPS.length
  const finish = () => {
    update({ onboarded: true })
    window.sarthi.showOverlay()
  }

  const checklist: [boolean, string][] = [
    [canContinue(2, keyStatus), 'Deepgram, Gemini and Groq keys saved'],
    [Boolean(settings.resume.trim()), settings.resume.trim() ? 'Résumé loaded' : 'Résumé skipped (add it in Profile)'],
    [heard.mic && heard.system, heard.mic && heard.system ? 'Microphone and system audio heard' : 'Audio not fully checked'],
    [settings.privateMode, settings.privateMode ? 'Private mode on' : 'Private mode is off']
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-8 py-4">
        <Logo size={20} />
        <span className="text-sm font-semibold">Sarthi AI</span>
        <span className="flex-1" />
        <span className="text-xs text-fg-3">
          Step {step} of {last} · {ONBOARDING_STEPS[step - 1]}
        </span>
        <div className="flex gap-1" aria-hidden="true">
          {ONBOARDING_STEPS.map((name, i) => (
            <span key={name} className={`h-1 w-8 rounded-xs ${i < step ? 'bg-leaf' : 'bg-line'}`} />
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[560px] px-6 pt-10 pb-8">
          {step === 1 && (
            <>
              <Logo size={48} className="mb-5" />
              <StepHeading title="Welcome to Sarthi">
                Sarthi listens to your interview, transcribes both sides and suggests answers in a small overlay that only
                you can see. It runs on this PC with your own API keys.
              </StepHeading>
              <div className="flex flex-col gap-3">
                <Fact icon="lock" title="Local-first">
                  No account, no telemetry. Keys and history stay on this PC.
                </Fact>
                <Fact icon="private" title="Private by default">
                  The overlay and this window are hidden from screen share.
                </Fact>
                <Fact icon="history" title="About three minutes">
                  Three free API keys, your résumé and a quick audio check.
                </Fact>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <StepHeading title="Add your API keys">
                Deepgram transcribes the call. Gemini and Groq write the answers. All three have a free tier.
              </StepHeading>
              <div className="rounded-panel border border-line bg-panel">
                {KEYS.filter((info) => !info.soon).map((info) => (
                  <KeyRow key={info.name} info={info} saved={Boolean(keyStatus?.[info.name])} onSaved={setKeyStatus} />
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-fg-3">
                <Icon name="lock" size={13} />
                Keys are encrypted with Windows (DPAPI) and stay on this PC.
              </p>
            </>
          )}
          {step === 3 && <ResumeStep settings={settings} update={update} />}
          {step === 4 && <AudioStep onHeard={(side) => setHeard((h) => ({ ...h, [side]: true }))} />}
          {step === 5 && (
            <>
              <StepHeading title="You're ready">
                Open the overlay and place it near your webcam. When the call starts, press
              </StepHeading>
              <div className="-mt-3 mb-6">
                <Keys keys={keysFor('toggle-listening')} />
              </div>
              <div className="flex flex-col gap-2.5 rounded-panel border border-line bg-panel p-4">
                {checklist.map(([ok, text]) => (
                  <span key={text} className={`flex items-center gap-2 text-[13px] ${ok ? 'text-fg' : 'text-fg-3'}`}>
                    {ok ? (
                      <Icon name="check" size={15} strokeWidth={2.25} className="text-leaf" />
                    ) : (
                      <span className="size-[15px] rounded-full border-[1.5px] border-dashed border-[#4a5a4f]" />
                    )}
                    {text}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="flex items-center gap-2 border-t border-line px-8 py-4">
        {step > 1 && (
          <Button onClick={() => setStep(step - 1)} className="[--ring-gap:var(--color-ink)]">
            Back
          </Button>
        )}
        <span className="flex-1" />
        {step === 3 && (
          <Button variant="danger" className="text-fg-2 hover:text-fg" onClick={() => setStep(4)}>
            Skip for now
          </Button>
        )}
        <Button
          variant="primary"
          iconRight={step === last ? 'arrowRight' : undefined}
          disabled={!canContinue(step, keyStatus)}
          title={!canContinue(step, keyStatus) ? 'Save all three keys to continue' : undefined}
          onClick={() => (step === last ? finish() : setStep(step + 1))}
          className="[--ring-gap:var(--color-ink)]"
        >
          {step === 1 ? 'Get started' : step === last ? 'Open the overlay' : 'Continue'}
        </Button>
      </footer>
    </div>
  )
}

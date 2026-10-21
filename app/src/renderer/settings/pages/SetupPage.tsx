// Setup · API keys (design B6). Keys are checked with their provider before saving and never shown again.
import { useEffect, useState } from 'react'
import type { AiUsage, ApiKeyName, ApiKeyStatus, LlmProvider, UsageReport, UsageTotals } from '../../../shared/types'
import { formatAudio, formatTokens } from '../../../shared/usageFormat'
import { Badge, Button, Input, useToast } from '../../ui/components'
import { Icon } from '../../ui/icons'
import { Card, ExternalLink, PageHeader, Row, SectionTitle } from '../layout'

interface KeyInfo {
  name: ApiKeyName
  label: string
  use: string
  console: string
  required: boolean
}

export const KEYS: KeyInfo[] = [
  { name: 'deepgram', label: 'Deepgram', use: 'Live transcription', console: 'console.deepgram.com', required: true },
  { name: 'gemini', label: 'Gemini', use: 'Answers, free tier', console: 'aistudio.google.com', required: true },
  { name: 'groq', label: 'Groq', use: 'Fast answers, free tier', console: 'console.groq.com', required: true },
  { name: 'anthropic', label: 'Anthropic', use: 'Claude answers, paid', console: 'console.anthropic.com', required: false }
]

export function useKeyStatusLive(): [ApiKeyStatus | null, (status: ApiKeyStatus) => void] {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null)
  useEffect(() => {
    window.sarthi.getKeyStatus().then(setStatus)
    return window.sarthi.onKeysChanged(setStatus)
  }, [])
  return [status, setStatus]
}

export function KeyRow({ info, saved, onSaved }: { info: KeyInfo; saved: boolean; onSaved: (status: ApiKeyStatus) => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const check = await window.sarthi.validateKey(info.name, value)
      if (!check.ok) return setError(check.message)
      onSaved(await window.sarthi.setKey(info.name, value))
      setValue('')
      toast(check.warning ?? `${info.label} key saved (encrypted)`)
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    onSaved(await window.sarthi.setKey(info.name, ''))
    toast(`${info.label} key removed`)
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-line px-4 py-3.5 first:border-t-0">
      <div className="flex items-center gap-2">
        <span className="text-[13.5px] font-semibold">{info.label}</span>
        <Badge tone={info.required ? 'required' : 'optional'}>{info.required ? 'Required' : 'Optional'}</Badge>
        <span className="flex-1" />
        {saved ? (
          <span className="inline-flex items-center gap-1 text-xs text-leaf">
            <Icon name="check" size={13} strokeWidth={2.25} />
            Saved (encrypted)
          </span>
        ) : (
          <span className="text-xs text-fg-3">Not set</span>
        )}
      </div>
      <div className="text-[12.5px] text-fg-muted">
        {info.use} · <ExternalLink href={`https://${info.console}`}>{info.console}</ExternalLink>
      </div>
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim() && !busy) void save()
        }}
      >
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-label={`${info.label} API key`}
          placeholder={saved ? 'Paste a new key to replace' : 'Paste key'}
          value={value}
          error={error}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          className="flex-1"
        />
        <Button type="submit" variant="primary" size={34} disabled={!value.trim()} busy={busy}>
          {busy ? 'Checking' : 'Save'}
        </Button>
        {saved && (
          <Button variant="danger" size={34} onClick={() => void remove()}>
            Remove
          </Button>
        )}
      </form>
    </div>
  )
}

const AI_PROVIDERS: { name: LlmProvider; label: string }[] = [
  { name: 'gemini', label: 'Gemini' },
  { name: 'groq', label: 'Groq' },
  { name: 'anthropic', label: 'Claude' }
]

const aiLine = (ai: AiUsage | undefined): string =>
  ai ? `${ai.calls} ${ai.calls === 1 ? 'call' : 'calls'} · ${ai.estimated ? '≈' : ''}${formatTokens(ai.inputTokens + ai.outputTokens)} tokens` : 'none'

function UsageFigures({ today, month }: { today: string; month: string }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5 text-[12.5px] tabular-nums">
      <span className="text-fg">{today} today</span>
      <span className="text-fg-3">{month} this month</span>
    </div>
  )
}

function UsageCard() {
  const [report, setReport] = useState<UsageReport | null>(null)
  useEffect(() => {
    window.sarthi.getUsage().then(setReport)
  }, [])
  if (!report) return null
  const used = (totals: UsageTotals) => AI_PROVIDERS.filter((p) => totals.ai[p.name])
  const providers = used(report.month)
  return (
    <>
      <SectionTitle>Usage</SectionTitle>
      <Card>
        <Row label="Deepgram" hint="Audio transcribed">
          <UsageFigures today={formatAudio(report.today.audioSeconds)} month={formatAudio(report.month.audioSeconds)} />
        </Row>
        {providers.map((p) => (
          <Row key={p.name} label={p.label} hint="Answers and notes">
            <UsageFigures today={aiLine(report.today.ai[p.name])} month={aiLine(report.month.ai[p.name])} />
          </Row>
        ))}
        {providers.length === 0 && <Row label="AI answers" hint="No answers yet this month" />}
      </Card>
      <p className="mt-3 text-[12px] text-fg-3">
        Counted on this PC. ≈ marks estimated tokens. Free-tier limits change, so check them in each provider's console.
      </p>
    </>
  )
}

export function SetupPage({ onRunGuide }: { onRunGuide: () => void }) {
  const [status, setStatus] = useKeyStatusLive()
  return (
    <>
      <PageHeader
        title="Setup"
        subtitle="Sarthi uses your own API keys. Deepgram, Gemini and Groq are required; all three have a free tier."
        action={
          <Button size={32} onClick={onRunGuide} className="[--ring-gap:var(--color-ink)]">
            Run setup guide
          </Button>
        }
      />
      <Card>
        {KEYS.map((info) => (
          <KeyRow key={info.name} info={info} saved={Boolean(status?.[info.name])} onSaved={setStatus} />
        ))}
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-fg-3">
        <Icon name="lock" size={13} />
        Keys are encrypted with Windows (DPAPI) and stay on this PC. A saved key is never shown again.
      </p>
      <UsageCard />
    </>
  )
}

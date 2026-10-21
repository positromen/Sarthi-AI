// Setup · API keys (design B6). Keys are checked with their provider before saving and never shown again.
import { useEffect, useState } from 'react'
import type { ApiKeyName, ApiKeyStatus } from '../../../shared/types'
import { Badge, Button, Input, useToast } from '../../ui/components'
import { Icon } from '../../ui/icons'
import { Card, ExternalLink, PageHeader } from '../layout'

interface KeyInfo {
  name: ApiKeyName
  label: string
  use: string
  console: string
  required: boolean
  soon?: boolean
}

export const KEYS: KeyInfo[] = [
  { name: 'deepgram', label: 'Deepgram', use: 'Live transcription', console: 'console.deepgram.com', required: true },
  { name: 'gemini', label: 'Gemini', use: 'Answers, free tier', console: 'aistudio.google.com', required: true },
  { name: 'groq', label: 'Groq', use: 'Fast answers, free tier', console: 'console.groq.com', required: true },
  { name: 'anthropic', label: 'Anthropic', use: 'Claude answers', console: 'console.anthropic.com', required: false, soon: true }
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
        {info.soon ? (
          <Badge tone="soon">Coming soon</Badge>
        ) : saved ? (
          <span className="inline-flex items-center gap-1 text-xs text-leaf">
            <Icon name="check" size={13} strokeWidth={2.25} />
            Saved (encrypted)
          </span>
        ) : (
          <span className="text-xs text-fg-3">Not set</span>
        )}
      </div>
      <div className="text-[12.5px] text-fg-muted">
        {info.use} · {info.soon ? info.console : <ExternalLink href={`https://${info.console}`}>{info.console}</ExternalLink>}
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
          placeholder={info.soon ? 'Coming soon' : saved ? 'Paste a new key to replace' : 'Paste key'}
          value={value}
          disabled={info.soon}
          error={error}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          className="flex-1"
        />
        <Button type="submit" variant="primary" size={34} disabled={!value.trim() || info.soon} busy={busy}>
          {busy ? 'Checking' : 'Save'}
        </Button>
        {saved && !info.soon && (
          <Button variant="danger" size={34} onClick={() => void remove()}>
            Remove
          </Button>
        )}
      </form>
    </div>
  )
}

export function SetupPage() {
  const [status, setStatus] = useKeyStatusLive()
  return (
    <>
      <PageHeader title="Setup" subtitle="Sarthi uses your own API keys. Deepgram, Gemini and Groq are required; all three have a free tier." />
      <Card>
        {KEYS.map((info) => (
          <KeyRow key={info.name} info={info} saved={Boolean(status?.[info.name])} onSaved={setStatus} />
        ))}
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-fg-3">
        <Icon name="lock" size={13} />
        Keys are encrypted with Windows (DPAPI) and stay on this PC. A saved key is never shown again.
      </p>
    </>
  )
}

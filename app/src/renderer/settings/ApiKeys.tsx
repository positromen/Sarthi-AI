import { useEffect, useState } from 'react'
import type { ApiKeyName, ApiKeyStatus } from '../../shared/types'

const KEYS: { name: ApiKeyName; label: string; hint: string; required: boolean }[] = [
  { name: 'deepgram', label: 'Deepgram', hint: 'Live transcription · console.deepgram.com', required: true },
  { name: 'gemini', label: 'Gemini', hint: 'Answers (free tier) · aistudio.google.com', required: true },
  { name: 'groq', label: 'Groq', hint: 'Fast answers (free tier) · console.groq.com', required: true },
  { name: 'anthropic', label: 'Anthropic', hint: 'Optional Claude answers · console.anthropic.com', required: false }
]

function KeyRow({ name, label, hint, saved, onSaved }: {
  name: ApiKeyName
  label: string
  hint: string
  saved: boolean
  onSaved: (status: ApiKeyStatus) => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = async (next: string) => {
    try {
      onSaved(await window.sarthi.setKey(name, next))
      setValue('')
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className={`text-xs ${saved ? 'text-leaf' : 'text-white/40'}`}>{saved ? 'Saved (encrypted)' : 'Not set'}</span>
      </div>
      <p className="mb-2 text-sm text-white/50">{hint}</p>
      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={saved ? 'Paste a new key to replace' : 'Paste key'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded border border-line bg-ink px-3 py-1.5 text-sm outline-none focus:border-leaf"
        />
        <button
          disabled={!value.trim()}
          onClick={() => save(value)}
          className="rounded bg-leaf/20 px-3 text-sm text-leaf hover:bg-leaf/30 disabled:opacity-40"
        >
          Save
        </button>
        {saved && (
          <button onClick={() => save('')} className="rounded px-3 text-sm text-white/50 hover:bg-white/10">
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  )
}

export function ApiKeys() {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null)

  useEffect(() => {
    window.sarthi.getKeyStatus().then(setStatus)
  }, [])

  if (!status) return null
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">API keys</h2>
      <p className="text-sm text-white/50">Keys are encrypted with Windows (DPAPI) and stay on this PC.</p>
      {KEYS.map((key) => (
        <KeyRow key={key.name} {...key} saved={status[key.name]} onSaved={setStatus} />
      ))}
    </section>
  )
}

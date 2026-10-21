import { useEffect, useState } from 'react'
import { LISTENING_LANGUAGES, OUTPUT_LANGUAGES } from '../../shared/languages'
import { useSettings } from '../useSettings'
import { ApiKeys } from './ApiKeys'

function Toggle({ label, hint, checked, onChange }: {
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 rounded-lg border border-line bg-panel p-4">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-white/50">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-5 accent-[var(--color-leaf)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function Select<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-line bg-panel px-4 py-3">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-line bg-ink px-3 py-1.5 text-sm outline-none focus:border-leaf"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ProfileField({ label, hint, value, placeholder, rows, onSave }: {
  label: string
  hint: string
  value: string
  placeholder: string
  rows: number
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  // Keep the field in sync if settings change elsewhere (e.g. another window).
  useEffect(() => setDraft(value), [value])

  const importFile = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const file = await window.sarthi.importDocument()
      if (!file) return
      // Append to anything already there, so a résumé and a CV can both be added.
      const next = draft.trim() ? `${draft.trim()}\n\n${file.text}` : file.text
      setDraft(next)
      onSave(next)
      setStatus({ ok: true, text: `Loaded ${file.name}` })
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <button
          onClick={importFile}
          disabled={busy}
          className="rounded bg-leaf/20 px-3 py-1 text-xs text-leaf hover:bg-leaf/30 disabled:opacity-40"
        >
          {busy ? 'Reading…' : 'Upload file'}
        </button>
      </div>
      <p className="mb-2 text-sm text-white/50">{hint}</p>
      <textarea
        value={draft}
        rows={rows}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onSave(draft)}
        className="w-full resize-y rounded border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-leaf"
      />
      {status && (
        <p className={`mt-2 text-xs ${status.ok ? 'text-leaf' : 'text-red-300'}`}>{status.text}</p>
      )}
    </div>
  )
}

export function SettingsApp() {
  const [settings, update] = useSettings()
  if (!settings) return null

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold text-leaf">Sarthi AI</h1>
      <ApiKeys />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Behavior</h2>
        <Toggle
          label="Private mode"
          hint="Hide the overlay and this window from screen sharing and recordings (Ctrl+Shift+P)."
          checked={settings.privateMode}
          onChange={(privateMode) => update({ privateMode })}
        />
        <Toggle
          label="Auto-answer"
          hint="Answer automatically when the interviewer asks a question. Off = press Ctrl+Shift+Enter."
          checked={settings.autoAnswer}
          onChange={(autoAnswer) => update({ autoAnswer })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Language</h2>
        <p className="text-sm text-white/50">
          Listening applies the next time you press Listen. Answers can be in a different language from the call.
        </p>
        <Select
          label="Listening language"
          value={settings.listeningLanguage}
          options={[...LISTENING_LANGUAGES]}
          onChange={(listeningLanguage) => update({ listeningLanguage })}
        />
        <Select
          label="Answer language"
          value={settings.outputLanguage}
          options={[...OUTPUT_LANGUAGES]}
          onChange={(outputLanguage) => update({ outputLanguage })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Answer style</h2>
        <Select
          label="Length"
          value={settings.responseLength}
          options={[
            { value: 'short', label: 'Short' },
            { value: 'medium', label: 'Medium' },
            { value: 'long', label: 'Long' }
          ]}
          onChange={(responseLength) => update({ responseLength })}
        />
        <Select
          label="Format"
          value={settings.responseFormat}
          options={[
            { value: 'bullets', label: 'Bullet points' },
            { value: 'paragraph', label: 'Paragraphs' }
          ]}
          onChange={(responseFormat) => update({ responseFormat })}
        />
        <Select
          label="Tone"
          value={settings.responseTone}
          options={[
            { value: 'professional', label: 'Professional' },
            { value: 'conversational', label: 'Conversational' },
            { value: 'confident', label: 'Confident' }
          ]}
          onChange={(responseTone) => update({ responseTone })}
        />
        <Toggle
          label="STAR method"
          hint="Structure behavioral answers as Situation, Task, Action, Result."
          checked={settings.useStarMethod}
          onChange={(useStarMethod) => update({ useStarMethod })}
        />
        <Toggle
          label="Natural fillers"
          hint="Add light spoken fillers so answers sound human, not scripted."
          checked={settings.useFillerWords}
          onChange={(useFillerWords) => update({ useFillerWords })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-white/50">
          Answers are grounded in this. Paste text or upload a file (.txt, .pdf, or Word .docx). It stays on this PC.
        </p>
        <ProfileField
          label="Résumé"
          hint="Paste your résumé or a summary of your experience."
          value={settings.resume}
          placeholder="Experience, skills, achievements…"
          rows={8}
          onSave={(resume) => update({ resume })}
        />
        <ProfileField
          label="Job description"
          hint="Paste the role you're interviewing for, so answers match it."
          value={settings.jobDescription}
          placeholder="Role, responsibilities, requirements…"
          rows={6}
          onSave={(jobDescription) => update({ jobDescription })}
        />
        <ProfileField
          label="Notes"
          hint="Anything else to weave in — talking points, company facts, questions to ask."
          value={settings.notes}
          placeholder="Optional…"
          rows={4}
          onSave={(notes) => update({ notes })}
        />
      </section>
    </main>
  )
}

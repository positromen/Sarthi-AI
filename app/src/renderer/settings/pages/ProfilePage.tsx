// Profile (design B7): résumé, job description and notes, with file upload, character counts and a strength meter.
import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'
import { Button, Textarea } from '../../ui/components'
import { Icon } from '../../ui/icons'
import { Card, PageHeader } from '../layout'
import { profileStrength } from '../model'
import { useCallActive } from '../useCallActive'

type Status = { kind: 'loaded'; name: string; chars: number } | { kind: 'error'; message: string } | null

const cleanError = (error: unknown): string =>
  (error as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

function ProfileField({
  label,
  hint,
  value,
  placeholder,
  rows,
  onSave
}: {
  label: string
  hint: string
  value: string
  placeholder: string
  rows: number
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  // Keep the field in sync if settings change elsewhere (e.g. onboarding).
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
      setStatus({ kind: 'loaded', name: file.name, chars: file.text.length })
    } catch (e) {
      setStatus({ kind: 'error', message: cleanError(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold">{label}</span>
          <span className="text-[12.5px] text-fg-muted">{hint}</span>
        </div>
        <Button variant="secondary" icon="upload" busy={busy} onClick={() => void importFile()}>
          {busy ? 'Reading…' : 'Upload file'}
        </Button>
      </div>
      <Textarea
        value={draft}
        rows={rows}
        placeholder={placeholder}
        spellCheck={false}
        count
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onSave(draft)}
      />
      {status?.kind === 'loaded' && (
        <span className="-mt-5 inline-flex items-center gap-1.5 self-start text-xs text-leaf">
          <Icon name="check" size={13} strokeWidth={2.25} />
          Loaded {status.name} · {status.chars.toLocaleString()} characters
        </span>
      )}
      {status?.kind === 'error' && (
        <span className="-mt-5 inline-flex items-center gap-1.5 self-start text-xs text-danger">
          <Icon name="alert" size={13} />
          {status.message}
        </span>
      )}
    </Card>
  )
}

const LEVEL_COLOR = { Empty: 'text-fg-3', Weak: 'text-danger', Fair: 'text-warn', Good: 'text-leaf', Strong: 'text-leaf' }

export function ProfilePage({ settings, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const strength = profileStrength(settings)
  const callActive = useCallActive()
  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Every answer is grounded in this. It stays on this PC, and a long profile doesn't slow answers down. Fields save when you click away."
      />
      {callActive && (
        <p className="mb-4 text-[12.5px] text-warn">The Upload file picker is visible in screen share. Upload before or after the call.</p>
      )}
      <Card className="mb-4 flex items-center gap-4 px-4 py-3.5">
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] text-fg-2">Profile strength</span>
            <span className={`text-[13px] font-semibold ${LEVEL_COLOR[strength.level]}`}>{strength.level}</span>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <span key={step} className={`h-1 flex-1 rounded-xs ${step <= strength.score ? 'bg-leaf' : 'bg-selected'}`} />
            ))}
          </div>
          <span className="text-xs text-fg-3">{strength.hint}</span>
        </div>
      </Card>
      <div className="flex flex-col gap-3">
        <ProfileField
          label="Résumé"
          hint="Your experience, skills and achievements."
          value={settings.resume}
          placeholder="Experience, skills, achievements…"
          rows={9}
          onSave={(resume) => update({ resume })}
        />
        <ProfileField
          label="Job description"
          hint="The role you're interviewing for, so answers match it."
          value={settings.jobDescription}
          placeholder="Role, responsibilities, requirements…"
          rows={6}
          onSave={(jobDescription) => update({ jobDescription })}
        />
        <ProfileField
          label="Notes"
          hint="Talking points, company facts, questions to ask."
          value={settings.notes}
          placeholder="Optional…"
          rows={4}
          onSave={(notes) => update({ notes })}
        />
      </div>
      <p className="mt-3 text-[12px] text-fg-3">Upload accepts .pdf, Word .docx, .txt and .md. The text is added to what's already there.</p>
    </>
  )
}

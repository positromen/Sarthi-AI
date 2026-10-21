import { useEffect, useState } from 'react'
import type { SessionRecord, SessionSummary } from '../../shared/types'

const SPEAKER_LABEL = { you: 'You', interviewer: 'Interviewer' } as const

// ipcRenderer.invoke wraps main-process errors as "Error invoking remote method '…': Error: <message>".
const cleanError = (error: unknown): string =>
  (error as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

function duration({ startedAt, endedAt }: SessionSummary): string {
  if (!endedAt) return 'unfinished'
  return `${Math.max(1, Math.round((endedAt - startedAt) / 60000))} min`
}

function SessionDetail({ id }: { id: string }) {
  const [record, setRecord] = useState<SessionRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    window.sarthi.getHistorySession(id).then(setRecord)
  }, [id])

  const makeNotes = async () => {
    setBusy(true)
    setError(null)
    try {
      setRecord(await window.sarthi.generateNotes(id))
    } catch (e) {
      setError(cleanError(e))
    } finally {
      setBusy(false)
    }
  }

  if (!record) return <p className="px-4 pb-4 text-sm text-white/40">Loading…</p>

  return (
    <div className="space-y-4 border-t border-line px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={makeNotes}
          disabled={busy || record.turns.length === 0}
          className="rounded bg-leaf/20 px-3 py-1 text-xs text-leaf hover:bg-leaf/30 disabled:opacity-40"
        >
          {busy ? 'Writing notes… (can take up to a minute)' : record.notes ? 'Regenerate notes' : 'Post-call notes'}
        </button>
        <button
          onClick={() => (confirmDelete ? void window.sarthi.deleteHistorySession(id) : setConfirmDelete(true))}
          onMouseLeave={() => setConfirmDelete(false)}
          className="rounded bg-red-500/15 px-3 py-1 text-xs text-red-200 hover:bg-red-500/25"
        >
          {confirmDelete ? 'Click again to delete' : 'Delete'}
        </button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}

      {record.notes && (
        <div>
          <h4 className="mb-1 text-sm font-semibold text-leaf">Post-call notes</h4>
          <p className="whitespace-pre-wrap rounded border border-line bg-ink p-3 text-sm leading-relaxed">{record.notes}</p>
        </div>
      )}

      {record.answers.length > 0 && (
        <div>
          <h4 className="mb-1 text-sm font-semibold">Suggested answers ({record.answers.length})</h4>
          <div className="max-h-72 space-y-3 overflow-y-auto rounded border border-line bg-ink p-3 text-sm">
            {record.answers.map((answer) => (
              <div key={answer.at}>
                <p className="text-xs text-white/45 italic">Q: {answer.question}</p>
                <p className="whitespace-pre-wrap">{answer.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-1 text-sm font-semibold">Transcript ({record.turns.length} turns)</h4>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded border border-line bg-ink p-3 text-xs">
          {record.turns.length === 0 && <p className="text-white/40">No transcript.</p>}
          {record.turns.map((turn) => (
            <p key={turn.id}>
              <span className={`font-semibold ${turn.speaker === 'you' ? 'text-sky-300' : 'text-leaf'}`}>
                {SPEAKER_LABEL[turn.speaker]}:{' '}
              </span>
              {turn.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

export function History() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    window.sarthi.listHistory().then(setSessions)
    return window.sarthi.onHistoryChanged(setSessions)
  }, [])

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">History</h2>
      <p className="text-sm text-white/50">
        Each session is saved on this PC when you stop listening (the latest 100 are kept). Open one for its transcript,
        answers and post-call notes.
      </p>
      {sessions.length === 0 && (
        <p className="rounded-lg border border-line bg-panel p-4 text-sm text-white/40">No sessions yet.</p>
      )}
      {sessions.map((session) => (
        <div key={session.id} className="overflow-hidden rounded-lg border border-line bg-panel">
          <button
            onClick={() => setOpenId(openId === session.id ? null : session.id)}
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white/5"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{session.title}</span>
              <span className="block text-xs text-white/45">
                {new Date(session.startedAt).toLocaleString()} · {duration(session)} · {session.turnCount} turns ·{' '}
                {session.answerCount} answers
              </span>
            </span>
            {session.hasNotes && (
              <span className="shrink-0 rounded-full bg-leaf/15 px-2 py-0.5 text-[11px] text-leaf">notes</span>
            )}
          </button>
          {openId === session.id && <SessionDetail id={session.id} />}
        </div>
      ))}
    </section>
  )
}

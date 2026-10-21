// History (design B13–B16): searchable session list on the left, the selected session on the right with tabs for the
// post-call notes report, the suggested answers and the transcript.
import { useEffect, useMemo, useState } from 'react'
import { sessionTitle } from '../../../shared/sessionTitle'
import type { SessionRecord, SessionSummary } from '../../../shared/types'
import { sessionUsageLine } from '../../../shared/usageFormat'
import { AnswerContent } from '../../overlay/AnswerContent'
import { keysFor } from '../../shortcuts'
import { Badge, Button, EmptyState, Keys, Segmented } from '../../ui/components'
import { Icon } from '../../ui/icons'
import {
  filterSessions,
  formatClock,
  formatFullDate,
  formatWhen,
  parseNotes,
  sessionMeta,
  type HistoryFilter,
  type NotesReport
} from '../historyView'

// ipcRenderer.invoke wraps main-process errors as "Error invoking remote method '…': Error: <message>".
const cleanError = (error: unknown): string =>
  (error as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

type Tab = 'notes' | 'answers' | 'transcript'

function useSessions(query: string): SessionSummary[] {
  const [all, setAll] = useState<SessionSummary[]>([])
  const [found, setFound] = useState<SessionSummary[] | null>(null)
  useEffect(() => {
    window.sarthi.listHistory().then(setAll)
    return window.sarthi.onHistoryChanged(setAll)
  }, [])
  // Searching reads every saved transcript in main, so wait for a pause in typing.
  useEffect(() => {
    if (!query.trim()) return setFound(null)
    const timer = setTimeout(() => window.sarthi.searchHistory(query).then(setFound), 200)
    return () => clearTimeout(timer)
  }, [query, all])
  return found ?? all
}

function Report({ report }: { report: NotesReport }) {
  const card = (title: string, color: string, items: string[], wide = false) =>
    items.length > 0 && (
      <div className={`rounded-panel border border-line bg-panel p-4 ${wide ? '@lg:col-span-2' : ''}`}>
        <div className={`mb-2 text-[12.5px] font-semibold ${color}`}>{title}</div>
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-normal text-fg-soft">
              <span className="mt-2 size-[5px] shrink-0 rounded-full bg-[#6f8f78]" />
              <span className="text-pretty">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      {report.overall.length > 0 && (
        <div className="rounded-panel border border-line bg-panel p-4">
          <div className="mb-1.5 text-[12.5px] font-semibold text-fg-2">Overall</div>
          <p className="text-[13.5px] leading-relaxed text-pretty text-fg">{report.overall.join(' ')}</p>
        </div>
      )}
      {/* Two columns only when the pane is wide enough to read them; otherwise one. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
          {card('Went well', 'text-leaf', report.wentWell)}
          {card('To improve', 'text-warn', report.toImprove)}
          {card('Prepare next', 'text-you', report.prepareNext, true)}
        </div>
      </div>
    </div>
  )
}

function SessionDetail({ id }: { id: string }) {
  const [record, setRecord] = useState<SessionRecord | null>(null)
  const [tab, setTab] = useState<Tab>('notes')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setRecord(null)
    setError(null)
    setConfirmDelete(false)
    window.sarthi.getHistorySession(id).then(setRecord)
  }, [id])

  const report = useMemo(() => (record?.notes ? parseNotes(record.notes) : null), [record?.notes])

  const makeNotes = async () => {
    setBusy(true)
    setError(null)
    setTab('notes')
    try {
      setRecord(await window.sarthi.generateNotes(id))
    } catch (e) {
      setError(cleanError(e))
    } finally {
      setBusy(false)
    }
  }

  if (!record) return <div className="p-6 text-sm text-fg-3">Loading…</div>

  const summary: SessionSummary = {
    id: record.id,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    turnCount: record.turns.length,
    answerCount: record.answers.length,
    title: '',
    hasNotes: Boolean(record.notes)
  }
  const title = sessionTitle(record)
  const usage = sessionUsageLine(record.usage)
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'notes', label: 'Notes' },
    { key: 'answers', label: 'Answers', count: record.answers.length },
    { key: 'transcript', label: 'Transcript', count: record.turns.length }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-line px-6 pt-5 pb-4">
        <div className="flex flex-col gap-1">
          <h2 className="line-clamp-2 text-[15px] leading-snug font-semibold">{title}</h2>
          <span className="text-xs text-fg-3">
            {formatFullDate(record.startedAt)} · {sessionMeta(summary)}
          </span>
          {usage && <span className="text-xs text-fg-3 tabular-nums">{usage}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={record.notes ? 'reAnswer' : 'answers'}
            busy={busy}
            disabled={record.turns.length === 0}
            onClick={() => void makeNotes()}
          >
            {busy ? 'Writing notes… can take up to a minute' : record.notes ? 'Regenerate notes' : 'Post-call notes'}
          </Button>
          <span className="flex-1" />
          <Button
            variant={confirmDelete ? 'confirm' : 'danger'}
            icon={confirmDelete ? undefined : 'delete'}
            onClick={() => (confirmDelete ? void window.sarthi.deleteHistorySession(id) : setConfirmDelete(true))}
            onMouseLeave={() => setConfirmDelete(false)}
          >
            {confirmDelete ? 'Click again to delete' : 'Delete'}
          </Button>
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>

      <div className="flex gap-5 border-b border-line px-6" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px flex h-10 items-center gap-1.5 border-b-2 text-[13px] transition-colors duration-120 focus-ring ${
              tab === t.key ? 'border-leaf text-fg' : 'border-transparent text-fg-muted hover:text-fg-soft'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="text-[11.5px] text-fg-3 tabular-nums">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {tab === 'notes' &&
          (record.notes ? (
            report ? (
              <Report report={report} />
            ) : (
              <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-fg">{record.notes}</p>
            )
          ) : (
            <EmptyState icon="answers" title="No notes yet">
              Post-call notes review the transcript and list what went well, what to improve and what to prepare next.
            </EmptyState>
          ))}
        {tab === 'answers' && (
          <div className="flex flex-col gap-3">
            {record.answers.length === 0 && <p className="text-sm text-fg-3">No answers were suggested in this session.</p>}
            {record.answers.map((answer, i) => (
              <div key={`${answer.at}-${i}`} className="rounded-panel border border-line bg-panel p-4">
                <div className="mb-2 flex gap-2 text-[12.5px] leading-snug text-fg-muted">
                  <span className="shrink-0 font-bold text-leaf">Q</span>
                  <span className="flex-1">{answer.question}</span>
                  <span className="shrink-0 text-fg-3 tabular-nums">{formatClock(record.startedAt, answer.at)}</span>
                </div>
                <AnswerContent text={answer.text} />
              </div>
            ))}
          </div>
        )}
        {tab === 'transcript' && (
          <div className="flex flex-col gap-2">
            {record.turns.length === 0 && <p className="text-sm text-fg-3">No transcript.</p>}
            {record.turns.map((turn) => (
              <div key={turn.id} className="grid grid-cols-[44px_88px_minmax(0,1fr)] gap-2 text-[13px] leading-normal">
                <span className="pt-px text-xs text-fg-3 tabular-nums">{formatClock(record.startedAt, turn.at)}</span>
                <span className={`pt-0.5 text-[10.5px] font-semibold tracking-[.05em] uppercase ${turn.speaker === 'you' ? 'text-you' : 'text-leaf'}`}>
                  {turn.speaker === 'you' ? 'You' : 'Interviewer'}
                </span>
                <span className="text-fg-soft">{turn.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function HistoryPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const sessions = useSessions(query)
  const visible = filterSessions(sessions, filter)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    window.sarthi.listHistory().then((list) => setTotal(list.length))
    return window.sarthi.onHistoryChanged((list) => setTotal(list.length))
  }, [])

  // Keep a valid selection: the first session when nothing (or a deleted one) is selected.
  const current = visible.find((s) => s.id === selected) ? selected : (visible[0]?.id ?? null)

  if (total === 0 && !query) {
    return (
      <>
        <h1 className="mb-6 text-xl font-semibold">History</h1>
        <div className="rounded-panel border border-line bg-panel">
          <EmptyState
            icon="history"
            title="No sessions yet."
            action={
              <Button onClick={() => window.sarthi.showOverlay()} className="mt-1">
                Show overlay <Keys keys={keysFor('toggle-overlay')} />
              </Button>
            }
          >
            Each session is saved here when you stop listening. The latest 100 are kept on this PC.
          </EmptyState>
        </div>
      </>
    )
  }

  return (
    <div className="flex h-[calc(100vh-48px)] min-h-[460px] flex-col">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">History</h1>
        <span className="text-[13px] text-fg-3">
          {total} {total === 1 ? 'session' : 'sessions'}
        </span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[264px_minmax(0,1fr)] overflow-hidden rounded-panel border border-line bg-[#0f1411]">
        <div className="flex min-h-0 flex-col border-r border-line">
          <div className="flex flex-col gap-2.5 border-b border-line p-3">
            <label className="flex h-[34px] items-center gap-2 rounded-md border border-line bg-ink px-2.5 focus-within:border-leaf focus-within:shadow-[0_0_0_3px_rgba(74,222,128,0.18)]">
              <Icon name="search" size={14} className="text-fg-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions and transcripts"
                aria-label="Search history"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[#6b7a70]"
              />
            </label>
            <Segmented<HistoryFilter>
              label="Filter sessions"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'notes', label: 'With notes' },
                { value: 'unfinished', label: 'Unfinished' }
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {visible.length === 0 && <p className="px-2 py-4 text-[12.5px] text-fg-3">No sessions match.</p>}
            {visible.map((s) => {
              const active = s.id === current
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`mb-1 flex w-full flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors duration-120 focus-ring ${
                    active ? 'border-line bg-[#151d17]' : 'border-transparent hover:bg-hover'
                  }`}
                >
                  <span className="flex items-start gap-2">
                    <span className="line-clamp-2 flex-1 text-[13px] leading-snug">{s.title}</span>
                    {s.hasNotes && <Badge tone="notes">Notes</Badge>}
                  </span>
                  <span className="text-[11.5px] text-fg-2">{formatWhen(s.startedAt)}</span>
                  <span className={`text-[11.5px] ${s.endedAt === null ? 'text-warn' : 'text-fg-3'}`}>{sessionMeta(s)}</span>
                </button>
              )
            })}
          </div>
        </div>
        {current ? (
          <SessionDetail key={current} id={current} />
        ) : (
          <div className="flex items-center justify-center text-sm text-fg-3">Select a session</div>
        )}
      </div>
    </div>
  )
}

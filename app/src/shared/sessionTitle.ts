import type { SessionRecord } from './types'

/**
 * What a session is about: the first question that got an answer (calls usually open with a greeting), else the
 * first interviewer line. Shared so the History list (main) and detail view (renderer) agree.
 */
export function sessionTitle(record: Pick<SessionRecord, 'turns' | 'answers'>): string {
  const first = record.turns.find((turn) => turn.speaker === 'interviewer') ?? record.turns[0]
  return record.answers[0]?.question ?? first?.text ?? 'Untitled session'
}

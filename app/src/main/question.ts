// Decide whether an interviewer utterance is a question worth answering.
// Heuristic only (fast, no API call): a question mark, a wh-/auxiliary-verb opener,
// or a common interview imperative ("tell me", "walk me through", "describe"...).

const WH_OPENER = /^(who|what|when|where|why|which|whose|whom|how)\b/i

const AUX_OPENER =
  /^(are|is|was|were|do|does|did|can|could|would|will|shall|should|have|has|had|may|might)\b/i

const IMPERATIVE_OPENER =
  /^(tell me|walk me|describe|explain|give me|share|talk about|what about|how about|let's talk|lets talk|i'?d like you to|i want you to|suppose|imagine)\b/i

export function isQuestion(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (trimmed.endsWith('?')) return true
  const lower = trimmed.toLowerCase()
  return WH_OPENER.test(lower) || AUX_OPENER.test(lower) || IMPERATIVE_OPENER.test(lower)
}

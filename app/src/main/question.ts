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

export type QuestionMode = 'behavioral' | 'technical' | 'coding' | 'general'

// Checked in this order: a story question stays behavioral even when it mentions technical work
// ("tell me about a time you designed…"), and coding words beat general technical ones.
const BEHAVIORAL =
  /\b(tell me about a time|describe a (time|situation)|give (me )?an example|example of a time|a time (when|you)|conflicts?|disagree(d|ment)?|fail(ed|ure)|mistakes?|weakness(es)?|strengths?|proud|challenge you|challenging situation|difficult (situation|person|colleague|team|stakeholder)|how did you (handle|deal|manage|resolve)|feedback|leadership|teamwork|deadlines?|under pressure)\b/i
const CODING =
  /\b(code|coding|algorithms?|functions?|implement|write a program|complexity|big[- ]?o|arrays?|substrings?|strings?|linked lists?|binary (search|tree)|trees?|graphs?|hash ?maps?|recursion|recursive|sort(ing|ed)?|leetcode|sql query|debug(ging)?|output of|data structures?|dynamic programming)\b/i
const TECHNICAL =
  /\b(design|architect(ure)?|scal(e|ing|ability)|trade-?offs?|difference between|how does|how do .+ work|what is (a|an|the)|what are|protocols?|databases?|latency|throughput|security|network(s|ing)?|apis?|microservices?|cach(e|ing)|concurrency|kubernetes|cloud|distributed|systems?)\b/i

/** What kind of answer the question needs; picks the shape of the system prompt. */
export function classifyQuestion(text: string, { screenshots = 0 }: { screenshots?: number } = {}): QuestionMode {
  if (screenshots > 0) return 'coding'
  if (BEHAVIORAL.test(text)) return 'behavioral'
  if (CODING.test(text)) return 'coding'
  if (TECHNICAL.test(text)) return 'technical'
  return 'general'
}

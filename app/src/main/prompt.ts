import type { Settings, TranscriptTurn } from '../shared/types'

// How many recent transcript turns to hand the model as conversation context.
const CONTEXT_TURNS = 8

const LENGTH: Record<Settings['responseLength'], string> = {
  short: 'Keep it very brief: 2-3 sentences, or 2-3 bullets.',
  medium: 'Keep it focused: about 4-6 sentences, or 3-5 bullets.',
  long: 'Give a thorough answer: 2-3 short paragraphs, or 5-7 bullets.'
}

const TONE: Record<Settings['responseTone'], string> = {
  professional: 'Sound polished and professional.',
  conversational: 'Sound natural and conversational, like real speech.',
  confident: 'Sound confident and assertive, without arrogance.'
}

export function buildSystemPrompt(settings: Settings): string {
  const lines = [
    'You are an interview copilot. The user is a candidate in a live job interview and the interviewer has just asked something.',
    'Write the answer the candidate should say, in the first person ("I"), ready to speak aloud.',
    'Respond with the answer itself only — no preamble, no "Here is", no quotation marks, no meta commentary.',
    LENGTH[settings.responseLength],
    settings.responseFormat === 'bullets'
      ? 'Format the answer as short bullet points, one per line starting with "- ".'
      : 'Format the answer as flowing prose paragraphs, not bullets.',
    TONE[settings.responseTone]
  ]
  if (settings.useStarMethod) {
    lines.push(
      'When the question is behavioral ("tell me about a time..."), structure the answer with the STAR method (Situation, Task, Action, Result) without labeling the parts.'
    )
  }
  if (settings.useFillerWords) {
    lines.push('Add a few light, natural spoken fillers so it sounds human, not scripted.')
  } else {
    lines.push('Do not add filler words; keep it crisp.')
  }

  const resume = settings.resume.trim()
  const jd = settings.jobDescription.trim()
  const notes = settings.notes.trim()
  if (resume || jd || notes) {
    lines.push('Ground the answer in the candidate context below — use real specifics from it, never invent facts about the candidate.')
    if (resume) lines.push(`Candidate résumé:\n${resume}`)
    if (jd) lines.push(`Job description:\n${jd}`)
    if (notes) lines.push(`Extra notes to weave in when relevant:\n${notes}`)
  }
  return lines.join('\n')
}

export function buildUserPrompt(question: string, turns: readonly TranscriptTurn[]): string {
  const recent = turns
    .slice(-CONTEXT_TURNS)
    .map((turn) => `${turn.speaker === 'you' ? 'Me' : 'Interviewer'}: ${turn.text}`)
    .join('\n')
  return [
    recent && `Recent conversation:\n${recent}`,
    `The interviewer just asked:\n"${question}"`,
    'Give me the answer I should say.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

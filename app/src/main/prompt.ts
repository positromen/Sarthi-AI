import { OUTPUT_LANGUAGES } from '../shared/languages'
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

function languageInstruction(code: string): string {
  if (code === 'hinglish') {
    return 'Write the answer in Hinglish: natural spoken Hindi mixed with English, in Roman (Latin) script, not Devanagari.'
  }
  const name = OUTPUT_LANGUAGES.find((language) => language.value === code)?.label ?? 'English'
  return `Write the answer in ${name}, whatever language the interviewer used.`
}

export function buildSystemPrompt(settings: Settings): string {
  const lines = [
    'You are an interview copilot. The user is a candidate in a live job interview and the interviewer has just asked something.',
    'Write the answer the candidate should say, in the first person ("I"), ready to speak aloud.',
    'Respond with the answer itself only — no preamble, no "Here is", no quotation marks, no meta commentary.',
    'Never break character: do not apologise, refuse, mention being an AI, or point out that the question does not match the candidate\'s background. If it falls outside that background, still give the answer a strong candidate would say: answer the subject directly, and bridge to related experience only where it fits naturally.',
    'The question comes from live speech recognition and may be garbled, cut off, or mixed with other speech. Infer the most likely question and answer that.',
    LENGTH[settings.responseLength],
    settings.responseFormat === 'bullets'
      ? 'Format the answer as short bullet points, one per line starting with "- ".'
      : 'Format the answer as flowing prose paragraphs, not bullets.',
    TONE[settings.responseTone],
    languageInstruction(settings.outputLanguage)
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
    lines.push(
      'Ground the answer in the candidate context below: use real specifics from it where relevant, and never invent employers, roles or projects. For questions it does not cover, answer from general knowledge in the candidate\'s voice.'
    )
    if (resume) lines.push(`Candidate résumé:\n${resume}`)
    if (jd) lines.push(`Job description:\n${jd}`)
    if (notes) lines.push(`Extra notes to weave in when relevant:\n${notes}`)
  }
  return lines.join('\n')
}

export interface UserPromptOptions {
  /** How many screenshots ride along with the request. */
  screenshots?: number
  outputLanguage?: string
}

export function buildUserPrompt(
  question: string,
  turns: readonly TranscriptTurn[],
  { screenshots: screenshotCount = 0, outputLanguage = 'en' }: UserPromptOptions = {}
): string {
  const recent = turns
    .slice(-CONTEXT_TURNS)
    .map((turn) => `${turn.speaker === 'you' ? 'Me' : 'Interviewer'}: ${turn.text}`)
    .join('\n')
  const screenshots =
    screenshotCount > 0 &&
    `I've attached ${screenshotCount} ${screenshotCount === 1 ? 'screenshot' : 'screenshots'} of my screen, oldest first. ` +
      'Use them when the question is about what is on screen. For a coding problem, give working code in a fenced ' +
      'code block plus a brief explanation of the approach and its complexity.'
  return [
    recent && `Recent conversation:\n${recent}`,
    screenshots,
    `The interviewer just asked:\n"${question}"`,
    // Repeated here, last, because a transcript in another language can outweigh the system prompt's rule.
    `Give me the answer I should say.\n${languageInstruction(outputLanguage)}`
  ]
    .filter(Boolean)
    .join('\n\n')
}

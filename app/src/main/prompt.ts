import { OUTPUT_LANGUAGES } from '../shared/languages'
import type { Settings, TranscriptTurn } from '../shared/types'
import { classifyQuestion, type QuestionMode } from './question'
import { selectProfile } from './rag'

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

// Post-call notes read the end of a long call: a ~60k-character cap keeps an hour-long transcript in one request.
const NOTES_TRANSCRIPT_CHARS = 60_000

const languageName = (code: string): string =>
  OUTPUT_LANGUAGES.find((language) => language.value === code)?.label ?? 'English'

function languageInstruction(code: string): string {
  if (code === 'hinglish') {
    return 'Write the answer in Hinglish: natural spoken Hindi mixed with English, in Roman (Latin) script, not Devanagari.'
  }
  return `Write the answer in ${languageName(code)}, whatever language the interviewer used.`
}

const transcriptLine = (turn: TranscriptTurn): string =>
  `${turn.speaker === 'you' ? 'Me' : 'Interviewer'}: ${turn.text}`

// What the overlay renders (see renderer/overlay/markdown.ts); anything else shows as plain text.
const FORMATTING =
  'Formatting: use **bold** sparingly for key terms, `backticks` for identifiers, fenced code blocks with a language tag for code, and LaTeX between $…$ for math (for example $O(n \\log n)$).'

const STAR =
  'Structure the answer with the STAR method (Situation, Task, Action, Result) without labeling the parts.'

const MODE_GUIDE: Record<Exclude<QuestionMode, 'behavioral' | 'general'>, string> = {
  technical:
    'This is a technical question: lead with the direct answer, then the key trade-offs, then a concrete example from my experience if there is one.',
  coding:
    'This is a coding question: give the approach in one or two sentences, then working code in a fenced code block with a language tag, then the time and space complexity.'
}

function modeInstruction(mode: QuestionMode | null, useStar: boolean): string | null {
  if (mode === 'technical' || mode === 'coding') return MODE_GUIDE[mode]
  if (mode === 'behavioral') {
    return useStar
      ? `This is a behavioral question. ${STAR}`
      : 'This is a behavioral question: tell it as one concrete story of what happened, what I did, and the result.'
  }
  // No question known (e.g. a preview of the prompt): keep the general STAR rule.
  if (mode === null && useStar) return `When the question is behavioral ("tell me about a time..."), ${STAR.charAt(0).toLowerCase()}${STAR.slice(1)}`
  return null
}

/**
 * With `question`, the answer shape follows its mode (behavioral, technical, coding; screenshots mean coding) and a
 * large profile is narrowed to the parts relevant to it (see rag.ts).
 */
export function buildSystemPrompt(settings: Settings, question?: string, screenshots = 0): string {
  const mode = question ? classifyQuestion(question, { screenshots }) : null
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
    languageInstruction(settings.outputLanguage),
    FORMATTING
  ]
  const modeLine = modeInstruction(mode, settings.useStarMethod)
  if (modeLine) lines.push(modeLine)
  if (settings.useFillerWords) {
    lines.push('Add a few light, natural spoken fillers so it sounds human, not scripted.')
  } else {
    lines.push('Do not add filler words; keep it crisp.')
  }

  const full = { resume: settings.resume.trim(), jobDescription: settings.jobDescription.trim(), notes: settings.notes.trim() }
  const profile = question ? selectProfile(full, question) : full
  const narrowed = profile !== full
  const { resume, jobDescription: jd, notes } = profile
  if (resume || jd || notes) {
    lines.push(
      'Ground the answer in the candidate context below: use real specifics from it where relevant, and never invent employers, roles or projects. For questions it does not cover, answer from general knowledge in the candidate\'s voice.'
    )
    if (narrowed) {
      lines.push('The profile is long, so below are the parts most relevant to this question ("…" marks skipped text).')
    }
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
  const recent = turns.slice(-CONTEXT_TURNS).map(transcriptLine).join('\n')
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

/** The most recent turns that fit the cap, oldest first. */
function tailTranscript(turns: readonly TranscriptTurn[]): string {
  const lines: string[] = []
  let size = 0
  for (let i = turns.length - 1; i >= 0; i--) {
    const line = transcriptLine(turns[i])
    if (size + line.length + 1 > NOTES_TRANSCRIPT_CHARS) break
    lines.push(line)
    size += line.length + 1
  }
  return lines.reverse().join('\n')
}

/** Prompts for post-call coaching notes on a finished session. */
export function buildNotesPrompt(
  turns: readonly TranscriptTurn[],
  settings: Settings
): { system: string; user: string } {
  const lines = [
    'You are an interview coach reviewing the transcript of a job interview the user just finished. "Me" is the user (the candidate); "Interviewer" is the other side.',
    'The transcript comes from live speech recognition and may be garbled; judge what was meant.',
    'Write short, specific, honest notes in exactly these sections, each a heading line followed by "- " bullets:',
    'Overall — two or three bullets on how it went.',
    'Went well — the strongest answers or moments, quoting briefly.',
    'To improve — weak, vague or missed answers, each with what a better answer would include.',
    'Prepare next — topics and likely follow-up questions to prepare for the next round.',
    'Address the user as "you". No preamble.'
  ]
  const jd = settings.jobDescription.trim()
  if (jd) lines.push(`The role they interviewed for:\n${jd}`)

  const language =
    settings.outputLanguage === 'hinglish'
      ? 'Write the notes in Hinglish (Hindi mixed with English, in Roman script).'
      : `Write the notes in ${languageName(settings.outputLanguage)}.`
  return {
    system: lines.join('\n'),
    user: `Interview transcript:\n${tailTranscript(turns)}\n\n${language}`
  }
}

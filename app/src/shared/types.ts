/** Which model writes answers. Anthropic is listed for later but not wired; it behaves like Gemini. */
export type LlmProvider = 'gemini' | 'groq' | 'anthropic'

export type ResponseLength = 'short' | 'medium' | 'long'
export type ResponseFormat = 'bullets' | 'paragraph'
export type ResponseTone = 'professional' | 'conversational' | 'confident'
/** How readily quiet sound counts as speech when skipping silence. */
export type VadSensitivity = 'low' | 'normal' | 'high'

export interface Settings {
  privateMode: boolean
  autoAnswer: boolean
  llmProvider: LlmProvider
  /** Deepgram language code the call is transcribed in (see shared/languages.ts). */
  listeningLanguage: string
  /** Language the answer is written in; independent of what the interviewer speaks. */
  outputLanguage: string
  /** Send audio to Deepgram only around speech (saves Deepgram minutes). */
  vadEnabled: boolean
  vadSensitivity: VadSensitivity
  responseLength: ResponseLength
  responseFormat: ResponseFormat
  responseTone: ResponseTone
  useStarMethod: boolean
  useFillerWords: boolean
  overlayOpacity: number
  /** Answer-only overlay: a one-line question header and the answer, nothing else. */
  overlayCompact: boolean
  /** Allow screenshots (hotkey, overlay button) and send them with answers. */
  screenshotsEnabled: boolean
  /** First-run onboarding finished (or skipped because keys were already set up). */
  onboarded: boolean
  /** Profile the answer engine draws on for tailored, specific answers. Plain text for now (PDF import later). */
  resume: string
  jobDescription: string
  notes: string
}

export const DEFAULT_SETTINGS: Settings = {
  privateMode: true,
  autoAnswer: true,
  llmProvider: 'gemini',
  listeningLanguage: 'en',
  outputLanguage: 'en',
  vadEnabled: false,
  vadSensitivity: 'normal',
  responseLength: 'medium',
  responseFormat: 'bullets',
  responseTone: 'professional',
  useStarMethod: true,
  useFillerWords: false,
  overlayOpacity: 0.92,
  overlayCompact: false,
  screenshotsEnabled: true,
  onboarded: false,
  resume: '',
  jobDescription: '',
  notes: ''
}

/** Stored settings merged over the defaults, upgrading fields renamed in earlier versions. */
export function withDefaults(stored: Record<string, unknown>): Settings {
  const { transcriptionLanguage, ...rest } = stored
  const upgraded = typeof transcriptionLanguage === 'string' ? { listeningLanguage: transcriptionLanguage, ...rest } : rest
  return { ...DEFAULT_SETTINGS, ...upgraded } as Settings
}

export type Hotkey ='answer' | 'scroll-up' | 'scroll-down' | 'toggle-listening' | 'focus-ask'

export const API_KEY_NAMES = ['deepgram', 'gemini', 'groq', 'anthropic'] as const
export type ApiKeyName = (typeof API_KEY_NAMES)[number]
/** Keys the app needs before it can listen and answer (onboarding asks for all three). */
export const REQUIRED_KEYS: readonly ApiKeyName[] = ['deepgram', 'gemini', 'groq']
export type ApiKeyStatus = Record<ApiKeyName, boolean>
/** Result of testing a key with its provider before saving it. */
export type KeyCheck = { ok: true; warning?: string } | { ok: false; message: string }

/** Channel 0 of the stereo stream is the mic, channel 1 is system loopback audio. */
export type Speaker = 'you' | 'interviewer'
export const SPEAKER_BY_CHANNEL: readonly Speaker[] = ['you', 'interviewer']

export interface TranscriptTurn {
  id: number
  speaker: Speaker
  text: string
  at: number
}

export interface InterimTranscript {
  speaker: Speaker
  text: string
}

export type ListeningStatus = 'idle' | 'connecting' | 'listening' | 'error'

export interface SessionState {
  status: ListeningStatus
  error?: string
}

/** A captured screenshot as the overlay sees it; the full-size image stays in main. */
export interface ScreenshotInfo {
  id: number
  /** Small PNG data URL for the overlay strip. */
  thumbnail: string
  at: number
}

export interface HistoryAnswer {
  question: string
  text: string
  at: number
}

/** One listening session as saved on disk, under userData/history. */
export interface SessionRecord {
  /** The start time in ms, as a string; also the file name. */
  id: string
  startedAt: number
  /** Null while the session is still running (or if the app quit mid-session). */
  endedAt: number | null
  turns: TranscriptTurn[]
  answers: HistoryAnswer[]
  /** Post-call coaching notes, once generated. */
  notes: string | null
}

export interface SessionSummary {
  id: string
  startedAt: number
  endedAt: number | null
  turnCount: number
  answerCount: number
  /** The first interviewer turn, shortened, so sessions are recognisable in a list. */
  title: string
  hasNotes: boolean
}

export type AnswerStatus = 'idle' | 'thinking' | 'streaming' | 'done' | 'error'

export interface AnswerState {
  status: AnswerStatus
  /** The answer text, accumulated as it streams. */
  text: string
  /** The interviewer question this answer is for, or null when idle. */
  question: string | null
  error?: string
}

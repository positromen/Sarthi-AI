export type LlmProvider = 'gemini' | 'anthropic'

export type ResponseLength = 'short' | 'medium' | 'long'
export type ResponseFormat = 'bullets' | 'paragraph'
export type ResponseTone = 'professional' | 'conversational' | 'confident'

export interface Settings {
  privateMode: boolean
  autoAnswer: boolean
  llmProvider: LlmProvider
  /** Deepgram language code the call is transcribed in (see shared/languages.ts). */
  listeningLanguage: string
  /** Language the answer is written in; independent of what the interviewer speaks. */
  outputLanguage: string
  responseLength: ResponseLength
  responseFormat: ResponseFormat
  responseTone: ResponseTone
  useStarMethod: boolean
  useFillerWords: boolean
  overlayOpacity: number
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
  responseLength: 'medium',
  responseFormat: 'bullets',
  responseTone: 'professional',
  useStarMethod: true,
  useFillerWords: false,
  overlayOpacity: 0.92,
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

export type ApiKeyName = 'deepgram' | 'gemini' | 'anthropic'
export type ApiKeyStatus = Record<ApiKeyName, boolean>

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

export type AnswerStatus ='idle' | 'thinking' | 'streaming' | 'done' | 'error'

export interface AnswerState {
  status: AnswerStatus
  /** The answer text, accumulated as it streams. */
  text: string
  /** The interviewer question this answer is for, or null when idle. */
  question: string | null
  error?: string
}

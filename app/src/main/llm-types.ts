// The request every answer provider (gemini.ts, groq.ts) accepts, so llm.ts can route between them.

export interface LlmImage {
  mimeType: string
  /** Base64-encoded image bytes. */
  data: string
}

export interface LlmRequest {
  apiKey: string
  system: string
  user: string
  /** Screenshots sent with the question (e.g. a coding problem on screen). */
  images?: readonly LlmImage[]
  /** Overrides the default answer budget (e.g. for longer post-call notes). */
  maxOutputTokens?: number
  signal?: AbortSignal
}

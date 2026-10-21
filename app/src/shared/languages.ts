export interface LanguageOption {
  value: string
  label: string
}

/**
 * Deepgram nova-3 language codes for transcription. "multi" auto-detects and handles code-switching
 * (e.g. an interviewer mixing English and Hindi) across English, Hindi, Spanish, French, German,
 * Portuguese, Italian, Dutch, Russian and Japanese.
 */
export const LISTENING_LANGUAGES: readonly LanguageOption[] = [
  { value: 'en', label: 'English' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'multi', label: 'Multilingual (auto, mixed English/Hindi etc.)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' }
]

/** Languages the answer can be written in. The label doubles as the language name in the prompt. */
export const OUTPUT_LANGUAGES: readonly LanguageOption[] = [
  { value: 'en', label: 'English' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' }
]

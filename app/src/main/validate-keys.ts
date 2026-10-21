// Checks an API key before it is saved, with one cheap authenticated GET, so a mistyped key is caught in Setup
// instead of mid-interview. Keys travel in headers only. A provider that can't be reached doesn't block saving.
import type { ApiKeyName, KeyCheck } from '../shared/types'

interface Check {
  url: string
  headers: (key: string) => Record<string, string>
  /** Who to name in the message (Gemini keys come from Google). */
  owner: string
  /** Statuses meaning "this key is wrong". */
  rejected: number[]
}

const CHECKS: Partial<Record<ApiKeyName, Check>> = {
  deepgram: {
    url: 'https://api.deepgram.com/v1/projects',
    headers: (key) => ({ authorization: `Token ${key}` }),
    owner: 'Deepgram',
    rejected: [401, 403]
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
    headers: (key) => ({ 'x-goog-api-key': key }),
    owner: 'Google',
    // An invalid Gemini key answers 400 (API_KEY_INVALID), not 401.
    rejected: [400, 401, 403]
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    headers: (key) => ({ authorization: `Bearer ${key}` }),
    owner: 'Groq',
    rejected: [401, 403]
  }
}

const TIMEOUT_MS = 8000

export async function validateKey(name: ApiKeyName, key: string, fetchImpl: typeof fetch = fetch): Promise<KeyCheck> {
  const check = CHECKS[name]
  if (!check) return { ok: true }
  try {
    const response = await fetchImpl(check.url, {
      method: 'GET',
      headers: check.headers(key.trim()),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (response.ok) return { ok: true }
    if (check.rejected.includes(response.status)) {
      return { ok: false, message: `${check.owner} rejected this key (${response.status}).` }
    }
    return { ok: true, warning: `Saved, but ${check.owner} answered ${response.status}; the key couldn't be confirmed yet.` }
  } catch {
    return { ok: true, warning: `Saved. Couldn't check it with ${check.owner} (no connection?).` }
  }
}

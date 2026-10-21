import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ApiKeyName, ApiKeyStatus } from '../shared/types'

// Keys are encrypted with the OS keychain (DPAPI on Windows) and never leave the main process.
const keysPath = () => join(app.getPath('userData'), 'keys.json')

type EncryptedKeys = Partial<Record<ApiKeyName, string>>

function readEncrypted(): EncryptedKeys {
  try {
    return JSON.parse(readFileSync(keysPath(), 'utf8'))
  } catch {
    return {}
  }
}

export function getKey(name: ApiKeyName): string | null {
  const encrypted = readEncrypted()[name]
  if (!encrypted) return null
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return null
  }
}

export function setKey(name: ApiKeyName, value: string): ApiKeyStatus {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is unavailable; refusing to store keys')
  const encrypted = readEncrypted()
  const trimmed = value.trim()
  if (trimmed) encrypted[name] = safeStorage.encryptString(trimmed).toString('base64')
  else delete encrypted[name]
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(keysPath(), JSON.stringify(encrypted, null, 2))
  return getKeyStatus()
}

export function getKeyStatus(): ApiKeyStatus {
  const encrypted = readEncrypted()
  return {
    deepgram: !!encrypted.deepgram,
    gemini: !!encrypted.gemini,
    groq: !!encrypted.groq,
    anthropic: !!encrypted.anthropic
  }
}

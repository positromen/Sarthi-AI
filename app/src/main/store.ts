import { app } from 'electron'
import { copyFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type Settings } from '../shared/types'

const settingsPath = () => join(app.getPath('userData'), 'settings.json')

// userData follows the package name, which changed when the app was renamed to Sarthi AI.
const LEGACY_USER_DATA_DIR = 'sarthi-ai'

/**
 * Carry settings (answer style + profile) over from the pre-rename folder, once. API keys are not copied:
 * safeStorage ties them to the old profile, so they are simply re-entered.
 */
export function migrateLegacySettings(): void {
  const target = settingsPath()
  const legacy = join(app.getPath('appData'), LEGACY_USER_DATA_DIR, 'settings.json')
  if (existsSync(target) || !existsSync(legacy)) return
  mkdirSync(app.getPath('userData'), { recursive: true })
  copyFileSync(legacy, target)
}

let cache: Settings | null = null

export function getSettings(): Settings {
  if (cache) return cache
  try {
    cache = { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(settingsPath(), 'utf8')) }
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache!
}

export function updateSettings(patch: Partial<Settings>): Settings {
  cache = { ...getSettings(), ...patch }
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(cache, null, 2))
  return cache
}

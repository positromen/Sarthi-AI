import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, parseSettings, type Settings } from '../shared/types'

const settingsPath = () => join(app.getPath('userData'), 'settings.json')

let cache: Settings | null = null

export function getSettings(): Settings {
  if (cache) return cache
  try {
    cache = parseSettings(readFileSync(settingsPath(), 'utf8'))
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

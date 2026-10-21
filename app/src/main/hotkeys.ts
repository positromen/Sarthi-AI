import { globalShortcut } from 'electron'
import {
  acceleratorKeys,
  DEFAULT_HOTKEYS,
  FIXED_HOTKEYS,
  hotkeyConflict,
  REBINDABLE,
  sameAccelerator,
  type HotkeyAction
} from '../shared/hotkeys'
import { IPC } from '../shared/ipc'
import type { Hotkey } from '../shared/types'
import { captureScreenshot } from './screenshot'
import { getSettings, updateSettings } from './store'
import {
  applyPrivacy,
  broadcast,
  focusOverlay,
  getOverlay,
  moveOverlay,
  openSettingsWindow,
  toggleOverlayVisible
} from './windows'

function sendHotkey(key: Hotkey): void {
  getOverlay()?.webContents.send(IPC.hotkey, key)
}

function saveSettings(patch: Parameters<typeof updateSettings>[0]): void {
  broadcast(IPC.settingsChanged, updateSettings(patch))
}

const HANDLERS: Record<HotkeyAction, () => void> = {
  'toggle-listening': () => sendHotkey('toggle-listening'),
  answer: () => sendHotkey('answer'),
  'focus-ask': () => {
    focusOverlay()
    sendHotkey('focus-ask')
  },
  screenshot: () => {
    captureScreenshot().catch((error) => console.warn('Screenshot failed:', error))
  },
  'toggle-overlay': toggleOverlayVisible,
  'open-settings': () => openSettingsWindow(),
  'toggle-private': () => {
    const privateMode = !getSettings().privateMode
    saveSettings({ privateMode })
    applyPrivacy()
  }
}

const FIXED: [string, () => void][] = [
  [FIXED_HOTKEYS.scroll[0], () => sendHotkey('scroll-up')],
  [FIXED_HOTKEYS.scroll[1], () => sendHotkey('scroll-down')],
  [FIXED_HOTKEYS.move[0], () => moveOverlay(0, -1)],
  [FIXED_HOTKEYS.move[1], () => moveOverlay(0, 1)],
  [FIXED_HOTKEYS.move[2], () => moveOverlay(-1, 0)],
  [FIXED_HOTKEYS.move[3], () => moveOverlay(1, 0)]
]

// Actions whose shortcut another app already holds; the Hotkeys page shows them as conflicts.
let unavailable: HotkeyAction[] = []

/** (Re)registers every shortcut from settings. Returns the actions whose shortcut another app has taken. */
export function registerHotkeys(): HotkeyAction[] {
  globalShortcut.unregisterAll()
  for (const [accelerator, handler] of FIXED) {
    if (!globalShortcut.register(accelerator, handler)) console.warn(`Hotkey ${accelerator} is taken by another app`)
  }
  const hotkeys = getSettings().hotkeys
  unavailable = REBINDABLE.filter((action) => !safeRegister(hotkeys[action], HANDLERS[action]))
  for (const action of unavailable) console.warn(`Hotkey ${hotkeys[action]} (${action}) is taken by another app`)
  return unavailable
}

export const unavailableHotkeys = (): HotkeyAction[] => unavailable

// Electron throws on a malformed accelerator; a stored value is treated as "not registered" instead.
function safeRegister(accelerator: string, handler: () => void): boolean {
  try {
    return globalShortcut.register(accelerator, handler)
  } catch {
    return false
  }
}

export type HotkeyResult = { ok: true } | { ok: false; message: string }

/**
 * Rebinds one action. Refused when the combination belongs to another Sarthi action, a fixed shortcut, or another
 * app; in that last case the previous shortcut is restored.
 */
export function setHotkey(action: unknown, accelerator: unknown): HotkeyResult {
  if (typeof action !== 'string' || !(REBINDABLE as readonly string[]).includes(action) || typeof accelerator !== 'string') {
    return { ok: false, message: 'Unknown shortcut.' }
  }
  const name = action as HotkeyAction
  const hotkeys = getSettings().hotkeys
  const conflict = hotkeyConflict(hotkeys, name, accelerator)
  if (conflict) return { ok: false, message: conflict }
  if (sameAccelerator(hotkeys[name], accelerator)) return { ok: true }

  globalShortcut.unregister(hotkeys[name])
  if (!safeRegister(accelerator, HANDLERS[name])) {
    safeRegister(hotkeys[name], HANDLERS[name])
    return { ok: false, message: `${acceleratorKeys(accelerator).join('+')} is taken by another app. Try a different combination.` }
  }
  unavailable = unavailable.filter((a) => a !== name)
  saveSettings({ hotkeys: { ...hotkeys, [name]: accelerator } })
  return { ok: true }
}

/** While the Hotkeys page records a new combination, nothing should fire (including the one being replaced). */
export function suspendHotkeys(suspended: boolean): void {
  if (suspended) globalShortcut.unregisterAll()
  else registerHotkeys()
}

export function resetHotkeys(): HotkeyAction[] {
  saveSettings({ hotkeys: { ...DEFAULT_HOTKEYS } })
  return registerHotkeys()
}

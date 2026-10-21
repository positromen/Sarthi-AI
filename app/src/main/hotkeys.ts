import { globalShortcut } from 'electron'
import { IPC } from '../shared/ipc'
import type { Hotkey } from '../shared/types'
import { captureScreenshot } from './screenshot'
import { getSettings, updateSettings } from './store'
import {
  broadcast,
  getOverlay,
  moveOverlay,
  openSettingsWindow,
  setPrivateMode,
  toggleOverlayVisible
} from './windows'

function sendHotkey(key: Hotkey): void {
  getOverlay()?.webContents.send(IPC.hotkey, key)
}

export function registerHotkeys(): void {
  const bindings: Record<string, () => void> = {
    'CommandOrControl+Shift+Enter': () => sendHotkey('answer'),
    'CommandOrControl+Shift+L': () => sendHotkey('toggle-listening'),
    'CommandOrControl+Shift+Up': () => sendHotkey('scroll-up'),
    'CommandOrControl+Shift+Down': () => sendHotkey('scroll-down'),
    'CommandOrControl+Shift+C': () => {
      captureScreenshot().catch((error) => console.warn('Screenshot failed:', error))
    },
    'CommandOrControl+Shift+H': toggleOverlayVisible,
    'CommandOrControl+Shift+S': openSettingsWindow,
    'CommandOrControl+Shift+P': () => {
      const settings = updateSettings({ privateMode: !getSettings().privateMode })
      setPrivateMode(settings.privateMode)
      broadcast(IPC.settingsChanged, settings)
    },
    'CommandOrControl+Alt+Up': () => moveOverlay(0, -1),
    'CommandOrControl+Alt+Down': () => moveOverlay(0, 1),
    'CommandOrControl+Alt+Left': () => moveOverlay(-1, 0),
    'CommandOrControl+Alt+Right': () => moveOverlay(1, 0)
  }
  for (const [accelerator, handler] of Object.entries(bindings)) {
    if (!globalShortcut.register(accelerator, handler)) {
      console.warn(`Hotkey ${accelerator} is taken by another app`)
    }
  }
}

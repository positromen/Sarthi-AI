import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, session } from 'electron'
import { basename, join } from 'node:path'
import { IPC } from '../shared/ipc'
import { API_KEY_NAMES, REQUIRED_KEYS, type ApiKeyName, type Settings } from '../shared/types'
import { getAnswerState } from './answer'
import { DOCUMENT_EXTENSIONS, extractDocumentText } from './documents'
import { getHistory, initHistory } from './history'
import { registerHotkeys, resetHotkeys, setHotkey, suspendHotkeys, unavailableHotkeys } from './hotkeys'
import { getKeyStatus, setKey } from './keys'
import { generateNotes } from './notes'
import { captureScreenshot, listScreenshots, removeScreenshot } from './screenshot'
import { getSessionState, pushAudioFrame, requestManualAnswer, startSession, stopSession } from './session'
import { getSettings, migrateLegacySettings, updateSettings } from './store'
import { destroyTray, syncTray } from './tray'
import { getUsage, initUsage } from './usage'
import { validateKey } from './validate-keys'
import {
  applyPrivacy,
  broadcast,
  endOverlayDrag,
  onPrivacyChange,
  createOverlayWindow,
  openSettingsWindow,
  setOverlayFocusable,
  setOverlayInteractive,
  showOverlay,
  startOverlayDrag
} from './windows'

if (!app.requestSingleInstanceLock()) app.quit()

if (process.platform === 'win32') {
  app.setAppUserModelId('ai.sarthi.app')
  // Windows occlusion tracking can pause rendering of a window it thinks is hidden behind others.
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
}

/**
 * getDisplayMedia() in the renderer is answered with the primary screen plus loopback audio, without a picker.
 * The renderer drops the video track and keeps only system audio (the interviewer's voice).
 */
function registerLoopbackAudio(): void {
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => callback(sources[0] ? { video: sources[0], audio: 'loopback' } : {}))
      .catch(() => callback({}))
  })
}

/** Prompt for a résumé/JD/notes file and return its extracted text, or null if the dialog was cancelled. */
async function importDocument(): Promise<{ name: string; text: string } | null> {
  const parent = BrowserWindow.getFocusedWindow()
  const options = {
    title: 'Import document',
    properties: ['openFile' as const],
    filters: [
      { name: 'Documents', extensions: [...DOCUMENT_EXTENSIONS] },
      { name: 'All files', extensions: ['*'] }
    ]
  }
  const result = await (parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options))
  const filePath = result.filePaths[0]
  if (result.canceled || !filePath) return null
  return { name: basename(filePath), text: await extractDocumentText(filePath) }
}

function registerIpc(): void {
  ipcMain.handle(IPC.getSettings, () => getSettings())
  ipcMain.handle(IPC.updateSettings, (_e, patch: Partial<Settings>) => {
    const settings = updateSettings(patch)
    if ('privateMode' in patch || 'onboarded' in patch) applyPrivacy()
    broadcast(IPC.settingsChanged, settings)
    return settings
  })
  ipcMain.handle(IPC.getKeyStatus, () => getKeyStatus())
  ipcMain.handle(IPC.setKey, (_e, name: ApiKeyName, value: string) => {
    if (!API_KEY_NAMES.includes(name) || typeof value !== 'string') throw new Error('Unknown API key.')
    const status = setKey(name, value)
    broadcast(IPC.keysChanged, status)
    return status
  })
  ipcMain.handle(IPC.validateKey, (_e, name: ApiKeyName, value: string) => {
    if (!API_KEY_NAMES.includes(name) || typeof value !== 'string') throw new Error('Unknown API key.')
    return validateKey(name, value)
  })
  ipcMain.handle(IPC.setHotkey, (_e, action: unknown, accelerator: unknown) => setHotkey(action, accelerator))
  ipcMain.handle(IPC.suspendHotkeys, (_e, suspended: unknown) => suspendHotkeys(suspended === true))
  ipcMain.handle(IPC.resetHotkeys, () => resetHotkeys())
  ipcMain.handle(IPC.unavailableHotkeys, () => unavailableHotkeys())
  ipcMain.handle(IPC.getAppInfo, () => ({ version: app.getVersion(), platform: process.platform }))
  ipcMain.handle(IPC.startSession, () => startSession())
  ipcMain.handle(IPC.stopSession, () => stopSession())
  ipcMain.handle(IPC.sessionState, () => getSessionState())
  ipcMain.handle(IPC.generateAnswer, (_e, typed?: string) =>
    requestManualAnswer(typeof typed === 'string' ? typed : undefined)
  )
  ipcMain.handle(IPC.getAnswerState, () => getAnswerState())
  ipcMain.handle(IPC.importDocument, () => importDocument())
  ipcMain.handle(IPC.getScreenshots, () => listScreenshots())
  ipcMain.handle(IPC.captureScreenshot, () => captureScreenshot())
  ipcMain.handle(IPC.removeScreenshot, (_e, id: number) => removeScreenshot(id))
  // Ids come from the renderer; the store validates them before touching the disk.
  ipcMain.handle(IPC.listHistory, () => getHistory()?.list() ?? [])
  ipcMain.handle(IPC.searchHistory, (_e, query: unknown) =>
    typeof query === 'string' ? (getHistory()?.search(query.slice(0, 200)) ?? []) : []
  )
  ipcMain.handle(IPC.getHistorySession, (_e, id: string) => getHistory()?.get(String(id)) ?? null)
  ipcMain.handle(IPC.deleteHistorySession, (_e, id: string) => getHistory()?.remove(String(id)) ?? false)
  ipcMain.handle(IPC.generateNotes, (_e, id: string) => generateNotes(String(id)))
  ipcMain.handle(IPC.getUsage, () => getUsage()?.report() ?? null)
  ipcMain.on(IPC.audioFrame, (_e, frame: ArrayBuffer) => pushAudioFrame(frame))
  ipcMain.on(IPC.setOverlayInteractive, (_e, interactive: boolean) => setOverlayInteractive(interactive))
  ipcMain.on(IPC.overlayDrag, (_e, phase: unknown) => (phase === 'start' ? startOverlayDrag() : endOverlayDrag()))
  ipcMain.handle(IPC.setOverlayFocusable, (_e, focusable: unknown) => setOverlayFocusable(focusable === true))
  ipcMain.on(IPC.openSettings, (_e, page?: unknown) => openSettingsWindow(typeof page === 'string' ? page : undefined))
  ipcMain.on(IPC.showOverlay, () => showOverlay())
  ipcMain.on(IPC.quitApp, () => app.quit())
}

app.on('second-instance', () => openSettingsWindow())

app.whenReady().then(() => {
  migrateLegacySettings()
  // Installs that were set up before onboarding existed already have their keys: don't walk them through it again.
  const keys = getKeyStatus()
  if (!getSettings().onboarded && REQUIRED_KEYS.every((name) => keys[name])) updateSettings({ onboarded: true })
  const history = initHistory(join(app.getPath('userData'), 'history'), {
    onChange: () => broadcast(IPC.historyChanged, history.list())
  })
  initUsage(join(app.getPath('userData'), 'usage.json'))
  registerIpc()
  registerLoopbackAudio()
  createOverlayWindow()
  registerHotkeys()
  onPrivacyChange(syncTray)
  syncTray()
  openSettingsWindow()
})

app.on('will-quit', () => {
  destroyTray()
  globalShortcut.unregisterAll()
  stopSession()
  // The socket's close event may not fire before the process exits, so save the running session now.
  getHistory()?.finish()
  getUsage()?.flush()
})
app.on('window-all-closed', () => app.quit())

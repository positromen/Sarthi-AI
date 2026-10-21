import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, session } from 'electron'
import { basename } from 'node:path'
import { IPC } from '../shared/ipc'
import type { ApiKeyName, Settings } from '../shared/types'
import { getAnswerState } from './answer'
import { DOCUMENT_EXTENSIONS, extractDocumentText } from './documents'
import { registerHotkeys } from './hotkeys'
import { getKeyStatus, setKey } from './keys'
import { captureScreenshot, listScreenshots, removeScreenshot } from './screenshot'
import { getSessionState, pushAudioFrame, requestManualAnswer, startSession, stopSession } from './session'
import { getSettings, migrateLegacySettings, updateSettings } from './store'
import {
  broadcast,
  createOverlayWindow,
  openSettingsWindow,
  setOverlayInteractive,
  setPrivateMode
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
    if ('privateMode' in patch) setPrivateMode(settings.privateMode)
    broadcast(IPC.settingsChanged, settings)
    return settings
  })
  ipcMain.handle(IPC.getKeyStatus, () => getKeyStatus())
  ipcMain.handle(IPC.setKey, (_e, name: ApiKeyName, value: string) => setKey(name, value))
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
  ipcMain.on(IPC.audioFrame, (_e, frame: ArrayBuffer) => pushAudioFrame(frame))
  ipcMain.on(IPC.setOverlayInteractive, (_e, interactive: boolean) => setOverlayInteractive(interactive))
  ipcMain.on(IPC.openSettings, () => openSettingsWindow())
}

app.on('second-instance', () => openSettingsWindow())

app.whenReady().then(() => {
  migrateLegacySettings()
  registerIpc()
  registerLoopbackAudio()
  createOverlayWindow()
  registerHotkeys()
  openSettingsWindow()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopSession()
})
app.on('window-all-closed', () => app.quit())

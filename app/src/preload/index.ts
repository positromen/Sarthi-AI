import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { HotkeyAction } from '../shared/hotkeys'
import { IPC } from '../shared/ipc'
import type {
  AnswerState,
  ApiKeyName,
  ApiKeyStatus,
  Hotkey,
  InterimTranscript,
  KeyCheck,
  ScreenshotInfo,
  SessionRecord,
  SessionState,
  SessionSummary,
  Settings,
  TranscriptTurn,
  UsageReport
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke(IPC.updateSettings, patch),
  onSettingsChanged: (callback: (settings: Settings) => void) =>
    subscribe(IPC.settingsChanged, callback),
  getKeyStatus: (): Promise<ApiKeyStatus> => ipcRenderer.invoke(IPC.getKeyStatus),
  setKey: (name: ApiKeyName, value: string): Promise<ApiKeyStatus> =>
    ipcRenderer.invoke(IPC.setKey, name, value),
  onHotkey: (callback: (key: Hotkey) => void) => subscribe(IPC.hotkey, callback),
  setOverlayInteractive: (interactive: boolean) =>
    ipcRenderer.send(IPC.setOverlayInteractive, interactive),
  /** The overlay only takes keyboard focus while the ask box is in use; resolves once main has applied it. */
  setOverlayFocusable: (focusable: boolean): Promise<void> => ipcRenderer.invoke(IPC.setOverlayFocusable, focusable),
  /** Header pressed / released: main moves the overlay with the cursor in between. */
  overlayDrag: (phase: 'start' | 'end') => ipcRenderer.send(IPC.overlayDrag, phase),
  /** Opens the Control Center, optionally on a page ("setup", "history", …). */
  openSettings: (page?: string) => ipcRenderer.send(IPC.openSettings, page),
  onNavigate: (callback: (page: string) => void) => subscribe(IPC.navigate, callback),
  showOverlay: () => ipcRenderer.send(IPC.showOverlay),
  /** Quits Sarthi (the running session is saved first). */
  quitApp: () => ipcRenderer.send(IPC.quitApp),
  onKeysChanged: (callback: (status: ApiKeyStatus) => void) => subscribe(IPC.keysChanged, callback),
  /** Tests a key with its provider before saving: { ok, warning? } or { ok: false, message }. */
  validateKey: (name: ApiKeyName, value: string): Promise<KeyCheck> => ipcRenderer.invoke(IPC.validateKey, name, value),
  getAppInfo: (): Promise<{ version: string; platform: string }> => ipcRenderer.invoke(IPC.getAppInfo),
  setHotkey: (action: HotkeyAction, accelerator: string): Promise<{ ok: true } | { ok: false; message: string }> =>
    ipcRenderer.invoke(IPC.setHotkey, action, accelerator),
  /** Pauses every global shortcut while a new combination is being recorded. */
  suspendHotkeys: (suspended: boolean): Promise<void> => ipcRenderer.invoke(IPC.suspendHotkeys, suspended),
  resetHotkeys: (): Promise<HotkeyAction[]> => ipcRenderer.invoke(IPC.resetHotkeys),
  /** Actions whose shortcut another app has taken. */
  unavailableHotkeys: (): Promise<HotkeyAction[]> => ipcRenderer.invoke(IPC.unavailableHotkeys),
  startSession: (): Promise<SessionState> => ipcRenderer.invoke(IPC.startSession),
  stopSession: (): Promise<SessionState> => ipcRenderer.invoke(IPC.stopSession),
  getSessionState: (): Promise<SessionState> => ipcRenderer.invoke(IPC.sessionState),
  onSessionState: (callback: (state: SessionState) => void) => subscribe(IPC.sessionState, callback),
  sendAudioFrame: (frame: ArrayBuffer) => ipcRenderer.send(IPC.audioFrame, frame),
  onTranscriptInterim: (callback: (interim: InterimTranscript) => void) =>
    subscribe(IPC.transcriptInterim, callback),
  onTranscriptTurn: (callback: (turn: TranscriptTurn) => void) => subscribe(IPC.transcriptTurn, callback),
  /** Answers `question` if given (typed by the user), else the last interviewer question. */
  generateAnswer: (question?: string): Promise<void> => ipcRenderer.invoke(IPC.generateAnswer, question),
  getAnswerState: (): Promise<AnswerState> => ipcRenderer.invoke(IPC.getAnswerState),
  onAnswerState: (callback: (state: AnswerState) => void) => subscribe(IPC.answerState, callback),
  importDocument: (): Promise<{ name: string; text: string } | null> => ipcRenderer.invoke(IPC.importDocument),
  getScreenshots: (): Promise<ScreenshotInfo[]> => ipcRenderer.invoke(IPC.getScreenshots),
  captureScreenshot: (): Promise<ScreenshotInfo[]> => ipcRenderer.invoke(IPC.captureScreenshot),
  removeScreenshot: (id: number): Promise<ScreenshotInfo[]> => ipcRenderer.invoke(IPC.removeScreenshot, id),
  onScreenshotsChanged: (callback: (shots: ScreenshotInfo[]) => void) =>
    subscribe(IPC.screenshotsChanged, callback),
  listHistory: (): Promise<SessionSummary[]> => ipcRenderer.invoke(IPC.listHistory),
  /** Sessions whose title, transcript or answers contain the query. */
  searchHistory: (query: string): Promise<SessionSummary[]> => ipcRenderer.invoke(IPC.searchHistory, query),
  getHistorySession: (id: string): Promise<SessionRecord | null> => ipcRenderer.invoke(IPC.getHistorySession, id),
  deleteHistorySession: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.deleteHistorySession, id),
  generateNotes: (id: string): Promise<SessionRecord> => ipcRenderer.invoke(IPC.generateNotes, id),
  getUsage: (): Promise<UsageReport | null> => ipcRenderer.invoke(IPC.getUsage),
  /** Resolves to the saved file's path, or null if the Save dialog was cancelled. */
  exportSession: (id: string): Promise<string | null> => ipcRenderer.invoke(IPC.exportSession, id),
  /** Uncaught renderer errors, for the local log (main redacts keys before writing). */
  logError: (message: string): void => ipcRenderer.send(IPC.logError, message),
  copyDebugInfo: (): Promise<void> => ipcRenderer.invoke(IPC.copyDebugInfo),
  openLogsFolder: (): Promise<void> => ipcRenderer.invoke(IPC.openLogsFolder),
  onHistoryChanged: (callback: (sessions: SessionSummary[]) => void) => subscribe(IPC.historyChanged, callback)
}

export type SarthiApi = typeof api

contextBridge.exposeInMainWorld('sarthi', api)

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  AnswerState,
  ApiKeyName,
  ApiKeyStatus,
  Hotkey,
  InterimTranscript,
  ScreenshotInfo,
  SessionRecord,
  SessionState,
  SessionSummary,
  Settings,
  TranscriptTurn
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
  openSettings: () => ipcRenderer.send(IPC.openSettings),
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
  getHistorySession: (id: string): Promise<SessionRecord | null> => ipcRenderer.invoke(IPC.getHistorySession, id),
  deleteHistorySession: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.deleteHistorySession, id),
  generateNotes: (id: string): Promise<SessionRecord> => ipcRenderer.invoke(IPC.generateNotes, id),
  onHistoryChanged: (callback: (sessions: SessionSummary[]) => void) => subscribe(IPC.historyChanged, callback)
}

export type SarthiApi = typeof api

contextBridge.exposeInMainWorld('sarthi', api)

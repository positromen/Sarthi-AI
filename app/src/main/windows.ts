import { app, BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { getSettings } from './store'

const OVERLAY_WIDTH = 520
const OVERLAY_HEIGHT = 640
const MARGIN = 24
const MOVE_STEP = 40

let overlay: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

function loadPage(win: BrowserWindow, page: 'overlay' | 'settings'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) win.loadURL(`${devUrl}/${page}.html`)
  else win.loadFile(join(__dirname, `../renderer/${page}.html`))
}

const preloadPath = () => join(__dirname, '../preload/index.js')

export function getOverlay(): BrowserWindow | null {
  return overlay && !overlay.isDestroyed() ? overlay : null
}

export function createOverlayWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  overlay = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: workArea.x + workArea.width - OVERLAY_WIDTH - MARGIN,
    y: workArea.y + MARGIN,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    alwaysOnTop: true,
    focusable: true,
    type: 'panel',
    show: false,
    webPreferences: { preload: preloadPath(), backgroundThrottling: false }
  })

  // "screen-saver" sits above full-screen meeting apps; some apps steal topmost, so keep re-asserting it.
  overlay.setAlwaysOnTop(true, 'screen-saver', 1)
  const topmostTimer = setInterval(() => {
    const win = getOverlay()
    if (win) win.setAlwaysOnTop(true, 'screen-saver', 1)
    else clearInterval(topmostTimer)
  }, 1000)

  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlay.setIgnoreMouseEvents(true, { forward: true })
  setPrivateMode(getSettings().privateMode)

  overlay.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'display-capture')
  })
  overlay.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  overlay.once('ready-to-show', () => overlay?.showInactive())
  loadPage(overlay, 'overlay')
  return overlay
}

export function setPrivateMode(enabled: boolean): void {
  getOverlay()?.setContentProtection(enabled)
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.setContentProtection(enabled)
}

export function setOverlayInteractive(interactive: boolean): void {
  getOverlay()?.setIgnoreMouseEvents(!interactive, { forward: true })
}

export function toggleOverlayVisible(): void {
  const win = getOverlay()
  if (!win) return
  if (win.isVisible()) win.hide()
  else win.showInactive()
}

export function moveOverlay(dx: number, dy: number): void {
  const win = getOverlay()
  if (!win) return
  const [x, y] = win.getPosition()
  win.setPosition(x + dx * MOVE_STEP, y + dy * MOVE_STEP)
}

export function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 900,
    height: 720,
    title: 'Sarthi AI',
    autoHideMenuBar: true,
    backgroundColor: '#0b0f0c',
    webPreferences: { preload: preloadPath() }
  })
  settingsWindow.setContentProtection(getSettings().privateMode)
  loadPage(settingsWindow, 'settings')
}

export function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

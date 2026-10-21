import { app, BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { getSettings } from './store'

const OVERLAY_WIDTH = 520
const OVERLAY_HEIGHT = 640
const MARGIN = 24
const MOVE_STEP = 40

let overlay: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

/** `hash` picks the Control Center page, e.g. "setup" opens settings.html#setup. */
function loadPage(win: BrowserWindow, page: 'overlay' | 'settings', hash?: string): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) win.loadURL(`${devUrl}/${page}.html${hash ? `#${hash}` : ''}`)
  else win.loadFile(join(__dirname, `../renderer/${page}.html`), hash ? { hash } : undefined)
}

// Page names come from renderer IPC; only plain slugs become part of a URL.
const PAGE_SLUG = /^[a-z][a-z-]{0,30}$/

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
    // Clicking the overlay must never pull focus from the meeting app; only the ask box asks for focus, briefly.
    focusable: false,
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

/** "Show overlay" from the Control Center: bring it back without taking focus. */
export function showOverlay(): void {
  getOverlay()?.showInactive()
}

export function toggleOverlayVisible(): void {
  const win = getOverlay()
  if (!win) return
  if (win.isVisible()) win.hide()
  else win.showInactive()
}

/**
 * The overlay is normally non-focusable, so its buttons work without taking focus from the meeting app. Typing a
 * question needs keyboard focus: the ask box turns it on while in use and off again on Enter, Esc or blur.
 */
export function setOverlayFocusable(focusable: boolean): void {
  const win = getOverlay()
  if (!win) return
  if (focusable) {
    win.setFocusable(true)
    if (!win.isVisible()) win.showInactive()
    win.focus()
  } else {
    win.blur()
    win.setFocusable(false)
  }
}

/** The "type a question" hotkey: focus the overlay so its ask box can take the keystrokes. */
export const focusOverlay = (): void => setOverlayFocusable(true)

export function moveOverlay(dx: number, dy: number): void {
  const win = getOverlay()
  if (!win) return
  const [x, y] = win.getPosition()
  win.setPosition(x + dx * MOVE_STEP, y + dy * MOVE_STEP)
}

/** Opens (or focuses) the Control Center, optionally on a page such as "setup" or "history". */
export function openSettingsWindow(page?: string): void {
  const target = page && PAGE_SLUG.test(page) ? page : undefined
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (target) settingsWindow.webContents.send(IPC.navigate, target)
    settingsWindow.show()
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    title: 'Sarthi AI',
    autoHideMenuBar: true,
    backgroundColor: '#0b0f0c',
    webPreferences: { preload: preloadPath() }
  })
  settingsWindow.setContentProtection(getSettings().privateMode)
  // Links in the Control Center (key consoles) open in the browser, never inside the app.
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  loadPage(settingsWindow, 'settings', target)
}

export function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

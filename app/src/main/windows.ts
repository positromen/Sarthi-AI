import { app, BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { clampToWorkArea, restoreOverlayPosition } from '../shared/overlayPosition'
import { getSettings, updateSettings } from './store'
import { controlCenterListed } from './trayModel'

const OVERLAY_WIDTH = 520
const OVERLAY_HEIGHT = 640
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

const OVERLAY_SIZE = { width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT }
// Window moves arrive as a stream while dragging; save once it settles.
const SAVE_POSITION_DELAY_MS = 400
let savePositionTimer: NodeJS.Timeout | null = null

function rememberOverlayPosition(win: BrowserWindow): void {
  if (savePositionTimer) clearTimeout(savePositionTimer)
  savePositionTimer = setTimeout(() => {
    if (win.isDestroyed()) return
    const [x, y] = win.getPosition()
    updateSettings({ overlayPosition: { x, y } })
  }, SAVE_POSITION_DELAY_MS)
}

export function createOverlayWindow(): BrowserWindow {
  const position = restoreOverlayPosition(
    getSettings().overlayPosition,
    screen.getAllDisplays().map((display) => display.workArea),
    screen.getPrimaryDisplay().workArea,
    OVERLAY_SIZE
  )
  overlay = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    ...position,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    alwaysOnTop: true,
    // Clicking the overlay must never pull focus from the meeting app; only the ask box asks for focus, briefly.
    focusable: false,
    // No title: Chromium-based share pickers ("share a window" in Meet, Teams on the web) skip untitled windows.
    title: '',
    // On Windows "toolbar" makes it a tool window: no taskbar button and no Alt+Tab / Win+Tab entry, both of which a
    // full-screen share would show. ("panel" is the macOS equivalent.)
    type: process.platform === 'win32' ? 'toolbar' : 'panel',
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

  // Dragging by the header (CSS app-region) and Ctrl+Alt+arrows both end up here.
  const created = overlay
  overlay.on('move', () => rememberOverlayPosition(created))

  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlay.setIgnoreMouseEvents(true, { forward: true })
  overlay.setContentProtection(getSettings().privateMode)

  overlay.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'display-capture')
  })
  overlay.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Keep the window title empty even though overlay.html has a <title>.
  overlay.on('page-title-updated', (event) => event.preventDefault())
  overlay.once('ready-to-show', () => overlay?.showInactive())
  loadPage(overlay, 'overlay')
  return overlay
}

const privacyListeners: (() => void)[] = []

// Windows leaves owned windows out of the taskbar and Alt+Tab. In private mode the Control Center is owned by this
// never-shown window; owning it by the overlay instead would pin it above the meeting (owned windows sit above owners).
let hiddenOwner: BrowserWindow | null = null

function getHiddenOwner(): BrowserWindow {
  if (!hiddenOwner || hiddenOwner.isDestroyed()) {
    hiddenOwner = new BrowserWindow({ show: false, width: 1, height: 1, skipTaskbar: true, focusable: false })
  }
  return hiddenOwner
}

function listControlCenter(win: BrowserWindow, listed: boolean): void {
  win.setSkipTaskbar(!listed)
  win.setParentWindow(listed ? null : getHiddenOwner())
}

/** Runs after every privacy change (the tray follows private mode this way, without an import cycle). */
export function onPrivacyChange(listener: () => void): void {
  privacyListeners.push(listener)
}

/**
 * Applies the saved private-mode setting to every surface a screen share could show: content protection on both
 * windows, the Control Center's taskbar button, and (through listeners) the tray icon. Call after saving settings.
 */
export function applyPrivacy(): void {
  const settings = getSettings()
  getOverlay()?.setContentProtection(settings.privateMode)
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setContentProtection(settings.privateMode)
    listControlCenter(settingsWindow, controlCenterListed(settings))
  }
  for (const listener of privacyListeners) listener()
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

// Dragging is driven from main: the renderer only says "pressed" and "released" on the header, and main follows the
// cursor in between. A CSS drag region would make the card fire mouseleave (it counts as window frame), which turns
// click-through back on mid-grab.
const DRAG_FRAME_MS = 16
// A release that never arrives (e.g. the renderer reloaded mid-drag) must not leave the overlay glued to the cursor.
const DRAG_TIMEOUT_MS = 30_000
let drag: { timer: NodeJS.Timeout; offsetX: number; offsetY: number; startedAt: number } | null = null

export function startOverlayDrag(): void {
  const win = getOverlay()
  if (!win || drag) return
  const cursor = screen.getCursorScreenPoint()
  const [x, y] = win.getPosition()
  const timer = setInterval(() => {
    const current = getOverlay()
    if (!current || !drag || Date.now() - drag.startedAt > DRAG_TIMEOUT_MS) return endOverlayDrag()
    const point = screen.getCursorScreenPoint()
    current.setPosition(point.x - drag.offsetX, point.y - drag.offsetY)
  }, DRAG_FRAME_MS)
  drag = { timer, offsetX: cursor.x - x, offsetY: cursor.y - y, startedAt: Date.now() }
}

/** Ends a drag and nudges the overlay back inside the display it was dropped on. */
export function endOverlayDrag(): void {
  if (!drag) return
  clearInterval(drag.timer)
  drag = null
  const win = getOverlay()
  if (!win) return
  const [x, y] = win.getPosition()
  const next = clampToWorkArea({ x, y }, OVERLAY_SIZE, screen.getDisplayMatching(win.getBounds()).workArea)
  if (next.x !== x || next.y !== y) win.setPosition(next.x, next.y)
}

export function moveOverlay(dx: number, dy: number): void {
  const win = getOverlay()
  if (!win) return
  const [x, y] = win.getPosition()
  // Stop at the edge of the display the overlay is on, so the keys can't push it out of reach.
  const area = screen.getDisplayMatching(win.getBounds()).workArea
  const next = clampToWorkArea({ x: x + dx * MOVE_STEP, y: y + dy * MOVE_STEP }, OVERLAY_SIZE, area)
  win.setPosition(next.x, next.y)
}

/** Opens (or focuses) the Control Center, optionally on a page such as "setup" or "history". */
export function openSettingsWindow(page?: string): void {
  const target = page && PAGE_SLUG.test(page) ? page : undefined
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (target) settingsWindow.webContents.send(IPC.navigate, target)
    if (settingsWindow.isMinimized()) settingsWindow.restore()
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
    // Shown only after protection is applied: it takes effect at the next composition, so a window shown at once
    // could reach a share for a frame.
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0f0c',
    webPreferences: { preload: preloadPath() }
  })
  const created = settingsWindow
  created.setContentProtection(getSettings().privateMode)
  listControlCenter(created, controlCenterListed(getSettings()))
  created.once('ready-to-show', () => created.show())
  // Unlisted, a minimized window would become a stub above the taskbar; hide it instead (the hotkey brings it back).
  created.on('minimize', () => {
    if (!controlCenterListed(getSettings())) created.hide()
  })
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

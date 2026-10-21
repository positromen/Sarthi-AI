// Tray icon: the always-reachable way to show the overlay, open the Control Center, or quit (the overlay itself has no
// window frame and no taskbar button). It exists only while private mode is off; see trayModel.ts.
import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { getSessionState } from './session'
import { getSettings } from './store'
import { trayMenu, trayVisible, type TrayAction } from './trayModel'
import { getOverlay, openSettingsWindow, toggleOverlayVisible } from './windows'

let tray: Tray | null = null

// Dev runs from the app folder; the installer copies resources/ next to the app (Phase 8 extraResources).
const iconPath = (): string =>
  app.isPackaged ? join(process.resourcesPath, 'tray.png') : join(app.getAppPath(), 'resources', 'tray.png')

function run(action: TrayAction): void {
  if (action === 'toggle-overlay') toggleOverlayVisible()
  // Audio is captured in the overlay renderer, so listening is toggled there, exactly like the hotkey.
  else if (action === 'toggle-listening') getOverlay()?.webContents.send(IPC.hotkey, 'toggle-listening')
  else if (action === 'open-settings') openSettingsWindow()
  else app.quit()
}

// Built when opened, so labels always reflect the current state.
function buildMenu(): Menu {
  const status = getSessionState().status
  const items = trayMenu({
    overlayVisible: Boolean(getOverlay()?.isVisible()),
    listening: status === 'listening' || status === 'connecting'
  })
  return Menu.buildFromTemplate(
    items.map((item) =>
      item.action ? { label: item.label!, click: () => run(item.action!) } : { type: 'separator' as const }
    )
  )
}

/** Creates or removes the tray to match private mode. Called at startup and after every privacy change. */
export function syncTray(): void {
  if (!trayVisible(getSettings())) {
    tray?.destroy()
    tray = null
    return
  }
  if (tray) return
  tray = new Tray(nativeImage.createFromPath(iconPath()))
  tray.setToolTip('Sarthi AI')
  const open = () => tray?.popUpContextMenu(buildMenu())
  tray.on('click', open)
  tray.on('right-click', open)
  tray.on('double-click', () => openSettingsWindow())
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Checks GitHub Releases at startup, downloads a newer version in the background and installs it when the app quits.
 * Deliberately silent: a Windows notification would appear in a screen share. Dev builds never check.
 */
export function startAutoUpdate(): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
  autoUpdater.on('update-downloaded', (info) => console.warn(`Update ${info.version} downloaded; it installs on quit.`))
  // A failed check both emits 'error' and rejects; log it once, here, and only its first line (the full message embeds
  // the whole HTTP response, cookies included).
  autoUpdater
    .checkForUpdates()
    .catch((error: Error) => console.warn('Update check failed:', error.message.split('\n')[0]))
}

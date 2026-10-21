import { app, BrowserWindow, dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { exportFileName, sessionToHtml, sessionToMarkdown } from '../shared/sessionExport'
import type { SessionRecord } from '../shared/types'
import { getHistory } from './history'

/** Renders the page in a hidden, sandboxed window with scripts off, then prints it to an A4 PDF. */
async function renderPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await win.webContents.printToPDF({ pageSize: 'A4', margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }, printBackground: false })
  } finally {
    win.destroy()
  }
}

/**
 * Asks where to save a session and writes it as Markdown or PDF, following the chosen extension. Returns the path,
 * or null if cancelled. The Save dialog is a normal Windows window, so a screen share shows it.
 */
export async function exportSession(id: string, parent: BrowserWindow | null): Promise<string | null> {
  const record: SessionRecord | null = getHistory()?.get(id) ?? null
  if (!record) throw new Error('That session is no longer in history.')
  const options = {
    title: 'Export session',
    defaultPath: join(app.getPath('documents'), `${exportFileName(record)}.md`),
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'PDF', extensions: ['pdf'] }
    ]
  }
  const result = await (parent ? dialog.showSaveDialog(parent, options) : dialog.showSaveDialog(options))
  if (result.canceled || !result.filePath) return null
  const path = result.filePath
  if (extname(path).toLowerCase() === '.pdf') await writeFile(path, await renderPdf(sessionToHtml(record)))
  else await writeFile(path, sessionToMarkdown(record), 'utf8')
  return path
}

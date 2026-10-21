import { desktopCapturer, screen } from 'electron'
import { IPC } from '../shared/ipc'
import type { ScreenshotInfo } from '../shared/types'
import type { GeminiImage } from './gemini'
import { broadcast } from './windows'

// Every kept screenshot rides along with each answer request, so cap how many we hold.
const MAX_SCREENSHOTS = 5
// Longest side sent to the model: keeps code and slide text legible without bloating the request.
const MAX_SIDE = 1280
const THUMBNAIL_WIDTH = 160

interface Screenshot extends ScreenshotInfo {
  /** Base64 JPEG sent to the model; never leaves main except in the Gemini request. */
  jpeg: string
}

let shots: Screenshot[] = []
let nextId = 1

export function listScreenshots(): ScreenshotInfo[] {
  return shots.map(({ id, thumbnail, at }) => ({ id, thumbnail, at }))
}

function publish(): ScreenshotInfo[] {
  const list = listScreenshots()
  broadcast(IPC.screenshotsChanged, list)
  return list
}

/**
 * Captures the display under the cursor. With private mode on, the overlay and settings windows are
 * content-protected, so they are left out of the shot.
 */
export async function captureScreenshot(): Promise<ScreenshotInfo[]> {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  // The thumbnail is scaled to fit this box with its aspect ratio kept, so it doubles as the downscale.
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: MAX_SIDE, height: MAX_SIDE }
  })
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!source || source.thumbnail.isEmpty()) throw new Error('Screen capture is unavailable.')

  const image = source.thumbnail
  shots.push({
    id: nextId++,
    at: Date.now(),
    jpeg: image.toJPEG(80).toString('base64'),
    thumbnail: image.resize({ width: THUMBNAIL_WIDTH }).toDataURL()
  })
  shots = shots.slice(-MAX_SCREENSHOTS)
  return publish()
}

export function removeScreenshot(id: number): ScreenshotInfo[] {
  shots = shots.filter((shot) => shot.id !== id)
  return publish()
}

export function getScreenshotImages(): GeminiImage[] {
  return shots.map((shot) => ({ mimeType: 'image/jpeg', data: shot.jpeg }))
}

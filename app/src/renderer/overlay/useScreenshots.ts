import { useCallback, useEffect, useState } from 'react'
import type { ScreenshotInfo } from '../../shared/types'

export function useScreenshots() {
  const [shots, setShots] = useState<ScreenshotInfo[]>([])

  useEffect(() => {
    window.sarthi.getScreenshots().then(setShots)
    return window.sarthi.onScreenshotsChanged(setShots)
  }, [])

  // Main broadcasts the new list, so these only need to ask.
  const capture = useCallback(() => {
    window.sarthi.captureScreenshot().catch((error) => console.warn('Screenshot failed:', error))
  }, [])
  const remove = useCallback((id: number) => void window.sarthi.removeScreenshot(id), [])

  return { shots, capture, remove }
}

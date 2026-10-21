import { useEffect, useState } from 'react'
import type { Settings } from '../shared/types'

export function useSettings(): [Settings | null, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    window.sarthi.getSettings().then(setSettings)
    return window.sarthi.onSettingsChanged(setSettings)
  }, [])

  const update = (patch: Partial<Settings>) => {
    window.sarthi.updateSettings(patch).then(setSettings)
  }
  return [settings, update]
}

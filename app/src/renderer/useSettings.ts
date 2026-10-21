import { useEffect, useState } from 'react'
import type { Settings } from '../shared/types'
import { syncHotkeys } from './shortcuts'

export function useSettings(): [Settings | null, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    // Keycap labels read the hotkeys at render time, so update them before the new settings render.
    const apply = (next: Settings) => {
      syncHotkeys(next.hotkeys)
      setSettings(next)
    }
    window.sarthi.getSettings().then(apply)
    return window.sarthi.onSettingsChanged(apply)
  }, [])

  const update = (patch: Partial<Settings>) => {
    window.sarthi.updateSettings(patch).then((next) => {
      syncHotkeys(next.hotkeys)
      setSettings(next)
    })
  }
  return [settings, update]
}

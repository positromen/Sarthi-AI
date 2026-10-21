import { useEffect, useState } from 'react'
import type { AppInfo } from '../shared/types'

/** Version, platform and whether this OS can hide Sarthi from a screen share (null until loaded). */
export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    window.sarthi.getAppInfo().then(setInfo)
  }, [])
  return info
}

import { useEffect, useState } from 'react'
import type { ApiKeyStatus } from '../../shared/types'

/** Which API keys are saved; null until loaded. Updates live when a key is saved or removed in the Control Center. */
export function useKeyStatus(): ApiKeyStatus | null {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null)
  useEffect(() => {
    window.sarthi.getKeyStatus().then(setStatus)
    return window.sarthi.onKeysChanged(setStatus)
  }, [])
  return status
}

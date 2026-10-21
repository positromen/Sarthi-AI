import { useEffect, useState } from 'react'

/**
 * True while listening. Native Open/Save dialogs are ordinary Windows windows that a screen share shows, so pages that
 * open one say so during a call.
 */
export function useCallActive(): boolean {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const track = (state: { status: string }) => setActive(state.status === 'listening' || state.status === 'connecting')
    window.sarthi.getSessionState().then(track)
    return window.sarthi.onSessionState(track)
  }, [])
  return active
}

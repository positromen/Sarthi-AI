import { useCallback, useEffect, useRef, useState } from 'react'
import type { InterimTranscript, SessionState, Speaker, TranscriptTurn } from '../../shared/types'
import { startCapture, type AudioLevels, type Capture } from '../audio/capture'
import { insertByTime } from '../../shared/transcript'

const MAX_TURNS = 50

export function useListening() {
  const [session, setSession] = useState<SessionState>({ status: 'idle' })
  const [turns, setTurns] = useState<TranscriptTurn[]>([])
  const [interim, setInterim] = useState<Partial<Record<Speaker, string>>>({})
  const [levels, setLevels] = useState<AudioLevels>({ mic: 0, system: 0, sending: false })
  const capture = useRef<Capture | null>(null)

  useEffect(() => {
    window.sarthi.getSessionState().then(setSession)
    const unsubscribers = [
      window.sarthi.onSessionState(setSession),
      window.sarthi.onTranscriptInterim(({ speaker, text }: InterimTranscript) =>
        setInterim((prev) => ({ ...prev, [speaker]: text }))
      ),
      window.sarthi.onTranscriptTurn((turn) => {
        // My lines arrive a few seconds late (echo check in main), so place each one by when it was said.
        setTurns((prev) => insertByTime(prev, turn).slice(-MAX_TURNS))
        setInterim((prev) => ({ ...prev, [turn.speaker]: undefined }))
      })
    ]
    return () => unsubscribers.forEach((off) => off())
  }, [])

  const stopCapture = useCallback(() => {
    capture.current?.stop()
    capture.current = null
    setLevels({ mic: 0, system: 0, sending: false })
  }, [])

  // The main process can end the session on its own (network error, bad key); release the devices then.
  useEffect(() => {
    if (session.status === 'idle' || session.status === 'error') stopCapture()
  }, [session.status, stopCapture])

  const start = useCallback(async () => {
    if (capture.current) return
    setTurns([])
    setInterim({})
    const state = await window.sarthi.startSession()
    if (state.status === 'error') return
    try {
      const settings = await window.sarthi.getSettings()
      capture.current = await startCapture((pcm) => window.sarthi.sendAudioFrame(pcm), setLevels, {
        enabled: settings.vadEnabled,
        sensitivity: settings.vadSensitivity
      })
    } catch (error) {
      await window.sarthi.stopSession()
      setSession({ status: 'error', error: `Audio capture failed: ${(error as Error).message}` })
    }
  }, [])

  const stop = useCallback(async () => {
    stopCapture()
    await window.sarthi.stopSession()
  }, [stopCapture])

  const active = session.status === 'connecting' || session.status === 'listening'
  const toggle = useCallback(() => (active ? stop() : start()), [active, start, stop])

  return { session, turns, interim, levels, active, start, stop, toggle }
}

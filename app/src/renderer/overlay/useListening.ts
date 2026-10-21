import { useCallback, useEffect, useRef, useState } from 'react'
import type { InterimTranscript, SessionState, Speaker, TranscriptTurn } from '../../shared/types'
import { startCapture, type AudioLevels, type Capture } from '../audio/capture'

const MAX_TURNS = 50

export function useListening() {
  const [session, setSession] = useState<SessionState>({ status: 'idle' })
  const [turns, setTurns] = useState<TranscriptTurn[]>([])
  const [interim, setInterim] = useState<Partial<Record<Speaker, string>>>({})
  const [levels, setLevels] = useState<AudioLevels>({ mic: 0, system: 0 })
  const capture = useRef<Capture | null>(null)

  useEffect(() => {
    window.sarthi.getSessionState().then(setSession)
    const unsubscribers = [
      window.sarthi.onSessionState(setSession),
      window.sarthi.onTranscriptInterim(({ speaker, text }: InterimTranscript) =>
        setInterim((prev) => ({ ...prev, [speaker]: text }))
      ),
      window.sarthi.onTranscriptTurn((turn) => {
        setTurns((prev) => [...prev, turn].slice(-MAX_TURNS))
        setInterim((prev) => ({ ...prev, [turn.speaker]: undefined }))
      })
    ]
    return () => unsubscribers.forEach((off) => off())
  }, [])

  const stopCapture = useCallback(() => {
    capture.current?.stop()
    capture.current = null
    setLevels({ mic: 0, system: 0 })
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
      capture.current = await startCapture((pcm) => window.sarthi.sendAudioFrame(pcm), setLevels)
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

// Live input levels for the onboarding audio check, without the transcription pipeline: an AnalyserNode per source,
// sampled ~20 times a second. Uses the same capture paths as capture.ts (mic, and system loopback via getDisplayMedia).
import { rmsLevel } from './pcm'

export interface Meter {
  stop: () => void
  /** Device name, e.g. "Microphone Array (Realtek Audio)"; empty for system audio. */
  label: string
}

function meterFor(stream: MediaStream, onLevel: (level: number) => void, label: string): Meter {
  const context = new AudioContext()
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  context.createMediaStreamSource(stream).connect(analyser)
  const samples = new Float32Array(analyser.fftSize)
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(samples)
    onLevel(rmsLevel(samples))
  }, 50)
  return {
    label,
    stop: () => {
      clearInterval(timer)
      stream.getTracks().forEach((t) => t.stop())
      void context.close()
    }
  }
}

export async function openMicMeter(onLevel: (level: number) => void): Promise<Meter> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  })
  return meterFor(stream, onLevel, stream.getAudioTracks()[0]?.label ?? '')
}

/** System audio is what the interviewer will sound like: answered by main's loopback display-media handler. */
export async function openSystemMeter(onLevel: (level: number) => void): Promise<Meter> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  stream.getVideoTracks().forEach((t) => t.stop())
  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((t) => t.stop())
    throw new Error('System audio is unavailable (no loopback track)')
  }
  return meterFor(stream, onLevel, '')
}

/** A soft 1 s 440 Hz tone on the default output, so loopback has something to hear. */
export function playTestTone(): void {
  const context = new AudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = 440
  gain.gain.setValueAtTime(0, context.currentTime)
  gain.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.05)
  gain.gain.linearRampToValueAtTime(0, context.currentTime + 1)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 1)
  oscillator.onended = () => void context.close()
}

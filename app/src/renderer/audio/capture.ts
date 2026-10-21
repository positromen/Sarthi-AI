import workletUrl from './pcm-worklet.ts?worker&url'

export const CAPTURE_SAMPLE_RATE = 16000

export interface AudioLevels {
  mic: number
  system: number
}

export interface Capture {
  stop: () => void
}

/**
 * Captures the mic (channel 0) and system loopback audio (channel 1) into one 16 kHz stereo stream.
 * Chromium resamples both sources to the AudioContext rate, so no manual resampling is needed.
 */
export async function startCapture(
  onFrame: (pcm: ArrayBuffer) => void,
  onLevels: (levels: AudioLevels) => void
): Promise<Capture> {
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  })
  let system: MediaStream
  try {
    // Answered by the main process's display-media handler with loopback audio; video is required by the API.
    system = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  } catch (error) {
    mic.getTracks().forEach((t) => t.stop())
    throw error
  }
  system.getVideoTracks().forEach((t) => t.stop())
  if (system.getAudioTracks().length === 0) {
    mic.getTracks().forEach((t) => t.stop())
    throw new Error('System audio is unavailable (no loopback track)')
  }

  const context = new AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE })
  await context.audioWorklet.addModule(workletUrl)

  const merger = context.createChannelMerger(2)
  context.createMediaStreamSource(mic).connect(merger, 0, 0)
  context.createMediaStreamSource(system).connect(merger, 0, 1)

  const framer = new AudioWorkletNode(context, 'stereo-pcm-framer', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 2,
    channelCountMode: 'explicit',
    channelInterpretation: 'discrete'
  })
  framer.port.onmessage = ({ data }) => {
    onFrame(data.pcm)
    onLevels({ mic: data.micLevel, system: data.systemLevel })
  }
  merger.connect(framer)
  // Keep the graph pulled without playing anything back.
  const mute = context.createGain()
  mute.gain.value = 0
  framer.connect(mute).connect(context.destination)

  return {
    stop: () => {
      framer.port.postMessage('stop')
      mic.getTracks().forEach((t) => t.stop())
      system.getTracks().forEach((t) => t.stop())
      void context.close()
    }
  }
}

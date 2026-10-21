import { interleaveStereoInt16, rmsLevel } from './pcm'

// AudioWorklet globals are not in TypeScript's DOM lib.
declare const sampleRate: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, ctor: unknown): void

/** Batches stereo input (ch0 = mic, ch1 = system audio) into ~50 ms Int16 frames for the main process. */
class StereoPcmFramer extends AudioWorkletProcessor {
  private readonly frameSamples = Math.round(sampleRate / 20)
  private left = new Float32Array(this.frameSamples)
  private right = new Float32Array(this.frameSamples)
  private filled = 0
  private active = true

  constructor() {
    super()
    this.port.onmessage = (event) => {
      if (event.data === 'stop') this.active = false
    }
  }

  process(inputs: Float32Array[][]): boolean {
    const [mic, system] = inputs[0] ?? []
    const length = mic?.length ?? system?.length ?? 0
    let offset = 0
    while (offset < length) {
      const take = Math.min(length - offset, this.frameSamples - this.filled)
      if (mic) this.left.set(mic.subarray(offset, offset + take), this.filled)
      if (system) this.right.set(system.subarray(offset, offset + take), this.filled)
      this.filled += take
      offset += take
      if (this.filled === this.frameSamples) this.flush()
    }
    return this.active
  }

  private flush(): void {
    const pcm = interleaveStereoInt16(this.left, this.right)
    this.port.postMessage(
      { pcm: pcm.buffer, micLevel: rmsLevel(this.left), systemLevel: rmsLevel(this.right) },
      [pcm.buffer]
    )
    this.left = new Float32Array(this.frameSamples)
    this.right = new Float32Array(this.frameSamples)
    this.filled = 0
  }
}

registerProcessor('stereo-pcm-framer', StereoPcmFramer)

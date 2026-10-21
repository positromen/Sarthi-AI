/** Clamp a [-1, 1] float sample to signed 16-bit PCM. */
export function floatToInt16(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample))
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
}

/**
 * Interleave two mono float channels into stereo Int16 PCM (L0 R0 L1 R1 ...), the linear16
 * layout Deepgram expects for multichannel audio. A missing channel is written as silence.
 */
export function interleaveStereoInt16(left: Float32Array | undefined, right: Float32Array | undefined): Int16Array {
  const frames = Math.max(left?.length ?? 0, right?.length ?? 0)
  const out = new Int16Array(frames * 2)
  for (let i = 0; i < frames; i++) {
    out[i * 2] = floatToInt16(left?.[i] ?? 0)
    out[i * 2 + 1] = floatToInt16(right?.[i] ?? 0)
  }
  return out
}

/** Root-mean-square level of a block, used for the overlay's input meters. */
export function rmsLevel(samples: Float32Array | undefined): number {
  if (!samples?.length) return 0
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

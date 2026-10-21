import type { VadSensitivity } from '../../shared/types'

// Pure (no worklet globals) so the gate can be unit-tested; the worklet feeds it one ~50 ms frame at a time.

export interface GateConfig {
  enabled: boolean
  sensitivity: VadSensitivity
}

const FRAME_MS = 50
// Replayed when speech is confirmed, so a soft first syllable is not clipped.
const PRE_ROLL_MS = 500
// Silence still sent after the last speech. Must exceed Deepgram's utterance_end_ms (1000) and endpointing (300):
// Deepgram only ends a turn once it *hears* that silence, and the auto-answer waits on the turn ending.
const HANGOVER_MS = 1500
// Speech must last this long to open the gate, so a click or a key tap does not.
const ATTACK_MS = 100
// The noise floor is the quietest frame in this window. Speech always dips between words, so the floor tracks
// background noise even mid-sentence, and steady noise (a fan) is learned within a few seconds.
const FLOOR_WINDOW_MS = 5000

const frames = (ms: number): number => Math.round(ms / FRAME_MS)

/**
 * A frame is speech when its RMS clears `ratio` × the noise floor, clamped between `minRms` (so near-silence never
 * counts) and `maxThreshold` (so normal speech always counts, even in a loud room: the gate fails open, never shut).
 * Normal speech sits around 0.05–0.2 RMS.
 */
const THRESHOLDS: Record<VadSensitivity, { ratio: number; minRms: number; maxThreshold: number }> = {
  high: { ratio: 2, minRms: 0.002, maxThreshold: 0.03 },
  normal: { ratio: 3, minRms: 0.004, maxThreshold: 0.05 },
  low: { ratio: 4, minRms: 0.008, maxThreshold: 0.08 }
}

/** Per-channel speech detector with an adaptive noise floor. */
class ChannelDetector {
  private readonly history: number[] = []
  private next = 0
  private run = 0

  constructor(
    private readonly threshold: (typeof THRESHOLDS)[VadSensitivity],
    private readonly windowFrames: number,
    private readonly attackFrames: number
  ) {}

  /** Returns whether this frame is speech, and whether speech has lasted long enough to open the gate. */
  update(rms: number): { speech: boolean; confirmed: boolean } {
    if (this.history.length < this.windowFrames) this.history.push(rms)
    else this.history[this.next] = rms
    this.next = (this.next + 1) % this.windowFrames

    const floor = Math.min(...this.history)
    const { ratio, minRms, maxThreshold } = this.threshold
    const speech = rms > Math.min(maxThreshold, Math.max(minRms, floor * ratio))
    this.run = speech ? this.run + 1 : 0
    return { speech, confirmed: this.run >= this.attackFrames }
  }
}

/**
 * Decides which stereo frames go to Deepgram: only those around speech on either channel (both channels share one
 * interleaved frame, so they open and close together). Gaps are simply not sent; Deepgram is billed per second of
 * audio received, and the WebSocket stays up on KeepAlive messages.
 */
export class SpeechGate {
  private readonly detectors: [ChannelDetector, ChannelDetector]
  private readonly preRoll: Int16Array[] = []
  private readonly preRollFrames = frames(PRE_ROLL_MS)
  private readonly hangoverFrames = frames(HANGOVER_MS)
  private silentFrames = 0
  private open = false

  constructor(private readonly config: GateConfig) {
    const threshold = THRESHOLDS[config.sensitivity] ?? THRESHOLDS.normal
    const make = () => new ChannelDetector(threshold, frames(FLOOR_WINDOW_MS), frames(ATTACK_MS))
    this.detectors = [make(), make()]
  }

  get isOpen(): boolean {
    return !this.config.enabled || this.open
  }

  /** Feeds one frame with its per-channel RMS; returns the frames to send now, in order (often none). */
  push(frame: Int16Array, micLevel: number, systemLevel: number): Int16Array[] {
    if (!this.config.enabled) return [frame]
    const mic = this.detectors[0].update(micLevel)
    const system = this.detectors[1].update(systemLevel)

    if (!this.open) {
      this.preRoll.push(frame)
      if (this.preRoll.length > this.preRollFrames) this.preRoll.shift()
      if (!mic.confirmed && !system.confirmed) return []
      this.open = true
      this.silentFrames = 0
      return this.preRoll.splice(0)
    }

    this.silentFrames = mic.speech || system.speech ? 0 : this.silentFrames + 1
    if (this.silentFrames >= this.hangoverFrames) this.open = false
    return [frame]
  }
}

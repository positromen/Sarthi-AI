// Pure rules for the first-run onboarding (design B1–B5).
import { REQUIRED_KEYS, type ApiKeyStatus } from '../../shared/types'

export const ONBOARDING_STEPS = ['Welcome', 'API keys', 'Résumé', 'Audio check', 'Ready'] as const

/** Whether "Continue" is enabled on a step (1-based). Only the keys step gates: the rest can be skipped. */
export function canContinue(step: number, keys: ApiKeyStatus | null): boolean {
  if (step === 2) return Boolean(keys) && REQUIRED_KEYS.every((name) => keys![name])
  return true
}

// RMS above room noise: someone is talking, or the test tone is playing.
const HEARD = 0.015

export const hasSpeech = (level: number): boolean => level > HEARD

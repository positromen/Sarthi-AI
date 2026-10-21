// Usage numbers as the Control Center shows them (Setup's usage card, History's session line).
import type { SessionUsage } from './types'

export function formatAudio(seconds: number): string {
  if (seconds > 0 && seconds < 60) return `${Math.round(seconds)} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(Math.round(tokens))
  if (tokens < 10_000) return `${(tokens / 1000).toFixed(1)}k`
  if (tokens < 1_000_000) return `${Math.round(tokens / 1000)}k`
  return `${(tokens / 1_000_000).toFixed(1)}M`
}

/** "12 min audio · 6 AI calls · ≈9.2k tokens"; "≈" when some counts were estimated. Empty when nothing was used. */
export function sessionUsageLine(usage: SessionUsage | undefined): string {
  if (!usage) return ''
  const parts: string[] = []
  if (usage.audioSeconds > 0) parts.push(`${formatAudio(usage.audioSeconds)} audio`)
  if (usage.aiCalls > 0) {
    parts.push(`${usage.aiCalls} AI ${usage.aiCalls === 1 ? 'call' : 'calls'}`)
    parts.push(`${usage.estimated ? '≈' : ''}${formatTokens(usage.tokens)} tokens`)
  }
  return parts.join(' · ')
}

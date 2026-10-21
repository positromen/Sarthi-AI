// Hotkeys (design B11): click a row, press a new combination. Every global shortcut is paused while recording, so the
// old combination doesn't fire; main refuses combinations used by another action, a fixed shortcut or another app.
import { useCallback, useEffect, useState } from 'react'
import { acceleratorFromKeyEvent, acceleratorKeys, HOTKEY_LABELS, type HotkeyAction } from '../../../shared/hotkeys'
import type { Settings } from '../../../shared/types'
import { shortcuts } from '../../shortcuts'
import { Button, Keys, useToast } from '../../ui/components'
import { Card, PageHeader } from '../layout'

const HINT: Partial<Record<string, string>> = { answer: 'or “what’s on screen”' }

type Problem = { action: HotkeyAction; message: string; keys?: string[] }

export function HotkeysPage({ settings }: { settings: Settings }) {
  const [capturing, setCapturing] = useState<HotkeyAction | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [unavailable, setUnavailable] = useState<HotkeyAction[]>([])
  const toast = useToast()

  useEffect(() => {
    window.sarthi.unavailableHotkeys().then(setUnavailable)
  }, [settings.hotkeys])

  const stop = useCallback(() => {
    setCapturing(null)
    void window.sarthi.suspendHotkeys(false)
  }, [])

  const start = (action: HotkeyAction) => {
    setProblem(null)
    setCapturing(action)
    void window.sarthi.suspendHotkeys(true)
  }

  useEffect(() => {
    if (!capturing) return
    const onKey = async (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const result = acceleratorFromKeyEvent(e)
      if (result === null) return
      if ('cancel' in result) return stop()
      if ('error' in result) return setProblem({ action: capturing, message: result.error })
      const saved = await window.sarthi.setHotkey(capturing, result.accelerator)
      if (saved.ok) {
        setProblem(null)
        toast(`${HOTKEY_LABELS[capturing]} is now ${acceleratorKeys(result.accelerator).join('+')}`)
      } else {
        setProblem({ action: capturing, message: saved.message, keys: acceleratorKeys(result.accelerator) })
      }
      stop()
    }
    // Leaving the window mid-recording must not leave every shortcut switched off.
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', stop)
    }
  }, [capturing, stop, toast])

  useEffect(() => () => void window.sarthi.suspendHotkeys(false), [])

  const reset = async () => {
    setProblem(null)
    setUnavailable(await window.sarthi.resetHotkeys())
    toast('Shortcuts reset to defaults')
  }

  return (
    <>
      <PageHeader
        title="Hotkeys"
        subtitle="Global shortcuts work from any app. Click a row to rebind it."
        action={
          <Button onClick={() => void reset()} className="[--ring-gap:var(--color-ink)]">
            Reset to defaults
          </Button>
        }
      />
      <Card>
        <div className="flex h-9 items-center justify-between border-b border-line px-4 text-[11px] font-semibold tracking-[.05em] text-fg-3 uppercase">
          <span>Action</span>
          <span>Shortcut</span>
        </div>
        {shortcuts().map((shortcut) => {
          const action = shortcut.fixed ? null : (shortcut.action as HotkeyAction)
          const isCapturing = action !== null && capturing === action
          const rowProblem = action && problem?.action === action ? problem : null
          const taken = action !== null && unavailable.includes(action) && !rowProblem
          const content = (
            <>
              <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                <span className="flex items-baseline gap-2 text-[13px]">
                  {shortcut.label}
                  {HINT[shortcut.action] && <span className="text-xs text-fg-3">{HINT[shortcut.action]}</span>}
                  {shortcut.fixed && <span className="text-xs text-fg-3">fixed</span>}
                  {!shortcut.fixed && !isCapturing && (
                    <span className="hidden text-xs text-fg-3 group-hover:inline">Click to rebind</span>
                  )}
                </span>
                {rowProblem && <span className="text-xs text-danger">{rowProblem.message}</span>}
                {taken && <span className="text-xs text-danger">Taken by another app. Click to choose another.</span>}
              </span>
              {isCapturing ? (
                <span className="flex items-center gap-2 text-xs text-leaf">
                  Press new keys…<span className="text-fg-3">Esc to cancel</span>
                </span>
              ) : (
                <Keys keys={rowProblem?.keys ?? shortcut.keys} tone={rowProblem?.keys || taken ? 'danger' : 'default'} />
              )}
            </>
          )
          const rowClass = `flex min-h-11 w-full items-center justify-between gap-4 border-t border-line px-4 py-2 first:border-t-0 ${
            isCapturing ? 'bg-leaf/4' : rowProblem || taken ? 'bg-danger-solid/5' : ''
          }`
          return action ? (
            <button
              key={shortcut.action}
              type="button"
              onClick={() => (isCapturing ? stop() : start(action))}
              className={`group transition-colors duration-120 hover:bg-[#161e18] focus-ring ${rowClass}`}
            >
              {content}
            </button>
          ) : (
            <div key={shortcut.action} className={rowClass}>
              {content}
            </div>
          )
        })}
      </Card>
      <p className="mt-3 text-[12px] text-fg-3">
        Shortcuts need Ctrl or Alt so they never block normal typing. Scrolling and moving the overlay use fixed arrow keys.
      </p>
    </>
  )
}

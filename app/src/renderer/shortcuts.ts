// The global shortcuts as shown in the UI (keycaps, cheat-sheet, Hotkeys page). Rebindable ones follow the user's
// settings: useSettings calls syncHotkeys whenever settings load or change, before the UI re-renders.
import {
  acceleratorKeys,
  DEFAULT_HOTKEYS,
  HOTKEY_LABELS,
  type HotkeyAction,
  type HotkeyMap
} from '../shared/hotkeys'

export type ShortcutAction = HotkeyAction | 'scroll' | 'move-overlay'

export interface Shortcut {
  action: ShortcutAction
  label: string
  keys: readonly string[]
  /** Fixed shortcuts (arrow-key pairs) can't be rebound. */
  fixed: boolean
}

let current: HotkeyMap = DEFAULT_HOTKEYS

export function syncHotkeys(hotkeys: HotkeyMap): void {
  current = hotkeys
}

const FIXED_KEYS: Record<'scroll' | 'move-overlay', readonly string[]> = {
  scroll: ['Ctrl', 'Shift', '↑', '↓'],
  'move-overlay': ['Ctrl', 'Alt', '←↑↓→']
}

export const keysFor = (action: ShortcutAction): readonly string[] =>
  action === 'scroll' || action === 'move-overlay' ? FIXED_KEYS[action] : acceleratorKeys(current[action])

/** "Ctrl+Shift+L", for native title tooltips. */
export const shortcutLabel = (action: ShortcutAction): string => keysFor(action).join('+')

const ORDER: ShortcutAction[] = [
  'toggle-listening',
  'answer',
  'focus-ask',
  'screenshot',
  'scroll',
  'toggle-overlay',
  'open-settings',
  'toggle-private',
  'move-overlay'
]

export function shortcuts(): Shortcut[] {
  return ORDER.map((action) => {
    const fixed = action === 'scroll' || action === 'move-overlay'
    return {
      action,
      label: fixed ? (action === 'scroll' ? 'Scroll answer' : 'Move overlay') : HOTKEY_LABELS[action as HotkeyAction],
      keys: keysFor(action),
      fixed
    }
  })
}

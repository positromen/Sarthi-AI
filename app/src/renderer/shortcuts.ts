// The global shortcuts as shown in the UI (keycaps, cheat-sheet, Hotkeys page). They mirror the bindings registered
// in main/hotkeys.ts.

export type ShortcutAction =
  | 'toggle-listening'
  | 'answer'
  | 'focus-ask'
  | 'screenshot'
  | 'scroll'
  | 'toggle-overlay'
  | 'open-settings'
  | 'toggle-private'
  | 'move-overlay'

export interface Shortcut {
  action: ShortcutAction
  label: string
  keys: readonly string[]
}

export const SHORTCUTS: readonly Shortcut[] = [
  { action: 'toggle-listening', label: 'Listen / stop', keys: ['Ctrl', 'Shift', 'L'] },
  { action: 'answer', label: 'Answer now', keys: ['Ctrl', 'Shift', 'Enter'] },
  { action: 'focus-ask', label: 'Type a question', keys: ['Ctrl', 'Shift', 'Space'] },
  { action: 'screenshot', label: 'Screenshot', keys: ['Ctrl', 'Shift', 'C'] },
  { action: 'scroll', label: 'Scroll answer', keys: ['Ctrl', 'Shift', '↑', '↓'] },
  { action: 'toggle-overlay', label: 'Hide / show', keys: ['Ctrl', 'Shift', 'H'] },
  { action: 'open-settings', label: 'Settings', keys: ['Ctrl', 'Shift', 'S'] },
  { action: 'toggle-private', label: 'Private mode', keys: ['Ctrl', 'Shift', 'P'] },
  { action: 'move-overlay', label: 'Move overlay', keys: ['Ctrl', 'Alt', '←↑↓→'] }
]

export const keysFor = (action: ShortcutAction): readonly string[] =>
  SHORTCUTS.find((shortcut) => shortcut.action === action)?.keys ?? []

/** "Ctrl+Shift+L", for native title tooltips. */
export const shortcutLabel = (action: ShortcutAction): string => keysFor(action).join('+')

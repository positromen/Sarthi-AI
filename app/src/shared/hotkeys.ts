// Global shortcuts: which can be rebound, their defaults, and the pure rules for turning a key press into an Electron
// accelerator. Shared by main (registration, conflict checks) and the renderer (capture UI, keycap labels).

/** Actions the user can rebind. Scroll and move are fixed pairs of arrow keys. */
export const REBINDABLE = [
  'toggle-listening',
  'answer',
  'focus-ask',
  'screenshot',
  'toggle-overlay',
  'open-settings',
  'toggle-private'
] as const
export type HotkeyAction = (typeof REBINDABLE)[number]
export type HotkeyMap = Record<HotkeyAction, string>

export const DEFAULT_HOTKEYS: HotkeyMap = {
  'toggle-listening': 'CommandOrControl+Shift+L',
  answer: 'CommandOrControl+Shift+Enter',
  'focus-ask': 'CommandOrControl+Shift+Space',
  screenshot: 'CommandOrControl+Shift+C',
  'toggle-overlay': 'CommandOrControl+Shift+H',
  'open-settings': 'CommandOrControl+Shift+S',
  'toggle-private': 'CommandOrControl+Shift+P'
}

export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  'toggle-listening': 'Listen / stop',
  answer: 'Answer now',
  'focus-ask': 'Type a question',
  screenshot: 'Screenshot',
  'toggle-overlay': 'Hide / show',
  'open-settings': 'Settings',
  'toggle-private': 'Private mode'
}

export const FIXED_HOTKEYS = {
  scroll: ['CommandOrControl+Shift+Up', 'CommandOrControl+Shift+Down'],
  move: ['CommandOrControl+Alt+Up', 'CommandOrControl+Alt+Down', 'CommandOrControl+Alt+Left', 'CommandOrControl+Alt+Right']
} as const

const isRebindable = (action: string): action is HotkeyAction => (REBINDABLE as readonly string[]).includes(action)

/** Saved hotkeys merged over the defaults; unknown actions and non-string values are dropped. */
export function mergeHotkeys(stored: unknown): HotkeyMap {
  const merged = { ...DEFAULT_HOTKEYS }
  if (stored && typeof stored === 'object') {
    for (const [action, accelerator] of Object.entries(stored)) {
      if (isRebindable(action) && typeof accelerator === 'string' && accelerator) merged[action] = accelerator
    }
  }
  return merged
}

// ── Key press → accelerator ─────────────────────────────────────────────────────────────────────────────────────────

const NAMED: Record<string, string> = {
  Space: 'Space', Enter: 'Enter', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Backquote: '`'
}
const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/

/** Uses the physical key (event.code), so Shift+1 records "1", not "!", whatever the keyboard layout. */
function keyName(code: string): string | null {
  let match: RegExpExecArray | null
  if ((match = /^Key([A-Z])$/.exec(code))) return match[1]
  if ((match = /^Digit(\d)$/.exec(code))) return match[1]
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
  return NAMED[code] ?? null
}

export interface KeyEventLike {
  code: string
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
}

/**
 * The accelerator for a key press while rebinding: null while only modifiers are held, `cancel` on Escape, or an
 * error for combinations that can't be global shortcuts.
 */
export function acceleratorFromKeyEvent(e: KeyEventLike): { accelerator: string } | { cancel: true } | { error: string } | null {
  if (e.key === 'Escape' || e.code === 'Escape') return { cancel: true }
  if (MODIFIER_CODES.test(e.code) || ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null
  if (e.metaKey) return { error: 'Windows key combinations are reserved by Windows. Use Ctrl or Alt.' }
  // Without Ctrl or Alt, a global shortcut would swallow ordinary typing in every app.
  if (!e.ctrlKey && !e.altKey) return { error: 'Include Ctrl or Alt, so the shortcut never blocks normal typing.' }
  const name = keyName(e.code)
  if (!name) return { error: 'That key can’t be used in a shortcut. Try a letter, number or F-key.' }
  const parts = [e.ctrlKey && 'CommandOrControl', e.altKey && 'Alt', e.shiftKey && 'Shift', name].filter(Boolean)
  return { accelerator: parts.join('+') }
}

// ── Display and comparison ──────────────────────────────────────────────────────────────────────────────────────────

const LABEL: Record<string, string> = {
  CommandOrControl: 'Ctrl', CmdOrCtrl: 'Ctrl', Control: 'Ctrl', Ctrl: 'Ctrl',
  Up: '↑', Down: '↓', Left: '←', Right: '→'
}

/** Keycap labels, e.g. "CommandOrControl+Alt+Up" → ["Ctrl", "Alt", "↑"]. */
export const acceleratorKeys = (accelerator: string): string[] =>
  accelerator.split('+').map((part) => LABEL[part] ?? part)

const normalize = (accelerator: string): string =>
  accelerator
    .split('+')
    .map((part) => (LABEL[part] === 'Ctrl' || /^ctrl$/i.test(part) ? 'ctrl' : part.toLowerCase()))
    .join('+')

export const sameAccelerator = (a: string, b: string): boolean => normalize(a) === normalize(b)

/** Why `accelerator` can't be used for `action`, or null if it is free. */
export function hotkeyConflict(hotkeys: HotkeyMap, action: HotkeyAction, accelerator: string): string | null {
  if (FIXED_HOTKEYS.scroll.some((fixed) => sameAccelerator(fixed, accelerator))) return 'That shortcut scrolls the answer.'
  if (FIXED_HOTKEYS.move.some((fixed) => sameAccelerator(fixed, accelerator))) return 'That shortcut moves the overlay.'
  const owner = REBINDABLE.find((other) => other !== action && sameAccelerator(hotkeys[other], accelerator))
  return owner ? `Already used by ${HOTKEY_LABELS[owner]}.` : null
}

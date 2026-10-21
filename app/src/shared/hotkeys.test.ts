import { describe, expect, it } from 'vitest'
import { acceleratorFromKeyEvent, acceleratorKeys, DEFAULT_HOTKEYS, hotkeyConflict, sameAccelerator } from './hotkeys'
import { DEFAULT_SETTINGS, withDefaults } from './types'

const key = (code: string, mods: Partial<Record<'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey', boolean>> = {}, k = '') => ({
  code,
  key: k || code,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...mods
})

describe('acceleratorFromKeyEvent', () => {
  it('builds Electron accelerators in a fixed modifier order, from the physical key', () => {
    expect(acceleratorFromKeyEvent(key('KeyL', { ctrlKey: true, shiftKey: true }))).toEqual({ accelerator: 'CommandOrControl+Shift+L' })
    expect(acceleratorFromKeyEvent(key('Digit1', { altKey: true, shiftKey: true }, '!'))).toEqual({ accelerator: 'Alt+Shift+1' })
    expect(acceleratorFromKeyEvent(key('ArrowUp', { ctrlKey: true, altKey: true }))).toEqual({ accelerator: 'CommandOrControl+Alt+Up' })
    expect(acceleratorFromKeyEvent(key('F8', { ctrlKey: true }))).toEqual({ accelerator: 'CommandOrControl+F8' })
    expect(acceleratorFromKeyEvent(key('Space', { ctrlKey: true, shiftKey: true }))).toEqual({ accelerator: 'CommandOrControl+Shift+Space' })
  })

  it('waits while only modifiers are held', () => {
    expect(acceleratorFromKeyEvent(key('ShiftLeft', { shiftKey: true }, 'Shift'))).toBeNull()
    expect(acceleratorFromKeyEvent(key('ControlLeft', { ctrlKey: true }, 'Control'))).toBeNull()
  })

  it('cancels on Escape', () => {
    expect(acceleratorFromKeyEvent(key('Escape', {}, 'Escape'))).toEqual({ cancel: true })
  })

  it('requires Ctrl or Alt, so ordinary typing can never become a global shortcut', () => {
    expect(acceleratorFromKeyEvent(key('KeyA'))).toMatchObject({ error: expect.stringMatching(/Ctrl or Alt/) })
    expect(acceleratorFromKeyEvent(key('KeyA', { shiftKey: true }))).toMatchObject({ error: expect.stringMatching(/Ctrl or Alt/) })
  })

  it('refuses Windows-key combinations, which Windows keeps for itself', () => {
    expect(acceleratorFromKeyEvent(key('KeyD', { metaKey: true, ctrlKey: true }))).toMatchObject({ error: expect.stringMatching(/Windows key/) })
  })

  it('refuses keys it cannot name', () => {
    expect(acceleratorFromKeyEvent(key('IntlRo', { ctrlKey: true }))).toMatchObject({ error: expect.any(String) })
  })
})

describe('acceleratorKeys', () => {
  it('turns an accelerator into keycap labels', () => {
    expect(acceleratorKeys('CommandOrControl+Shift+Enter')).toEqual(['Ctrl', 'Shift', 'Enter'])
    expect(acceleratorKeys('CommandOrControl+Alt+Up')).toEqual(['Ctrl', 'Alt', '↑'])
  })
})

describe('hotkeyConflict', () => {
  it('names the action that already uses the combination', () => {
    expect(hotkeyConflict(DEFAULT_HOTKEYS, 'answer', 'CommandOrControl+Shift+H')).toMatch(/Hide \/ show/)
  })

  it('protects the fixed scroll and move shortcuts', () => {
    expect(hotkeyConflict(DEFAULT_HOTKEYS, 'answer', 'CommandOrControl+Shift+Up')).toMatch(/scroll/i)
    expect(hotkeyConflict(DEFAULT_HOTKEYS, 'answer', 'CommandOrControl+Alt+Left')).toMatch(/move/i)
  })

  it('allows rebinding an action to its own current shortcut, or to something free', () => {
    expect(hotkeyConflict(DEFAULT_HOTKEYS, 'answer', 'CommandOrControl+Shift+Enter')).toBeNull()
    expect(hotkeyConflict(DEFAULT_HOTKEYS, 'answer', 'CommandOrControl+Alt+A')).toBeNull()
  })

  it('compares accelerators regardless of case and Ctrl spelling', () => {
    expect(sameAccelerator('Ctrl+shift+h', 'CommandOrControl+Shift+H')).toBe(true)
  })
})

describe('withDefaults hotkeys', () => {
  it('fills in missing actions and ignores junk', () => {
    const settings = withDefaults({ hotkeys: { answer: 'CommandOrControl+Alt+A', bogus: 'X', screenshot: 42 } })
    expect(settings.hotkeys).toEqual({ ...DEFAULT_HOTKEYS, answer: 'CommandOrControl+Alt+A' })
    expect(withDefaults({}).hotkeys).toEqual(DEFAULT_SETTINGS.hotkeys)
  })
})

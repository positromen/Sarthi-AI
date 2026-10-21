import { describe, expect, it } from 'vitest'
import { controlCenterInTaskbar, trayMenu, trayVisible } from './trayModel'

describe('tray and taskbar privacy', () => {
  it('shows the tray only when private mode is off (it would be visible in a full-screen share)', () => {
    expect(trayVisible({ privateMode: true })).toBe(false)
    expect(trayVisible({ privateMode: false })).toBe(true)
  })

  it('keeps the Control Center off the taskbar in private mode, except during first-run onboarding', () => {
    expect(controlCenterInTaskbar({ privateMode: true, onboarded: true })).toBe(false)
    expect(controlCenterInTaskbar({ privateMode: true, onboarded: false })).toBe(true)
    expect(controlCenterInTaskbar({ privateMode: false, onboarded: true })).toBe(true)
  })
})

describe('trayMenu', () => {
  const labels = (state: Parameters<typeof trayMenu>[0]) => trayMenu(state).map((item) => item.label)

  it('offers show/hide, listen/stop, Control Center and Quit, matching the current state', () => {
    expect(labels({ overlayVisible: true, listening: false })).toEqual([
      'Hide overlay',
      'Start listening',
      'Control Center',
      null,
      'Quit Sarthi'
    ])
    expect(labels({ overlayVisible: false, listening: true })).toEqual([
      'Show overlay',
      'Stop listening',
      'Control Center',
      null,
      'Quit Sarthi'
    ])
  })

  it('maps each item to an action', () => {
    expect(trayMenu({ overlayVisible: true, listening: false }).map((item) => item.action)).toEqual([
      'toggle-overlay',
      'toggle-listening',
      'open-settings',
      null,
      'quit'
    ])
  })
})

// Pure rules for the tray icon and the Control Center's taskbar button (no Electron imports, so they're testable).
// Private mode hides the windows from capture; the tray and taskbar would still show "Sarthi" in a full-screen share,
// so they follow private mode too.

/** The tray lives in the taskbar's notification area, so it only exists while private mode is off. */
export const trayVisible = ({ privateMode }: { privateMode: boolean }): boolean => !privateMode

/**
 * In private mode the Control Center leaves the taskbar (reach it with the settings hotkey or the overlay's ⚙). During
 * first-run onboarding it stays, so a new user can't lose the window behind others.
 */
export const controlCenterInTaskbar = ({ privateMode, onboarded }: { privateMode: boolean; onboarded: boolean }): boolean =>
  !privateMode || !onboarded

export type TrayAction = 'toggle-overlay' | 'toggle-listening' | 'open-settings' | 'quit'

/** Menu items in order; a null label/action is a separator. */
export function trayMenu({ overlayVisible, listening }: { overlayVisible: boolean; listening: boolean }): {
  label: string | null
  action: TrayAction | null
}[] {
  return [
    { label: overlayVisible ? 'Hide overlay' : 'Show overlay', action: 'toggle-overlay' },
    { label: listening ? 'Stop listening' : 'Start listening', action: 'toggle-listening' },
    { label: 'Control Center', action: 'open-settings' },
    { label: null, action: null },
    { label: 'Quit Sarthi', action: 'quit' }
  ]
}

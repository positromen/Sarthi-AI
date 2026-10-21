// Whether this OS can leave Sarthi's windows out of a screen share. Windows removes a protected window from capture
// only from build 19041 (Windows 10 version 2004); older builds capture it as a black box, which is worse than nothing.
export const MIN_WINDOWS_BUILD = 19041

/** `release` is `os.release()`, e.g. "10.0.26300" on Windows (the build is the third part). */
export function captureExclusionSupported(platform: string, release: string): boolean {
  if (platform === 'darwin') return true
  if (platform !== 'win32') return false
  const build = Number(release.split('.')[2])
  return Number.isFinite(build) && build >= MIN_WINDOWS_BUILD
}

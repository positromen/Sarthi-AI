import { describe, expect, it } from 'vitest'
import { captureExclusionSupported } from './privacySupport'

describe('captureExclusionSupported', () => {
  it('is true from Windows 10 version 2004 (build 19041) on, including Windows 11', () => {
    expect(captureExclusionSupported('win32', '10.0.19041')).toBe(true)
    expect(captureExclusionSupported('win32', '10.0.26300')).toBe(true)
  })

  it('is false on older Windows 10 builds, where a share shows a black box instead', () => {
    expect(captureExclusionSupported('win32', '10.0.18363')).toBe(false)
    expect(captureExclusionSupported('win32', '10.0.17763')).toBe(false)
  })

  it('trusts macOS, refuses Linux, and refuses a release it cannot read', () => {
    expect(captureExclusionSupported('darwin', '24.0.0')).toBe(true)
    expect(captureExclusionSupported('linux', '6.8.0')).toBe(false)
    expect(captureExclusionSupported('win32', 'garbage')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { clampToWorkArea, defaultOverlayPosition, restoreOverlayPosition } from './overlayPosition'

const SIZE = { width: 520, height: 640 }
const PRIMARY = { x: 0, y: 0, width: 1920, height: 1040 }
const RIGHT = { x: 1920, y: 0, width: 2560, height: 1400 }

describe('defaultOverlayPosition', () => {
  it('sits top-right of the primary work area with a margin', () => {
    expect(defaultOverlayPosition(PRIMARY, SIZE)).toEqual({ x: 1920 - 520 - 24, y: 24 })
  })
})

describe('restoreOverlayPosition', () => {
  it('uses the saved position when it is on a connected display', () => {
    expect(restoreOverlayPosition({ x: 2200, y: 100 }, [PRIMARY, RIGHT], PRIMARY, SIZE)).toEqual({ x: 2200, y: 100 })
  })

  it('falls back to the default when the saved display is gone (monitor unplugged)', () => {
    expect(restoreOverlayPosition({ x: 2200, y: 100 }, [PRIMARY], PRIMARY, SIZE)).toEqual(defaultOverlayPosition(PRIMARY, SIZE))
  })

  it('falls back to the default when nothing is saved', () => {
    expect(restoreOverlayPosition(null, [PRIMARY], PRIMARY, SIZE)).toEqual(defaultOverlayPosition(PRIMARY, SIZE))
  })

  it('pulls a position that hangs off the edge of its display back on screen', () => {
    expect(restoreOverlayPosition({ x: 1700, y: 10 }, [PRIMARY], PRIMARY, SIZE)).toEqual({ x: 1920 - 520, y: 10 })
  })
})

describe('clampToWorkArea', () => {
  it('keeps the window fully inside horizontally and its header reachable vertically', () => {
    expect(clampToWorkArea({ x: -300, y: -50 }, SIZE, PRIMARY)).toEqual({ x: 0, y: 0 })
    expect(clampToWorkArea({ x: 5000, y: 5000 }, SIZE, PRIMARY)).toEqual({ x: 1920 - 520, y: 1040 - 60 })
    expect(clampToWorkArea({ x: 100, y: 200 }, SIZE, PRIMARY)).toEqual({ x: 100, y: 200 })
  })
})

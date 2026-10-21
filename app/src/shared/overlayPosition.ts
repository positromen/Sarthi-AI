// Where the overlay window goes: restored from settings when that spot is still on a connected display, otherwise the
// top-right of the primary display. Pure (rectangles in, position out) so main can stay a thin Electron wrapper.

export interface Point {
  x: number
  y: number
}
export interface Size {
  width: number
  height: number
}
export type Rect = Point & Size

const MARGIN = 24
// The card's header sits at the top of the (mostly transparent) window; keep this much of it on screen.
const HEADER_VISIBLE = 60

export const defaultOverlayPosition = (primary: Rect, size: Size): Point => ({
  x: primary.x + primary.width - size.width - MARGIN,
  y: primary.y + MARGIN
})

/** Fully inside horizontally; vertically the header stays reachable (the transparent bottom may hang below). */
export function clampToWorkArea(position: Point, size: Size, area: Rect): Point {
  return {
    x: Math.min(Math.max(position.x, area.x), area.x + area.width - size.width),
    y: Math.min(Math.max(position.y, area.y), area.y + area.height - HEADER_VISIBLE)
  }
}

const overlap = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))

export function restoreOverlayPosition(saved: Point | null, workAreas: Rect[], primary: Rect, size: Size): Point {
  if (saved) {
    // The display showing most of the header strip owns the window; none at all means its display is gone.
    const header = { ...saved, width: size.width, height: HEADER_VISIBLE }
    const best = workAreas.reduce<{ area: Rect | null; shared: number }>(
      (acc, area) => (overlap(header, area) > acc.shared ? { area, shared: overlap(header, area) } : acc),
      { area: null, shared: 0 }
    )
    if (best.area) return clampToWorkArea(saved, size, best.area)
  }
  return defaultOverlayPosition(primary, size)
}

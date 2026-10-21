/**
 * Arrow-key movement through a row or list of `count` options (segmented controls, select menus): returns the new
 * index, clamped to the ends, or null when the key is not a navigation key.
 */
export function stepIndex(current: number, key: string, count: number): number | null {
  const last = count - 1
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(last, current + 1)
    case 'ArrowLeft':
    case 'ArrowUp':
      return Math.max(0, current - 1)
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return null
  }
}

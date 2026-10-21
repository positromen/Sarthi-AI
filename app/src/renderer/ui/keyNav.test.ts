import { describe, expect, it } from 'vitest'
import { stepIndex } from './keyNav'

describe('stepIndex', () => {
  it('moves forward and back with arrow keys in either axis', () => {
    expect(stepIndex(1, 'ArrowRight', 3)).toBe(2)
    expect(stepIndex(1, 'ArrowDown', 3)).toBe(2)
    expect(stepIndex(1, 'ArrowLeft', 3)).toBe(0)
    expect(stepIndex(1, 'ArrowUp', 3)).toBe(0)
  })

  it('stops at the ends instead of wrapping', () => {
    expect(stepIndex(2, 'ArrowRight', 3)).toBe(2)
    expect(stepIndex(0, 'ArrowLeft', 3)).toBe(0)
  })

  it('jumps with Home and End', () => {
    expect(stepIndex(1, 'Home', 5)).toBe(0)
    expect(stepIndex(1, 'End', 5)).toBe(4)
  })

  it('starts from the first item when nothing is selected yet', () => {
    expect(stepIndex(-1, 'ArrowDown', 4)).toBe(0)
  })

  it('ignores other keys', () => {
    expect(stepIndex(1, 'a', 3)).toBeNull()
    expect(stepIndex(1, 'Enter', 3)).toBeNull()
  })
})

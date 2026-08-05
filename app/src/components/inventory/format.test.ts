import { describe, expect, it } from 'vitest'
import { formatSize } from './format'

describe('formatSize', () => {
  it('joins value and unit when both are present', () => {
    expect(formatSize(12, 'fl_oz')).toBe('12 fl_oz')
  })

  it('renders a zero size instead of dropping it', () => {
    // 0 is real data — a truthiness check would silently hide it.
    expect(formatSize(0, 'oz')).toBe('0 oz')
  })

  it('returns null unless both halves are set', () => {
    expect(formatSize(null, null)).toBeNull()
    expect(formatSize(12, null)).toBeNull()
    expect(formatSize(null, 'oz')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildUnitMap,
  convertQuantity,
  formatQuantity,
  sameCategory,
} from './units'

const units = buildUnitMap([
  { unit: 'g', unit_category: 'weight', to_base_factor: 1 },
  { unit: 'kg', unit_category: 'weight', to_base_factor: 1000 },
  { unit: 'oz', unit_category: 'weight', to_base_factor: 28.3495 },
  { unit: 'fl_oz', unit_category: 'volume', to_base_factor: 1 },
  { unit: 'cup', unit_category: 'volume', to_base_factor: 8 },
  { unit: 'count', unit_category: 'count', to_base_factor: 1 },
])

describe('convertQuantity', () => {
  it('converts within the weight category', () => {
    expect(convertQuantity(1, 'kg', 'g', units)).toBe(1000)
    expect(convertQuantity(1000, 'g', 'kg', units)).toBe(1)
  })

  it('converts grams to ounces', () => {
    expect(convertQuantity(50, 'g', 'oz', units)).toBeCloseTo(1.7637, 3)
  })

  it('blocks cross-category conversion (returns null)', () => {
    expect(convertQuantity(50, 'g', 'fl_oz', units)).toBeNull()
    expect(convertQuantity(1, 'count', 'g', units)).toBeNull()
  })

  it('returns null for unknown units', () => {
    expect(convertQuantity(1, 'mystery', 'g', units)).toBeNull()
  })
})

describe('sameCategory', () => {
  it('matches within a category and rejects across', () => {
    expect(sameCategory('g', 'kg', units)).toBe(true)
    expect(sameCategory('g', 'fl_oz', units)).toBe(false)
    expect(sameCategory('count', 'count', units)).toBe(true)
  })
})

describe('formatQuantity', () => {
  it('trims trailing precision', () => {
    expect(formatQuantity(8)).toBe('8')
    expect(formatQuantity(1.76370625)).toBe('1.764')
    expect(formatQuantity(11)).toBe('11')
  })
})

import { describe, expect, it } from 'vitest'
import { buildUnitMap } from '@/lib/units'
import {
  allocatedTotal,
  costReconciles,
  defaultAllocations,
  isAllCount,
  resolveChild,
  type ComponentLine,
} from './types'

const units = buildUnitMap([
  { unit: 'count', unit_category: 'count', to_base_factor: 1 },
  { unit: 'g', unit_category: 'weight', to_base_factor: 1 },
  { unit: 'kg', unit_category: 'weight', to_base_factor: 1000 },
  { unit: 'ml', unit_category: 'volume', to_base_factor: 1 },
])

// A variety 12-pack: 4 Coke / 4 Sprite / 4 Fanta (all count).
const varietyPack: ComponentLine[] = [
  { componentProductId: 'coke', name: 'Coke', quantity: 4, unit: 'count' },
  { componentProductId: 'sprite', name: 'Sprite', quantity: 4, unit: 'count' },
  { componentProductId: 'fanta', name: 'Fanta', quantity: 4, unit: 'count' },
]

describe('isAllCount', () => {
  it('is true for an all-count composition', () => {
    expect(isAllCount(varietyPack, units)).toBe(true)
  })

  it('is false when a weight component is present', () => {
    const kit: ComponentLine[] = [
      ...varietyPack,
      { componentProductId: 'spice', name: 'Paprika', quantity: 50, unit: 'g' },
    ]
    expect(isAllCount(kit, units)).toBe(false)
  })
})

describe('defaultAllocations (all-count) — equal per individual unit', () => {
  it('splits $12/pack × 2 packs across 24 cans = $1.00 each', () => {
    const packCost = 12 * 2 // 24 cans total
    const alloc = defaultAllocations(varietyPack, 2, packCost, units)
    expect(alloc.get('coke')).toBeCloseTo(1.0, 10)
    expect(alloc.get('sprite')).toBeCloseTo(1.0, 10)
    // Conservation: total allocated equals the package cost.
    expect(allocatedTotal(varietyPack, 2, alloc)).toBeCloseTo(packCost, 10)
    expect(costReconciles(varietyPack, 2, packCost, alloc)).toBe(true)
  })
})

describe('defaultAllocations (mixed) — equal per component line', () => {
  const kit: ComponentLine[] = [
    { componentProductId: 'flour', name: 'Flour', quantity: 500, unit: 'g' },
    { componentProductId: 'oil', name: 'Oil', quantity: 250, unit: 'ml' },
  ]
  it('conserves cost across lines despite mixed units', () => {
    const packCost = 10
    const alloc = defaultAllocations(kit, 1, packCost, units)
    // $5 per line / 500 g and / 250 ml respectively.
    expect(alloc.get('flour')).toBeCloseTo(5 / 500, 10)
    expect(alloc.get('oil')).toBeCloseTo(5 / 250, 10)
    expect(allocatedTotal(kit, 1, alloc)).toBeCloseTo(packCost, 10)
  })
})

describe('costReconciles', () => {
  it('rejects a total that misses the package cost', () => {
    const bad = new Map([
      ['coke', 2],
      ['sprite', 1],
      ['fanta', 1],
    ])
    // 4*2 + 4*1 + 4*1 = 16 ≠ 24
    expect(costReconciles(varietyPack, 2, 24, bad)).toBe(false)
  })
})

describe('resolveChild', () => {
  it('creates new when no existing item', () => {
    const r = resolveChild(varietyPack[0], 2, undefined, units)
    expect(r.kind).toBe('create')
  })

  it('merges with within-category conversion', () => {
    const weightLine: ComponentLine = {
      componentProductId: 'flour',
      name: 'Flour',
      quantity: 1,
      unit: 'kg',
    }
    const r = resolveChild(weightLine, 2, { unit: 'g', quantity: 500 }, units)
    expect(r.kind).toBe('merge')
    if (r.kind === 'merge') {
      // 2 kg produced → 2000 g into the existing 500 g item.
      expect(r.convertedQty).toBe(2000)
      expect(r.existingQty).toBe(500)
    }
  })

  it('falls back to create-new on a cross-category mismatch', () => {
    const weightLine: ComponentLine = {
      componentProductId: 'flour',
      name: 'Flour',
      quantity: 1,
      unit: 'kg',
    }
    // Existing item is in ml (volume) — can't convert from kg (weight).
    const r = resolveChild(weightLine, 1, { unit: 'ml', quantity: 100 }, units)
    expect(r.kind).toBe('create')
  })
})

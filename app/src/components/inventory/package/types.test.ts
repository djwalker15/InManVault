import { describe, expect, it } from 'vitest'
import { makeRow, validateComposition, type ComponentDraft } from './types'

function row(
  key: string,
  productId: string | null,
  quantity: string,
  unit = 'count',
): ComponentDraft {
  return {
    key,
    product: productId
      ? { product_id: productId, name: productId, brand: null }
      : null,
    quantity,
    unit,
  }
}

describe('validateComposition', () => {
  it('rejects an empty composition', () => {
    expect(validateComposition([]).ok).toBe(false)
  })

  it('rejects a row with no product picked', () => {
    const r = validateComposition([row('a', null, '4')])
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/pick a product/i)
  })

  it('rejects a non-positive quantity', () => {
    expect(validateComposition([row('a', 'coke', '0')]).ok).toBe(false)
    expect(validateComposition([row('a', 'coke', '')]).ok).toBe(false)
    expect(validateComposition([row('a', 'coke', 'abc')]).ok).toBe(false)
  })

  it('rejects a duplicate product', () => {
    const r = validateComposition([
      row('a', 'coke', '4'),
      row('b', 'coke', '4'),
    ])
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/already a component/i)
  })

  it('resolves valid rows into sequential sort_order', () => {
    const r = validateComposition([
      row('a', 'coke', '4'),
      row('b', 'sprite', '4', 'count'),
    ])
    expect(r.ok).toBe(true)
    expect(r.components).toEqual([
      { component_product_id: 'coke', quantity: 4, unit: 'count', sort_order: 0 },
      { component_product_id: 'sprite', quantity: 4, unit: 'count', sort_order: 1 },
    ])
  })
})

describe('makeRow', () => {
  it('creates an empty row defaulting to count', () => {
    const r = makeRow('k1')
    expect(r).toEqual({ key: 'k1', product: null, quantity: '1', unit: 'count' })
  })
})

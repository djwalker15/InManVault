import { describe, expect, it } from 'vitest'
import {
  guessMapping,
  resolveRows,
  toPayloadRow,
  type ResolveInput,
} from './resolve'
import type { ProductRow } from '../types'

const product = (over: Partial<ProductRow>): ProductRow => ({
  product_id: 'p1',
  crew_id: null,
  name: 'Tomato Paste',
  brand: 'Heinz',
  variant: null,
  barcode: '012345678905',
  image_url: null,
  size_value: null,
  size_unit: null,
  default_category_id: null,
  ...over,
})

const baseInput = (
  rows: Record<string, string>[],
  over: Partial<ResolveInput> = {},
): ResolveInput => ({
  parsed: { headers: ['Name', 'Qty', 'Unit', 'Location', 'UPC'], rows },
  mapping: {
    name: 'Name',
    quantity: 'Qty',
    unit: 'Unit',
    location: 'Location',
    barcode: 'UPC',
  },
  defaults: { unit: 'count', defaultSpaceId: 'premises' },
  products: [product({})],
  spaces: [
    { space_id: 'premises', name: 'My House', parent_id: null },
    { space_id: 'pantry', name: 'Pantry', parent_id: 'premises' },
  ],
  categories: [{ category_id: 'cat1', name: 'Canned Goods' }],
  validUnits: ['count', 'oz', 'kg'],
  ...over,
})

describe('resolveRows', () => {
  it('matches a product by barcode and a location by name', () => {
    const [row] = resolveRows(
      baseInput([
        { Name: '', Qty: '3', Unit: 'count', Location: 'Pantry', UPC: '012345678905' },
      ]),
    )
    expect(row.productResolution).toBe('matched')
    expect(row.productId).toBe('p1')
    expect(row.locationResolution).toBe('matched')
    expect(row.currentSpaceId).toBe('pantry')
    expect(row.locationLabel).toBe('My House › Pantry')
    expect(row.valid).toBe(true)
  })

  it('flags a new product when no catalog match and defaults the location', () => {
    const [row] = resolveRows(
      baseInput([
        { Name: 'Homemade Syrup', Qty: '2', Unit: 'oz', Location: 'Nowhere', UPC: '' },
      ]),
    )
    expect(row.productResolution).toBe('new')
    expect(row.productId).toBeNull()
    expect(row.productName).toBe('Homemade Syrup')
    expect(row.locationResolution).toBe('defaulted')
    expect(row.currentSpaceId).toBe('premises')
    expect(row.valid).toBe(true)
  })

  it('marks rows invalid for bad quantity, unknown unit, or missing product', () => {
    const rows = resolveRows(
      baseInput([
        { Name: 'A', Qty: '0', Unit: 'count', Location: 'Pantry', UPC: '' },
        { Name: 'B', Qty: '2', Unit: 'furlong', Location: 'Pantry', UPC: '' },
        { Name: '', Qty: '2', Unit: 'count', Location: 'Pantry', UPC: '' },
      ]),
    )
    expect(rows[0].valid).toBe(false)
    expect(rows[0].issues[0]).toMatch(/quantity/i)
    expect(rows[1].valid).toBe(false)
    expect(rows[1].issues[0]).toMatch(/unit/i)
    expect(rows[2].valid).toBe(false)
    expect(rows[2].issues[0]).toMatch(/no product/i)
  })

  it('applies the default unit when the unit column is unmapped', () => {
    const input = baseInput([{ Name: 'C', Qty: '1', Unit: '', Location: 'Pantry', UPC: '' }])
    input.mapping.unit = null
    const [row] = resolveRows(input)
    expect(row.unit).toBe('count')
    expect(row.valid).toBe(true)
  })

  it('guessMapping auto-detects headers by synonym', () => {
    const m = guessMapping(['Item Name', 'Qty', 'UPC', 'Where', 'Notes', 'Flavor'])
    expect(m).toEqual({
      name: 'Item Name',
      variant: 'Flavor',
      quantity: 'Qty',
      barcode: 'UPC',
      location: 'Where',
      notes: 'Notes',
    })
  })

  describe('variant-aware matching', () => {
    const lime = product({ product_id: 'lime', name: 'LaCroix', variant: 'Lime', barcode: null })
    const pample = product({
      product_id: 'pample',
      name: 'LaCroix',
      variant: 'Pamplemousse',
      barcode: null,
    })
    const plain = product({ product_id: 'plain', name: 'Seltzer', variant: null, barcode: null })
    const withVariant = (rows: Record<string, string>[]) => {
      const input = baseInput(rows, { products: [lime, pample, plain] })
      input.parsed.headers.push('Flavor')
      input.mapping.variant = 'Flavor'
      return input
    }

    it('matches on (name, variant) so two flavors do not collide', () => {
      const rows = resolveRows(
        withVariant([
          { Name: 'LaCroix', Flavor: 'Lime', Qty: '1', Unit: 'count', Location: '', UPC: '' },
          { Name: 'LaCroix', Flavor: 'pamplemousse', Qty: '1', Unit: 'count', Location: '', UPC: '' },
        ]),
      )
      expect(rows[0]).toMatchObject({ productResolution: 'matched', productId: 'lime' })
      expect(rows[1]).toMatchObject({ productResolution: 'matched', productId: 'pample' })
    })

    it('creates a new product for an unknown variant and carries it in the payload', () => {
      const [row] = resolveRows(
        withVariant([
          { Name: 'LaCroix', Flavor: 'Coconut', Qty: '1', Unit: 'count', Location: '', UPC: '' },
        ]),
      )
      expect(row.productResolution).toBe('new')
      expect(row.productVariant).toBe('Coconut')
      expect(toPayloadRow(row)).toMatchObject({
        product_name: 'LaCroix',
        product_variant: 'Coconut',
      })
    })

    it('flags a variant-less row as ambiguous when only variants exist under that name', () => {
      const [row] = resolveRows(
        withVariant([
          { Name: 'LaCroix', Flavor: '', Qty: '1', Unit: 'count', Location: '', UPC: '' },
        ]),
      )
      expect(row.productResolution).toBe('ambiguous')
    })

    it('still matches a variant-less product when no variant column is given', () => {
      const [row] = resolveRows(
        withVariant([
          { Name: 'Seltzer', Flavor: '', Qty: '1', Unit: 'count', Location: '', UPC: '' },
        ]),
      )
      expect(row).toMatchObject({ productResolution: 'matched', productId: 'plain' })
    })
  })

  it('toPayloadRow projects a resolved row to the RPC shape', () => {
    const [row] = resolveRows(
      baseInput([
        { Name: 'Homemade Syrup', Qty: '2', Unit: 'oz', Location: 'Pantry', UPC: '999' },
      ]),
    )
    expect(toPayloadRow(row)).toEqual({
      product_id: null,
      product_name: 'Homemade Syrup',
      product_brand: null,
      product_variant: null,
      product_barcode: '999',
      quantity: 2,
      unit: 'oz',
      current_space_id: 'pantry',
      category_id: null,
      unit_cost: null,
      notes: null,
    })
  })
})

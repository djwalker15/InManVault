import { describe, expect, it } from 'vitest'
import { isImportable, normalizeRaw, rowIssues, toPayloadRows } from './api'
import { toRowState, type ReceiptRow, type RowState } from './types'

const VALID_UNITS = new Set(['count', 'oz', 'kg', 'gal'])

const row = (over: Partial<RowState> = {}): RowState => ({
  id: 0,
  rawText: 'GV WHL MLK GAL',
  canonicalName: 'Whole Milk',
  brand: 'Great Value',
  quantity: 1,
  unit: 'count',
  unitPrice: 3.48,
  choice: { kind: 'product', productId: 'p1', productName: 'Whole Milk' },
  included: true,
  candidates: [],
  ...over,
})

describe('isImportable', () => {
  it('accepts an included, priced, product-matched row', () => {
    expect(isImportable(row(), VALID_UNITS)).toBe(true)
  })

  it('rejects an unresolved row (forces explicit pick/create)', () => {
    expect(isImportable(row({ choice: { kind: 'unresolved' } }), VALID_UNITS)).toBe(
      false,
    )
  })

  it('rejects a create row with a blank name', () => {
    expect(
      isImportable(row({ choice: { kind: 'create', name: '  ' } }), VALID_UNITS),
    ).toBe(false)
  })

  it('accepts a create row with a name', () => {
    expect(
      isImportable(row({ choice: { kind: 'create', name: 'Whole Milk' } }), VALID_UNITS),
    ).toBe(true)
  })

  it('rejects excluded rows and bad quantities/units', () => {
    expect(isImportable(row({ included: false }), VALID_UNITS)).toBe(false)
    expect(isImportable(row({ quantity: 0 }), VALID_UNITS)).toBe(false)
    expect(isImportable(row({ quantity: null }), VALID_UNITS)).toBe(false)
    expect(isImportable(row({ unit: 'furlong' }), VALID_UNITS)).toBe(false)
  })
})

describe('rowIssues', () => {
  it('is empty for an importable row', () => {
    expect(rowIssues(row(), VALID_UNITS)).toEqual([])
  })

  it('accepts a gallon row once gal is a tracked unit', () => {
    expect(rowIssues(row({ unit: 'gal' }), VALID_UNITS)).toEqual([])
  })

  it('names the unknown unit instead of a generic message', () => {
    expect(rowIssues(row({ unit: 'furlong' }), VALID_UNITS)).toEqual([
      `Unit "furlong" isn't one we track — pick one.`,
    ])
  })

  it('flags a missing unit distinctly from an unknown one', () => {
    expect(rowIssues(row({ unit: '' }), VALID_UNITS)).toEqual([
      'No unit found — pick one.',
    ])
  })

  it('stacks one message per blocking reason', () => {
    const issues = rowIssues(
      row({ quantity: null, unit: '', choice: { kind: 'unresolved' } }),
      VALID_UNITS,
    )
    expect(issues).toEqual([
      'Enter a quantity above zero.',
      'No unit found — pick one.',
      'Pick or create a product to add this line.',
    ])
  })
})

describe('toPayloadRows', () => {
  it('emits product_id + unit_cost for a matched row and skips unresolved', () => {
    const rows = [
      row({ id: 0 }),
      row({ id: 1, choice: { kind: 'unresolved' } }),
      row({
        id: 2,
        choice: { kind: 'create', name: 'Oat Milk' },
        unitPrice: null,
      }),
    ]
    const payload = toPayloadRows(rows, 'space-1', VALID_UNITS)
    expect(payload).toHaveLength(2)

    expect(payload[0]).toMatchObject({
      product_id: 'p1',
      product_name: null,
      current_space_id: 'space-1',
      unit_cost: 3.48,
    })
    // create-new row carries the typed name + brand, no product_id.
    expect(payload[1]).toMatchObject({
      product_id: null,
      product_name: 'Oat Milk',
      product_brand: 'Great Value',
      unit_cost: null,
    })
  })
})

describe('normalizeRaw', () => {
  it('lower-cases, trims, and collapses whitespace (matches the edge fn)', () => {
    expect(normalizeRaw('  GV   WHL  MLK ')).toBe('gv whl mlk')
  })
})

describe('toRowState', () => {
  const serverRow = (over: Partial<ReceiptRow> = {}): ReceiptRow => ({
    raw_text: 'GV WHL MLK GAL',
    canonical_name: 'Whole Milk',
    brand: 'Great Value',
    category: 'Dairy',
    quantity: 2,
    unit: 'count',
    unit_price: 3.48,
    resolution: 'matched',
    product_id: 'p1',
    product_name: 'Whole Milk',
    candidates: [],
    confidence: 0.95,
    ...over,
  })

  it('pre-selects the product for a matched row', () => {
    const state = toRowState(serverRow(), 0)
    expect(state.choice).toEqual({
      kind: 'product',
      productId: 'p1',
      productName: 'Whole Milk',
    })
  })

  it('leaves ambiguous/new rows unresolved, defaults qty, and keeps a missing unit blank', () => {
    const state = toRowState(
      serverRow({
        resolution: 'new',
        product_id: null,
        product_name: null,
        quantity: null,
        unit: null,
      }),
      3,
    )
    expect(state.choice).toEqual({ kind: 'unresolved' })
    expect(state.quantity).toBe(1)
    // No silent 'count' coercion — a blank unit keeps the row in review.
    expect(state.unit).toBe('')
    expect(state.id).toBe(3)
  })
})

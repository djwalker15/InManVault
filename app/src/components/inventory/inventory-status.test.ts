import { describe, expect, it } from 'vitest'
import {
  alertScore,
  deriveAlerts,
  type InventoryStatusInput,
} from './inventory-status'

const base: InventoryStatusInput = {
  quantity: 5,
  min_stock: null,
  expiry_date: null,
  current_space_id: 'space_a',
  home_space_id: null,
  today: '2026-04-29',
}

describe('deriveAlerts', () => {
  it('returns no alerts on a healthy item', () => {
    expect(deriveAlerts(base)).toEqual([])
  })

  it('flags out_of_stock when quantity is 0 and min_stock is set', () => {
    expect(
      deriveAlerts({ ...base, quantity: 0, min_stock: 3 }),
    ).toContain('out_of_stock')
  })

  it('does not flag out_of_stock when min_stock is null (one-off item)', () => {
    const alerts = deriveAlerts({ ...base, quantity: 0 })
    expect(alerts).not.toContain('out_of_stock')
    expect(alerts).not.toContain('low_stock')
  })

  it('flags low_stock when quantity < min_stock', () => {
    expect(
      deriveAlerts({ ...base, quantity: 1, min_stock: 3 }),
    ).toContain('low_stock')
  })

  it('does not flag low_stock when quantity is 0 (out_of_stock takes over)', () => {
    const alerts = deriveAlerts({ ...base, quantity: 0, min_stock: 3 })
    expect(alerts).toContain('out_of_stock')
    expect(alerts).not.toContain('low_stock')
  })

  it('flags expired when expiry_date is in the past', () => {
    expect(
      deriveAlerts({ ...base, expiry_date: '2026-04-25' }),
    ).toContain('expired')
  })

  it('flags expiring_soon when expiry_date is within 7 days (default window)', () => {
    expect(
      deriveAlerts({ ...base, expiry_date: '2026-05-04' }),
    ).toContain('expiring_soon')
  })

  it('respects a custom expiringWindowDays', () => {
    const result = deriveAlerts({
      ...base,
      expiry_date: '2026-05-29', // 30 days out
      expiringWindowDays: 30,
    })
    expect(result).toContain('expiring_soon')
  })

  it('flags displaced when home_space_id ≠ current_space_id', () => {
    expect(
      deriveAlerts({ ...base, home_space_id: 'space_b' }),
    ).toContain('displaced')
  })

  it('does not flag displaced when home matches current', () => {
    expect(
      deriveAlerts({ ...base, home_space_id: 'space_a' }),
    ).not.toContain('displaced')
  })

  it('does not flag displaced when home is unset (unsorted, not displaced)', () => {
    expect(deriveAlerts({ ...base, home_space_id: null })).not.toContain(
      'displaced',
    )
  })
})

describe('alertScore', () => {
  it('is 0 with no alerts', () => {
    expect(alertScore([])).toBe(0)
  })

  it('uses the maximum-priority alert', () => {
    expect(alertScore(['displaced', 'out_of_stock', 'low_stock'])).toBe(100)
    expect(alertScore(['displaced'])).toBe(20)
    expect(alertScore(['expired', 'low_stock'])).toBe(80)
  })
})

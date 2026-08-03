/**
 * Pure status / sort helpers for inventory rows. Stays separate from the
 * React components so they can be unit-tested without rendering.
 */

export type InventoryAlert =
  | 'out_of_stock'
  | 'expired'
  | 'low_stock'
  | 'expiring_soon'
  | 'displaced'

export interface InventoryStatusInput {
  quantity: number
  min_stock: number | null
  expiry_date: string | null
  current_space_id: string
  home_space_id: string | null
  /** Today as YYYY-MM-DD; injectable for testing. */
  today?: string
  /** Days-ahead window for "expiring soon" — default 7. */
  expiringWindowDays?: number
}

const ALERT_RANK: Record<InventoryAlert, number> = {
  out_of_stock: 100,
  expired: 80,
  low_stock: 50,
  expiring_soon: 40,
  displaced: 20,
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(target: string, today: string): number {
  // Both YYYY-MM-DD; compare as dates.
  const t = new Date(`${today}T00:00:00Z`).getTime()
  const e = new Date(`${target}T00:00:00Z`).getTime()
  return Math.round((e - t) / 86_400_000)
}

export function deriveAlerts(input: InventoryStatusInput): InventoryAlert[] {
  const today = input.today ?? todayString()
  const window = input.expiringWindowDays ?? 7
  const out: InventoryAlert[] = []
  // min_stock unset means the crew doesn't intend to restock (one-off item):
  // no stock alerts at all, only expiry/displaced.
  if (input.min_stock !== null && input.quantity === 0) {
    out.push('out_of_stock')
  } else if (input.min_stock !== null && input.quantity < input.min_stock) {
    out.push('low_stock')
  }
  if (input.expiry_date) {
    const days = daysUntil(input.expiry_date, today)
    if (days < 0) out.push('expired')
    else if (days <= window) out.push('expiring_soon')
  }
  if (
    input.home_space_id !== null &&
    input.home_space_id !== input.current_space_id
  ) {
    out.push('displaced')
  }
  return out
}

/**
 * Highest priority alert score for a row — used for "alerts-first" sort.
 * Returns 0 if no alerts.
 */
export function alertScore(alerts: InventoryAlert[]): number {
  let best = 0
  for (const a of alerts) {
    const r = ALERT_RANK[a]
    if (r > best) best = r
  }
  return best
}

export const ALERT_LABEL: Record<InventoryAlert, string> = {
  out_of_stock: 'Out of stock',
  expired: 'Expired',
  low_stock: 'Low stock',
  expiring_soon: 'Expiring soon',
  displaced: 'Displaced',
}

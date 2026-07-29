/**
 * Within-category unit conversion, mirroring the DB rule: weight ↔ weight
 * and volume ↔ volume convert through a base unit (`to_base_factor`);
 * cross-category conversion is blocked (returns null) the same way the
 * server does. Used by the Open-a-Package preview to show what a yielded
 * child quantity becomes when it merges into an existing item held in a
 * different (same-category) unit.
 */

export interface UnitDef {
  unit: string
  category: string
  /** Multiplier to the category's base unit (e.g. g, fl_oz, count). */
  toBase: number
}

export type UnitMap = Map<string, UnitDef>

export function buildUnitMap(
  rows: { unit: string; unit_category: string; to_base_factor: number }[],
): UnitMap {
  const m: UnitMap = new Map()
  for (const r of rows) {
    m.set(r.unit, {
      unit: r.unit,
      category: r.unit_category,
      toBase: Number(r.to_base_factor),
    })
  }
  return m
}

export function sameCategory(a: string, b: string, units: UnitMap): boolean {
  const ua = units.get(a)
  const ub = units.get(b)
  return !!ua && !!ub && ua.category === ub.category
}

/**
 * Convert `qty` from unit `from` into unit `to`. Returns null when either
 * unit is unknown or the two are in different categories (cross-category
 * conversion is intentionally unsupported).
 */
export function convertQuantity(
  qty: number,
  from: string,
  to: string,
  units: UnitMap,
): number | null {
  const uf = units.get(from)
  const ut = units.get(to)
  if (!uf || !ut || uf.category !== ut.category) return null
  return (qty * uf.toBase) / ut.toBase
}

/** Trim a converted quantity to a readable precision without trailing zeros. */
export function formatQuantity(qty: number): string {
  const rounded = Math.round(qty * 1000) / 1000
  return String(rounded)
}

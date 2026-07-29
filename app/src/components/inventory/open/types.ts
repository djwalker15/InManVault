import { convertQuantity, type UnitMap } from '@/lib/units'

/** The sealed package item being opened. */
export interface PackageItem {
  inventoryItemId: string
  productId: string
  productName: string
  /** Sealed packs on hand. */
  quantity: number
  /** The pack's own unit (e.g. 'pkg'). */
  unit: string
  currentSpaceId: string
  lastUnitCost: number | null
}

/** One line of the package's composition (per single package). */
export interface ComponentLine {
  componentProductId: string
  name: string
  quantity: number
  unit: string
}

/** Predicted resolution of a child in-leg against the target space. */
export type ChildResolution =
  | {
      kind: 'merge'
      existingUnit: string
      existingQty: number
      /** Produced qty converted into the existing item's unit, or null if cross-category. */
      convertedQty: number | null
    }
  | { kind: 'create' }

/** True when every component is measured in a `count`-category unit. */
export function isAllCount(
  components: ComponentLine[],
  units: UnitMap,
): boolean {
  return components.every((c) => units.get(c.unit)?.category === 'count')
}

/**
 * Category-aware default cost allocation, mirroring the open_package RPC:
 * all-count packs split equally per individual unit; mixed weight/volume
 * packs split equally per component line. Returns componentProductId →
 * allocated unit cost (per the component line's own unit).
 */
export function defaultAllocations(
  components: ComponentLine[],
  count: number,
  packCost: number,
  units: UnitMap,
): Map<string, number> {
  const map = new Map<string, number>()
  if (components.length === 0) return map

  if (isAllCount(components, units)) {
    const totalUnits =
      components.reduce((sum, c) => sum + c.quantity, 0) * count
    const perUnit = totalUnits > 0 ? packCost / totalUnits : 0
    for (const c of components) map.set(c.componentProductId, perUnit)
  } else {
    const perLine = packCost / components.length
    for (const c of components) {
      const childQty = c.quantity * count
      map.set(c.componentProductId, childQty > 0 ? perLine / childQty : 0)
    }
  }
  return map
}

/** The total cost currently allocated across all children, for the given per-unit costs. */
export function allocatedTotal(
  components: ComponentLine[],
  count: number,
  unitCosts: Map<string, number>,
): number {
  return components.reduce((sum, c) => {
    const cost = unitCosts.get(c.componentProductId) ?? 0
    return sum + cost * c.quantity * count
  }, 0)
}

/** Whether the allocated total reconciles to the package cost (to the cent). */
export function costReconciles(
  components: ComponentLine[],
  count: number,
  packCost: number,
  unitCosts: Map<string, number>,
): boolean {
  return Math.abs(allocatedTotal(components, count, unitCosts) - packCost) < 0.005
}

/** Resolve a single component against the existing items in the target space. */
export function resolveChild(
  component: ComponentLine,
  count: number,
  existing: { unit: string; quantity: number } | undefined,
  units: UnitMap,
): ChildResolution {
  if (!existing) return { kind: 'create' }
  const producedQty = component.quantity * count
  const convertedQty = convertQuantity(
    producedQty,
    component.unit,
    existing.unit,
    units,
  )
  // Cross-category mismatch (null) can't merge — fall back to create-new,
  // same guard as the server.
  if (convertedQty === null) return { kind: 'create' }
  return {
    kind: 'merge',
    existingUnit: existing.unit,
    existingQty: existing.quantity,
    convertedQty,
  }
}

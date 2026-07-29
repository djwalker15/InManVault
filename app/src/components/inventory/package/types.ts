import type { PickedProduct } from './product-picker'

/** A single editable line in the composition editor. */
export interface ComponentDraft {
  /** Stable local key for React lists. */
  key: string
  product: PickedProduct | null
  quantity: string
  unit: string
}

export function makeRow(key: string, unit = 'count'): ComponentDraft {
  return { key, product: null, quantity: '1', unit }
}

export interface ResolvedComponent {
  component_product_id: string
  quantity: number
  unit: string
  sort_order: number
}

export interface CompositionValidation {
  ok: boolean
  error: string | null
  components: ResolvedComponent[]
}

/**
 * Validate the editor rows into insertable product_components: every row
 * needs a product and a positive quantity, and a product can appear at
 * most once (raise its quantity instead of duplicating).
 */
export function validateComposition(
  rows: ComponentDraft[],
): CompositionValidation {
  const components: ResolvedComponent[] = []
  const seen = new Set<string>()

  if (rows.length === 0) {
    return { ok: false, error: 'Add at least one component.', components }
  }

  for (const row of rows) {
    if (!row.product) {
      return { ok: false, error: 'Pick a product for every component.', components }
    }
    const qty = Number(row.quantity)
    if (row.quantity.trim() === '' || Number.isNaN(qty) || qty <= 0) {
      return { ok: false, error: 'Quantity must be greater than 0.', components }
    }
    if (seen.has(row.product.product_id)) {
      return {
        ok: false,
        error: `${row.product.name} is already a component — raise its quantity instead.`,
        components,
      }
    }
    seen.add(row.product.product_id)
    components.push({
      component_product_id: row.product.product_id,
      quantity: qty,
      unit: row.unit,
      sort_order: components.length,
    })
  }

  return { ok: true, error: null, components }
}

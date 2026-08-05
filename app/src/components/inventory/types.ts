export interface ProductRow {
  product_id: string
  crew_id: string | null
  name: string
  brand: string | null
  variant: string | null
  barcode: string | null
  image_url: string | null
  size_value: number | null
  size_unit: string | null
  default_category_id: string | null
}

/** The select list matching ProductRow — keep the two in lockstep. */
export const PRODUCT_COLUMNS =
  'product_id, crew_id, name, brand, variant, barcode, image_url, size_value, size_unit, default_category_id'

export interface InventoryItemSearchRow {
  inventory_item_id: string
  crew_id: string
  product_id: string
  current_space_id: string
  quantity: number
  unit: string
}

/** A search result joined with its Product for display. */
export interface ExistingItemRow {
  item: InventoryItemSearchRow
  product: ProductRow
  /** Breadcrumb path (Premises > Area > … > current Space). */
  locationPath: string
}

export type CatalogSource = 'all' | 'catalog' | 'mine'

/**
 * CatalogBrowser filter state, lifted into the caller so backing out of the
 * details step and returning to browse restores the same view.
 */
export interface CatalogBrowserFilters {
  source: CatalogSource
  categoryId: string | null
  /** How many pages are visible — "Load more" increments this. */
  pages: number
}

export const INITIAL_BROWSE_FILTERS: CatalogBrowserFilters = {
  source: 'all',
  categoryId: null,
  pages: 1,
}

export type Selection =
  | { kind: 'product'; product: ProductRow }
  | { kind: 'restock'; item: ExistingItemRow }
  | { kind: 'add-another'; product: ProductRow; from: ExistingItemRow }

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

export type Selection =
  | { kind: 'product'; product: ProductRow }
  | { kind: 'restock'; item: ExistingItemRow }
  | { kind: 'add-another'; product: ProductRow; from: ExistingItemRow }

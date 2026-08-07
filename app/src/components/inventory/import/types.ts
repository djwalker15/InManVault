import type { ProductRow } from '../types'

/** The InMan fields a spreadsheet column can be mapped onto. */
export type InmanField =
  | 'name'
  | 'brand'
  | 'quantity'
  | 'unit'
  | 'location'
  | 'category'
  | 'barcode'
  | 'notes'

export const REQUIRED_FIELDS: InmanField[] = ['name', 'quantity', 'unit']

export const FIELD_LABELS: Record<InmanField, string> = {
  name: 'Product name',
  brand: 'Brand',
  quantity: 'Quantity',
  unit: 'Unit',
  location: 'Location',
  category: 'Category',
  barcode: 'Barcode',
  notes: 'Notes',
}

/** A parsed spreadsheet: header names + each row as { header: cellValue }. */
export interface ParsedFile {
  headers: string[]
  rows: Record<string, string>[]
}

/** Maps each InMan field to a chosen file column header (or null = unmapped). */
export type FieldMapping = Partial<Record<InmanField, string | null>>

/** Default values applied when a required field isn't mapped to a column. */
export interface ImportDefaults {
  /** Unit applied to every row when `unit` is unmapped. */
  unit: string
  /** Space used when a row's location is blank or doesn't match a Space. */
  defaultSpaceId: string | null
}

export type ProductResolution = 'matched' | 'new' | 'ambiguous'
export type LocationResolution = 'matched' | 'defaulted' | 'missing'

/** A single row after mapping + resolution against catalog/spaces. */
export interface ResolvedRow {
  index: number
  /** Display name (matched product name, or the typed name for a new one). */
  displayName: string
  productId: string | null
  productName: string | null
  productBrand: string | null
  productBarcode: string | null
  /** Matched product's dual-mode image_url (null for new/unmatched rows). */
  productImageUrl: string | null
  quantity: number | null
  unit: string
  currentSpaceId: string | null
  locationLabel: string
  categoryId: string | null
  notes: string | null
  productResolution: ProductResolution
  locationResolution: LocationResolution
  /** True when the row can be imported as-is. */
  valid: boolean
  /** Human-readable reasons the row is invalid (empty when valid). */
  issues: string[]
}

/** The payload object sent per row to the bulk_import_inventory RPC. */
export interface ImportPayloadRow {
  product_id: string | null
  product_name: string | null
  product_brand: string | null
  product_barcode: string | null
  quantity: number
  unit: string
  current_space_id: string
  category_id: string | null
  /** Per-unit purchase cost. Used by receipt scan; null for spreadsheet import. */
  unit_cost: number | null
  notes: string | null
}

export type { ProductRow }

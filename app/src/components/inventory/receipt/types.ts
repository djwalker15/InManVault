/** A catalog candidate the edge function found for a receipt line. */
export interface ReceiptCandidate {
  product_id: string
  name: string
  brand: string | null
}

export type ReceiptResolution = 'matched' | 'ambiguous' | 'new'

/** One line item as resolved by the parse-receipt edge function. */
export interface ReceiptRow {
  raw_text: string
  canonical_name: string
  brand: string | null
  category: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  resolution: ReceiptResolution
  product_id: string | null
  product_name: string | null
  candidates: ReceiptCandidate[]
  confidence: number
}

export interface ParseReceiptResult {
  merchant: string | null
  rows: ReceiptRow[]
}

/**
 * How the user has resolved a row in the preview. `unresolved` rows are
 * blocked from import — every line must be an explicit pick or create.
 */
export type RowChoice =
  | { kind: 'product'; productId: string; productName: string }
  | { kind: 'create'; name: string }
  | { kind: 'unresolved' }

/** Editable, gated client state for one receipt line. */
export interface RowState {
  /** Stable key for React lists. */
  id: number
  rawText: string
  /** Cleaned product name — the create-name default and the search seed. */
  canonicalName: string
  brand: string | null
  quantity: number | null
  unit: string
  unitPrice: number | null
  choice: RowChoice
  /** Whether this row is included in the import. */
  included: boolean
  candidates: ReceiptCandidate[]
}

/** Map an edge-function row to initial editable client state. */
export function toRowState(row: ReceiptRow, id: number): RowState {
  const choice: RowChoice =
    row.resolution === 'matched' && row.product_id
      ? {
          kind: 'product',
          productId: row.product_id,
          productName: row.product_name ?? row.canonical_name,
        }
      : { kind: 'unresolved' }
  return {
    id,
    rawText: row.raw_text,
    canonicalName: row.canonical_name,
    brand: row.brand,
    quantity: typeof row.quantity === 'number' ? row.quantity : 1,
    // No silent coercion: a missing unit stays blank so isImportable flags
    // the row for review instead of guessing 'count'.
    unit: row.unit ?? '',
    unitPrice: typeof row.unit_price === 'number' ? row.unit_price : null,
    choice,
    included: true,
    candidates: row.candidates,
  }
}

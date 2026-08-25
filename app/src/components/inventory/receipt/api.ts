import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImportPayloadRow } from '../import/types'
import type { DownscaledImage } from '@/lib/downscale'
import type { ParseReceiptResult, RowState } from './types'

/** Invokes the parse-receipt edge function with a downscaled image. */
export async function parseReceipt(
  supabase: SupabaseClient,
  args: { image: DownscaledImage; crewId: string },
): Promise<ParseReceiptResult> {
  const { data, error } = await supabase.functions.invoke<ParseReceiptResult>(
    'parse-receipt',
    {
      body: {
        image: args.image.base64,
        mime: args.image.mime,
        crew_id: args.crewId,
      },
    },
  )
  if (error) throw error
  if (!data) throw new Error('parse-receipt returned no body')
  return data
}

/**
 * Everything blocking a row from import, as user-facing messages. A row
 * needs a positive quantity, a known unit, and an explicit resolution (a
 * picked product or a create-new name) — `unresolved` rows are
 * intentionally blocked.
 */
export function rowIssues(row: RowState, validUnits: Set<string>): string[] {
  const issues: string[] = []
  if (row.quantity === null || !(row.quantity > 0)) {
    issues.push('Enter a quantity above zero.')
  }
  if (!row.unit) {
    issues.push('No unit found — pick one.')
  } else if (!validUnits.has(row.unit)) {
    issues.push(`Unit "${row.unit}" isn't one we track — pick one.`)
  }
  if (row.choice.kind === 'unresolved') {
    issues.push('Pick or create a product to add this line.')
  } else if (
    row.choice.kind === 'create' &&
    row.choice.name.trim().length === 0
  ) {
    issues.push('Name the new product to add this line.')
  }
  return issues
}

/** Whether a row can be imported (included and free of issues). */
export function isImportable(row: RowState, validUnits: Set<string>): boolean {
  return row.included && rowIssues(row, validUnits).length === 0
}

/** Build the bulk_import_inventory payload for the importable rows. */
export function toPayloadRows(
  rows: RowState[],
  currentSpaceId: string,
  validUnits: Set<string>,
): ImportPayloadRow[] {
  return rows
    .filter((r) => isImportable(r, validUnits))
    .map((r) => ({
      product_id: r.choice.kind === 'product' ? r.choice.productId : null,
      product_name: r.choice.kind === 'create' ? r.choice.name.trim() : null,
      product_brand: r.choice.kind === 'create' ? r.brand : null,
      // Receipt lines don't carry a variant; the user can set it later.
      product_variant: null,
      product_barcode: null,
      quantity: r.quantity as number,
      unit: r.unit,
      current_space_id: currentSpaceId,
      category_id: null,
      unit_cost: r.unitPrice,
      notes: null,
    }))
}

// Must mirror the edge function's normalize() so a written alias is found
// on the next scan (trim, lower-case, collapse internal whitespace).
export function normalizeRaw(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Remember the catalog product each confirmed line maps to, so the next
 * receipt that prints the same raw text auto-resolves. Only rows resolved
 * to an *existing* product are learned — create-new products are minted
 * inside the RPC and have no id to alias here. Best-effort.
 */
export async function writeAliases(
  supabase: SupabaseClient,
  crewId: string,
  merchant: string | null,
  rows: RowState[],
): Promise<void> {
  const aliases = rows
    .filter((r) => r.included && r.choice.kind === 'product')
    .map((r) => ({
      crew_id: crewId,
      raw_text: normalizeRaw(r.rawText),
      merchant,
      product_id: (r.choice as { productId: string }).productId,
    }))
  if (aliases.length === 0) return
  await supabase
    .from('product_aliases')
    .upsert(aliases, { onConflict: 'crew_id,raw_text' })
}

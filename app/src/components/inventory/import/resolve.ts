import type {
  FieldMapping,
  ImportDefaults,
  ImportPayloadRow,
  InmanField,
  ParsedFile,
  ProductRow,
  ResolvedRow,
} from './types'

/** Synonyms used to auto-map spreadsheet headers to InMan fields. */
const FIELD_SYNONYMS: Record<InmanField, string[]> = {
  name: ['name', 'product', 'product name', 'item', 'item name', 'description'],
  brand: ['brand', 'make', 'manufacturer'],
  quantity: ['quantity', 'qty', 'count', 'amount', 'on hand'],
  unit: ['unit', 'units', 'uom'],
  location: ['location', 'space', 'where', 'place', 'storage'],
  category: ['category', 'cat', 'type', 'group'],
  barcode: ['barcode', 'upc', 'ean', 'sku', 'gtin'],
  notes: ['notes', 'note', 'comment', 'comments', 'memo'],
}

/** Best-effort guess of which file column feeds each InMan field. */
export function guessMapping(headers: string[]): FieldMapping {
  const used = new Set<string>()
  const mapping: FieldMapping = {}
  for (const field of Object.keys(FIELD_SYNONYMS) as InmanField[]) {
    const synonyms = FIELD_SYNONYMS[field]
    const hit = headers.find(
      (h) => !used.has(h) && synonyms.includes(h.trim().toLowerCase()),
    )
    if (hit) {
      mapping[field] = hit
      used.add(hit)
    }
  }
  return mapping
}

interface SpaceLite {
  space_id: string
  name: string
  parent_id: string | null
}

interface CategoryLite {
  category_id: string
  name: string
}

export interface ResolveInput {
  parsed: ParsedFile
  mapping: FieldMapping
  defaults: ImportDefaults
  /** Candidate products fetched for the names/barcodes present in the file. */
  products: ProductRow[]
  /** The crew's spaces (for matching location names). */
  spaces: SpaceLite[]
  /** System + crew categories (for matching category names). */
  categories: CategoryLite[]
  /** Valid unit names from unit_definitions. */
  validUnits: string[]
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function spacePath(id: string, byId: Map<string, SpaceLite>): string {
  const parts: string[] = []
  let cursor: SpaceLite | undefined = byId.get(id)
  while (cursor) {
    parts.unshift(cursor.name)
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined
  }
  return parts.join(' › ')
}

/**
 * Turn mapped spreadsheet rows into resolved, importable rows. Pure — all the
 * lookup data (catalog candidates, spaces, categories, units) is passed in so
 * the wizard can fetch it once and this stays unit-testable.
 */
export function resolveRows(input: ResolveInput): ResolvedRow[] {
  const { parsed, mapping, defaults, products, spaces, categories, validUnits } =
    input

  const spacesById = new Map(spaces.map((s) => [s.space_id, s]))
  const spaceByName = new Map(spaces.map((s) => [norm(s.name), s]))
  const categoryByName = new Map(categories.map((c) => [norm(c.name), c]))
  const productByBarcode = new Map<string, ProductRow>()
  const productsByName = new Map<string, ProductRow[]>()
  for (const p of products) {
    if (p.barcode) productByBarcode.set(p.barcode, p)
    const key = norm(p.name)
    productsByName.set(key, [...(productsByName.get(key) ?? []), p])
  }
  const unitSet = new Set(validUnits)

  const cell = (row: Record<string, string>, field: InmanField): string => {
    const col = mapping[field]
    return col ? (row[col] ?? '').trim() : ''
  }

  return parsed.rows.map((row, index) => {
    const name = cell(row, 'name')
    const brand = cell(row, 'brand')
    const quantityStr = cell(row, 'quantity')
    const unit = cell(row, 'unit') || defaults.unit
    const locationStr = cell(row, 'location')
    const categoryStr = cell(row, 'category')
    const barcode = cell(row, 'barcode')
    const notes = cell(row, 'notes')

    const issues: string[] = []

    // ---- Product resolution -------------------------------------------------
    let productId: string | null = null
    let productResolution: ResolvedRow['productResolution'] = 'new'
    let matchedName: string | null = null
    let matchedImageUrl: string | null = null

    const barcodeMatch = barcode ? productByBarcode.get(barcode) : undefined
    if (barcodeMatch) {
      productId = barcodeMatch.product_id
      matchedName = barcodeMatch.name
      matchedImageUrl = barcodeMatch.image_url
      productResolution = 'matched'
    } else if (name) {
      const byName = productsByName.get(norm(name)) ?? []
      if (byName.length === 1) {
        productId = byName[0].product_id
        matchedName = byName[0].name
        matchedImageUrl = byName[0].image_url
        productResolution = 'matched'
      } else if (byName.length > 1) {
        // Pick the first but flag it for the user.
        productId = byName[0].product_id
        matchedName = byName[0].name
        matchedImageUrl = byName[0].image_url
        productResolution = 'ambiguous'
      } else {
        productResolution = 'new'
      }
    }

    if (!productId && !name) {
      issues.push('No product name or matching barcode')
    }

    // ---- Quantity + unit ----------------------------------------------------
    const quantity = quantityStr === '' ? null : Number(quantityStr)
    if (quantity === null || Number.isNaN(quantity) || quantity <= 0) {
      issues.push('Quantity must be a number greater than 0')
    }
    if (!unit || !unitSet.has(unit)) {
      issues.push(`Unit "${unit || '(blank)'}" is not recognized`)
    }

    // ---- Location -----------------------------------------------------------
    let currentSpaceId: string | null = null
    let locationResolution: ResolvedRow['locationResolution'] = 'missing'
    const locMatch = locationStr ? spaceByName.get(norm(locationStr)) : undefined
    if (locMatch) {
      currentSpaceId = locMatch.space_id
      locationResolution = 'matched'
    } else if (defaults.defaultSpaceId) {
      currentSpaceId = defaults.defaultSpaceId
      locationResolution = 'defaulted'
    }
    if (!currentSpaceId) {
      issues.push('No location and no default space')
    }

    // ---- Category (optional, silently ignored if unmatched) -----------------
    const catMatch = categoryStr
      ? categoryByName.get(norm(categoryStr))
      : undefined
    const categoryId = catMatch ? catMatch.category_id : null

    const locationLabel = currentSpaceId
      ? spacePath(currentSpaceId, spacesById)
      : locationStr || '—'

    return {
      index,
      displayName: matchedName ?? name ?? '(unnamed)',
      productId,
      productName: productId ? null : name || null,
      productBrand: productId ? null : brand || null,
      productBarcode: productId ? null : barcode || null,
      productImageUrl: matchedImageUrl,
      quantity,
      unit,
      currentSpaceId,
      locationLabel,
      categoryId,
      notes: notes || null,
      productResolution,
      locationResolution,
      valid: issues.length === 0,
      issues,
    }
  })
}

/** Convert a valid resolved row to the RPC payload shape. */
export function toPayloadRow(row: ResolvedRow): ImportPayloadRow {
  return {
    product_id: row.productId,
    product_name: row.productName,
    product_brand: row.productBrand,
    product_barcode: row.productBarcode,
    quantity: row.quantity as number,
    unit: row.unit,
    current_space_id: row.currentSpaceId as string,
    category_id: row.categoryId,
    // Spreadsheet import doesn't capture cost; receipt scan sets this itself.
    unit_cost: null,
    notes: row.notes,
  }
}

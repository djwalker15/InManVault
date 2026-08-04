import { useEffect, useRef, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { TextButton } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatSize } from './format'
import {
  PRODUCT_COLUMNS,
  type ExistingItemRow,
  type InventoryItemSearchRow,
  type ProductRow,
  type Selection,
} from './types'

interface ProductSearchProps {
  crewId: string
  onSelect: (selection: Selection) => void
  onCreateCustom: () => void
  /**
   * "Create similar": start a custom-product draft prefilled from an
   * existing product. Optional — consumers without the affordance (the
   * receipt sheet) simply don't render the action.
   */
  onCreateSimilar?: (product: ProductRow) => void
  /** Seed the search box (e.g. a receipt line's canonical name). */
  initialQuery?: string
}

interface SpaceLite {
  space_id: string
  name: string
  parent_id: string | null
}

function escapeIlike(query: string): string {
  return query.replace(/[%_,]/g, '\\$&')
}

function buildLocationPath(
  spaceId: string,
  spacesById: Map<string, SpaceLite>,
): string {
  const parts: string[] = []
  let cursor: SpaceLite | undefined = spacesById.get(spaceId)
  while (cursor) {
    parts.unshift(cursor.name)
    cursor = cursor.parent_id
      ? spacesById.get(cursor.parent_id)
      : undefined
  }
  return parts.join(' › ')
}

export function ProductSearch({
  crewId,
  onSelect,
  onCreateCustom,
  onCreateSimilar,
  initialQuery = '',
}: ProductSearchProps) {
  const supabase = useSupabase()
  const [query, setQuery] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery.trim())
  const [products, setProducts] = useState<ProductRow[]>([])
  const [existing, setExisting] = useState<ExistingItemRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce the typed query.
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebounced(query.trim()), 250)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [query])

  // Run the search whenever the debounced query changes. Short queries
  // skip the round-trip — display masking below hides any stale results.
  useEffect(() => {
    if (debounced.length < 2) return
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const escaped = `%${escapeIlike(debounced)}%`
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(PRODUCT_COLUMNS)
          .is('deleted_at', null)
          .or(
            `name.ilike.${escaped},brand.ilike.${escaped},variant.ilike.${escaped},barcode.eq.${debounced}`,
          )
          .limit(20)
        if (cancelled) return
        if (productError) throw productError
        const productRows = Array.isArray(productData)
          ? (productData as ProductRow[])
          : []
        setProducts(productRows)

        if (productRows.length === 0) {
          setExisting([])
          return
        }

        const productIds = productRows.map((p) => p.product_id)
        const { data: itemData, error: itemError } = await supabase
          .from('inventory_items')
          .select(
            'inventory_item_id, crew_id, product_id, current_space_id, quantity, unit',
          )
          .eq('crew_id', crewId)
          .is('deleted_at', null)
          .in('product_id', productIds)
        if (cancelled) return
        if (itemError) throw itemError
        const itemRows = Array.isArray(itemData)
          ? (itemData as InventoryItemSearchRow[])
          : []

        // Pull names for every space referenced so we can build path strings.
        const spaceIds = Array.from(
          new Set(itemRows.map((i) => i.current_space_id)),
        )
        const spacesById = new Map<string, SpaceLite>()
        if (spaceIds.length > 0) {
          // Pull the whole crew tree so parent walks resolve.
          const { data: spaceData } = await supabase
            .from('spaces')
            .select('space_id, name, parent_id')
            .eq('crew_id', crewId)
            .is('deleted_at', null)
          if (cancelled) return
          if (Array.isArray(spaceData)) {
            for (const s of spaceData as SpaceLite[]) {
              spacesById.set(s.space_id, s)
            }
          }
        }

        const productsById = new Map<string, ProductRow>(
          productRows.map((p) => [p.product_id, p]),
        )
        const enriched: ExistingItemRow[] = itemRows
          .map((item) => {
            const product = productsById.get(item.product_id)
            if (!product) return null
            return {
              item,
              product,
              locationPath: buildLocationPath(item.current_space_id, spacesById),
            }
          })
          .filter((row): row is ExistingItemRow => row !== null)
        setExisting(enriched)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Search failed.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [debounced, crewId, supabase])

  const showResults = debounced.length >= 2
  // Mask stale state when the query shrinks below the search threshold.
  const displayedProducts = showResults ? products : []
  const displayedExisting = showResults ? existing : []
  const displayedError = showResults ? error : null
  const noResults =
    showResults &&
    !loading &&
    displayedProducts.length === 0 &&
    displayedExisting.length === 0

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Search for a product
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-600">
            <Search size={18} />
          </span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tomato paste, Domino sugar, 0123456…"
            className={cn(
              'h-14 w-full rounded-xl bg-paper-100 pl-12 pr-4',
              'font-body text-base text-ink-900 outline-none',
              'placeholder:text-ink-500 focus:bg-paper-250',
              'border-b-2 border-transparent focus:border-sage-700',
            )}
          />
        </div>
        <span className="px-1 font-body text-xs text-ink-500">
          Type a name, brand, or barcode. We'll look across the master catalog
          and your existing inventory.
        </span>
      </label>

      {displayedError && (
        <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
          {displayedError}
        </p>
      )}

      {showResults && displayedExisting.length > 0 && (
        <ResultGroup
          title="In your inventory"
          subtitle="Restock the existing item or add another at a different location."
        >
          <ul className="flex flex-col gap-2">
            {displayedExisting.map((row) => (
              <ExistingResultRow
                key={row.item.inventory_item_id}
                row={row}
                onRestock={() => onSelect({ kind: 'restock', item: row })}
                onAddAnother={() =>
                  onSelect({
                    kind: 'add-another',
                    product: row.product,
                    from: row,
                  })
                }
                onCreateSimilar={
                  onCreateSimilar
                    ? () => onCreateSimilar(row.product)
                    : undefined
                }
              />
            ))}
          </ul>
        </ResultGroup>
      )}

      {showResults && displayedProducts.length > 0 && (
        <ResultGroup
          title="Catalog matches"
          subtitle="Pick a product to log how much you have and where it lives."
        >
          <ul className="flex flex-col gap-2">
            {displayedProducts.map((product) => (
              <ProductResultRow
                key={product.product_id}
                product={product}
                onClick={() => onSelect({ kind: 'product', product })}
                onCreateSimilar={
                  onCreateSimilar
                    ? () => onCreateSimilar(product)
                    : undefined
                }
              />
            ))}
          </ul>
        </ResultGroup>
      )}

      {showResults && noResults && (
        <p className="font-body text-sm text-ink-600">
          No matches yet for "{debounced}". Create a custom product below.
        </p>
      )}

      {showResults && loading && (
        <p className="font-body text-sm text-ink-500">Searching…</p>
      )}

      <CreateCustomCta onClick={onCreateCustom} emphasize={noResults} />
    </div>
  )
}

function ResultGroup({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <header>
        <h2 className="font-display text-base font-bold text-ink-900">
          {title}
        </h2>
        <p className="font-body text-xs text-ink-600">{subtitle}</p>
      </header>
      {children}
    </section>
  )
}

export function ProductResultRow({
  product,
  onClick,
  onCreateSimilar,
}: {
  product: ProductRow
  onClick: () => void
  onCreateSimilar?: () => void
}) {
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-paper-100 p-3">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-lg text-left transition active:scale-[0.99] hover:bg-paper-200"
      >
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper-50"
        >
          {product.image_url ? (
            <img src={product.image_url} alt="" className="size-full object-cover" />
          ) : (
            <span className="font-display text-base font-bold text-ink-500">
              {product.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-sm font-bold text-ink-900">
            {product.name}
          </span>
          <span className="font-body text-xs text-ink-600">
            {[
              product.brand,
              product.variant,
              formatSize(product.size_value, product.size_unit),
              product.crew_id === null ? 'Catalog' : 'Crew',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </button>
      {onCreateSimilar && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateSimilar}
            className="inline-flex h-9 items-center justify-center rounded-full bg-paper-250 px-3 font-display text-xs font-bold text-sage-700"
          >
            Create similar
          </button>
        </div>
      )}
    </li>
  )
}

function ExistingResultRow({
  row,
  onRestock,
  onAddAnother,
  onCreateSimilar,
}: {
  row: ExistingItemRow
  onRestock: () => void
  onAddAnother: () => void
  onCreateSimilar?: () => void
}) {
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-paper-100 p-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper-50"
        >
          {row.product.image_url ? (
            <img
              src={row.product.image_url}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span className="font-display text-base font-bold text-ink-500">
              {row.product.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-sm font-bold text-ink-900">
            {row.product.name}
          </span>
          <span className="font-body text-xs text-ink-600">
            {[
              row.product.variant,
              formatSize(row.product.size_value, row.product.size_unit),
              `${row.item.quantity} ${row.item.unit}`,
              row.locationPath || 'No location',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRestock}
          className="inline-flex h-9 items-center justify-center rounded-full bg-gradient-to-br from-sage-700 to-sage-600 px-3 font-display text-xs font-bold text-white"
        >
          Restock this
        </button>
        <button
          type="button"
          onClick={onAddAnother}
          className="inline-flex h-9 items-center justify-center rounded-full bg-paper-250 px-3 font-display text-xs font-bold text-sage-700"
        >
          Add another
        </button>
        {onCreateSimilar && (
          <button
            type="button"
            onClick={onCreateSimilar}
            className="inline-flex h-9 items-center justify-center rounded-full bg-paper-250 px-3 font-display text-xs font-bold text-sage-700"
          >
            Create similar
          </button>
        )}
      </div>
    </li>
  )
}

function CreateCustomCta({
  onClick,
  emphasize,
}: {
  onClick: () => void
  emphasize: boolean
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-2 border-t border-paper-300 bg-paper-150/80 px-4 pb-2 pt-3 backdrop-blur-md md:mx-0 md:rounded-xl md:border md:bg-paper-100 md:py-3">
      <TextButton
        onClick={onClick}
        className={cn(
          '!text-ink-900 !font-display !font-bold',
          emphasize && '!text-sage-700',
        )}
      >
        <Plus size={14} aria-hidden />
        <span className="ml-1">Create a custom product</span>
      </TextButton>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Chip } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'
import { InventoryFilters } from './inventory-filters'
import {
  EMPTY_FILTERS,
  type InventoryFiltersState,
} from './inventory-filters-state'
import { InventoryRowDetails } from './row-details'
import {
  ALERT_LABEL,
  alertScore,
  deriveAlerts,
  type InventoryAlert,
} from './inventory-status'

interface InventoryItemRow {
  inventory_item_id: string
  product_id: string
  current_space_id: string
  home_space_id: string | null
  quantity: number
  unit: string
  category_id: string | null
  min_stock: number | null
  expiry_date: string | null
  last_unit_cost: number | null
  notes: string | null
}

interface ProductRow {
  product_id: string
  name: string
  brand: string | null
  barcode: string | null
  image_url: string | null
  size_value: number | null
  size_unit: string | null
  default_category_id: string | null
  is_package: boolean
}

interface CategoryRow {
  category_id: string
  name: string
}

interface SpaceLite {
  space_id: string
  parent_id: string | null
  name: string
}

interface RenderRow {
  item: InventoryItemRow
  product: ProductRow
  categoryName: string | null
  effectiveCategoryId: string | null
  locationPath: string
  alerts: InventoryAlert[]
  score: number
  /** Pre-built lowercased haystack for the search box. */
  search: string
}

interface InventoryListProps {
  crewId: string
}

interface LoadedData {
  rows: RenderRow[]
  categoryOptions: { category_id: string; name: string }[]
  /** Every category visible to this crew — used by the inline Edit form. */
  allCategories: { category_id: string; name: string; crew_id: string | null }[]
  spaceOptions: { space_id: string; label: string }[]
  spaceChildEntries: Array<readonly [string, string[]]>
  allSpaceRows: SpaceLite[]
}

const EMPTY_LOAD: LoadedData = {
  rows: [],
  categoryOptions: [],
  allCategories: [],
  spaceOptions: [],
  spaceChildEntries: [],
  allSpaceRows: [],
}

export function InventoryList({ crewId }: InventoryListProps) {
  const supabase = useSupabase()
  const [loaded, setLoaded] = useState<LoadedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<InventoryFiltersState>(EMPTY_FILTERS)
  const [reloadKey, setReloadKey] = useState(0)

  const rows = loaded?.rows ?? null
  const categoryOptions = loaded?.categoryOptions ?? EMPTY_LOAD.categoryOptions
  const spaceOptions = loaded?.spaceOptions ?? EMPTY_LOAD.spaceOptions
  const spaceChildren = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const [id, list] of loaded?.spaceChildEntries ?? []) {
      m.set(id, new Set(list))
    }
    return m
  }, [loaded?.spaceChildEntries])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const { data: itemData, error: itemErr } = await supabase
        .from('inventory_items')
        .select(
          'inventory_item_id, product_id, current_space_id, home_space_id, quantity, unit, category_id, min_stock, expiry_date, last_unit_cost, notes',
        )
        .eq('crew_id', crewId)
        .is('deleted_at', null)
      if (cancelled) return
      if (itemErr) {
        setError(itemErr.message ?? 'Failed to load inventory.')
        setLoaded(EMPTY_LOAD)
        return
      }
      const items = (Array.isArray(itemData) ? itemData : []) as InventoryItemRow[]
      if (items.length === 0) {
        setLoaded(EMPTY_LOAD)
        return
      }

      const productIds = Array.from(new Set(items.map((i) => i.product_id)))
      const categoryIds = Array.from(
        new Set(items.map((i) => i.category_id).filter((id): id is string => id !== null)),
      )

      const [productsRes, categoriesRes, spacesRes] = await Promise.all([
        supabase
          .from('products')
          .select(
            'product_id, name, brand, barcode, image_url, size_value, size_unit, default_category_id, is_package',
          )
          .in('product_id', productIds)
          .is('deleted_at', null),
        categoryIds.length > 0
          ? supabase
              .from('categories')
              .select('category_id, name')
              .in('category_id', categoryIds)
              .is('deleted_at', null)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('spaces')
          .select('space_id, parent_id, name')
          .eq('crew_id', crewId)
          .is('deleted_at', null),
      ])
      if (cancelled) return

      const products = new Map<string, ProductRow>()
      for (const p of (Array.isArray(productsRes.data)
        ? productsRes.data
        : []) as ProductRow[]) {
        products.set(p.product_id, p)
      }
      function fallbackProduct(id: string): ProductRow {
        return {
          product_id: id,
          name: 'Unknown product',
          brand: null,
          barcode: null,
          image_url: null,
          size_value: null,
          size_unit: null,
          default_category_id: null,
          is_package: false,
        }
      }
      // Hydrate the category lookup with both per-item categories and
      // product default categories so badges can show either.
      const allDefaultCategoryIds = Array.from(
        new Set(
          [...products.values()]
            .map((p) => p.default_category_id)
            .filter((id): id is string => id !== null),
        ),
      )
      const missingDefaults = allDefaultCategoryIds.filter(
        (id) => !categoryIds.includes(id),
      )
      let defaultCategoriesData: CategoryRow[] = []
      if (missingDefaults.length > 0) {
        const { data } = await supabase
          .from('categories')
          .select('category_id, name')
          .in('category_id', missingDefaults)
          .is('deleted_at', null)
        if (cancelled) return
        defaultCategoriesData = (Array.isArray(data) ? data : []) as CategoryRow[]
      }

      const categories = new Map<string, CategoryRow>()
      for (const c of (Array.isArray(categoriesRes.data)
        ? categoriesRes.data
        : []) as CategoryRow[]) {
        categories.set(c.category_id, c)
      }
      for (const c of defaultCategoriesData) {
        categories.set(c.category_id, c)
      }

      const spaces = new Map<string, SpaceLite>()
      for (const s of (Array.isArray(spacesRes.data)
        ? spacesRes.data
        : []) as SpaceLite[]) {
        spaces.set(s.space_id, s)
      }

      const today = new Date().toISOString().slice(0, 10)

      const rendered: RenderRow[] = items.map((item) => {
        const product = products.get(item.product_id) ?? fallbackProduct(item.product_id)
        const effectiveCategoryId =
          item.category_id ?? product.default_category_id
        const categoryName = effectiveCategoryId
          ? (categories.get(effectiveCategoryId)?.name ?? null)
          : null
        const alerts = deriveAlerts({
          quantity: item.quantity,
          min_stock: item.min_stock,
          expiry_date: item.expiry_date,
          current_space_id: item.current_space_id,
          home_space_id: item.home_space_id,
          today,
        })
        return {
          item,
          product,
          categoryName,
          effectiveCategoryId,
          locationPath: buildLocationPath(item.current_space_id, spaces),
          alerts,
          score: alertScore(alerts),
          search: [
            product.name,
            product.brand ?? '',
            categoryName ?? '',
            item.notes ?? '',
          ]
            .join(' ')
            .toLowerCase(),
        }
      })

      rendered.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.product.name.localeCompare(b.product.name)
      })

      // Build the filter UI's reference data.
      const categoryOpts = Array.from(categories.values())
        .map((c) => ({ category_id: c.category_id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name))

      const usedSpaceIds = new Set(items.map((i) => i.current_space_id))
      const ancestors = new Set<string>()
      for (const id of usedSpaceIds) {
        let cursor = spaces.get(id)
        while (cursor) {
          ancestors.add(cursor.space_id)
          cursor = cursor.parent_id ? spaces.get(cursor.parent_id) : undefined
        }
      }
      const spaceOpts = Array.from(ancestors)
        .map((id) => ({ space_id: id, label: buildLocationPath(id, spaces) }))
        .sort((a, b) => a.label.localeCompare(b.label))

      // Pre-compute "descendants" for each space so the include-children
      // toggle is O(1) at filter time.
      const childrenIndex = new Map<string, string[]>()
      for (const s of spaces.values()) {
        if (s.parent_id) {
          const arr = childrenIndex.get(s.parent_id) ?? []
          arr.push(s.space_id)
          childrenIndex.set(s.parent_id, arr)
        }
      }
      const descendants = new Map<string, Set<string>>()
      for (const s of spaces.values()) {
        const set = new Set<string>([s.space_id])
        const queue = [s.space_id]
        while (queue.length) {
          const id = queue.shift()!
          for (const c of childrenIndex.get(id) ?? []) {
            if (!set.has(c)) {
              set.add(c)
              queue.push(c)
            }
          }
        }
        descendants.set(s.space_id, set)
      }

      // Fetch ALL categories visible to this crew (system + crew-private)
      // so the inline Edit form can offer the full picker, not just the
      // categories already in use by some inventory item.
      const { data: allCatsData } = await supabase
        .from('categories')
        .select('category_id, name, crew_id')
        .is('deleted_at', null)
        .order('name', { ascending: true })
      if (cancelled) return
      const allCategoriesData = (Array.isArray(allCatsData)
        ? allCatsData
        : []) as { category_id: string; name: string; crew_id: string | null }[]

      setLoaded({
        rows: rendered,
        categoryOptions: categoryOpts,
        allCategories: allCategoriesData,
        spaceOptions: spaceOpts,
        spaceChildEntries: Array.from(descendants.entries()).map(
          ([id, set]) => [id, Array.from(set)] as const,
        ),
        allSpaceRows: Array.from(spaces.values()),
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, crewId, reloadKey])

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const allSpaces = useMemo(() => {
    const map = new Map<string, SpaceLite>()
    for (const s of loaded?.allSpaceRows ?? []) map.set(s.space_id, s)
    return map
  }, [loaded?.allSpaceRows])

  const filtered = useMemo(() => {
    const all = rows ?? []
    const q = filters.query.trim().toLowerCase()
    const allowedSpaces =
      filters.spaceId === ''
        ? null
        : filters.spaceIncludeChildren
          ? (spaceChildren.get(filters.spaceId) ?? new Set([filters.spaceId]))
          : new Set([filters.spaceId])
    return all.filter((row) => {
      if (q && !row.search.includes(q)) return false
      if (
        filters.categoryIds.size > 0 &&
        (!row.effectiveCategoryId ||
          !filters.categoryIds.has(row.effectiveCategoryId))
      ) {
        return false
      }
      if (
        allowedSpaces &&
        !allowedSpaces.has(row.item.current_space_id)
      ) {
        return false
      }
      if (filters.alerts.size > 0) {
        const hit = row.alerts.some((a) => filters.alerts.has(a))
        if (!hit) return false
      }
      return true
    })
  }, [rows, filters, spaceChildren])

  if (error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
        {error}
      </p>
    )
  }

  if (rows === null) {
    return <p className="font-body text-sm text-ink-600">Loading inventory…</p>
  }

  if (rows.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <InventoryFilters
        state={filters}
        onChange={setFilters}
        categories={categoryOptions}
        spaces={spaceOptions}
      />
      {filtered.length === 0 ? (
        <p className="rounded-2xl bg-paper-100 p-4 font-body text-sm text-ink-600">
          No items match your filters.
        </p>
      ) : (
        <ul aria-label="Inventory items" className="flex flex-col gap-2">
          {filtered.map((row) => {
            const expanded = expandedId === row.item.inventory_item_id
            return (
              <li key={row.item.inventory_item_id}>
                <InventoryRow
                  row={row}
                  expanded={expanded}
                  onToggle={() =>
                    setExpandedId(expanded ? null : row.item.inventory_item_id)
                  }
                />
                {expanded && (
                  <InventoryRowDetailsAdapter
                    row={row}
                    crewId={crewId}
                    categories={loaded?.allCategories ?? []}
                    onChanged={() => setReloadKey((k) => k + 1)}
                    spaces={allSpaces}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

interface InventoryRowProps {
  row: RenderRow
  expanded: boolean
  onToggle: () => void
}

function InventoryRow({ row, expanded, onToggle }: InventoryRowProps) {
  const { item, product, categoryName, locationPath, alerts } = row
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={`row-details-${row.item.inventory_item_id}`}
      onClick={onToggle}
      className="flex w-full items-start gap-3 rounded-2xl bg-paper-50 p-4 text-left shadow-ambient-sm transition hover:bg-paper-100 active:scale-[0.998]"
      data-alert-score={row.score}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-display text-base font-bold text-ink-900">
          {product.name}
          {product.brand && (
            <span className="ml-1 font-body text-sm font-normal text-ink-600">
              · {product.brand}
            </span>
          )}
        </h3>
        <p className="font-body text-sm text-ink-700">
          <span className="font-numeric font-semibold">
            {item.quantity}
          </span>{' '}
          {item.unit}
          {locationPath && (
            <>
              <span className="mx-1.5 text-ink-400">·</span>
              <span className="text-ink-600">{locationPath}</span>
            </>
          )}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {categoryName && (
            <Chip variant="default">{categoryName}</Chip>
          )}
          {alerts.map((alert) => (
            <Chip key={alert} variant={chipVariantFor(alert)}>
              {ALERT_LABEL[alert]}
            </Chip>
          ))}
        </div>
      </div>
    </button>
  )
}

interface InventoryRowDetailsAdapterProps {
  row: RenderRow
  spaces: Map<string, SpaceLite>
  crewId: string
  categories: { category_id: string; name: string; crew_id: string | null }[]
  onChanged: () => void
}

function InventoryRowDetailsAdapter({
  row,
  spaces,
  crewId,
  categories,
  onChanged,
}: InventoryRowDetailsAdapterProps) {
  const { item, product, categoryName, alerts } = row
  const home = item.home_space_id ? buildLocationPath(item.home_space_id, spaces) : null
  let displacementState: 'in_place' | 'displaced' | 'unsorted' = 'in_place'
  if (item.home_space_id === null) displacementState = 'unsorted'
  else if (item.home_space_id !== item.current_space_id) displacementState = 'displaced'
  const productSize =
    product.size_value !== null && product.size_unit !== null
      ? { value: product.size_value, unit: product.size_unit }
      : null
  const categoryOverridden =
    item.category_id !== null && item.category_id !== product.default_category_id
  return (
    <InventoryRowDetails
      inventoryItemId={item.inventory_item_id}
      productId={product.product_id}
      productName={product.name}
      productBrand={product.brand}
      productImageUrl={product.image_url}
      productSize={productSize}
      productBarcode={product.barcode}
      effectiveCategoryName={categoryName}
      categoryOverridden={categoryOverridden}
      quantity={item.quantity}
      unit={item.unit}
      isPackage={product.is_package}
      currentLocationPath={row.locationPath}
      currentSpaceId={item.current_space_id}
      homeSpaceId={item.home_space_id}
      homeLocationPath={home}
      displacementState={displacementState}
      lastUnitCost={item.last_unit_cost}
      minStock={item.min_stock}
      categoryId={item.category_id}
      expiryDate={item.expiry_date}
      notes={item.notes}
      alerts={alerts}
      crewId={crewId}
      categories={categories}
      onChanged={onChanged}
    />
  )
}

function chipVariantFor(alert: InventoryAlert): 'warn' | 'error' | 'default' {
  if (alert === 'out_of_stock' || alert === 'expired') return 'error'
  if (alert === 'low_stock' || alert === 'expiring_soon') return 'warn'
  return 'default'
}

function buildLocationPath(
  spaceId: string,
  spaces: Map<string, SpaceLite>,
): string {
  const parts: string[] = []
  let cursor: SpaceLite | undefined = spaces.get(spaceId)
  let depth = 0
  while (cursor && depth < 10) {
    parts.unshift(cursor.name)
    cursor = cursor.parent_id ? spaces.get(cursor.parent_id) : undefined
    depth++
  }
  return parts.join(' › ')
}

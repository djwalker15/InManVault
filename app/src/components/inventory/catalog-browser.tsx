import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Chip, TextButton } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'
import { ProductResultRow } from './product-search'
import {
  PRODUCT_COLUMNS,
  type CatalogBrowserFilters,
  type CatalogSource,
  type ProductRow,
  type Selection,
} from './types'

const PAGE_SIZE = 25

interface CategoryRow {
  category_id: string
  name: string
  crew_id: string | null
}

interface CatalogBrowserProps {
  crewId: string
  onSelect: (selection: Selection) => void
  onBack: () => void
  filters: CatalogBrowserFilters
  onFiltersChange: (filters: CatalogBrowserFilters) => void
}

const SOURCE_OPTIONS: { key: CatalogSource; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'catalog', label: 'Catalog' },
  { key: 'mine', label: "My crew's" },
]

export function CatalogBrowser({
  crewId,
  onSelect,
  onBack,
  filters,
  onFiltersChange,
}: CatalogBrowserProps) {
  const supabase = useSupabase()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('categories')
        .select('category_id, name, crew_id')
        .is('deleted_at', null)
        .order('name', { ascending: true })
      if (cancelled) return
      setCategories(Array.isArray(data) ? (data as CategoryRow[]) : [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // One growing range instead of page-append: refetching to the same
        // depth is what makes filter-state restore after backing out trivial.
        let query = supabase
          .from('products')
          .select(PRODUCT_COLUMNS, { count: 'exact' })
          .is('deleted_at', null)
        if (filters.source === 'catalog') query = query.is('crew_id', null)
        if (filters.source === 'mine') query = query.eq('crew_id', crewId)
        if (filters.categoryId)
          query = query.eq('default_category_id', filters.categoryId)
        const { data, count, error: queryError } = await query
          .order('name', { ascending: true })
          .range(0, filters.pages * PAGE_SIZE - 1)
        if (cancelled) return
        if (queryError) throw queryError
        setProducts(Array.isArray(data) ? (data as ProductRow[]) : [])
        setTotal(count ?? null)
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : 'Failed to load the catalog.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, crewId, filters])

  const hasMore = total !== null && products.length < total

  return (
    <div className="flex flex-col gap-4">
      <div>
        <TextButton type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          Back to search
        </TextButton>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
          Source
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              aria-pressed={filters.source === opt.key}
              onClick={() =>
                onFiltersChange({ ...filters, source: opt.key, pages: 1 })
              }
              className="appearance-none border-0 bg-transparent p-0"
            >
              <Chip variant={filters.source === opt.key ? 'sage' : 'default'}>
                {opt.label}
              </Chip>
            </button>
          ))}
        </div>
      </fieldset>

      {categories.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
            Category
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={filters.categoryId === null}
              onClick={() =>
                onFiltersChange({ ...filters, categoryId: null, pages: 1 })
              }
              className="appearance-none border-0 bg-transparent p-0"
            >
              <Chip variant={filters.categoryId === null ? 'sage' : 'default'}>
                All
              </Chip>
            </button>
            {categories.map((c) => {
              const active = filters.categoryId === c.category_id
              return (
                <button
                  key={c.category_id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      categoryId: active ? null : c.category_id,
                      pages: 1,
                    })
                  }
                  className="appearance-none border-0 bg-transparent p-0"
                >
                  <Chip variant={active ? 'sage' : 'default'}>{c.name}</Chip>
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && products.length === 0 && (
        <p className="font-body text-sm text-ink-600">
          No products match these filters.
        </p>
      )}

      {products.length > 0 && (
        <ul aria-label="Catalog products" className="flex flex-col gap-2">
          {products.map((product) => (
            <ProductResultRow
              key={product.product_id}
              product={product}
              onClick={() => onSelect({ kind: 'product', product })}
            />
          ))}
        </ul>
      )}

      {loading && (
        <p className="font-body text-sm text-ink-500">Loading catalog…</p>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <TextButton
            type="button"
            onClick={() =>
              onFiltersChange({ ...filters, pages: filters.pages + 1 })
            }
          >
            Load more ({products.length} of {total})
          </TextButton>
        </div>
      )}
    </div>
  )
}

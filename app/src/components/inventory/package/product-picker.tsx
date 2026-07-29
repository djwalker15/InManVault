import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export interface PickedProduct {
  product_id: string
  name: string
  brand: string | null
}

interface ProductPickerProps {
  value: PickedProduct | null
  onChange: (product: PickedProduct | null) => void
  /** Product ids already used elsewhere in the composition (hidden from results). */
  excludeIds?: string[]
  placeholder?: string
}

function escapeIlike(query: string): string {
  return query.replace(/[%_,]/g, '\\$&')
}

/**
 * A compact single-product typeahead over the catalog + crew products,
 * used to pick each line of a package composition. Once a product is
 * chosen it collapses to a chip with a "change" affordance.
 */
export function ProductPicker({
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Search products…',
}: ProductPickerProps) {
  const supabase = useSupabase()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState<PickedProduct[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebounced(query.trim()), 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query])

  useEffect(() => {
    if (value || debounced.length < 2) return
    let cancelled = false
    async function run() {
      setLoading(true)
      const escaped = `%${escapeIlike(debounced)}%`
      const { data } = await supabase
        .from('products')
        .select('product_id, name, brand')
        .is('deleted_at', null)
        .or(`name.ilike.${escaped},brand.ilike.${escaped}`)
        .limit(12)
      if (cancelled) return
      const rows = (Array.isArray(data) ? data : []) as PickedProduct[]
      setResults(rows.filter((r) => !excludeIds.includes(r.product_id)))
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [debounced, value, supabase, excludeIds])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-paper-100 px-3 py-2">
        <span className="min-w-0 truncate font-body text-sm text-ink-900">
          {value.name}
          {value.brand && (
            <span className="ml-1 text-ink-500">· {value.brand}</span>
          )}
        </span>
        <button
          type="button"
          aria-label="Change product"
          onClick={() => {
            onChange(null)
            setQuery('')
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-600 transition hover:bg-paper-250"
        >
          <X size={15} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-600">
          <Search size={16} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search products"
          className={cn(
            'h-11 w-full rounded-lg bg-paper-100 pl-9 pr-3',
            'font-body text-sm text-ink-900 outline-none',
            'placeholder:text-ink-500 focus:bg-paper-250',
          )}
        />
      </div>
      {debounced.length >= 2 && (
        <div className="overflow-hidden rounded-lg bg-paper-50">
          {loading ? (
            <p className="px-3 py-2 font-body text-xs text-ink-500">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 font-body text-xs text-ink-500">
              No matches.
            </p>
          ) : (
            <ul>
              {results.map((p) => (
                <li key={p.product_id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p)
                      setQuery('')
                    }}
                    className="flex w-full flex-col items-start px-3 py-2 text-left transition hover:bg-paper-150"
                  >
                    <span className="font-body text-sm text-ink-900">
                      {p.name}
                    </span>
                    {p.brand && (
                      <span className="font-body text-xs text-ink-500">
                        {p.brand}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { CtaTray, PrimaryButton, TextButton } from '@/components/ds'
import { SpaceSelect } from '@/components/spaces/space-select'
import { useSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { ProductRow } from './types'

interface QuickAddFormProps {
  crewId: string
  userId: string
  /** Called with the saved item's display name after a successful add. */
  onSaved: (name: string) => void
}

interface UnitRow {
  unit: string
  unit_category: string
}

interface SpaceLite {
  space_id: string
  parent_id: string | null
  unit_type: string
}

const PRODUCT_COLUMNS =
  'product_id, crew_id, name, brand, barcode, image_url, size_value, size_unit, default_category_id'

function escapeIlike(query: string): string {
  return query.replace(/[%_,]/g, '\\$&')
}

/**
 * Minimal-friction, one-screen add (Journey "Adding Inventory" — Method 4).
 * Product name (type to search the catalog, otherwise a name-only custom
 * Product is created), quantity (default 1), unit (default count), and
 * location (defaults to the crew's Premises). Everything else is skipped and
 * can be filled in later by editing the item. Submits through the shared
 * `record_purchase` RPC.
 */
export function QuickAddForm({ crewId, userId, onSaved }: QuickAddFormProps) {
  const supabase = useSupabase()

  // Product resolution
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState<ProductRow[]>([])
  const [selected, setSelected] = useState<ProductRow | null>(null)
  const [searching, setSearching] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The rest of the one-screen form
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('count')
  const [currentSpaceId, setCurrentSpaceId] = useState('')
  const [units, setUnits] = useState<UnitRow[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load units + default the location to the crew's Premises (the root space).
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: unitData }, { data: spaceData }] = await Promise.all([
        supabase
          .from('unit_definitions')
          .select('unit, unit_category')
          .order('unit', { ascending: true }),
        supabase
          .from('spaces')
          .select('space_id, parent_id, unit_type')
          .eq('crew_id', crewId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true }),
      ])
      if (cancelled) return
      setUnits(Array.isArray(unitData) ? (unitData as UnitRow[]) : [])
      const spaces = Array.isArray(spaceData) ? (spaceData as SpaceLite[]) : []
      const premises = spaces.find((s) => s.parent_id === null)
      if (premises) setCurrentSpaceId((curr) => curr || premises.space_id)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, crewId])

  // Debounce the typed product query.
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebounced(query.trim()), 250)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [query])

  // Search the catalog whenever the debounced query changes (and nothing is
  // already selected).
  useEffect(() => {
    // Short query or an already-picked product → nothing to fetch. Stale
    // results stay in state but are masked by `showResults` at render time.
    if (selected || debounced.length < 2) return
    let cancelled = false
    async function run() {
      setSearching(true)
      try {
        const escaped = `%${escapeIlike(debounced)}%`
        const { data } = await supabase
          .from('products')
          .select(PRODUCT_COLUMNS)
          .is('deleted_at', null)
          .or(`name.ilike.${escaped},brand.ilike.${escaped},barcode.eq.${debounced}`)
          .limit(8)
        if (cancelled) return
        setResults(Array.isArray(data) ? (data as ProductRow[]) : [])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [debounced, selected, supabase])

  function pick(product: ProductRow) {
    setSelected(product)
    setQuery(product.name)
    setResults([])
  }

  function clearSelection() {
    setSelected(null)
    setQuery('')
    setResults([])
  }

  const trimmedName = query.trim()
  const quantityNum = Number(quantity)
  const quantityValid = !Number.isNaN(quantityNum) && quantityNum > 0
  const hasProduct = selected !== null || trimmedName.length > 0
  const valid = hasProduct && quantityValid && Boolean(unit) && Boolean(currentSpaceId)

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    // Tell the user why the form won't submit instead of silently
    // disabling the CTA (the disabled-only gate read as a dead button).
    if (!valid) {
      if (!hasProduct) {
        setError('Type or pick a product first.')
      } else if (!quantityValid) {
        setError('Enter a quantity greater than zero.')
      } else if (!unit) {
        setError('Pick a unit for this item.')
      } else {
        setError('Pick a location for this item.')
      }
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      let productId = selected?.product_id
      const savedName = selected?.name ?? trimmedName
      // No catalog match chosen → create a name-only crew-private product.
      if (!productId) {
        const { data, error: insertError } = await supabase
          .from('products')
          .insert({
            crew_id: crewId,
            name: trimmedName,
            source: 'crew_created',
            created_by: userId,
          })
          .select(PRODUCT_COLUMNS)
          .single()
        if (insertError) throw insertError
        if (!data) throw new Error('Product insert returned no row')
        productId = (data as ProductRow).product_id
      }

      const { error: rpcError } = await supabase.rpc('record_purchase', {
        p_product_id: productId,
        p_quantity: quantityNum,
        p_unit: unit,
        p_current_space_id: currentSpaceId,
        p_home_space_id: null,
        p_category_id: null,
        p_min_stock: null,
        p_expiry_date: null,
        p_unit_cost: null,
        p_notes: null,
        p_source: null,
      })
      if (rpcError) throw rpcError

      // Stay-in-flow: reset the product + quantity, keep unit and location so
      // logging several items into the same place stays fast.
      setSelected(null)
      setQuery('')
      setResults([])
      setQuantity('1')
      onSaved(savedName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item.')
    } finally {
      setSubmitting(false)
    }
  }

  const showResults = !selected && debounced.length >= 2

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="quick-add-product"
          className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900"
        >
          What did you get?
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-600">
            <Search size={18} />
          </span>
          <input
            id="quick-add-product"
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (selected) setSelected(null)
            }}
            placeholder="Tomato paste, Domino sugar, 0123456…"
            className={cn(
              'h-14 w-full rounded-xl bg-paper-100 pl-12',
              selected ? 'pr-12' : 'pr-4',
              'font-body text-base text-ink-900 outline-none',
              'placeholder:text-ink-500 focus:bg-paper-250',
              'border-b-2 border-transparent focus:border-sage-700',
            )}
          />
          {selected && (
            <button
              type="button"
              aria-label="Clear selected product"
              onClick={clearSelection}
              className="absolute inset-y-0 right-3 flex items-center text-ink-600 hover:text-ink-900"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <span className="px-1 font-body text-xs text-ink-500">
          {selected
            ? `Using "${selected.name}" from the catalog.`
            : "Pick a match below, or just keep typing — we'll create it."}
        </span>

        {showResults && results.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-xl bg-paper-100 p-1">
            {results.map((p) => (
              <li key={p.product_id}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-paper-200"
                >
                  <span className="font-display text-sm font-bold text-ink-900">
                    {p.name}
                  </span>
                  <span className="truncate font-body text-xs text-ink-600">
                    {[p.brand, p.crew_id === null ? 'Catalog' : 'Crew']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {showResults && searching && results.length === 0 && (
          <p className="px-1 font-body text-xs text-ink-500">Searching…</p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          How much
        </legend>
        <div className="flex gap-2">
          <input
            aria-label="Quantity"
            type="number"
            min="0"
            step="0.01"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-14 w-28 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
          />
          <select
            aria-label="Unit"
            required
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="h-14 flex-1 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
          >
            {units.length === 0 && <option value="count">count</option>}
            {units.map((u) => (
              <option key={u.unit} value={u.unit}>
                {u.unit} ({u.unit_category})
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <SpaceSelect
        id="quick-add-location"
        crewId={crewId}
        value={currentSpaceId}
        onChange={setCurrentSpaceId}
        label="Location"
        placeholder="Where is it?"
        required
      />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
          {error}
        </p>
      )}

      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? 'Adding…' : 'Add to inventory'}
        </PrimaryButton>
        <TextButton type="button" onClick={clearSelection} disabled={submitting}>
          Clear
        </TextButton>
      </CtaTray>
    </form>
  )
}

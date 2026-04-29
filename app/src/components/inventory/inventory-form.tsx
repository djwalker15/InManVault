import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CtaTray, Field, PrimaryButton, TextButton } from '@/components/ds'
import { SpaceSelect } from '@/components/spaces/space-select'
import { useSupabase } from '@/lib/supabase'
import type { ProductRow, Selection } from './types'

interface InventoryFormProps {
  crewId: string
  selection: Selection
  onSaved: (insertedItemId: string) => void
  onCancel: () => void
}

interface CategoryRow {
  category_id: string
  name: string
  crew_id: string | null
}

interface UnitRow {
  unit: string
  unit_category: string
}

function selectedProduct(selection: Selection): ProductRow {
  return selection.kind === 'restock'
    ? selection.item.product
    : selection.product
}

export function InventoryForm({
  crewId,
  selection,
  onSaved,
  onCancel,
}: InventoryFormProps) {
  const supabase = useSupabase()
  const product = useMemo(() => selectedProduct(selection), [selection])

  // Form state
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState<string>(product.size_unit ?? 'count')
  const [currentSpaceId, setCurrentSpaceId] = useState('')
  const [homeSpaceId, setHomeSpaceId] = useState('')
  const [categoryId, setCategoryId] = useState<string>(
    product.default_category_id ?? '',
  )
  const [unitCost, setUnitCost] = useState('')
  const [minStock, setMinStock] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')

  // Reference data
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: catData }, { data: unitData }] = await Promise.all([
        supabase
          .from('categories')
          .select('category_id, name, crew_id')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .from('unit_definitions')
          .select('unit, unit_category')
          .order('unit', { ascending: true }),
      ])
      if (cancelled) return
      setCategories(Array.isArray(catData) ? (catData as CategoryRow[]) : [])
      setUnits(Array.isArray(unitData) ? (unitData as UnitRow[]) : [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const quantityNum = Number(quantity)
  const quantityValid = !Number.isNaN(quantityNum) && quantityNum > 0
  const valid = quantityValid && unit && currentSpaceId

  function setHomeSameAsCurrent() {
    setHomeSpaceId(currentSpaceId)
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (!valid) return
    setError(null)
    setSubmitting(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('record_purchase', {
        p_product_id: product.product_id,
        p_quantity: quantityNum,
        p_unit: unit,
        p_current_space_id: currentSpaceId,
        p_home_space_id: homeSpaceId || null,
        p_category_id: categoryId || null,
        p_min_stock: minStock.trim() === '' ? null : Number(minStock),
        p_expiry_date: expiryDate || null,
        p_unit_cost: unitCost.trim() === '' ? null : Number(unitCost),
        p_notes: notes.trim() || null,
        p_source: null,
      })
      if (rpcError) throw rpcError
      const insertedId = typeof data === 'string' ? data : ''
      onSaved(insertedId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <header className="flex items-start gap-3 rounded-2xl bg-paper-100 p-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper-50"
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span className="font-display text-base font-bold text-ink-500">
              {product.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="font-display text-base font-bold text-ink-900">
            {product.name}
          </h2>
          <p className="font-body text-xs text-ink-600">
            {[
              product.brand,
              product.size_value && product.size_unit
                ? `${product.size_value} ${product.size_unit}`
                : null,
              product.crew_id === null ? 'Catalog' : 'Crew product',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </header>

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
            {units.map((u) => (
              <option key={u.unit} value={u.unit}>
                {u.unit} ({u.unit_category})
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <SpaceSelect
        id="current-space"
        crewId={crewId}
        value={currentSpaceId}
        onChange={setCurrentSpaceId}
        label="Current location"
        placeholder="Where is it now?"
        required
      />

      <div className="flex flex-col gap-2">
        <SpaceSelect
          crewId={crewId}
          value={homeSpaceId}
          onChange={setHomeSpaceId}
          label="Home location (optional)"
          placeholder="Where does it live?"
          allowEmpty
        />
        {currentSpaceId && homeSpaceId !== currentSpaceId && (
          <button
            type="button"
            onClick={setHomeSameAsCurrent}
            className="self-start font-body text-xs text-sage-700 hover:underline"
          >
            Same as current location
          </button>
        )}
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Category (optional)
        </span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-14 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        >
          <option value="">No override</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.name}
              {c.crew_id === null ? ' (system)' : ''}
            </option>
          ))}
        </select>
      </label>

      <Field
        label="UNIT COST (OPTIONAL)"
        placeholder="2.49"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={unitCost}
        onValueChange={setUnitCost}
        hint="What did this cost per unit? Skippable but powers waste cost reports."
      />

      <Field
        label="MIN STOCK (OPTIONAL)"
        placeholder="2"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={minStock}
        onValueChange={setMinStock}
        hint="Alert me when I have fewer than this."
      />

      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Expiry date (optional)
        </span>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="h-14 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Notes (optional)
        </span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-xl bg-paper-100 p-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        />
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
          {error}
        </p>
      )}

      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={submitting || !valid}
          onClick={() => void handleSubmit()}
        >
          {submitting ? 'Adding…' : 'Add to inventory'}
        </PrimaryButton>
        <TextButton type="button" onClick={onCancel}>
          Pick a different product
        </TextButton>
      </CtaTray>
    </form>
  )
}

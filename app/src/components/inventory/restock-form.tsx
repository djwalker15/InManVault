import { useState, type FormEvent } from 'react'
import { CtaTray, Field, PrimaryButton, TextButton } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'
import type { ExistingItemRow } from './types'

interface RestockFormProps {
  row: ExistingItemRow
  onSaved: (newQuantity: number) => void
  onCancel: () => void
}

/**
 * Simplified Add Inventory variant: drop-in replacement for new-record
 * insertion when the user is restocking an EXISTING inventory_item. Just
 * the additive fields — quantity, optional unit_cost, optional notes.
 *
 * Submits via the restock_inventory RPC so the flow + detail rows land
 * atomically; the existing flow_quantity_cache and
 * flow_purchase_apply_cost triggers do the rest.
 */
export function RestockForm({ row, onSaved, onCancel }: RestockFormProps) {
  const supabase = useSupabase()
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const quantityNum = Number(quantity)
  const valid = !Number.isNaN(quantityNum) && quantityNum > 0

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (!valid) return
    setError(null)
    setSubmitting(true)
    try {
      const { error: rpcError } = await supabase.rpc('restock_inventory', {
        p_inventory_item_id: row.item.inventory_item_id,
        p_quantity: quantityNum,
        p_unit_cost: unitCost.trim() === '' ? null : Number(unitCost),
        p_notes: notes.trim() || null,
        p_source: null,
      })
      if (rpcError) throw rpcError
      onSaved(row.item.quantity + quantityNum)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restock.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 rounded-2xl bg-paper-100 p-4">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.55px] text-sage-700">
          Restock
        </p>
        <h2 className="font-display text-base font-bold text-ink-900">
          {row.product.name}
          {row.product.brand ? (
            <span className="ml-1 font-body text-sm font-normal text-ink-600">
              ({row.product.brand})
            </span>
          ) : null}
        </h2>
        <p className="font-body text-sm leading-5 text-ink-700">
          Currently <strong>{row.item.quantity} {row.item.unit}</strong> at{' '}
          {row.locationPath || 'no location'}. Adding more here keeps the same
          location and unit — pick "Add another" instead if you need a new
          location.
        </p>
      </header>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Adding
        </legend>
        <div className="flex items-center gap-2">
          <input
            aria-label="Quantity to add"
            type="number"
            min="0"
            step="0.01"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-14 w-28 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
          />
          <span className="font-body text-base text-ink-700">
            {row.item.unit}
          </span>
          {valid && (
            <span className="ml-auto font-body text-sm text-ink-600">
              New total: {row.item.quantity + quantityNum} {row.item.unit}
            </span>
          )}
        </div>
      </fieldset>

      <Field
        label="UNIT COST (OPTIONAL)"
        placeholder="2.49"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={unitCost}
        onValueChange={setUnitCost}
        hint="Updates this item's last unit cost. Skip if it didn't change."
      />

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
          {submitting ? 'Restocking…' : 'Restock'}
        </PrimaryButton>
        <TextButton type="button" onClick={onCancel}>
          Pick a different product
        </TextButton>
      </CtaTray>
    </form>
  )
}

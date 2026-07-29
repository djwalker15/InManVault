import { useState } from 'react'
import { CtaTray, PrimaryButton, TextButton } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'

interface ConsumeFormProps {
  inventoryItemId: string
  unit: string
  quantity: number
  busy: boolean
  setBusy: (b: boolean) => void
  setError: (e: string | null) => void
  onCancel: () => void
  onSaved: () => void
}

/**
 * "Use some" — writes a consumption flow (no child detail table;
 * the cache trigger decrements quantity). Member-level action.
 */
export function ConsumeForm({
  inventoryItemId,
  unit,
  quantity,
  busy,
  setBusy,
  setError,
  onCancel,
  onSaved,
}: ConsumeFormProps) {
  const supabase = useSupabase()
  // Count-style units default to using one; measured units start empty.
  const [used, setUsed] = useState(
    unit === 'count' || unit === 'pkg' ? '1' : '',
  )
  const [notes, setNotes] = useState('')

  const usedNum = Number(used)
  const parsed = used.trim() !== '' && !Number.isNaN(usedNum)
  const valid = parsed && usedNum > 0 && usedNum <= quantity

  async function handleSubmit() {
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('record_consumption', {
        p_inventory_item_id: inventoryItemId,
        p_quantity: usedNum,
        p_notes: notes.trim() || null,
      })
      if (rpcError) throw rpcError
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record use.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        Use some
      </span>
      <div className="flex items-center gap-2">
        <input
          aria-label="Quantity used"
          type="number"
          min="0"
          step="0.01"
          value={used}
          onChange={(e) => setUsed(e.target.value)}
          className="h-14 w-28 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        />
        <span className="font-body text-base text-ink-700">{unit}</span>
        {parsed && (
          <span className="ml-auto font-body text-sm text-ink-600">
            {usedNum > quantity
              ? `Only ${quantity} ${unit} on hand`
              : `Left after: ${quantity - usedNum} ${unit}`}
          </span>
        )}
      </div>
      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Notes (optional)
        </span>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-xl bg-paper-100 p-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        />
      </label>
      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={busy || !valid}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Recording…' : 'Record use'}
        </PrimaryButton>
        <TextButton type="button" onClick={onCancel}>
          Cancel
        </TextButton>
      </CtaTray>
    </div>
  )
}

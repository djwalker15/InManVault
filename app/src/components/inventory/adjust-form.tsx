import { useState } from 'react'
import { CtaTray, Field, PrimaryButton, TextButton } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'

interface AdjustFormProps {
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
 * Physical-count correction: the user enters what's actually on the
 * shelf and record_adjustment writes the signed delta to the ledger
 * (adjustment flow + flow_adjustment_details). Admin/owner only —
 * the RPC enforces it; members see the RPC's error.
 */
export function AdjustForm({
  inventoryItemId,
  unit,
  quantity,
  busy,
  setBusy,
  setError,
  onCancel,
  onSaved,
}: AdjustFormProps) {
  const supabase = useSupabase()
  const [actual, setActual] = useState('')
  const [reason, setReason] = useState('')

  const actualNum = Number(actual)
  const parsed = actual.trim() !== '' && !Number.isNaN(actualNum)
  const valid = parsed && actualNum >= 0 && actualNum !== quantity
  const delta = parsed ? actualNum - quantity : 0

  async function handleSubmit() {
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('record_adjustment', {
        p_inventory_item_id: inventoryItemId,
        p_actual_quantity: actualNum,
        p_reason: reason.trim() || null,
        p_notes: null,
        p_audit_session_id: null,
      })
      if (rpcError) throw rpcError
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        Adjust count
      </span>
      <p className="font-body text-xs text-ink-500">
        Tracked: {quantity} {unit}. Enter what&apos;s actually there and the
        ledger records the correction.
      </p>
      <div className="flex items-center gap-2">
        <input
          aria-label="Actual count on shelf"
          type="number"
          min="0"
          step="0.01"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          placeholder={String(quantity)}
          className="h-14 w-28 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        />
        <span className="font-body text-base text-ink-700">{unit}</span>
        {parsed && (
          <span className="ml-auto font-body text-sm text-ink-600">
            {delta === 0
              ? 'No change'
              : `Change: ${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${unit}`}
          </span>
        )}
      </div>
      <Field
        label="REASON (OPTIONAL)"
        placeholder="found extra behind other items"
        value={reason}
        onValueChange={setReason}
      />
      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={busy || !valid}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Adjusting…' : 'Correct count'}
        </PrimaryButton>
        <TextButton type="button" onClick={onCancel}>
          Cancel
        </TextButton>
      </CtaTray>
    </div>
  )
}

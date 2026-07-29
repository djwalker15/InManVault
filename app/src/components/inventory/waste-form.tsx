import { useState } from 'react'
import { CtaTray, Field, PrimaryButton, TextButton } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'

export type WasteReason =
  | 'expired'
  | 'spoiled'
  | 'damaged'
  | 'prep_failure'
  | 'spilled'
  | 'other'

const REASONS: { value: WasteReason; label: string }[] = [
  { value: 'expired', label: 'Expired' },
  { value: 'spoiled', label: 'Spoiled' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'prep_failure', label: 'Prep failure' },
  { value: 'spilled', label: 'Spilled' },
  { value: 'other', label: 'Other' },
]

interface WasteFormProps {
  inventoryItemId: string
  unit: string
  quantity: number
  lastUnitCost: number | null
  /** Item's tracked expiry, prefills the expired-reason date field. */
  expiryDate: string | null
  busy: boolean
  setBusy: (b: boolean) => void
  setError: (e: string | null) => void
  onCancel: () => void
  onSaved: () => void
}

/**
 * Log waste inline action (Journey - Logging Waste, v1 scope): quantity
 * with smart default, six-reason picker with reason-specific detail
 * fields, cost preview from last_unit_cost. Submits via record_waste,
 * which writes the waste flow + waste_events + one detail row
 * atomically; the space on detail rows defaults server-side to the
 * item's current space. Photo capture is deferred (no storage bucket
 * yet) — the RPC already accepts p_photo_url.
 */
export function WasteForm({
  inventoryItemId,
  unit,
  quantity,
  lastUnitCost,
  expiryDate,
  busy,
  setBusy,
  setError,
  onCancel,
  onSaved,
}: WasteFormProps) {
  const supabase = useSupabase()
  const [wasted, setWasted] = useState(
    unit === 'count' || unit === 'pkg' ? '1' : '',
  )
  const [reason, setReason] = useState<WasteReason>('expired')
  const [notes, setNotes] = useState('')
  // Reason-specific fields (only the active reason's values are sent).
  const [expiry, setExpiry] = useState(expiryDate ?? '')
  const [wasOpened, setWasOpened] = useState(false)
  const [containerType, setContainerType] = useState('')
  const [storageConditions, setStorageConditions] = useState('')
  const [howDamaged, setHowDamaged] = useState('')
  const [packagingIssue, setPackagingIssue] = useState(false)
  const [whatWentWrong, setWhatWentWrong] = useState('')
  const [howSpilled, setHowSpilled] = useState('')
  const [duringActivity, setDuringActivity] = useState('')
  const [description, setDescription] = useState('')

  const wastedNum = Number(wasted)
  const parsed = wasted.trim() !== '' && !Number.isNaN(wastedNum)
  const quantityOk = parsed && wastedNum > 0 && wastedNum <= quantity

  const detailsOk = (() => {
    switch (reason) {
      case 'expired':
        return expiry !== ''
      case 'damaged':
        return howDamaged.trim() !== ''
      case 'prep_failure':
        return whatWentWrong.trim() !== ''
      case 'spilled':
        return howSpilled.trim() !== ''
      case 'other':
        return description.trim() !== ''
      default:
        return true
    }
  })()

  const valid = quantityOk && detailsOk
  const cost =
    lastUnitCost != null && quantityOk
      ? (wastedNum * lastUnitCost).toFixed(2)
      : null

  function buildDetails(): Record<string, unknown> {
    switch (reason) {
      case 'expired':
        return { expiry_date: expiry, was_opened: wasOpened }
      case 'spoiled':
        return {
          expiry_date: expiry || null,
          container_type: containerType.trim() || null,
          storage_conditions: storageConditions.trim() || null,
        }
      case 'damaged':
        return {
          how_damaged: howDamaged.trim(),
          packaging_issue: packagingIssue,
        }
      case 'prep_failure':
        return { what_went_wrong: whatWentWrong.trim() }
      case 'spilled':
        return {
          how_spilled: howSpilled.trim(),
          during_activity: duringActivity.trim() || null,
        }
      case 'other':
        return { description: description.trim() }
    }
  }

  async function handleSubmit() {
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('record_waste', {
        p_inventory_item_id: inventoryItemId,
        p_quantity: wastedNum,
        p_waste_reason: reason,
        p_notes: notes.trim() || null,
        p_photo_url: null,
        p_details: buildDetails(),
      })
      if (rpcError) throw rpcError
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log waste.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        Log waste
      </span>

      <div className="flex items-center gap-2">
        <input
          aria-label="Quantity wasted"
          type="number"
          min="0"
          step="0.01"
          value={wasted}
          onChange={(e) => setWasted(e.target.value)}
          className="h-14 w-28 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        />
        <span className="font-body text-base text-ink-700">{unit}</span>
        {parsed && (
          <span className="ml-auto font-body text-sm text-ink-600">
            {wastedNum > quantity
              ? `Only ${quantity} ${unit} on hand`
              : cost != null
                ? `Cost: $${cost}`
                : 'Cost: not tracked'}
          </span>
        )}
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Reason
        </span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as WasteReason)}
          className="h-12 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      {reason === 'expired' && (
        <>
          <label className="flex flex-col gap-2">
            <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
              Expiry date
            </span>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="h-12 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
            />
          </label>
          <label className="flex items-center gap-2 font-body text-sm text-ink-700">
            <input
              type="checkbox"
              checked={wasOpened}
              onChange={(e) => setWasOpened(e.target.checked)}
            />
            It had been opened
          </label>
        </>
      )}

      {reason === 'spoiled' && (
        <>
          <Field
            label="CONTAINER (OPTIONAL)"
            placeholder="glass jar, original packaging…"
            value={containerType}
            onValueChange={setContainerType}
          />
          <Field
            label="STORAGE CONDITIONS (OPTIONAL)"
            placeholder="left out overnight"
            value={storageConditions}
            onValueChange={setStorageConditions}
          />
        </>
      )}

      {reason === 'damaged' && (
        <>
          <Field
            label="HOW WAS IT DAMAGED?"
            placeholder="dropped, crushed in the bag…"
            value={howDamaged}
            onValueChange={setHowDamaged}
          />
          <label className="flex items-center gap-2 font-body text-sm text-ink-700">
            <input
              type="checkbox"
              checked={packagingIssue}
              onChange={(e) => setPackagingIssue(e.target.checked)}
            />
            Packaging was the cause
          </label>
        </>
      )}

      {reason === 'prep_failure' && (
        <Field
          label="WHAT WENT WRONG?"
          placeholder="burned, over-salted…"
          value={whatWentWrong}
          onValueChange={setWhatWentWrong}
        />
      )}

      {reason === 'spilled' && (
        <>
          <Field
            label="HOW DID IT SPILL?"
            placeholder="knocked over while cooking"
            value={howSpilled}
            onValueChange={setHowSpilled}
          />
          <Field
            label="DURING (OPTIONAL)"
            placeholder="dinner prep"
            value={duringActivity}
            onValueChange={setDuringActivity}
          />
        </>
      )}

      {reason === 'other' && (
        <Field
          label="WHAT HAPPENED?"
          placeholder="describe the loss"
          value={description}
          onValueChange={setDescription}
        />
      )}

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
          {busy
            ? 'Logging…'
            : quantityOk
              ? `Log waste — deducts ${wastedNum} ${unit}`
              : 'Log waste'}
        </PrimaryButton>
        <TextButton type="button" onClick={onCancel}>
          Cancel
        </TextButton>
      </CtaTray>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Edit3,
  Home,
  MoveRight,
  PackageOpen,
  RotateCcw,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import {
  CtaTray,
  Field,
  PrimaryButton,
  TextButton,
} from '@/components/ds'
import { SpaceSelect } from '@/components/spaces/space-select'
import { useSupabase } from '@/lib/supabase'

type Action = 'move' | 'set-home' | 'put-back' | 'edit' | null

interface RowActionsProps {
  crewId: string
  inventoryItemId: string
  currentSpaceId: string
  homeSpaceId: string | null
  unit: string
  quantity: number
  /** Whether this item's product is a package (can be opened). */
  isPackage: boolean
  category_id: string | null
  min_stock: number | null
  expiry_date: string | null
  notes: string | null
  /** Notifies the parent so it can refetch / refresh row state. */
  onChanged: () => void
  /** All categories the user can pick from (system + crew). */
  categories: { category_id: string; name: string; crew_id: string | null }[]
}

interface CategoryOption {
  category_id: string
  name: string
  crew_id: string | null
}

export function RowActions({
  crewId,
  inventoryItemId,
  currentSpaceId,
  homeSpaceId,
  unit,
  quantity,
  isPackage,
  category_id,
  min_stock,
  expiry_date,
  notes,
  onChanged,
  categories,
}: RowActionsProps) {
  const supabase = useSupabase()
  const navigate = useNavigate()
  const [action, setAction] = useState<Action>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setAction(null)
    setError(null)
  }

  async function handlePutBack() {
    if (!homeSpaceId) {
      setError('No home location set.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('record_transfer', {
        p_inventory_item_id: inventoryItemId,
        p_to_space_id: homeSpaceId,
        p_notes: 'put back to home',
      })
      if (rpcError) throw rpcError
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to put back.')
    } finally {
      setBusy(false)
    }
  }

  const isDisplaced =
    homeSpaceId !== null && homeSpaceId !== currentSpaceId
  const isUnsorted = homeSpaceId === null

  return (
    <section
      aria-label="Inventory actions"
      className="flex flex-col gap-3 rounded-lg bg-paper-50 p-3"
    >
      <h4 className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        Actions
      </h4>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {isPackage && (
          <ActionButton
            icon={<PackageOpen size={14} />}
            label="Open"
            disabled={quantity <= 0}
            title={
              quantity <= 0
                ? 'No sealed packs to open.'
                : 'Open this package into its contents'
            }
            onClick={() =>
              navigate(`/inventory/open/${inventoryItemId}`)
            }
          />
        )}
        <ActionButton
          icon={<MoveRight size={14} />}
          label="Move"
          active={action === 'move'}
          onClick={() => setAction(action === 'move' ? null : 'move')}
        />
        {isUnsorted && (
          <ActionButton
            icon={<Home size={14} />}
            label="Set home"
            active={action === 'set-home'}
            onClick={() =>
              setAction(action === 'set-home' ? null : 'set-home')
            }
          />
        )}
        {isDisplaced && (
          <ActionButton
            icon={<RotateCcw size={14} />}
            label="Put back"
            disabled={busy}
            onClick={() => void handlePutBack()}
          />
        )}
        <ActionButton
          icon={<Edit3 size={14} />}
          label="Edit"
          active={action === 'edit'}
          onClick={() => setAction(action === 'edit' ? null : 'edit')}
        />
        <ActionButton
          icon={<Trash2 size={14} />}
          label="Log waste"
          disabled
          title="Coming with the Waste journey (Phase 4 follow-up)"
        />
        <ActionButton
          icon={<ShoppingCart size={14} />}
          label="Add to list"
          disabled
          title="Coming with the Shopping journey"
        />
      </div>

      {action === 'move' && (
        <MoveForm
          crewId={crewId}
          inventoryItemId={inventoryItemId}
          currentSpaceId={currentSpaceId}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onCancel={close}
          onSaved={() => {
            onChanged()
            close()
          }}
        />
      )}

      {action === 'set-home' && (
        <SetHomeForm
          crewId={crewId}
          inventoryItemId={inventoryItemId}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onCancel={close}
          onSaved={() => {
            onChanged()
            close()
          }}
        />
      )}

      {action === 'edit' && (
        <EditForm
          inventoryItemId={inventoryItemId}
          unit={unit}
          category_id={category_id}
          min_stock={min_stock}
          expiry_date={expiry_date}
          notes={notes}
          categories={categories}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onCancel={close}
          onSaved={() => {
            onChanged()
            close()
          }}
        />
      )}
    </section>
  )
}

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  title?: string
  onClick?: () => void
}

function ActionButton({
  icon,
  label,
  active,
  disabled,
  title,
  onClick,
}: ActionButtonProps) {
  const palette = disabled
    ? 'bg-paper-100 text-ink-500'
    : active
      ? 'bg-sage-700 text-white'
      : 'bg-paper-100 text-ink-700 hover:bg-paper-200'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs transition disabled:cursor-not-allowed ${palette}`}
    >
      {icon}
      {label}
    </button>
  )
}

interface MoveFormProps {
  crewId: string
  inventoryItemId: string
  currentSpaceId: string
  busy: boolean
  setBusy: (b: boolean) => void
  setError: (e: string | null) => void
  onCancel: () => void
  onSaved: () => void
}

function MoveForm({
  crewId,
  inventoryItemId,
  currentSpaceId,
  busy,
  setBusy,
  setError,
  onCancel,
  onSaved,
}: MoveFormProps) {
  const supabase = useSupabase()
  const [target, setTarget] = useState('')
  const valid = target !== '' && target !== currentSpaceId

  async function handleSubmit() {
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('record_transfer', {
        p_inventory_item_id: inventoryItemId,
        p_to_space_id: target,
        p_notes: null,
      })
      if (rpcError) throw rpcError
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        Move
      </span>
      <SpaceSelect
        crewId={crewId}
        value={target}
        onChange={setTarget}
        label="New current location"
        placeholder="Pick a space"
        allowEmpty
      />
      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={busy || !valid}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Moving…' : 'Confirm move'}
        </PrimaryButton>
        <TextButton type="button" onClick={onCancel}>
          Cancel
        </TextButton>
      </CtaTray>
    </div>
  )
}

interface SetHomeFormProps {
  crewId: string
  inventoryItemId: string
  busy: boolean
  setBusy: (b: boolean) => void
  setError: (e: string | null) => void
  onCancel: () => void
  onSaved: () => void
}

function SetHomeForm({
  crewId,
  inventoryItemId,
  busy,
  setBusy,
  setError,
  onCancel,
  onSaved,
}: SetHomeFormProps) {
  const supabase = useSupabase()
  const [target, setTarget] = useState('')
  const valid = target !== ''

  async function handleSubmit() {
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ home_space_id: target })
        .eq('inventory_item_id', inventoryItemId)
      if (updateError) throw updateError
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set home.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        Set home location
      </span>
      <SpaceSelect
        crewId={crewId}
        value={target}
        onChange={setTarget}
        label="Home location"
        placeholder="Where does it live?"
        allowEmpty
      />
      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={busy || !valid}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Saving…' : 'Save home'}
        </PrimaryButton>
        <TextButton type="button" onClick={onCancel}>
          Cancel
        </TextButton>
      </CtaTray>
    </div>
  )
}

interface EditFormProps {
  inventoryItemId: string
  unit: string
  category_id: string | null
  min_stock: number | null
  expiry_date: string | null
  notes: string | null
  categories: CategoryOption[]
  busy: boolean
  setBusy: (b: boolean) => void
  setError: (e: string | null) => void
  onCancel: () => void
  onSaved: () => void
}

function EditForm({
  inventoryItemId,
  unit,
  category_id,
  min_stock,
  expiry_date,
  notes,
  categories,
  busy,
  setBusy,
  setError,
  onCancel,
  onSaved,
}: EditFormProps) {
  const supabase = useSupabase()
  const [categoryId, setCategoryId] = useState(category_id ?? '')
  const [minStock, setMinStock] = useState(
    min_stock !== null ? String(min_stock) : '',
  )
  const [expiry, setExpiry] = useState(expiry_date ?? '')
  const [noteText, setNoteText] = useState(notes ?? '')

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          category_id: categoryId === '' ? null : categoryId,
          min_stock: minStock.trim() === '' ? null : Number(minStock),
          expiry_date: expiry === '' ? null : expiry,
          notes: noteText.trim() === '' ? null : noteText,
        })
        .eq('inventory_item_id', inventoryItemId)
      if (updateError) throw updateError
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        Edit details
      </span>
      <p className="font-body text-xs text-ink-500">
        Quantity changes go through Restock, Move, or Adjust — not edit.
      </p>
      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Category
        </span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-12 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
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
        label="MIN STOCK (OPTIONAL)"
        placeholder="2"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={minStock}
        onValueChange={setMinStock}
        hint={`In ${unit}.`}
      />
      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Expiry
        </span>
        <input
          type="date"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="h-12 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Notes
        </span>
        <textarea
          rows={3}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="rounded-xl bg-paper-100 p-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        />
      </label>
      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={busy}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Saving…' : 'Save'}
        </PrimaryButton>
        <TextButton type="button" onClick={onCancel}>
          Cancel
        </TextButton>
      </CtaTray>
    </div>
  )
}

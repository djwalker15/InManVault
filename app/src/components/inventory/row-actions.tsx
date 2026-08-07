import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive,
  Edit3,
  Home,
  ImagePlus,
  MoveRight,
  PackageOpen,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  Utensils,
  X,
} from 'lucide-react'
import {
  CtaTray,
  Field,
  PrimaryButton,
  ProductThumb,
  TextButton,
} from '@/components/ds'
import {
  deleteCrewImage,
  resolveImageSrc,
  uploadCrewImage,
} from '@/lib/media'
import { SpaceSelect } from '@/components/spaces/space-select'
import { useSupabase } from '@/lib/supabase'
import { buildUnitMap, convertQuantity } from '@/lib/units'
import { AdjustForm } from './adjust-form'
import { ConsumeForm } from './consume-form'
import { WasteForm } from './waste-form'

type Action =
  | 'move'
  | 'set-home'
  | 'put-back'
  | 'edit'
  | 'adjust'
  | 'use'
  | 'waste'
  | 'remove'
  | null

interface RowActionsProps {
  crewId: string
  inventoryItemId: string
  productId: string
  productName: string
  productBrand: string | null
  /** The product's crew (null = master catalog). Gates name/brand editing. */
  productCrewId: string | null
  /** Dual-mode products.image_url — powers the Edit form's photo controls. */
  productImageUrl: string | null
  currentSpaceId: string
  homeSpaceId: string | null
  unit: string
  quantity: number
  lastUnitCost: number | null
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
  /** All unit definitions — powers the Edit form's unit picker. */
  units: UnitDefRow[]
}

interface CategoryOption {
  category_id: string
  name: string
  crew_id: string | null
}

interface UnitDefRow {
  unit: string
  unit_category: string
  to_base_factor: number
}

export function RowActions({
  crewId,
  inventoryItemId,
  productId,
  productName,
  productBrand,
  productCrewId,
  productImageUrl,
  currentSpaceId,
  homeSpaceId,
  unit,
  quantity,
  lastUnitCost,
  isPackage,
  category_id,
  min_stock,
  expiry_date,
  notes,
  onChanged,
  categories,
  units,
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
          icon={<Utensils size={14} />}
          label="Use"
          active={action === 'use'}
          disabled={quantity <= 0}
          title={
            quantity <= 0
              ? 'Nothing on hand to use.'
              : 'Record using some of this item'
          }
          onClick={() => setAction(action === 'use' ? null : 'use')}
        />
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
          icon={<SlidersHorizontal size={14} />}
          label="Adjust"
          active={action === 'adjust'}
          title="Correct the count to match what's actually there"
          onClick={() => setAction(action === 'adjust' ? null : 'adjust')}
        />
        <ActionButton
          icon={<Trash2 size={14} />}
          label="Log waste"
          active={action === 'waste'}
          disabled={quantity <= 0}
          title={
            quantity <= 0
              ? 'Nothing on hand to waste.'
              : 'Record a loss — deducts from inventory'
          }
          onClick={() => setAction(action === 'waste' ? null : 'waste')}
        />
        <ActionButton
          icon={<ShoppingCart size={14} />}
          label="Add to list"
          disabled
          title="Coming with the Shopping journey"
        />
        <ActionButton
          icon={<Archive size={14} />}
          label="Remove"
          active={action === 'remove'}
          title="Remove this item from inventory (history stays in the ledger)"
          onClick={() => setAction(action === 'remove' ? null : 'remove')}
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

      {action === 'remove' && (
        <RemoveForm
          inventoryItemId={inventoryItemId}
          unit={unit}
          quantity={quantity}
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

      {action === 'waste' && (
        <WasteForm
          inventoryItemId={inventoryItemId}
          unit={unit}
          quantity={quantity}
          lastUnitCost={lastUnitCost}
          expiryDate={expiry_date}
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

      {action === 'use' && (
        <ConsumeForm
          inventoryItemId={inventoryItemId}
          unit={unit}
          quantity={quantity}
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

      {action === 'adjust' && (
        <AdjustForm
          inventoryItemId={inventoryItemId}
          unit={unit}
          quantity={quantity}
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
          crewId={crewId}
          inventoryItemId={inventoryItemId}
          productId={productId}
          productName={productName}
          productBrand={productBrand}
          productCrewId={productCrewId}
          productImageUrl={productImageUrl}
          unit={unit}
          quantity={quantity}
          category_id={category_id}
          min_stock={min_stock}
          expiry_date={expiry_date}
          notes={notes}
          categories={categories}
          units={units}
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

interface RemoveFormProps {
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
 * Soft-deletes the item via the admin/owner-gated
 * soft_delete_inventory_item RPC (a direct deleted_at update trips the
 * RLS SELECT trap). Two-step: the confirm button only arms after the
 * panel opens, with explicit copy about the zero-out adjustment.
 */
function RemoveForm({
  inventoryItemId,
  unit,
  quantity,
  busy,
  setBusy,
  setError,
  onCancel,
  onSaved,
}: RemoveFormProps) {
  const supabase = useSupabase()
  const [reason, setReason] = useState('')

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc(
        'soft_delete_inventory_item',
        {
          p_inventory_item_id: inventoryItemId,
          p_reason: reason.trim() || null,
        },
      )
      if (rpcError) throw rpcError
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        Remove from inventory
      </span>
      <p className="font-body text-sm text-ink-700">
        Removes this item from your inventory. Its history stays in the
        ledger.
        {quantity !== 0 && (
          <>
            {' '}
            The remaining <strong>{quantity} {unit}</strong> will be zeroed
            out with an adjustment.
          </>
        )}
      </p>
      <Field
        label="REASON (OPTIONAL)"
        placeholder="no longer stocking this"
        value={reason}
        onValueChange={setReason}
      />
      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={busy}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Removing…' : 'Remove item'}
        </PrimaryButton>
        <TextButton type="button" onClick={onCancel}>
          Cancel
        </TextButton>
      </CtaTray>
    </div>
  )
}

interface EditFormProps {
  crewId: string
  inventoryItemId: string
  productId: string
  productName: string
  productBrand: string | null
  productCrewId: string | null
  productImageUrl: string | null
  unit: string
  quantity: number
  category_id: string | null
  min_stock: number | null
  expiry_date: string | null
  notes: string | null
  categories: CategoryOption[]
  units: UnitDefRow[]
  busy: boolean
  setBusy: (b: boolean) => void
  setError: (e: string | null) => void
  onCancel: () => void
  onSaved: () => void
}

function EditForm({
  crewId,
  inventoryItemId,
  productId,
  productName,
  productBrand,
  productCrewId,
  productImageUrl,
  unit,
  quantity,
  category_id,
  min_stock,
  expiry_date,
  notes,
  categories,
  units,
  busy,
  setBusy,
  setError,
  onCancel,
  onSaved,
}: EditFormProps) {
  const supabase = useSupabase()
  const [categoryId, setCategoryId] = useState(category_id ?? '')
  const [selectedUnit, setSelectedUnit] = useState(unit)
  const [minStock, setMinStock] = useState(
    min_stock !== null ? String(min_stock) : '',
  )
  const [expiry, setExpiry] = useState(expiry_date ?? '')
  const [noteText, setNoteText] = useState(notes ?? '')
  // Crew-private products expose their name/brand for editing here; master
  // catalog products are shared and stay read-only.
  const isCrewProduct = productCrewId !== null
  const [nameText, setNameText] = useState(productName)
  const [brandText, setBrandText] = useState(productBrand ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)

  // Only units in the SAME category as the current unit are offered — the
  // DB blocks cross-category conversion, and so does convertQuantity().
  const currentCategory = units.find((u) => u.unit === unit)?.unit_category
  const sameCategoryUnits = units.filter(
    (u) => u.unit_category === currentCategory,
  )

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        category_id: categoryId === '' ? null : categoryId,
        min_stock: minStock.trim() === '' ? null : Number(minStock),
        expiry_date: expiry === '' ? null : expiry,
        notes: noteText.trim() === '' ? null : noteText,
      }

      if (selectedUnit !== unit) {
        // Unit re-denomination: the same physical amount expressed in a new
        // (same-category) unit. inventory_items.quantity is normally a cache
        // written only by the Flow trigger — this is the ONE sanctioned
        // direct quantity write, because the amount on hand doesn't change,
        // only the unit it's denominated in. No Flow row is warranted.
        const unitMap = buildUnitMap(units)
        const convertedQty = convertQuantity(
          quantity,
          unit,
          selectedUnit,
          unitMap,
        )
        if (convertedQty === null) {
          throw new Error(`Can't convert ${unit} to ${selectedUnit}.`)
        }
        payload.unit = selectedUnit
        payload.quantity = convertedQty
        if (payload.min_stock !== null) {
          const convertedMin = convertQuantity(
            payload.min_stock as number,
            unit,
            selectedUnit,
            unitMap,
          )
          if (convertedMin === null) {
            throw new Error(`Can't convert ${unit} to ${selectedUnit}.`)
          }
          payload.min_stock = convertedMin
        }
      }

      const { error: updateError } = await supabase
        .from('inventory_items')
        .update(payload)
        .eq('inventory_item_id', inventoryItemId)
      if (updateError) throw updateError

      // Crew-private product: name/brand edits go to the products table
      // (RLS products_update allows any crew member).
      const trimmedName = nameText.trim()
      const trimmedBrand = brandText.trim()
      const nameChanged = trimmedName !== '' && trimmedName !== productName
      const brandChanged = trimmedBrand !== (productBrand ?? '')
      if (isCrewProduct && (nameChanged || brandChanged)) {
        const { error: productError } = await supabase
          .from('products')
          .update({
            name: trimmedName === '' ? productName : trimmedName,
            brand: trimmedBrand === '' ? null : trimmedBrand,
          })
          .eq('product_id', productId)
        if (productError) throw productError
      }

      // Photo set / replace / remove — crew-private products only.
      // Objects are immutable: replace = upload new + best-effort delete
      // of the old one (a failed delete is an accepted, warned orphan).
      // External http(s) image_url values are never storage objects, so
      // they are never deleted.
      const oldIsPath =
        productImageUrl !== null &&
        resolveImageSrc(productImageUrl)?.kind === 'path'
      if (isCrewProduct && imageFile) {
        const path = await uploadCrewImage(
          supabase,
          crewId,
          'products',
          imageFile,
          productId,
        )
        const { error: imageError } = await supabase
          .from('products')
          .update({ image_url: path })
          .eq('product_id', productId)
        if (imageError) {
          void deleteCrewImage(supabase, path)
          throw imageError
        }
        if (oldIsPath) void deleteCrewImage(supabase, productImageUrl)
      } else if (isCrewProduct && removeImage && productImageUrl !== null) {
        const { error: imageError } = await supabase
          .from('products')
          .update({ image_url: null })
          .eq('product_id', productId)
        if (imageError) throw imageError
        if (oldIsPath) void deleteCrewImage(supabase, productImageUrl)
      }
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
      {isCrewProduct && (
        <>
          <Field
            label="PRODUCT NAME"
            placeholder="Whole milk"
            value={nameText}
            onValueChange={setNameText}
            hint="This product is private to your crew, so you can rename it."
          />
          <Field
            label="BRAND (OPTIONAL)"
            placeholder="Great Value"
            value={brandText}
            onValueChange={setBrandText}
          />
          <div className="flex flex-col gap-2">
            <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
              Photo <span className="font-body lowercase text-ink-500">(optional)</span>
            </span>
            <div className="flex items-center gap-3">
              <ProductThumb
                imageUrl={removeImage ? null : productImageUrl}
                name={productName}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {imageFile ? (
                  <div className="flex items-center justify-between rounded-xl bg-paper-100 px-3 py-2">
                    <span className="truncate font-body text-sm text-ink-700">
                      {imageFile.name}
                    </span>
                    <button
                      type="button"
                      aria-label="Clear selected photo"
                      onClick={() => setImageFile(null)}
                      className="ml-3 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-600 transition hover:bg-paper-200"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-paper-100 px-3 py-2 font-body text-sm text-ink-600 transition hover:bg-paper-200">
                    <ImagePlus size={16} aria-hidden />
                    {productImageUrl !== null && !removeImage
                      ? 'Replace photo'
                      : 'Add a photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        setImageFile(e.target.files?.[0] ?? null)
                        setRemoveImage(false)
                      }}
                    />
                  </label>
                )}
                {productImageUrl !== null && !imageFile && (
                  <button
                    type="button"
                    onClick={() => setRemoveImage(!removeImage)}
                    className="self-start font-body text-xs text-ink-500 underline"
                  >
                    {removeImage ? 'Keep current photo' : 'Remove photo'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Unit
        </span>
        <select
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
          className="h-12 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        >
          {sameCategoryUnits.length === 0 && (
            <option value={unit}>{unit}</option>
          )}
          {sameCategoryUnits.map((u) => (
            <option key={u.unit} value={u.unit}>
              {u.unit}
            </option>
          ))}
        </select>
        {selectedUnit !== unit && (
          <span className="font-body text-xs text-ink-500">
            The quantity on hand converts automatically — same amount, new
            unit.
          </span>
        )}
      </label>
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
        hint={`In ${unit}. Leave empty for one-off items — no stock alerts.`}
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

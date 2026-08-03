import { useRef, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import {
  AddItemForms,
  type AddPhase,
} from '@/components/inventory/add-item-forms'
import { BarcodeScanner } from '@/components/inventory/barcode-scanner'
import { useActiveCrew } from '@/lib/active-crew'
import { useSupabase } from '@/lib/supabase'
import {
  PRODUCT_COLUMNS,
  type ExistingItemRow,
  type InventoryItemSearchRow,
  type ProductRow,
} from '@/components/inventory/types'

type Phase =
  | { kind: 'scanning' }
  | { kind: 'resolving' }
  | { kind: 'choose-existing'; product: ProductRow; items: ExistingItemRow[] }
  | AddPhase

interface SpaceLite {
  space_id: string
  name: string
  parent_id: string | null
}

function buildLocationPath(
  spaceId: string,
  spacesById: Map<string, SpaceLite>,
): string {
  const parts: string[] = []
  let cursor: SpaceLite | undefined = spacesById.get(spaceId)
  while (cursor) {
    parts.unshift(cursor.name)
    cursor = cursor.parent_id ? spacesById.get(cursor.parent_id) : undefined
  }
  return parts.join(' › ')
}

export default function BarcodeScanPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const supabase = useSupabase()
  const { loading: crewLoading, activeCrewId } = useActiveCrew(
    user?.id ?? null,
  )

  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' })
  const [sessionCount, setSessionCount] = useState(0)
  const [lastAddedName, setLastAddedName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Guards against the camera firing repeat detections before we leave the
  // scanning phase.
  const resolvingRef = useRef(false)

  async function handleDetected(code: string) {
    if (resolvingRef.current || !activeCrewId) return
    resolvingRef.current = true
    setError(null)
    setPhase({ kind: 'resolving' })
    try {
      const { data: productData, error: productErr } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .is('deleted_at', null)
        .eq('barcode', code)
        .limit(1)
      if (productErr) throw productErr
      const products = Array.isArray(productData)
        ? (productData as ProductRow[])
        : []

      // Not in the catalog → create a custom product, barcode pre-filled.
      if (products.length === 0) {
        setPhase({ kind: 'custom', initialBarcode: code })
        return
      }

      const product = products[0]
      const { data: itemData, error: itemErr } = await supabase
        .from('inventory_items')
        .select(
          'inventory_item_id, crew_id, product_id, current_space_id, quantity, unit',
        )
        .eq('crew_id', activeCrewId)
        .is('deleted_at', null)
        .eq('product_id', product.product_id)
      if (itemErr) throw itemErr
      const items = Array.isArray(itemData)
        ? (itemData as InventoryItemSearchRow[])
        : []

      // Already in inventory → offer restock / add-another.
      if (items.length > 0) {
        const spacesById = new Map<string, SpaceLite>()
        const { data: spaceData } = await supabase
          .from('spaces')
          .select('space_id, name, parent_id')
          .eq('crew_id', activeCrewId)
          .is('deleted_at', null)
        if (Array.isArray(spaceData)) {
          for (const s of spaceData as SpaceLite[]) spacesById.set(s.space_id, s)
        }
        const existing: ExistingItemRow[] = items.map((item) => ({
          item,
          product,
          locationPath: buildLocationPath(item.current_space_id, spacesById),
        }))
        setPhase({ kind: 'choose-existing', product, items: existing })
        return
      }

      // Found, not yet stocked → straight to the details form.
      setPhase({ kind: 'selected', selection: { kind: 'product', product } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Barcode lookup failed.')
      backToScanning()
    }
  }

  function backToScanning() {
    resolvingRef.current = false
    setPhase({ kind: 'scanning' })
  }

  function handleCustomCreated(product: ProductRow) {
    setPhase({ kind: 'selected', selection: { kind: 'product', product } })
  }

  function handleSaved(name: string) {
    setLastAddedName(name)
    setSessionCount((n) => n + 1)
    backToScanning()
  }

  return (
    <SignedInLayout>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 pt-4 pb-12">
        <header className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back to add methods"
            onClick={() => navigate('/inventory/add')}
            className="flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
          <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.4px] text-ink-900">
            Scan a barcode
          </h1>
        </header>

        {sessionCount > 0 && phase.kind === 'scanning' && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 rounded-xl bg-sage-100/40 p-3"
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-700 text-white"
            >
              <Check size={14} strokeWidth={3} />
            </span>
            <div className="flex flex-col">
              <p className="font-display text-sm font-bold text-ink-900">
                {lastAddedName ? `Added ${lastAddedName}.` : 'Item added.'}
              </p>
              <p className="font-body text-xs text-ink-700">
                {sessionCount} item{sessionCount === 1 ? '' : 's'} scanned this
                session. Keep scanning, or tap back when you're done.
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            {error}
          </p>
        )}

        {crewLoading ? (
          <p className="font-body text-sm text-ink-600">Loading…</p>
        ) : !activeCrewId || !user ? (
          <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            We couldn't load your crew. Finish onboarding first.
          </p>
        ) : phase.kind === 'scanning' || phase.kind === 'resolving' ? (
          <>
            <BarcodeScanner
              active={phase.kind === 'scanning'}
              onDetected={handleDetected}
            />
            {phase.kind === 'resolving' && (
              <p className="font-body text-sm text-ink-600">Looking it up…</p>
            )}
          </>
        ) : phase.kind === 'choose-existing' ? (
          <ExistingChooser
            product={phase.product}
            items={phase.items}
            onRestock={(item) =>
              setPhase({ kind: 'restock', selection: { kind: 'restock', item } })
            }
            onAddAnother={() =>
              setPhase({
                kind: 'selected',
                selection: { kind: 'product', product: phase.product },
              })
            }
            onCancel={backToScanning}
          />
        ) : (
          <AddItemForms
            crewId={activeCrewId}
            userId={user.id}
            phase={phase}
            onCustomCreated={handleCustomCreated}
            onSaved={() => handleSaved(phaseName(phase))}
            onCancel={backToScanning}
          />
        )}
      </div>
    </SignedInLayout>
  )
}

function phaseName(phase: AddPhase): string {
  if (phase.kind === 'restock') return phase.selection.item.product.name
  if (phase.kind === 'selected') {
    const s = phase.selection
    return s.kind === 'restock' ? s.item.product.name : s.product.name
  }
  return 'item'
}

interface ExistingChooserProps {
  product: ProductRow
  items: ExistingItemRow[]
  onRestock: (item: ExistingItemRow) => void
  onAddAnother: () => void
  onCancel: () => void
}

function ExistingChooser({
  product,
  items,
  onRestock,
  onAddAnother,
  onCancel,
}: ExistingChooserProps) {
  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="font-display text-base font-bold text-ink-900">
          {product.name} is already in your inventory
        </h2>
        <p className="font-body text-xs text-ink-600">
          Restock an existing item, or add another at a new location.
        </p>
      </header>
      <ul className="flex flex-col gap-2">
        {items.map((row) => (
          <li
            key={row.item.inventory_item_id}
            className="flex items-center justify-between gap-3 rounded-xl bg-paper-100 p-3"
          >
            <span className="font-body text-xs text-ink-600">
              {row.item.quantity} {row.item.unit} ·{' '}
              {row.locationPath || 'No location'}
            </span>
            <button
              type="button"
              onClick={() => onRestock(row)}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sage-700 to-sage-600 px-3 font-display text-xs font-bold text-white"
            >
              Restock this
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddAnother}
          className="inline-flex h-9 items-center justify-center rounded-full bg-paper-250 px-3 font-display text-xs font-bold text-sage-700"
        >
          Add at a new location
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center rounded-full px-3 font-display text-xs font-bold text-ink-600 hover:bg-paper-200"
        >
          Back to scanning
        </button>
      </div>
    </section>
  )
}

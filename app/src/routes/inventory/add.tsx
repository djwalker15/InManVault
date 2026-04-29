import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import { CustomProductForm } from '@/components/inventory/custom-product-form'
import { InventoryForm } from '@/components/inventory/inventory-form'
import { ProductSearch } from '@/components/inventory/product-search'
import type { ProductRow, Selection } from '@/components/inventory/types'
import { useSupabase } from '@/lib/supabase'

interface MembershipRow {
  crew_id: string
}

type Phase =
  | { kind: 'search' }
  | { kind: 'custom' }
  | { kind: 'selected'; selection: Selection }
  | { kind: 'restock'; selection: Extract<Selection, { kind: 'restock' }> }

export default function AddInventoryPage() {
  const { user } = useUser()
  const supabase = useSupabase()
  const navigate = useNavigate()

  const [crewId, setCrewId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'search' })
  const [crewLoading, setCrewLoading] = useState(true)
  const [sessionCount, setSessionCount] = useState(0)
  const [lastAddedName, setLastAddedName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('crew_members')
        .select('crew_id')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      const row = data as MembershipRow | null
      if (row?.crew_id) setCrewId(row.crew_id)
      setCrewLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  function handleSelect(selection: Selection) {
    if (selection.kind === 'restock') {
      // P3.5 will replace this with the real restock sub-flow.
      setPhase({ kind: 'restock', selection })
      return
    }
    setPhase({ kind: 'selected', selection })
  }

  function handleCustomCreated(product: ProductRow) {
    setPhase({
      kind: 'selected',
      selection: { kind: 'product', product },
    })
  }

  function handleSaved() {
    if (phase.kind === 'selected') {
      const product =
        phase.selection.kind === 'restock'
          ? phase.selection.item.product
          : phase.selection.product
      setLastAddedName(product.name)
    }
    setSessionCount((n) => n + 1)
    setPhase({ kind: 'search' })
  }

  return (
    <SignedInLayout>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 pt-4 pb-12">
        <header className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back to inventory"
            onClick={() => navigate('/inventory')}
            className="flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
          <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.4px] text-ink-900">
            Add an item
          </h1>
        </header>

        {sessionCount > 0 && phase.kind === 'search' && (
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
                {lastAddedName
                  ? `Added ${lastAddedName}.`
                  : 'Item added.'}
              </p>
              <p className="font-body text-xs text-ink-700">
                {sessionCount} item{sessionCount === 1 ? '' : 's'} added this
                session. Search again to keep going, or tap back when you're
                done.
              </p>
            </div>
          </div>
        )}

        {crewLoading ? (
          <p className="font-body text-sm text-ink-600">Loading…</p>
        ) : !crewId || !user ? (
          <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            We couldn't load your crew. Finish onboarding first.
          </p>
        ) : phase.kind === 'search' ? (
          <ProductSearch
            crewId={crewId}
            onSelect={handleSelect}
            onCreateCustom={() => setPhase({ kind: 'custom' })}
          />
        ) : phase.kind === 'custom' ? (
          <CustomProductForm
            crewId={crewId}
            userId={user.id}
            onCreated={handleCustomCreated}
            onCancel={() => setPhase({ kind: 'search' })}
          />
        ) : phase.kind === 'selected' ? (
          <InventoryForm
            crewId={crewId}
            selection={phase.selection}
            onSaved={handleSaved}
            onCancel={() => setPhase({ kind: 'search' })}
          />
        ) : (
          <RestockPlaceholder
            selection={phase.selection}
            onBack={() => setPhase({ kind: 'search' })}
          />
        )}
      </div>
    </SignedInLayout>
  )
}

interface RestockPlaceholderProps {
  selection: Extract<Selection, { kind: 'restock' }>
  onBack: () => void
}

function RestockPlaceholder({ selection, onBack }: RestockPlaceholderProps) {
  const product = selection.item.product
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-paper-100 p-5">
      <h2 className="font-display text-base font-bold text-ink-900">
        Restock — coming next (P3.5)
      </h2>
      <p className="font-body text-sm leading-5 text-ink-700">
        Selected: <strong>{product.name}</strong>
        {product.brand ? ` (${product.brand})` : ''}. Existing stock:{' '}
        {selection.item.item.quantity} {selection.item.item.unit} at{' '}
        {selection.item.locationPath || 'unknown'}.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="self-start font-display text-sm font-bold text-sage-700 hover:underline"
      >
        ← Pick a different product
      </button>
    </section>
  )
}

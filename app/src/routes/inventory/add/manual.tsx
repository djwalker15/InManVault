import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import {
  AddItemForms,
  type AddPhase,
} from '@/components/inventory/add-item-forms'
import { ProductSearch } from '@/components/inventory/product-search'
import type { ProductRow, Selection } from '@/components/inventory/types'
import { useActiveCrew } from '@/lib/active-crew'

type Phase = { kind: 'search' } | AddPhase

export default function ManualAddInventoryPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const { loading: crewLoading, activeCrewId } = useActiveCrew(
    user?.id ?? null,
  )

  const [phase, setPhase] = useState<Phase>({ kind: 'search' })
  const [sessionCount, setSessionCount] = useState(0)
  const [lastAddedName, setLastAddedName] = useState<string | null>(null)

  function handleSelect(selection: Selection) {
    if (selection.kind === 'restock') {
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
    } else if (phase.kind === 'restock') {
      setLastAddedName(phase.selection.item.product.name)
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
            aria-label="Back to add methods"
            onClick={() => navigate('/inventory/add')}
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
        ) : !activeCrewId || !user ? (
          <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            We couldn't load your crew. Finish onboarding first.
          </p>
        ) : phase.kind === 'search' ? (
          <ProductSearch
            crewId={activeCrewId}
            onSelect={handleSelect}
            onCreateCustom={() => setPhase({ kind: 'custom' })}
            onCreateSimilar={(product) =>
              setPhase({
                kind: 'custom',
                initialProduct: product,
                autoFocusVariant: true,
              })
            }
          />
        ) : (
          <AddItemForms
            crewId={activeCrewId}
            userId={user.id}
            phase={phase}
            onCustomCreated={handleCustomCreated}
            onSaved={handleSaved}
            onCancel={() => setPhase({ kind: 'search' })}
          />
        )}
      </div>
    </SignedInLayout>
  )
}


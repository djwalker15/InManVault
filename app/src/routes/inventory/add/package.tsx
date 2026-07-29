import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { CtaTray, Field, PrimaryButton, TextButton } from '@/components/ds'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import { SpaceSelect } from '@/components/spaces/space-select'
import { CompositionEditor } from '@/components/inventory/package/composition-editor'
import {
  makeRow,
  validateComposition,
  type ComponentDraft,
} from '@/components/inventory/package/types'
import { useActiveCrew } from '@/lib/active-crew'
import { useSupabase } from '@/lib/supabase'

interface UnitOption {
  unit: string
  unit_category: string
}

/**
 * Author a package on the fly: a crew-private package Product + its
 * composition + initial sealed stock, written in one go so you can jump
 * straight into the Opening-a-Package flow. The catalog-side composition
 * editor proper is still a follow-up; this is the fast authoring path.
 */
export default function CreatePackagePage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const supabase = useSupabase()
  const { loading: crewLoading, activeCrewId } = useActiveCrew(user?.id ?? null)

  const keyCounter = useRef(0)
  const nextKey = () => `row_${keyCounter.current++}`

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [rows, setRows] = useState<ComponentDraft[]>(() => [makeRow('row_init')])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [sealedQty, setSealedQty] = useState('1')
  const [spaceId, setSpaceId] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('unit_definitions')
        .select('unit, unit_category')
        .order('unit', { ascending: true })
      if (cancelled) return
      setUnits(Array.isArray(data) ? (data as UnitOption[]) : [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const trimmedName = name.trim()
  const qtyNum = Number(sealedQty)
  const composition = validateComposition(rows)
  const valid =
    trimmedName.length >= 1 &&
    composition.ok &&
    spaceId !== '' &&
    !Number.isNaN(qtyNum) &&
    qtyNum >= 1

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (!activeCrewId || !user) return
    if (!composition.ok) {
      setError(composition.error)
      return
    }
    if (!valid) return

    setSubmitting(true)
    setError(null)
    try {
      // 1. The package Product (is_package set on insert — it has components).
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          crew_id: activeCrewId,
          name: trimmedName,
          brand: brand.trim() || null,
          source: 'crew_created',
          created_by: user.id,
          is_package: true,
        })
        .select('product_id')
        .single()
      if (productError) throw productError
      if (!product) throw new Error('Product insert returned no row')
      const packageProductId = (product as { product_id: string }).product_id

      // 2. The composition rows.
      const { error: componentsError } = await supabase
        .from('product_components')
        .insert(
          composition.components.map((c) => ({
            package_product_id: packageProductId,
            component_product_id: c.component_product_id,
            quantity: c.quantity,
            unit: c.unit,
            sort_order: c.sort_order,
          })),
        )
      if (componentsError) throw componentsError

      // 3. Initial sealed stock via the atomic purchase RPC.
      const { data: itemId, error: purchaseError } = await supabase.rpc(
        'record_purchase',
        {
          p_product_id: packageProductId,
          p_quantity: qtyNum,
          p_unit: 'pkg',
          p_current_space_id: spaceId,
          p_unit_cost: unitCost.trim() === '' ? null : Number(unitCost),
          p_source: 'crew_created',
        },
      )
      if (purchaseError) throw purchaseError

      // Straight into the break flow with the freshly-stocked pack.
      if (typeof itemId === 'string') {
        navigate(`/inventory/open/${itemId}`)
      } else {
        navigate('/inventory')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create the package.',
      )
    } finally {
      setSubmitting(false)
    }
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
            Create a package
          </h1>
        </header>

        {crewLoading ? (
          <p className="font-body text-sm text-ink-600">Loading…</p>
        ) : !activeCrewId || !user ? (
          <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            We couldn't load your crew. Finish onboarding first.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <p className="font-body text-sm text-ink-700">
              Define a package and its contents, add a few sealed packs, then
              open one — handy for walking the break flow repeatedly.
            </p>

            <Field
              label="PACKAGE NAME"
              placeholder="Soda Variety 12-pack"
              value={name}
              onValueChange={setName}
              autoFocus
              required
              minLength={1}
              maxLength={200}
            />
            <Field
              label="BRAND (OPTIONAL)"
              placeholder="Demo Co"
              value={brand}
              onValueChange={setBrand}
              maxLength={120}
            />

            <CompositionEditor
              rows={rows}
              onChange={setRows}
              units={units}
              nextKey={nextKey}
            />

            <fieldset className="flex flex-col gap-3 border-t border-paper-300 pt-4">
              <legend className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
                Initial sealed stock
              </legend>
              <div className="flex items-end gap-2">
                <Field
                  label="SEALED PACKS"
                  placeholder="3"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={sealedQty}
                  onValueChange={setSealedQty}
                />
                <Field
                  label="COST / PACK (OPTIONAL)"
                  placeholder="12.00"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onValueChange={setUnitCost}
                />
              </div>
              <SpaceSelect
                crewId={activeCrewId}
                value={spaceId}
                onChange={setSpaceId}
                label="Stored in"
                allowEmpty
              />
            </fieldset>

            {(error || (!composition.ok && rows.some((r) => r.product))) && (
              <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
                {error ?? composition.error}
              </p>
            )}

            <CtaTray sticky={false}>
              <PrimaryButton
                arrow
                type="button"
                disabled={submitting || !valid}
                onClick={() => void handleSubmit()}
              >
                {submitting ? 'Creating…' : 'Create & open'}
              </PrimaryButton>
              <TextButton type="button" onClick={() => navigate('/inventory/add')}>
                Cancel
              </TextButton>
            </CtaTray>
          </form>
        )}
      </div>
    </SignedInLayout>
  )
}

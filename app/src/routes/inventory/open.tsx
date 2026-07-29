import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  CtaTray,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  TextButton,
  Toast,
} from '@/components/ds'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import { SpaceSelect } from '@/components/spaces/space-select'
import { useActiveCrew } from '@/lib/active-crew'
import { useSupabase } from '@/lib/supabase'
import { buildUnitMap, formatQuantity, type UnitMap } from '@/lib/units'
import {
  allocatedTotal,
  costReconciles,
  defaultAllocations,
  resolveChild,
  type ComponentLine,
  type PackageItem,
} from '@/components/inventory/open/types'

type Step = 'count' | 'preview' | 'cost' | 'confirm' | 'done'
const STEP_ORDER: Step[] = ['count', 'preview', 'cost', 'confirm']

interface LoadedPackage {
  item: PackageItem
  components: ComponentLine[]
  units: UnitMap
}

export default function OpenPackagePage() {
  const { itemId } = useParams<{ itemId: string }>()
  const { user } = useUser()
  const navigate = useNavigate()
  const supabase = useSupabase()
  const { loading: crewLoading, activeCrewId } = useActiveCrew(user?.id ?? null)

  const [loaded, setLoaded] = useState<LoadedPackage | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [step, setStep] = useState<Step>('count')
  const [count, setCount] = useState(1)
  const [targetSpaceId, setTargetSpaceId] = useState('')
  const [costOverrides, setCostOverrides] = useState<Map<string, number>>(
    new Map(),
  )
  const [costEdited, setCostEdited] = useState(false)
  const [existing, setExisting] = useState<
    Map<string, { unit: string; quantity: number }>
  >(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ---- Load the package, its composition, and unit definitions. --------
  useEffect(() => {
    if (!itemId || !activeCrewId) return
    let cancelled = false
    async function load() {
      setLoadError(null)
      const { data: itemRow, error: itemErr } = await supabase
        .from('inventory_items')
        .select(
          'inventory_item_id, product_id, quantity, unit, current_space_id, last_unit_cost',
        )
        .eq('inventory_item_id', itemId)
        .eq('crew_id', activeCrewId)
        .is('deleted_at', null)
        .maybeSingle()
      if (cancelled) return
      if (itemErr || !itemRow) {
        setLoadError('We couldn’t find that package item.')
        return
      }

      const [productRes, componentsRes, unitsRes] = await Promise.all([
        supabase
          .from('products')
          .select('name, is_package')
          .eq('product_id', itemRow.product_id)
          .maybeSingle(),
        supabase
          .from('product_components')
          .select('component_product_id, quantity, unit, sort_order')
          .eq('package_product_id', itemRow.product_id)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true }),
        supabase
          .from('unit_definitions')
          .select('unit, unit_category, to_base_factor'),
      ])
      if (cancelled) return

      const product = productRes.data as
        | { name: string; is_package: boolean }
        | null
      const componentRows = (
        Array.isArray(componentsRes.data) ? componentsRes.data : []
      ) as {
        component_product_id: string
        quantity: number
        unit: string
        sort_order: number
      }[]

      if (!product?.is_package || componentRows.length === 0) {
        setLoadError('This item isn’t a package, so there’s nothing to open.')
        return
      }
      if (itemRow.quantity < 1) {
        setLoadError('No sealed packs to open.')
        return
      }

      // Resolve component product names for display.
      const ids = componentRows.map((c) => c.component_product_id)
      const { data: namesData } = await supabase
        .from('products')
        .select('product_id, name')
        .in('product_id', ids)
      if (cancelled) return
      const names = new Map<string, string>()
      for (const p of (Array.isArray(namesData) ? namesData : []) as {
        product_id: string
        name: string
      }[]) {
        names.set(p.product_id, p.name)
      }

      const components: ComponentLine[] = componentRows.map((c) => ({
        componentProductId: c.component_product_id,
        name: names.get(c.component_product_id) ?? 'Unknown product',
        quantity: Number(c.quantity),
        unit: c.unit,
      }))

      const units = buildUnitMap(
        (Array.isArray(unitsRes.data) ? unitsRes.data : []) as {
          unit: string
          unit_category: string
          to_base_factor: number
        }[],
      )

      const item: PackageItem = {
        inventoryItemId: itemRow.inventory_item_id,
        productId: itemRow.product_id,
        productName: product.name,
        quantity: Number(itemRow.quantity),
        unit: itemRow.unit,
        currentSpaceId: itemRow.current_space_id,
        lastUnitCost:
          itemRow.last_unit_cost === null ? null : Number(itemRow.last_unit_cost),
      }
      setTargetSpaceId(item.currentSpaceId)
      setLoaded({ item, components, units })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, itemId, activeCrewId])

  const item = loaded?.item ?? null
  const components = useMemo(() => loaded?.components ?? [], [loaded])
  const units = loaded?.units ?? null

  const packCost = item ? (item.lastUnitCost ?? 0) * count : 0

  // Cost allocation is derived, not stored: category-aware defaults, with
  // the user's per-line edits layered on top. Non-edited lines follow the
  // defaults as count changes; edited lines hold their explicit value.
  const unitCosts = useMemo(() => {
    const defaults = units
      ? defaultAllocations(components, count, packCost, units)
      : new Map<string, number>()
    if (!costEdited) return defaults
    const merged = new Map(defaults)
    for (const [k, v] of costOverrides) merged.set(k, v)
    return merged
  }, [units, components, count, packCost, costEdited, costOverrides])

  // Predict merge-vs-create against the chosen target space.
  useEffect(() => {
    if (!loaded || !targetSpaceId || !activeCrewId) return
    let cancelled = false
    async function loadExisting() {
      const ids = components.map((c) => c.componentProductId)
      const { data } = await supabase
        .from('inventory_items')
        .select('product_id, unit, quantity, created_at')
        .eq('crew_id', activeCrewId)
        .eq('current_space_id', targetSpaceId)
        .in('product_id', ids)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      if (cancelled) return
      const map = new Map<string, { unit: string; quantity: number }>()
      for (const r of (Array.isArray(data) ? data : []) as {
        product_id: string
        unit: string
        quantity: number
      }[]) {
        // First (earliest) item per product wins, mirroring the RPC.
        if (!map.has(r.product_id)) {
          map.set(r.product_id, { unit: r.unit, quantity: Number(r.quantity) })
        }
      }
      setExisting(map)
    }
    void loadExisting()
    return () => {
      cancelled = true
    }
  }, [supabase, loaded, components, targetSpaceId, activeCrewId])

  const reconciles = useMemo(
    () => (units ? costReconciles(components, count, packCost, unitCosts) : false),
    [units, components, count, packCost, unitCosts],
  )
  const totalAllocated = useMemo(
    () => allocatedTotal(components, count, unitCosts),
    [components, count, unitCosts],
  )
  const itemsProduced = useMemo(
    () => components.reduce((sum, c) => sum + c.quantity * count, 0),
    [components, count],
  )

  const handleSubmit = useCallback(async () => {
    if (!item) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const overrides = costEdited
        ? Object.fromEntries(
            components.map((c) => [
              c.componentProductId,
              unitCosts.get(c.componentProductId) ?? 0,
            ]),
          )
        : null
      const { error: rpcError } = await supabase.rpc('open_package', {
        p_package_item_id: item.inventoryItemId,
        p_quantity_opened: count,
        p_target_space_id: targetSpaceId,
        p_cost_overrides: overrides,
      })
      if (rpcError) throw rpcError
      setStep('done')
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Couldn’t open the package. Nothing was changed. Try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }, [item, components, unitCosts, costEdited, count, targetSpaceId, supabase])

  // ---- Shells -----------------------------------------------------------
  if (crewLoading || (!loaded && !loadError)) {
    return (
      <OpenShell onBack={() => navigate('/inventory')}>
        <p className="font-body text-sm text-ink-600">Loading package…</p>
      </OpenShell>
    )
  }

  if (loadError || !item || !units || !activeCrewId) {
    return (
      <OpenShell onBack={() => navigate('/inventory')}>
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700"
        >
          {loadError ?? 'We couldn’t load this package.'}
        </p>
        <CtaTray sticky={false}>
          <SecondaryButton type="button" onClick={() => navigate('/inventory')}>
            Back to inventory
          </SecondaryButton>
        </CtaTray>
      </OpenShell>
    )
  }

  if (step === 'done') {
    return (
      <OpenShell onBack={() => navigate('/inventory')}>
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ink-900">
            Package opened
          </h2>
          <p className="font-body text-sm text-ink-700">
            Opened {count} pack{count === 1 ? '' : 's'} of {item.productName} —{' '}
            {formatQuantity(itemsProduced)} item
            {itemsProduced === 1 ? '' : 's'} added to stock.
          </p>
          <CtaTray sticky={false}>
            <PrimaryButton
              arrow
              type="button"
              onClick={() => navigate('/inventory')}
            >
              Back to inventory
            </PrimaryButton>
          </CtaTray>
        </div>
        <Toast
          message={`Opened ${count} pack${count === 1 ? '' : 's'} — ${formatQuantity(
            itemsProduced,
          )} items added.`}
          onDismiss={() => navigate('/inventory')}
        />
      </OpenShell>
    )
  }

  const stepIndex = STEP_ORDER.indexOf(step)

  return (
    <OpenShell onBack={() => navigate('/inventory')}>
      <ProgressBar step={stepIndex + 1} total={STEP_ORDER.length} />
      <h2 className="font-display text-xl font-bold text-ink-900">
        Open {item.productName}
      </h2>

      {submitError && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700"
        >
          {submitError}
        </p>
      )}

      {step === 'count' && (
        <CountStep
          item={item}
          components={components}
          count={count}
          onCount={setCount}
          onNext={() => setStep('preview')}
        />
      )}

      {step === 'preview' && (
        <PreviewStep
          crewId={activeCrewId}
          item={item}
          components={components}
          count={count}
          units={units}
          existing={existing}
          targetSpaceId={targetSpaceId}
          onTargetSpace={setTargetSpaceId}
          onBack={() => setStep('count')}
          onNext={() => setStep('cost')}
        />
      )}

      {step === 'cost' && (
        <CostStep
          components={components}
          count={count}
          packCost={packCost}
          packCostKnown={item.lastUnitCost !== null}
          unitCosts={unitCosts}
          totalAllocated={totalAllocated}
          reconciles={reconciles}
          onEdit={(productId, value) => {
            setCostEdited(true)
            setCostOverrides((prev) => {
              const next = new Map(prev)
              next.set(productId, value)
              return next
            })
          }}
          onBack={() => setStep('preview')}
          onNext={() => setStep('confirm')}
        />
      )}

      {step === 'confirm' && (
        <ConfirmStep
          item={item}
          components={components}
          count={count}
          packCost={packCost}
          itemsProduced={itemsProduced}
          existing={existing}
          submitting={submitting}
          onBack={() => setStep('cost')}
          onConfirm={() => void handleSubmit()}
        />
      )}
    </OpenShell>
  )
}

function OpenShell({
  onBack,
  children,
}: {
  onBack: () => void
  children: React.ReactNode
}) {
  return (
    <SignedInLayout>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 pt-4 pb-12">
        <header className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back to inventory"
            onClick={onBack}
            className="flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
          <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.4px] text-ink-900">
            Open a package
          </h1>
        </header>
        {children}
      </div>
    </SignedInLayout>
  )
}

// ---- Step 1: count ------------------------------------------------------
function CountStep({
  item,
  components,
  count,
  onCount,
  onNext,
}: {
  item: PackageItem
  components: ComponentLine[]
  count: number
  onCount: (n: number) => void
  onNext: () => void
}) {
  const max = item.quantity
  const clamp = (n: number) => Math.max(1, Math.min(max, Math.round(n)))
  return (
    <div className="flex flex-col gap-5">
      <p className="font-body text-sm text-ink-700">
        <span className="font-numeric font-semibold">{item.quantity}</span>{' '}
        sealed on hand. Each pack contains{' '}
        {components
          .map((c) => `${formatQuantity(c.quantity)} ${c.unit} ${c.name}`)
          .join(', ')}
        .
      </p>
      <div className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          How many to open?
        </span>
        <div className="flex items-center gap-3">
          <Stepper
            label="Decrease"
            disabled={count <= 1}
            onClick={() => onCount(clamp(count - 1))}
          >
            −
          </Stepper>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            value={count}
            onChange={(e) => onCount(clamp(Number(e.target.value) || 1))}
            aria-label="Packs to open"
            className="h-12 w-20 rounded-xl bg-paper-100 text-center font-numeric text-lg text-ink-900 outline-none focus:bg-paper-250"
          />
          <Stepper
            label="Increase"
            disabled={count >= max}
            onClick={() => onCount(clamp(count + 1))}
          >
            +
          </Stepper>
          <span className="font-body text-sm text-ink-500">of {max}</span>
        </div>
        {max > 1 && (
          <TextButton type="button" onClick={() => onCount(max)}>
            Open all {max}
          </TextButton>
        )}
      </div>
      <CtaTray sticky={false}>
        <PrimaryButton arrow type="button" onClick={onNext}>
          Preview
        </PrimaryButton>
      </CtaTray>
    </div>
  )
}

function Stepper({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-12 items-center justify-center rounded-full bg-paper-100 font-display text-xl text-ink-900 transition hover:bg-paper-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

// ---- Step 2: preview ----------------------------------------------------
function PreviewStep({
  crewId,
  item,
  components,
  count,
  units,
  existing,
  targetSpaceId,
  onTargetSpace,
  onBack,
  onNext,
}: {
  crewId: string
  item: PackageItem
  components: ComponentLine[]
  count: number
  units: UnitMap
  existing: Map<string, { unit: string; quantity: number }>
  targetSpaceId: string
  onTargetSpace: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <SpaceSelect
        crewId={crewId}
        value={targetSpaceId || item.currentSpaceId}
        onChange={onTargetSpace}
        label="Store contents in"
      />
      <ul className="flex flex-col gap-2" aria-label="Resulting items">
        {components.map((c) => {
          const produced = c.quantity * count
          const resolution = resolveChild(
            c,
            count,
            existing.get(c.componentProductId),
            units,
          )
          return (
            <li
              key={c.componentProductId}
              className="flex flex-col gap-1 rounded-xl bg-paper-50 p-3"
            >
              <p className="font-display text-sm font-bold text-ink-900">
                {formatQuantity(produced)} {c.unit} {c.name}
              </p>
              {resolution.kind === 'merge' ? (
                <p className="font-body text-xs text-ink-600">
                  Merge → existing ({formatQuantity(resolution.existingQty)}{' '}
                  {resolution.existingUnit} →{' '}
                  {formatQuantity(
                    resolution.existingQty + (resolution.convertedQty ?? 0),
                  )}{' '}
                  {resolution.existingUnit})
                  {resolution.existingUnit !== c.unit &&
                    resolution.convertedQty !== null && (
                      <span className="text-ink-500">
                        {' · '}
                        {formatQuantity(produced)} {c.unit} →{' '}
                        {formatQuantity(resolution.convertedQty)}{' '}
                        {resolution.existingUnit}
                      </span>
                    )}
                </p>
              ) : (
                <p className="font-body text-xs text-ink-600">+ New item</p>
              )}
            </li>
          )
        })}
      </ul>
      <CtaTray sticky={false}>
        <PrimaryButton arrow type="button" onClick={onNext}>
          Review cost
        </PrimaryButton>
        <TextButton type="button" onClick={onBack}>
          Back
        </TextButton>
      </CtaTray>
    </div>
  )
}

// ---- Step 3: cost -------------------------------------------------------
function CostStep({
  components,
  count,
  packCost,
  packCostKnown,
  unitCosts,
  totalAllocated,
  reconciles,
  onEdit,
  onBack,
  onNext,
}: {
  components: ComponentLine[]
  count: number
  packCost: number
  packCostKnown: boolean
  unitCosts: Map<string, number>
  totalAllocated: number
  reconciles: boolean
  onEdit: (productId: string, value: number) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-body text-sm text-ink-700">
        Split the package cost across its contents. The total must match the
        package cost before you can continue.
      </p>
      {!packCostKnown && (
        <p className="rounded-md bg-paper-100 px-3 py-2 font-body text-xs text-ink-600">
          This package has no recorded cost — values default to $0. You can
          still proceed.
        </p>
      )}
      <ul className="flex flex-col gap-2" aria-label="Cost allocation">
        {components.map((c) => {
          const value = unitCosts.get(c.componentProductId) ?? 0
          return (
            <li
              key={c.componentProductId}
              className="flex items-center justify-between gap-3 rounded-xl bg-paper-50 p-3"
            >
              <span className="font-body text-sm text-ink-900">
                {c.name}
                <span className="ml-1 text-ink-500">
                  ({formatQuantity(c.quantity * count)} {c.unit})
                </span>
              </span>
              <label className="flex items-center gap-1">
                <span className="font-body text-sm text-ink-500">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={value === 0 ? '' : String(value)}
                  placeholder="0.00"
                  aria-label={`Unit cost for ${c.name}`}
                  onChange={(e) =>
                    onEdit(c.componentProductId, Number(e.target.value) || 0)
                  }
                  className="h-10 w-24 rounded-lg bg-paper-100 px-2 text-right font-numeric text-sm text-ink-900 outline-none focus:bg-paper-250"
                />
                <span className="font-body text-xs text-ink-500">/{c.unit}</span>
              </label>
            </li>
          )
        })}
      </ul>
      <p
        aria-live="polite"
        className={`font-body text-sm ${reconciles ? 'text-sage-700' : 'text-ink-700'}`}
      >
        ${totalAllocated.toFixed(2)} of ${packCost.toFixed(2)} allocated
        {reconciles ? ' ✓' : ''}
      </p>
      <CtaTray sticky={false}>
        <PrimaryButton arrow type="button" disabled={!reconciles} onClick={onNext}>
          Continue
        </PrimaryButton>
        <TextButton type="button" onClick={onBack}>
          Back
        </TextButton>
      </CtaTray>
    </div>
  )
}

// ---- Step 4: confirm ----------------------------------------------------
function ConfirmStep({
  item,
  components,
  count,
  packCost,
  itemsProduced,
  existing,
  submitting,
  onBack,
  onConfirm,
}: {
  item: PackageItem
  components: ComponentLine[]
  count: number
  packCost: number
  itemsProduced: number
  existing: Map<string, { unit: string; quantity: number }>
  submitting: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 font-body text-sm">
        <dt className="text-ink-600">Opening</dt>
        <dd className="text-ink-900">
          {count} × {item.productName}
        </dd>
        <dt className="text-ink-600">Sealed remaining after</dt>
        <dd className="text-ink-900">
          {item.quantity - count} pack{item.quantity - count === 1 ? '' : 's'}
        </dd>
        <dt className="text-ink-600">Items produced</dt>
        <dd className="text-ink-900">{formatQuantity(itemsProduced)}</dd>
        <dt className="text-ink-600">Cost released</dt>
        <dd className="text-ink-900">${packCost.toFixed(2)}</dd>
      </dl>
      <ul className="flex flex-col gap-1" aria-label="Children produced">
        {components.map((c) => {
          const merges = existing.has(c.componentProductId)
          return (
            <li key={c.componentProductId} className="font-body text-xs text-ink-600">
              {formatQuantity(c.quantity * count)} {c.unit} {c.name}{' '}
              <span className="text-ink-500">
                ({merges ? 'merges into existing' : 'new item'})
              </span>
            </li>
          )
        })}
      </ul>
      <p className="rounded-md bg-paper-100 px-3 py-2 font-body text-xs text-ink-600">
        This can’t be undone — opened packs convert to loose items.
      </p>
      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={submitting}
          onClick={onConfirm}
        >
          {submitting ? 'Opening…' : 'Open package'}
        </PrimaryButton>
        <TextButton type="button" onClick={onBack}>
          Back
        </TextButton>
      </CtaTray>
    </div>
  )
}

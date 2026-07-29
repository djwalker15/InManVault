import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Chip } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'
import { ALERT_LABEL, type InventoryAlert } from './inventory-status'
import { RowActions } from './row-actions'

interface InventoryRowDetailsProps {
  inventoryItemId: string
  productId: string
  productName: string
  productBrand: string | null
  productImageUrl: string | null
  productSize: { value: number; unit: string } | null
  productBarcode: string | null
  effectiveCategoryName: string | null
  categoryOverridden: boolean
  quantity: number
  unit: string
  /** When true, the item's product is a package and can be opened. */
  isPackage?: boolean
  currentLocationPath: string
  currentSpaceId?: string
  homeSpaceId?: string | null
  homeLocationPath: string | null
  displacementState: 'in_place' | 'displaced' | 'unsorted'
  lastUnitCost: number | null
  minStock: number | null
  categoryId?: string | null
  expiryDate: string | null
  notes: string | null
  alerts: InventoryAlert[]
  /** When provided, renders the inline-actions panel. */
  crewId?: string
  categories?: { category_id: string; name: string; crew_id: string | null }[]
  onChanged?: () => void
}

interface FlowRow {
  flow_id: string
  flow_type:
    | 'purchase'
    | 'waste'
    | 'consumption'
    | 'transfer'
    | 'prep_usage'
    | 'batch_output'
    | 'adjustment'
    | 'package_break'
    | 'package_yield'
  quantity: number
  unit: string
  performed_at: string
  performed_by: string
  notes: string | null
}

const FLOW_LABEL: Record<FlowRow['flow_type'], string> = {
  purchase: 'Purchased',
  waste: 'Wasted',
  consumption: 'Used',
  transfer: 'Moved',
  prep_usage: 'Used in a batch',
  batch_output: 'Created from a batch',
  adjustment: 'Adjusted',
  package_break: 'Opened',
  package_yield: 'Unpacked',
}

export function InventoryRowDetails(props: InventoryRowDetailsProps) {
  const supabase = useSupabase()
  const { user } = useUser()
  const [flows, setFlows] = useState<FlowRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: queryError } = await supabase
        .from('flows')
        .select(
          'flow_id, flow_type, quantity, unit, performed_at, performed_by, notes',
        )
        .eq('inventory_item_id', props.inventoryItemId)
        .order('performed_at', { ascending: false })
        .limit(5)
      if (cancelled) return
      if (queryError) {
        setError(queryError.message ?? 'Failed to load activity.')
        return
      }
      setFlows(Array.isArray(data) ? (data as FlowRow[]) : [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, props.inventoryItemId])

  return (
    <div
      className="flex flex-col gap-4 rounded-b-2xl bg-paper-100 px-4 pb-4 pt-1"
      data-testid={`row-details-${props.inventoryItemId}`}
    >
      <Section title="Product">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper-50"
          >
            {props.productImageUrl ? (
              <img
                src={props.productImageUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <span className="font-display text-base font-bold text-ink-500">
                {props.productName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <div className="flex min-w-0 flex-col">
            <p className="font-display text-sm font-bold text-ink-900">
              {props.productName}
            </p>
            <p className="font-body text-xs text-ink-600">
              {[
                props.productBrand,
                props.productSize
                  ? `${props.productSize.value} ${props.productSize.unit}`
                  : null,
                props.productBarcode ? `UPC ${props.productBarcode}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'No catalog details'}
            </p>
            {props.effectiveCategoryName && (
              <p className="mt-1 font-body text-xs text-ink-500">
                Category: {props.effectiveCategoryName}
                {props.categoryOverridden ? ' (crew override)' : ''}
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section title="Inventory">
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 font-body text-sm">
          <Row
            label="Quantity"
            value={
              <>
                <span className="font-numeric font-semibold">
                  {props.quantity}
                </span>{' '}
                {props.unit}
              </>
            }
          />
          <Row label="Current location" value={props.currentLocationPath} />
          <Row
            label="Home location"
            value={props.homeLocationPath ?? 'Unsorted'}
          />
          <Row
            label="Status"
            value={
              <Chip
                variant={
                  props.displacementState === 'in_place'
                    ? 'sage'
                    : props.displacementState === 'displaced'
                      ? 'warn'
                      : 'default'
                }
              >
                {displacementLabel(props.displacementState)}
              </Chip>
            }
          />
          <Row
            label="Last unit cost"
            value={
              props.lastUnitCost == null
                ? 'Not tracked'
                : `$${Number(props.lastUnitCost).toFixed(2)}`
            }
          />
          <Row
            label="Min stock"
            value={
              props.minStock == null
                ? 'Not set'
                : `${props.minStock} ${props.unit}`
            }
          />
          <Row
            label="Expiry"
            value={renderExpiry(props.expiryDate)}
          />
        </dl>
        {props.notes && (
          <p className="mt-2 rounded-md bg-paper-50 px-3 py-2 font-body text-sm leading-5 text-ink-700">
            {props.notes}
          </p>
        )}
        {props.alerts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {props.alerts.map((alert) => (
              <Chip
                key={alert}
                variant={
                  alert === 'out_of_stock' || alert === 'expired'
                    ? 'error'
                    : alert === 'low_stock' || alert === 'expiring_soon'
                      ? 'warn'
                      : 'default'
                }
              >
                {ALERT_LABEL[alert]}
              </Chip>
            ))}
          </div>
        )}
      </Section>

      {props.crewId && props.currentSpaceId && props.onChanged && (
        <RowActions
          crewId={props.crewId}
          inventoryItemId={props.inventoryItemId}
          currentSpaceId={props.currentSpaceId}
          homeSpaceId={props.homeSpaceId ?? null}
          unit={props.unit}
          quantity={props.quantity}
          isPackage={props.isPackage ?? false}
          category_id={props.categoryId ?? null}
          min_stock={props.minStock}
          expiry_date={props.expiryDate}
          notes={props.notes}
          categories={props.categories ?? []}
          onChanged={props.onChanged}
        />
      )}

      <Section title="Recent activity">
        {error ? (
          <p className="font-body text-sm text-error">{error}</p>
        ) : flows === null ? (
          <p className="font-body text-sm text-ink-600">Loading…</p>
        ) : flows.length === 0 ? (
          <p className="font-body text-sm text-ink-500">
            No activity recorded for this item yet.
          </p>
        ) : (
          <ol
            aria-label="Recent flows"
            className="flex flex-col gap-2 border-l-2 border-paper-300 pl-3"
          >
            {flows.map((flow) => (
              <li key={flow.flow_id} className="flex flex-col">
                <p className="font-display text-sm font-bold text-ink-900">
                  {FLOW_LABEL[flow.flow_type]} {flow.quantity} {flow.unit}
                </p>
                <p className="font-body text-xs text-ink-600">
                  {formatRelative(flow.performed_at)}
                  {user?.id === flow.performed_by ? ' · by you' : ''}
                </p>
                {flow.notes && (
                  <p className="mt-1 font-body text-xs italic text-ink-500">
                    {flow.notes}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        {title}
      </h4>
      {children}
    </section>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <>
      <dt className="text-ink-600">{label}</dt>
      <dd className="text-ink-900">{value}</dd>
    </>
  )
}

function displacementLabel(
  state: 'in_place' | 'displaced' | 'unsorted',
): string {
  if (state === 'in_place') return 'In place'
  if (state === 'displaced') return 'Displaced'
  return 'Unsorted'
}

function renderExpiry(date: string | null): string {
  if (!date) return 'Not set'
  const todayMs = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime()
  const expMs = new Date(`${date}T00:00:00Z`).getTime()
  const days = Math.round((expMs - todayMs) / 86_400_000)
  if (days === 0) return `${date} · today`
  if (days < 0) return `${date} · expired ${Math.abs(days)}d ago`
  return `${date} · in ${days}d`
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return iso.slice(0, 10)
}

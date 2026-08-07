import { useMemo } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Chip, ProductThumb } from '@/components/ds'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import { useCrewAlerts, type AlertRow } from '@/components/inventory/use-crew-alerts'
import {
  ALERT_LABEL,
  type InventoryAlert,
} from '@/components/inventory/inventory-status'
import { useActiveCrew } from '@/lib/active-crew'

const GROUPS: InventoryAlert[] = [
  'out_of_stock',
  'expired',
  'low_stock',
  'expiring_soon',
  'displaced',
]

function chipVariant(
  alert: InventoryAlert,
): 'error' | 'warn' | 'default' {
  if (alert === 'out_of_stock' || alert === 'expired') return 'error'
  if (alert === 'low_stock' || alert === 'expiring_soon') return 'warn'
  return 'default'
}

export default function AlertsPage() {
  const { user } = useUser()
  const { loading: crewLoading, activeCrewId } = useActiveCrew(
    user?.id ?? null,
  )
  const { loading, error, rows, counts } = useCrewAlerts(activeCrewId)
  const [params] = useSearchParams()
  const focus = params.get('focus') as InventoryAlert | null

  const grouped = useMemo(() => {
    const map: Record<InventoryAlert, AlertRow[]> = {
      out_of_stock: [],
      expired: [],
      low_stock: [],
      expiring_soon: [],
      displaced: [],
    }
    for (const row of rows) {
      for (const a of row.alerts) {
        map[a].push(row)
      }
    }
    return map
  }, [rows])

  const total = GROUPS.reduce((sum, a) => sum + counts[a], 0)

  return (
    <SignedInLayout>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 pt-4 pb-12">
        <header className="flex items-center gap-2">
          <Link
            to="/inventory"
            aria-label="Back to inventory"
            className="flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </Link>
          <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.4px] text-ink-900">
            Alerts
          </h1>
        </header>

        {crewLoading || loading ? (
          <p className="font-body text-sm text-ink-600">Loading alerts…</p>
        ) : error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            {error}
          </p>
        ) : total === 0 ? (
          <section className="rounded-2xl bg-paper-100 p-6">
            <h2 className="font-display text-xl font-bold text-ink-900">
              All caught up
            </h2>
            <p className="mt-2 font-body text-base leading-6 text-ink-700">
              Nothing in your inventory needs attention right now.
            </p>
          </section>
        ) : (
          <div className="flex flex-col gap-5">
            {GROUPS.filter(
              (g) =>
                grouped[g].length > 0 && (focus === null || focus === g),
            ).map((group) => (
              <AlertGroup
                key={group}
                alert={group}
                rows={grouped[group]}
              />
            ))}
            {focus !== null && (
              <Link
                to="/alerts"
                className="self-start font-display text-xs font-bold uppercase tracking-[0.55px] text-sage-700 hover:underline"
              >
                ← Show all alert groups
              </Link>
            )}
          </div>
        )}
      </div>
    </SignedInLayout>
  )
}

interface AlertGroupProps {
  alert: InventoryAlert
  rows: AlertRow[]
}

function AlertGroup({ alert, rows }: AlertGroupProps) {
  return (
    <section
      aria-label={`${ALERT_LABEL[alert]} (${rows.length})`}
      className="flex flex-col gap-3 rounded-2xl bg-paper-100 p-4"
    >
      <header className="flex items-center gap-2">
        <Chip variant={chipVariant(alert)}>{ALERT_LABEL[alert]}</Chip>
        <span className="font-numeric font-semibold text-ink-700">
          {rows.length}
        </span>
      </header>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={`${alert}-${row.inventoryItemId}`}
            className="flex items-start gap-2 rounded-lg bg-paper-50 p-3"
          >
            <ProductThumb
              imageUrl={row.productImageUrl}
              name={row.productName}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="font-display text-sm font-bold text-ink-900">
                {row.productName}
                {row.productBrand && (
                  <span className="ml-1 font-body text-xs font-normal text-ink-600">
                    · {row.productBrand}
                  </span>
                )}
              </p>
              <p className="font-body text-xs text-ink-600">
                <span className="font-numeric font-semibold">
                  {row.quantity}
                </span>{' '}
                {row.unit}
                {row.locationPath && (
                  <>
                    <span className="mx-1.5 text-ink-400">·</span>
                    {row.locationPath}
                  </>
                )}
                {row.expiryDate && (
                  <>
                    <span className="mx-1.5 text-ink-400">·</span>
                    Exp {row.expiryDate}
                  </>
                )}
              </p>
            </div>
            <Link
              to="/inventory"
              className="font-display text-xs font-semibold uppercase tracking-[0.55px] text-sage-700 hover:underline"
            >
              Open
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

import { Plus, Trash2 } from 'lucide-react'
import { SecondaryButton } from '@/components/ds'
import { ProductPicker } from './product-picker'
import type { ComponentDraft } from './types'
import { makeRow } from './types'

interface UnitOption {
  unit: string
  unit_category: string
}

interface CompositionEditorProps {
  rows: ComponentDraft[]
  onChange: (rows: ComponentDraft[]) => void
  units: UnitOption[]
  /** Monotonic counter owner for stable row keys (caller-provided). */
  nextKey: () => string
}

/**
 * Controlled editor for a package's composition. Each row picks a child
 * product, a per-package quantity, and a unit. Quantities are "per single
 * package"; the break multiplies them by the packs opened.
 */
export function CompositionEditor({
  rows,
  onChange,
  units,
  nextKey,
}: CompositionEditorProps) {
  const usedIds = rows
    .map((r) => r.product?.product_id)
    .filter((id): id is string => !!id)

  function update(key: string, patch: Partial<ComponentDraft>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function remove(key: string) {
    onChange(rows.filter((r) => r.key !== key))
  }

  function add() {
    onChange([...rows, makeRow(nextKey())])
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
        Contents (per single package)
      </span>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-col gap-2 rounded-xl bg-paper-50 p-3"
          >
            <ProductPicker
              value={row.product}
              onChange={(product) => update(row.key, { product })}
              excludeIds={usedIds.filter(
                (id) => id !== row.product?.product_id,
              )}
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={row.quantity}
                onChange={(e) => update(row.key, { quantity: e.target.value })}
                aria-label="Quantity per package"
                className="h-11 w-24 rounded-lg bg-paper-100 px-3 font-numeric text-sm text-ink-900 outline-none focus:bg-paper-250"
              />
              <select
                value={row.unit}
                onChange={(e) => update(row.key, { unit: e.target.value })}
                aria-label="Unit"
                className="h-11 flex-1 rounded-lg bg-paper-100 px-3 font-body text-sm text-ink-900 outline-none focus:bg-paper-250"
              >
                {units.map((u) => (
                  <option key={u.unit} value={u.unit}>
                    {u.unit} ({u.unit_category})
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Remove component"
                onClick={() => remove(row.key)}
                disabled={rows.length === 1}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-600 transition hover:bg-paper-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <SecondaryButton type="button" onClick={add}>
        <Plus size={16} aria-hidden className="mr-1" />
        Add component
      </SecondaryButton>
    </div>
  )
}

import { useState } from 'react'
import { Pencil, Plus, Search, X } from 'lucide-react'
import {
  Chip,
  CtaTray,
  PrimaryButton,
  ProductThumb,
  Sheet,
  TextButton,
} from '@/components/ds'
import { formatSize } from '@/components/inventory/format'
import { ProductSearch } from '@/components/inventory/product-search'
import type { Selection } from '@/components/inventory/types'
import { SpaceSelect } from '@/components/spaces/space-select'
import { cn } from '@/lib/utils'
import { isImportable, rowIssues } from './api'
import type { ReceiptCandidate, RowChoice, RowState } from './types'

interface ReceiptPreviewStepProps {
  crewId: string
  rows: RowState[]
  onChange: (rows: RowState[]) => void
  spaceId: string
  onSpaceChange: (id: string) => void
  validUnits: string[]
  importing: boolean
  onBack: () => void
  onImport: () => void
}

/** Pull a ProductRow out of any ProductSearch selection. */
function productFromSelection(selection: Selection): {
  product_id: string
  name: string
} {
  if (selection.kind === 'restock') return selection.item.product
  return selection.product
}

export function ReceiptPreviewStep({
  crewId,
  rows,
  onChange,
  spaceId,
  onSpaceChange,
  validUnits,
  importing,
  onBack,
  onImport,
}: ReceiptPreviewStepProps) {
  // Which row's "search catalog" sheet is open (null = none).
  const [searchRowId, setSearchRowId] = useState<number | null>(null)
  // Why the last import tap was blocked (null = not blocked).
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const unitSet = new Set(validUnits)

  function update(id: number, patch: Partial<RowState>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function setChoice(id: number, choice: RowChoice) {
    update(id, { choice })
  }

  const included = rows.filter((r) => r.included)
  const ready = included.filter((r) => isImportable(r, unitSet))
  const unresolved = included.length - ready.length

  // Explain why the import can't run instead of silently disabling the
  // CTA (a disabled-only gate reads as a dead button).
  function handleImportClick() {
    if (!spaceId) {
      setBlockedMessage('Pick a space to shelve these items.')
      return
    }
    if (ready.length === 0) {
      setBlockedMessage('Nothing to add yet — include at least one line.')
      return
    }
    if (unresolved > 0) {
      setBlockedMessage(
        unresolved === 1
          ? '1 line still needs review — fix or exclude it above.'
          : `${unresolved} lines still need review — fix or exclude them above.`,
      )
      return
    }
    setBlockedMessage(null)
    onImport()
  }

  const searchRow = rows.find((r) => r.id === searchRowId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <SpaceSelect
        crewId={crewId}
        value={spaceId}
        onChange={onSpaceChange}
        label="Shelve everything to"
        required
      />

      <div className="flex flex-wrap gap-2">
        <Chip variant="sage">{ready.length} ready</Chip>
        {unresolved > 0 && (
          <Chip variant="warn">{unresolved} need review</Chip>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <RowCard
            key={row.id}
            row={row}
            validUnits={validUnits}
            unitSet={unitSet}
            onUpdate={(patch) => update(row.id, patch)}
            onChoose={(choice) => setChoice(row.id, choice)}
            onOpenSearch={() => setSearchRowId(row.id)}
          />
        ))}
      </ul>

      {blockedMessage && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700"
        >
          {blockedMessage}
        </p>
      )}

      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={importing}
          onClick={handleImportClick}
        >
          {importing
            ? 'Adding…'
            : `Add ${ready.length} item${ready.length === 1 ? '' : 's'}`}
        </PrimaryButton>
        <TextButton type="button" onClick={onBack} disabled={importing}>
          Retake photo
        </TextButton>
      </CtaTray>

      <Sheet
        open={searchRow !== null}
        onClose={() => setSearchRowId(null)}
        ariaLabel="Find a product"
        title={searchRow ? `Match “${searchRow.rawText}”` : undefined}
      >
        {searchRow && (
          <ProductSearch
            crewId={crewId}
            initialQuery={searchRow.canonicalName}
            onSelect={(selection) => {
              const product = productFromSelection(selection)
              setChoice(searchRow.id, {
                kind: 'product',
                productId: product.product_id,
                productName: product.name,
              })
              setSearchRowId(null)
            }}
            onCreateCustom={() => {
              setChoice(searchRow.id, {
                kind: 'create',
                name: searchRow.canonicalName,
              })
              setSearchRowId(null)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

interface RowCardProps {
  row: RowState
  validUnits: string[]
  unitSet: Set<string>
  onUpdate: (patch: Partial<RowState>) => void
  onChoose: (choice: RowChoice) => void
  onOpenSearch: () => void
}

function RowCard({
  row,
  validUnits,
  unitSet,
  onUpdate,
  onChoose,
  onOpenSearch,
}: RowCardProps) {
  const issues = rowIssues(row, unitSet)
  const unitUnknown = !unitSet.has(row.unit)

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl bg-paper-100 p-3',
        !row.included && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 font-mono text-xs text-ink-500">
          {row.rawText}
        </span>
        <button
          type="button"
          aria-label={row.included ? 'Exclude this line' : 'Include this line'}
          aria-pressed={!row.included}
          onClick={() => onUpdate({ included: !row.included })}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-500 transition hover:bg-paper-250"
        >
          <X size={16} />
        </button>
      </div>

      {/* Resolution */}
      <ResolutionControl
        row={row}
        onChoose={onChoose}
        onOpenSearch={onOpenSearch}
      />

      {/* Quantity / unit / price */}
      <div className="flex flex-wrap items-end gap-3">
        <NumberInput
          label="Qty"
          value={row.quantity}
          width="w-20"
          onChange={(v) => onUpdate({ quantity: v })}
        />
        <label className="flex flex-col gap-1">
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.3px] text-ink-700">
            Unit
          </span>
          <select
            value={row.unit}
            aria-label="Unit"
            aria-invalid={unitUnknown}
            onChange={(e) => onUpdate({ unit: e.target.value })}
            className={cn(
              'h-10 rounded-lg px-2 font-body text-sm outline-none focus:bg-paper-250',
              unitUnknown
                ? 'bg-red-50 text-red-700'
                : 'bg-paper-50 text-ink-900',
            )}
          >
            {unitUnknown && (
              <option value={row.unit}>
                {row.unit === ''
                  ? 'Pick a unit…'
                  : `${row.unit} — not recognised`}
              </option>
            )}
            {validUnits.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <NumberInput
          label="Unit price"
          value={row.unitPrice}
          width="w-24"
          prefix="$"
          onChange={(v) => onUpdate({ unitPrice: v })}
        />
      </div>

      {row.included && issues.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {issues.map((issue) => (
            <li key={issue} className="font-body text-xs text-error">
              {issue}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function ResolutionControl({
  row,
  onChoose,
  onOpenSearch,
}: {
  row: RowState
  onChoose: (choice: RowChoice) => void
  onOpenSearch: () => void
}) {
  if (row.choice.kind === 'product') {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Chip variant="default">Matched</Chip>
          <span className="truncate font-display text-sm font-bold text-ink-900">
            {row.choice.productName}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-1 font-body text-xs text-sage-700"
        >
          <Pencil size={13} /> Change
        </button>
      </div>
    )
  }

  if (row.choice.kind === 'create') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Chip variant="sage">New product</Chip>
          <button
            type="button"
            onClick={onOpenSearch}
            className="font-body text-xs text-sage-700"
          >
            Pick existing instead
          </button>
        </div>
        <input
          type="text"
          aria-label="New product name"
          value={row.choice.name}
          onChange={(e) => onChoose({ kind: 'create', name: e.target.value })}
          className="h-10 w-full rounded-lg bg-paper-50 px-3 font-body text-sm text-ink-900 outline-none focus:bg-paper-250"
        />
      </div>
    )
  }

  // Unresolved: offer candidates + search + create.
  return (
    <div className="flex flex-col gap-2">
      <Chip variant="warn">Needs review</Chip>
      {row.candidates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {row.candidates.map((c: ReceiptCandidate) => {
            // Same meta line as the product picker rows: brand · variant · size.
            const meta = [
              c.brand,
              c.variant ?? null,
              formatSize(c.size_value ?? null, c.size_unit ?? null),
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <button
                key={c.product_id}
                type="button"
                onClick={() =>
                  onChoose({
                    kind: 'product',
                    productId: c.product_id,
                    productName: c.name,
                  })
                }
                className="flex items-center gap-2 rounded-full bg-paper-50 py-1 pl-1 pr-3 font-body text-xs text-ink-900 transition hover:bg-paper-250"
              >
                <ProductThumb
                  imageUrl={c.image_url}
                  name={c.name}
                  className="size-7 rounded-full"
                />
                <span className="text-left">
                  {c.name}
                  {meta ? <span className="text-ink-500"> · {meta}</span> : null}
                </span>
              </button>
            )
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-1 font-body text-xs text-sage-700"
        >
          <Search size={13} /> Search catalog
        </button>
        <button
          type="button"
          onClick={() => onChoose({ kind: 'create', name: row.canonicalName })}
          className="flex items-center gap-1 font-body text-xs text-sage-700"
        >
          <Plus size={13} /> Create “{row.canonicalName}”
        </button>
      </div>
    </div>
  )
}

function NumberInput({
  label,
  value,
  onChange,
  width,
  prefix,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  width: string
  prefix?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-[11px] font-bold uppercase tracking-[0.3px] text-ink-700">
        {label}
      </span>
      <div
        className={cn(
          'flex h-10 items-center rounded-lg bg-paper-50 px-2 focus-within:bg-paper-250',
          width,
        )}
      >
        {prefix && <span className="pr-1 font-body text-sm text-ink-500">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          aria-label={label}
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange(v === '' ? null : Number(v))
          }}
          className="w-full bg-transparent font-body text-sm text-ink-900 outline-none"
        />
      </div>
    </label>
  )
}

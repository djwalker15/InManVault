import { Chip, CtaTray, PrimaryButton, ProductThumb, TextButton } from '@/components/ds'
import type { ResolvedRow } from './types'

interface PreviewStepProps {
  rows: ResolvedRow[]
  importing: boolean
  onBack: () => void
  onImport: () => void
}

function ProductChip({ row }: { row: ResolvedRow }) {
  if (!row.valid) return <Chip variant="error">Needs fix</Chip>
  if (row.productResolution === 'new') return <Chip variant="sage">New product</Chip>
  if (row.productResolution === 'ambiguous')
    return <Chip variant="warn">Multiple matches</Chip>
  return <Chip variant="default">Matched</Chip>
}

export function PreviewStep({
  rows,
  importing,
  onBack,
  onImport,
}: PreviewStepProps) {
  const ready = rows.filter((r) => r.valid)
  const skipped = rows.length - ready.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Chip variant="sage">{ready.length} ready to import</Chip>
        {skipped > 0 && <Chip variant="error">{skipped} will be skipped</Chip>}
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.index}
            className="flex items-start justify-between gap-3 rounded-xl bg-paper-100 p-3"
          >
            <ProductThumb
              imageUrl={row.productImageUrl}
              name={row.displayName}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-display text-sm font-bold text-ink-900">
                {row.displayName}
              </span>
              <span className="font-body text-xs text-ink-600">
                {row.quantity ?? '?'} {row.unit} · {row.locationLabel}
                {row.locationResolution === 'defaulted' && ' (default)'}
              </span>
              {!row.valid && (
                <span className="mt-1 font-body text-xs text-error">
                  {row.issues.join(' · ')}
                </span>
              )}
            </div>
            <ProductChip row={row} />
          </li>
        ))}
      </ul>

      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={importing || ready.length === 0}
          onClick={onImport}
        >
          {importing
            ? 'Importing…'
            : `Import ${ready.length} item${ready.length === 1 ? '' : 's'}`}
        </PrimaryButton>
        <TextButton type="button" onClick={onBack} disabled={importing}>
          Back to mapping
        </TextButton>
      </CtaTray>
    </div>
  )
}

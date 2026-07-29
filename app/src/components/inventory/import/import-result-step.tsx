import { CheckCircle2 } from 'lucide-react'
import { CtaTray, PrimaryButton, TextButton } from '@/components/ds'

export interface ImportError {
  index: number
  message: string
}

/** A row dropped before the RPC (failed local validation), with reasons. */
export interface SkippedRow {
  index: number
  issues: string[]
}

interface ImportResultStepProps {
  imported: number
  errors: ImportError[]
  /** Rows dropped before the RPC (failed local validation). */
  skippedLocal: SkippedRow[]
  onDone: () => void
  onAnother: () => void
  /** Label for the secondary "start over" action. */
  anotherLabel?: string
}

export function ImportResultStep({
  imported,
  errors,
  skippedLocal,
  onDone,
  onAnother,
  anotherLabel = 'Import another file',
}: ImportResultStepProps) {
  const skipped = skippedLocal.length + errors.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-2xl bg-sage-100/40 p-4">
        <span
          aria-hidden
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-700 text-white"
        >
          <CheckCircle2 size={20} />
        </span>
        <div className="flex flex-col">
          <p className="font-display text-base font-bold text-ink-900">
            Imported {imported} item{imported === 1 ? '' : 's'}.
          </p>
          {skipped > 0 && (
            <p className="font-body text-sm text-ink-700">
              {skipped} row{skipped === 1 ? '' : 's'} skipped.
            </p>
          )}
        </div>
      </div>

      {skipped > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
            Skipped rows
          </h2>
          <ul className="flex flex-col gap-1">
            {skippedLocal.map((s) => (
              <li
                key={`local-${s.index}`}
                className="rounded-lg bg-paper-100 px-3 py-2 font-body text-xs text-ink-700"
              >
                Row {s.index + 1}: {s.issues.join(' ')}
              </li>
            ))}
            {errors.map((e) => (
              <li
                key={`rpc-${e.index}`}
                className="rounded-lg bg-paper-100 px-3 py-2 font-body text-xs text-ink-700"
              >
                Row {e.index + 1}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CtaTray sticky={false}>
        <PrimaryButton arrow type="button" onClick={onDone}>
          Go to inventory
        </PrimaryButton>
        <TextButton type="button" onClick={onAnother}>
          {anotherLabel}
        </TextButton>
      </CtaTray>
    </div>
  )
}

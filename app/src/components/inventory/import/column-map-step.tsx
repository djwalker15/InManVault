import { CtaTray, PrimaryButton, TextButton } from '@/components/ds'
import {
  FIELD_LABELS,
  REQUIRED_FIELDS,
  type FieldMapping,
  type InmanField,
  type ParsedFile,
} from './types'

const ALL_FIELDS: InmanField[] = [
  'name',
  'brand',
  'variant',
  'quantity',
  'unit',
  'location',
  'category',
  'barcode',
  'notes',
]

interface ColumnMapStepProps {
  parsed: ParsedFile
  mapping: FieldMapping
  onMappingChange: (m: FieldMapping) => void
  defaultUnit: string
  onDefaultUnitChange: (u: string) => void
  units: string[]
  onBack: () => void
  onContinue: () => void
}

/** Required fields that are neither mapped nor (for unit) covered by a default. */
function unmappedRequired(
  mapping: FieldMapping,
  defaultUnit: string,
): InmanField[] {
  return REQUIRED_FIELDS.filter((f) => {
    if (mapping[f]) return false
    if (f === 'unit' && defaultUnit) return false
    return true
  })
}

export function ColumnMapStep({
  parsed,
  mapping,
  onMappingChange,
  defaultUnit,
  onDefaultUnitChange,
  units,
  onBack,
  onContinue,
}: ColumnMapStepProps) {
  const missing = unmappedRequired(mapping, defaultUnit)

  return (
    <div className="flex flex-col gap-5">
      <p className="font-body text-sm text-ink-700">
        We found {parsed.rows.length} row{parsed.rows.length === 1 ? '' : 's'}.
        Match your columns to InMan fields. Required fields are marked.
      </p>

      <ul className="flex flex-col gap-3">
        {ALL_FIELDS.map((field) => {
          const required = REQUIRED_FIELDS.includes(field)
          return (
            <li key={field} className="flex flex-col gap-2">
              <label className="flex flex-col gap-2">
                <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
                  {FIELD_LABELS[field]}
                  {required && <span className="ml-1 text-sage-700">*</span>}
                </span>
                <select
                  value={mapping[field] ?? ''}
                  onChange={(e) =>
                    onMappingChange({
                      ...mapping,
                      [field]: e.target.value || null,
                    })
                  }
                  className="h-12 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
                >
                  <option value="">— Not mapped —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>

              {field === 'unit' && !mapping.unit && (
                <label className="ml-3 flex items-center gap-2">
                  <span className="font-body text-xs text-ink-600">
                    Default unit for every row:
                  </span>
                  <select
                    aria-label="Default unit"
                    value={defaultUnit}
                    onChange={(e) => onDefaultUnitChange(e.target.value)}
                    className="h-10 rounded-lg bg-paper-100 px-2 font-body text-sm text-ink-900 outline-none focus:bg-paper-250"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </li>
          )
        })}
      </ul>

      {missing.length > 0 && (
        <p className="rounded-md bg-[color:rgba(217,119,6,0.12)] px-3 py-2 font-body text-sm text-warn">
          Map a column for: {missing.map((f) => FIELD_LABELS[f]).join(', ')}.
        </p>
      )}

      <CtaTray sticky={false}>
        <PrimaryButton
          arrow
          type="button"
          disabled={missing.length > 0}
          onClick={onContinue}
        >
          Preview import
        </PrimaryButton>
        <TextButton type="button" onClick={onBack}>
          Choose a different file
        </TextButton>
      </CtaTray>
    </div>
  )
}

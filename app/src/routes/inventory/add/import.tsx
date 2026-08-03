import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import { ColumnMapStep } from '@/components/inventory/import/column-map-step'
import {
  ImportResultStep,
  type ImportError,
  type SkippedRow,
} from '@/components/inventory/import/import-result-step'
import { PreviewStep } from '@/components/inventory/import/preview-step'
import { UploadStep } from '@/components/inventory/import/upload-step'
import { parseFile } from '@/components/inventory/import/parse'
import {
  guessMapping,
  resolveRows,
  toPayloadRow,
} from '@/components/inventory/import/resolve'
import type {
  FieldMapping,
  ParsedFile,
  ResolvedRow,
} from '@/components/inventory/import/types'
import {
  PRODUCT_COLUMNS,
  type ProductRow,
} from '@/components/inventory/types'
import { useActiveCrew } from '@/lib/active-crew'
import { useSupabase } from '@/lib/supabase'

type Step = 'upload' | 'map' | 'preview' | 'result'

function distinct(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v.length > 0)))
}

export default function BulkImportPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const supabase = useSupabase()
  const { loading: crewLoading, activeCrewId } = useActiveCrew(
    user?.id ?? null,
  )

  const [step, setStep] = useState<Step>('upload')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<FieldMapping>({})
  const [defaultUnit, setDefaultUnit] = useState('count')
  const [units, setUnits] = useState<string[]>([])
  const [resolved, setResolved] = useState<ResolvedRow[]>([])
  const [result, setResult] = useState<{
    imported: number
    errors: ImportError[]
    skippedLocal: SkippedRow[]
  } | null>(null)

  // Units power the default-unit dropdown and resolution validation.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('unit_definitions')
        .select('unit')
        .order('unit', { ascending: true })
      if (cancelled) return
      const list = Array.isArray(data)
        ? (data as { unit: string }[]).map((u) => u.unit)
        : []
      setUnits(list)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  function reset() {
    setStep('upload')
    setParsed(null)
    setMapping({})
    setResolved([])
    setResult(null)
    setError(null)
    setFileName('')
  }

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    try {
      const result = await parseFile(file)
      if (result.headers.length === 0 || result.rows.length === 0) {
        setError('That file has no header row or no data rows.')
        return
      }
      setFileName(file.name)
      setParsed(result)
      setMapping(guessMapping(result.headers))
      setStep('map')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  async function loadCandidateProducts(p: ParsedFile): Promise<ProductRow[]> {
    const nameCol = mapping.name
    const barcodeCol = mapping.barcode
    const names = nameCol
      ? distinct(p.rows.map((r) => (r[nameCol] ?? '').trim())).slice(0, 1000)
      : []
    const barcodes = barcodeCol
      ? distinct(p.rows.map((r) => (r[barcodeCol] ?? '').trim())).slice(0, 1000)
      : []

    const byId = new Map<string, ProductRow>()
    const queries = []
    if (barcodes.length > 0) {
      queries.push(
        supabase
          .from('products')
          .select(PRODUCT_COLUMNS)
          .is('deleted_at', null)
          .in('barcode', barcodes),
      )
    }
    if (names.length > 0) {
      queries.push(
        supabase
          .from('products')
          .select(PRODUCT_COLUMNS)
          .is('deleted_at', null)
          .in('name', names),
      )
    }
    for (const q of queries) {
      const { data } = await q
      if (Array.isArray(data)) {
        for (const row of data as ProductRow[]) byId.set(row.product_id, row)
      }
    }
    return Array.from(byId.values())
  }

  async function handlePreview() {
    if (!parsed || !activeCrewId) return
    setBusy(true)
    setError(null)
    try {
      const [products, { data: spaceData }, { data: catData }] =
        await Promise.all([
          loadCandidateProducts(parsed),
          supabase
            .from('spaces')
            .select('space_id, name, parent_id')
            .eq('crew_id', activeCrewId)
            .is('deleted_at', null),
          supabase
            .from('categories')
            .select('category_id, name')
            .is('deleted_at', null),
        ])
      const spaces = Array.isArray(spaceData)
        ? (spaceData as { space_id: string; name: string; parent_id: string | null }[])
        : []
      const categories = Array.isArray(catData)
        ? (catData as { category_id: string; name: string }[])
        : []
      const premises = spaces.find((s) => s.parent_id === null)
      const rows = resolveRows({
        parsed,
        mapping,
        defaults: { unit: defaultUnit, defaultSpaceId: premises?.space_id ?? null },
        products,
        spaces,
        categories,
        validUnits: units,
      })
      setResolved(rows)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the preview.')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!activeCrewId) return
    const valid = resolved.filter((r) => r.valid)
    // Keep each dropped row's reasons so the result screen can explain
    // the skip instead of only counting it.
    const skippedLocal: SkippedRow[] = resolved
      .filter((r) => !r.valid)
      .map((r) => ({ index: r.index, issues: r.issues }))
    setBusy(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc(
        'bulk_import_inventory',
        { p_crew_id: activeCrewId, p_rows: valid.map(toPayloadRow) },
      )
      if (rpcError) throw rpcError
      const summary = (data ?? {}) as {
        imported?: number
        errors?: { index: number; message: string }[]
      }
      // Map RPC payload indexes back to original file row numbers.
      const errors: ImportError[] = (summary.errors ?? []).map((e) => ({
        index: valid[e.index]?.index ?? e.index,
        message: e.message,
      }))
      setResult({ imported: summary.imported ?? 0, errors, skippedLocal })
      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
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
            Bulk import
          </h1>
        </header>

        {fileName && step !== 'upload' && step !== 'result' && (
          <p className="font-body text-xs text-ink-500">From {fileName}</p>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            {error}
          </p>
        )}

        {crewLoading ? (
          <p className="font-body text-sm text-ink-600">Loading…</p>
        ) : !activeCrewId || !user ? (
          <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            We couldn't load your crew. Finish onboarding first.
          </p>
        ) : step === 'upload' ? (
          <UploadStep busy={busy} error={null} onFile={handleFile} />
        ) : step === 'map' && parsed ? (
          <ColumnMapStep
            parsed={parsed}
            mapping={mapping}
            onMappingChange={setMapping}
            defaultUnit={defaultUnit}
            onDefaultUnitChange={setDefaultUnit}
            units={units}
            onBack={reset}
            onContinue={handlePreview}
          />
        ) : step === 'preview' ? (
          <PreviewStep
            rows={resolved}
            importing={busy}
            onBack={() => setStep('map')}
            onImport={handleImport}
          />
        ) : step === 'result' && result ? (
          <ImportResultStep
            imported={result.imported}
            errors={result.errors}
            skippedLocal={result.skippedLocal}
            onDone={() => navigate('/inventory')}
            onAnother={reset}
          />
        ) : (
          <p className="font-body text-sm text-ink-600">Loading…</p>
        )}
      </div>
    </SignedInLayout>
  )
}

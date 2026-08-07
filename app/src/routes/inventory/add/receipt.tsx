import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import {
  ImportResultStep,
  type ImportError,
  type SkippedRow,
} from '@/components/inventory/import/import-result-step'
import { ReceiptCaptureStep } from '@/components/inventory/receipt/capture-step'
import { ReceiptPreviewStep } from '@/components/inventory/receipt/preview-step'
import {
  isImportable,
  parseReceipt,
  rowIssues,
  toPayloadRows,
  writeAliases,
} from '@/components/inventory/receipt/api'
import { downscaleImage } from '@/lib/downscale'
import { toRowState, type RowState } from '@/components/inventory/receipt/types'
import { useActiveCrew } from '@/lib/active-crew'
import { useSupabase } from '@/lib/supabase'

type Step = 'capture' | 'preview' | 'result'

export default function ReceiptScanPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const supabase = useSupabase()
  const { loading: crewLoading, activeCrewId } = useActiveCrew(
    user?.id ?? null,
  )

  const [step, setStep] = useState<Step>('capture')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [units, setUnits] = useState<string[]>([])
  const [merchant, setMerchant] = useState<string | null>(null)
  const [rows, setRows] = useState<RowState[]>([])
  const [spaceId, setSpaceId] = useState('')
  const [result, setResult] = useState<{
    imported: number
    errors: ImportError[]
    skippedLocal: SkippedRow[]
  } | null>(null)

  // Units validate the per-row unit dropdown. Root space seeds the
  // "shelve everything to" default (intake defers to Premises).
  useEffect(() => {
    if (!activeCrewId) return
    let cancelled = false
    async function load() {
      const [{ data: unitData }, { data: spaceData }] = await Promise.all([
        supabase
          .from('unit_definitions')
          .select('unit')
          .order('unit', { ascending: true }),
        supabase
          .from('spaces')
          .select('space_id, parent_id')
          .eq('crew_id', activeCrewId)
          .is('deleted_at', null),
      ])
      if (cancelled) return
      setUnits(
        Array.isArray(unitData)
          ? (unitData as { unit: string }[]).map((u) => u.unit)
          : [],
      )
      const spaces = Array.isArray(spaceData)
        ? (spaceData as { space_id: string; parent_id: string | null }[])
        : []
      const premises = spaces.find((s) => s.parent_id === null)
      if (premises) setSpaceId((prev) => prev || premises.space_id)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, activeCrewId])

  function reset() {
    setStep('capture')
    setRows([])
    setMerchant(null)
    setResult(null)
    setError(null)
  }

  async function handleCapture(file: File) {
    if (!activeCrewId) return
    setBusy(true)
    setError(null)
    try {
      const image = await downscaleImage(file)
      const parsed = await parseReceipt(supabase, { image, crewId: activeCrewId })
      if (parsed.rows.length === 0) {
        setError("We couldn't find any items on that receipt. Try another photo.")
        return
      }
      setMerchant(parsed.merchant)
      setRows(parsed.rows.map((r, i) => toRowState(r, i)))
      setStep('preview')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not read that receipt.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!activeCrewId || !spaceId) return
    const unitSet = new Set(units)
    const payload = toPayloadRows(rows, spaceId, unitSet)
    // Keep each dropped row's reasons so the result screen can explain
    // the skip instead of only counting it.
    const skippedLocal: SkippedRow[] = rows
      .filter((r) => r.included && !isImportable(r, unitSet))
      .map((r) => ({ index: r.id, issues: rowIssues(r, unitSet) }))
    setBusy(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc(
        'bulk_import_inventory',
        { p_crew_id: activeCrewId, p_rows: payload, p_source: 'receipt_scan' },
      )
      if (rpcError) throw rpcError
      const summary = (data ?? {}) as {
        imported?: number
        errors?: { index: number; message: string }[]
      }
      // Map RPC payload indexes back to importable-row positions.
      const importable = rows.filter((r) => isImportable(r, unitSet))
      const errors: ImportError[] = (summary.errors ?? []).map((e) => ({
        index: importable[e.index]?.id ?? e.index,
        message: e.message,
      }))
      // Learn the confirmed mappings so the next receipt auto-resolves.
      await writeAliases(supabase, activeCrewId, merchant, rows)
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
            Scan a receipt
          </h1>
        </header>

        {merchant && step === 'preview' && (
          <p className="font-body text-xs text-ink-500">From {merchant}</p>
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
        ) : step === 'capture' ? (
          <ReceiptCaptureStep
            busy={busy}
            error={null}
            onCapture={handleCapture}
          />
        ) : step === 'preview' ? (
          <ReceiptPreviewStep
            crewId={activeCrewId}
            rows={rows}
            onChange={setRows}
            spaceId={spaceId}
            onSpaceChange={setSpaceId}
            validUnits={units}
            importing={busy}
            onBack={reset}
            onImport={handleImport}
          />
        ) : step === 'result' && result ? (
          <ImportResultStep
            imported={result.imported}
            errors={result.errors}
            skippedLocal={result.skippedLocal}
            onDone={() => navigate('/inventory')}
            onAnother={reset}
            anotherLabel="Scan another receipt"
          />
        ) : (
          <p className="font-body text-sm text-ink-600">Loading…</p>
        )}
      </div>
    </SignedInLayout>
  )
}

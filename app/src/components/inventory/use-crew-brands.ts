import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSupabase } from '@/lib/supabase'

/**
 * Cap on the rows pulled for a suggestion list. PostgREST has no DISTINCT, so
 * this is a scan of every visible product — the master catalog seeds ~227
 * branded rows and a crew's own products are a rounding error on top of that.
 */
const SUGGESTION_ROW_LIMIT = 2000

export interface DistinctProductValues {
  /** Deduped, alphabetically sorted values visible to the crew. */
  values: string[]
  /**
   * Snap a typed value onto an existing spelling when the only difference is
   * case ("kraft" → "Kraft"). Anything genuinely new comes back untouched.
   */
  canonicalize: (input: string) => string
}

export function useDistinctProductValues(
  column: 'brand' | 'variant',
): DistinctProductValues {
  const supabase = useSupabase()
  const [rawValues, setRawValues] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      // No crew_id filter: the products_select RLS policy already exposes the
      // master catalog (crew_id is null) plus this crew's rows, and filtering
      // by crew here would throw the catalog away.
      const { data } = await supabase
        .from('products')
        .select(column)
        .not(column, 'is', null)
        .is('deleted_at', null)
        .limit(SUGGESTION_ROW_LIMIT)
      if (cancelled) return
      const rows = (Array.isArray(data) ? data : []) as Record<
        string,
        string | null
      >[]
      setRawValues(
        rows
          .map((r) => r[column]?.trim() ?? '')
          .filter((v): v is string => v.length > 0),
      )
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, column])

  // Case-insensitive dedupe, first spelling seen wins as the canonical one.
  const byLowercase = useMemo(() => {
    const map = new Map<string, string>()
    for (const value of rawValues) {
      const key = value.toLowerCase()
      if (!map.has(key)) map.set(key, value)
    }
    return map
  }, [rawValues])

  const values = useMemo(
    () => Array.from(byLowercase.values()).sort((a, b) => a.localeCompare(b)),
    [byLowercase],
  )

  const canonicalize = useCallback(
    (input: string) => {
      const trimmed = input.trim()
      if (!trimmed) return trimmed
      return byLowercase.get(trimmed.toLowerCase()) ?? trimmed
    },
    [byLowercase],
  )

  return { values, canonicalize }
}

export interface CrewBrands {
  /** Deduped, alphabetically sorted brands visible to the crew. */
  brands: string[]
  canonicalize: (input: string) => string
}

export function useCrewBrands(): CrewBrands {
  const { values, canonicalize } = useDistinctProductValues('brand')
  return { brands: values, canonicalize }
}

export interface CrewVariants {
  /** Deduped, alphabetically sorted variant descriptors visible to the crew. */
  variants: string[]
  canonicalize: (input: string) => string
}

export function useCrewVariants(): CrewVariants {
  const { values, canonicalize } = useDistinctProductValues('variant')
  return { variants: values, canonicalize }
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSupabase } from '@/lib/supabase'

/**
 * Cap on the rows pulled for the brand list. PostgREST has no DISTINCT, so this
 * is a scan of every visible product — the master catalog seeds ~227 branded
 * rows and a crew's own products are a rounding error on top of that.
 */
const BRAND_ROW_LIMIT = 2000

export interface CrewBrands {
  /** Deduped, alphabetically sorted brands visible to the crew. */
  brands: string[]
  /**
   * Snap a typed brand onto an existing spelling when the only difference is
   * case ("kraft" → "Kraft"). Anything genuinely new comes back untouched.
   */
  canonicalize: (input: string) => string
}

export function useCrewBrands(): CrewBrands {
  const supabase = useSupabase()
  const [rawBrands, setRawBrands] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      // No crew_id filter: the products_select RLS policy already exposes the
      // master catalog (crew_id is null) plus this crew's rows, and filtering
      // by crew here would throw the catalog away.
      const { data } = await supabase
        .from('products')
        .select('brand')
        .not('brand', 'is', null)
        .is('deleted_at', null)
        .limit(BRAND_ROW_LIMIT)
      if (cancelled) return
      const rows = (Array.isArray(data) ? data : []) as { brand: string | null }[]
      setRawBrands(
        rows
          .map((r) => r.brand?.trim() ?? '')
          .filter((b): b is string => b.length > 0),
      )
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Case-insensitive dedupe, first spelling seen wins as the canonical one.
  const byLowercase = useMemo(() => {
    const map = new Map<string, string>()
    for (const brand of rawBrands) {
      const key = brand.toLowerCase()
      if (!map.has(key)) map.set(key, brand)
    }
    return map
  }, [rawBrands])

  const brands = useMemo(
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

  return { brands, canonicalize }
}

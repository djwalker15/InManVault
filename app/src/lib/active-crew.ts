import { useEffect, useState } from 'react'
import { useSupabase } from './supabase'

/**
 * Active-crew preference plumbing.
 *
 * Each user can be a member of multiple Crews. When the user has more
 * than one membership, we pin the "active" one to localStorage so the
 * dashboard / inventory / spaces views all reflect the same crew. If
 * the stored preference points at a crew the user has since been
 * removed from (or which has been soft-deleted), we silently fall back
 * to the most-recently-created active membership.
 *
 * The preference is keyed by Clerk user_id so it survives sign-outs of
 * other users on the same device.
 */

const STORAGE_PREFIX = 'inman:active-crew:'

export interface CrewMembership {
  crew_id: string
  role: string
  crew_name: string
  is_owner: boolean
}

export interface ActiveCrewState {
  loading: boolean
  error: string | null
  /** All active memberships for the signed-in user. */
  memberships: CrewMembership[]
  /** The selected crew (preference or most-recent fallback). */
  activeCrewId: string | null
  /** Switch to a different crew the user is a member of. */
  setActive: (crewId: string) => void
}

export function readPreference(userId: string): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_PREFIX + userId)
}

export function writePreference(userId: string, crewId: string | null): void {
  if (typeof window === 'undefined') return
  if (crewId === null) {
    window.localStorage.removeItem(STORAGE_PREFIX + userId)
  } else {
    window.localStorage.setItem(STORAGE_PREFIX + userId, crewId)
  }
}

interface RawCrew {
  name: string
  owner_id: string
}
/**
 * Supabase typing for foreign-table joins is permissive — the result
 * shape can be a single row or an array depending on the cardinality.
 * We accept both and normalize at read time.
 */
interface RawRow {
  crew_id: string
  role: string
  crews: RawCrew | RawCrew[] | null
}

export function useActiveCrew(userId: string | null): ActiveCrewState {
  const supabase = useSupabase()
  const [memberships, setMemberships] = useState<CrewMembership[]>([])
  // Initial loading reflects whether we'll actually run the effect: if
  // we already know there's no auth context, skip straight to "not
  // loading" so we don't have to setState from inside the effect's
  // early-return branch (react-hooks/set-state-in-effect).
  const [loading, setLoading] = useState(() => Boolean(userId && supabase))
  const [error, setError] = useState<string | null>(null)
  const [override, setOverride] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !supabase) return
    const safeUserId: string = userId
    let cancelled = false
    async function load() {
      const { data, error: queryError } = await supabase
        .from('crew_members')
        .select('crew_id, role, crews(name, owner_id)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (queryError) {
        setError(queryError.message ?? 'Failed to load crews.')
        setLoading(false)
        return
      }
      const rows = (Array.isArray(data) ? data : []) as RawRow[]
      const next: CrewMembership[] = []
      for (const r of rows) {
        const crew = Array.isArray(r.crews) ? r.crews[0] : r.crews
        if (!crew) continue
        next.push({
          crew_id: r.crew_id,
          role: r.role,
          crew_name: crew.name,
          is_owner: crew.owner_id === safeUserId,
        })
      }
      setMemberships(next)
      // Re-validate the stored preference against current memberships.
      const stored = readPreference(safeUserId)
      if (stored && next.some((m) => m.crew_id === stored)) {
        setOverride(stored)
      } else {
        setOverride(null)
        if (stored) writePreference(safeUserId, null)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  const activeCrewId =
    override ??
    (memberships.length > 0 ? memberships[0].crew_id : null)

  function setActive(crewId: string) {
    if (!userId) return
    if (!memberships.some((m) => m.crew_id === crewId)) return
    writePreference(userId, crewId)
    setOverride(crewId)
  }

  return {
    loading,
    error,
    memberships,
    activeCrewId,
    setActive,
  }
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Chip, PrimaryButton, SecondaryButton } from '@/components/ds'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import { useActiveCrew, type CrewMembership } from '@/lib/active-crew'
import { useSupabase } from '@/lib/supabase'

export default function CrewsPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const { loading, error, memberships, activeCrewId, setActive } =
    useActiveCrew(user?.id ?? null)
  const supabase = useSupabase()
  const [leaving, setLeaving] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleLeave(crew: CrewMembership) {
    if (crew.is_owner) return
    const confirmed = window.confirm(
      `Leave "${crew.crew_name}"? You will lose access to all of its data. You can rejoin if invited again.`,
    )
    if (!confirmed) return
    setLeaving(crew.crew_id)
    setActionError(null)
    try {
      const { error: rpcError } = await supabase.rpc('leave_crew', {
        p_crew_id: crew.crew_id,
      })
      if (rpcError) throw rpcError
      // Pop the user back to the dashboard so the active-crew query
      // re-resolves against their remaining memberships.
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to leave.')
    } finally {
      setLeaving(null)
    }
  }

  return (
    <SignedInLayout>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 pt-4 pb-12">
        <header className="flex items-center gap-2">
          <Link
            to="/dashboard"
            aria-label="Back to dashboard"
            className="flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </Link>
          <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.4px] text-ink-900">
            Crews
          </h1>
        </header>

        {loading ? (
          <p className="font-body text-sm text-ink-600">Loading…</p>
        ) : error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            {error}
          </p>
        ) : memberships.length === 0 ? (
          <section className="flex flex-col gap-3 rounded-2xl bg-paper-100 p-6">
            <h2 className="font-display text-xl font-bold text-ink-900">
              You're not in any Crews
            </h2>
            <p className="font-body text-base leading-6 text-ink-700">
              Create one to start tracking inventory, or accept an invite from
              someone in an existing Crew.
            </p>
            <Link to="/onboarding" className="self-start">
              <PrimaryButton arrow>Set up a Crew</PrimaryButton>
            </Link>
          </section>
        ) : (
          <ul aria-label="Your crews" className="flex flex-col gap-3">
            {memberships.map((crew) => {
              const isActive = crew.crew_id === activeCrewId
              const isLeaving = leaving === crew.crew_id
              return (
                <li
                  key={crew.crew_id}
                  className="flex flex-col gap-2 rounded-2xl bg-paper-50 p-4 shadow-ambient-sm"
                  aria-current={isActive ? 'true' : undefined}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-bold text-ink-900">
                      {crew.crew_name}
                    </h2>
                    <Chip variant={crew.is_owner ? 'sage' : 'default'}>
                      {crew.is_owner ? 'Owner' : capitalize(crew.role)}
                    </Chip>
                    {isActive && (
                      <span className="font-body text-xs text-ink-600">
                        · Active
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isActive && (
                      <SecondaryButton
                        type="button"
                        onClick={() => setActive(crew.crew_id)}
                        className="!h-10 !w-auto px-3 !text-sm"
                      >
                        Switch to this crew
                      </SecondaryButton>
                    )}
                    {(crew.is_owner || crew.role === 'admin') && (
                      <Link to={`/crew/settings?crew=${crew.crew_id}`}>
                        <SecondaryButton
                          type="button"
                          className="!h-10 !w-auto px-3 !text-sm"
                        >
                          Settings
                        </SecondaryButton>
                      </Link>
                    )}
                    {!crew.is_owner && (
                      <button
                        type="button"
                        onClick={() => void handleLeave(crew)}
                        disabled={isLeaving}
                        className="inline-flex h-10 items-center justify-center rounded-xl px-3 font-display text-sm font-bold text-error transition hover:bg-paper-100 disabled:opacity-60"
                      >
                        {isLeaving ? 'Leaving…' : 'Leave'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {actionError && (
          <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            {actionError}
          </p>
        )}

        <Link to="/onboarding" className="self-start">
          <SecondaryButton type="button" className="!w-auto px-4">
            <Plus size={16} aria-hidden />
            Create a new Crew
          </SecondaryButton>
        </Link>
      </div>
    </SignedInLayout>
  )
}

function capitalize(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { ArrowRight, Wand } from 'lucide-react'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import { HeroCard, ChecklistRow } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'

interface ChecklistStep {
  key: string
  label: string
  complete: boolean
  resumeTo?: string
}

function buildPathA(
  hasCrew: boolean,
  spacesReady: boolean,
  hasItems: boolean,
  hasInvites: boolean,
): ChecklistStep[] {
  return [
    { key: 'sign-up', label: 'Sign Up', complete: true },
    {
      key: 'crew',
      label: 'Create your Crew',
      complete: hasCrew,
      resumeTo: '/onboarding',
    },
    {
      key: 'spaces',
      label: 'Set up spaces',
      complete: spacesReady,
      resumeTo: '/onboarding/spaces',
    },
    {
      key: 'items',
      label: 'Add first items',
      complete: hasItems,
      resumeTo: '/inventory/add',
    },
    {
      key: 'invite',
      label: 'Invite crew members',
      complete: hasInvites,
      resumeTo: '/onboarding',
    },
  ]
}

function buildPathB(crewName: string): ChecklistStep[] {
  return [
    { key: 'sign-up', label: 'Sign Up', complete: true },
    { key: 'joined', label: `Joined ${crewName}`, complete: true },
    { key: 'browse-spaces', label: 'Browse your spaces', complete: false },
    { key: 'browse-inventory', label: 'Browse inventory', complete: false },
  ]
}

export default function DashboardPage() {
  const { user } = useUser()
  const supabase = useSupabase()
  const [steps, setSteps] = useState<ChecklistStep[]>(() =>
    buildPathA(false, false, false, false),
  )

  const firstName = user?.firstName ?? user?.username ?? 'there'

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Step 1: count query — preserves existing test assertions
      const { count, error: countError } = await supabase
        .from('crew_members')
        .select('crew_member_id', { count: 'exact', head: true })
        .is('deleted_at', null)
      if (cancelled) return

      const hasMembership = !countError && (count ?? 0) > 0

      if (!hasMembership) {
        setSteps(buildPathA(false, false, false, false))
        return
      }

      // Step 2: resolve role + crew_id from most recent active membership
      const { data: rawMembership } = await supabase
        .from('crew_members')
        .select('crew_id, role')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return

      const membership = rawMembership as { crew_id: string; role: string } | null

      if (!membership?.crew_id) {
        // Couldn't determine crew context — fall back to Path A with crew complete
        setSteps(buildPathA(true, false, false, false))
        return
      }

      const { crew_id: crewId, role } = membership
      const isOwnerOrAdmin = role === 'owner' || role === 'admin'

      if (!isOwnerOrAdmin) {
        // Path B — get crew name then build the short checklist
        const { data: crewData } = await supabase
          .from('crews')
          .select('name')
          .eq('crew_id', crewId)
          .single()
        if (cancelled) return
        const crewName =
          (crewData as { name: string } | null)?.name ?? 'your crew'
        setSteps(buildPathB(crewName))
        return
      }

      // Path A — fetch counts; treat missing tables (42P01) as 0
      let spacesCount = 0
      let itemsCount = 0
      let memberCount = 1
      let pendingInvites = 0

      {
        const { count: sc, error: se } = await supabase
          .from('spaces')
          .select('space_id', { count: 'exact', head: true })
          .eq('crew_id', crewId)
        if (cancelled) return
        if (!se || (se as { code?: string }).code === '42P01') {
          spacesCount = sc ?? 0
        }
      }

      {
        const { count: ic, error: ie } = await supabase
          .from('inventory_items')
          .select('inventory_item_id', { count: 'exact', head: true })
          .eq('crew_id', crewId)
        if (cancelled) return
        if (!ie || (ie as { code?: string }).code === '42P01') {
          itemsCount = ic ?? 0
        }
      }

      {
        const { count: mc } = await supabase
          .from('crew_members')
          .select('crew_member_id', { count: 'exact', head: true })
          .eq('crew_id', crewId)
          .is('deleted_at', null)
        if (cancelled) return
        memberCount = mc ?? 1
      }

      {
        const now = new Date().toISOString()
        const { count: invCount, error: invError } = await supabase
          .from('invites')
          .select('invite_id', { count: 'exact', head: true })
          .eq('crew_id', crewId)
          .eq('status', 'pending')
          .gt('expires_at', now)
        if (cancelled) return
        if (!invError || (invError as { code?: string }).code === '42P01') {
          pendingInvites = invCount ?? 0
        }
      }

      setSteps(
        buildPathA(
          true,
          spacesCount > 1,
          itemsCount > 0,
          memberCount > 1 || pendingInvites > 0,
        ),
      )
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const completed = steps.filter((s) => s.complete).length
  const pct = steps.length > 0 ? (completed / steps.length) * 100 : 0
  const nextIncomplete = steps.find((s) => !s.complete)

  return (
    <SignedInLayout>
      <section className="pb-4 pt-5">
        <h1 className="font-display text-[30px] font-bold leading-[37.5px] text-ink-900">
          Welcome, {firstName}
        </h1>
      </section>

      <section className="flex flex-col gap-2 rounded-lg bg-paper-100 p-5">
        <HeroCard
          title="Your pantry is live 🎉"
          body="Complete the steps below to finish onboarding"
          badge={<Wand className="text-white" size={20} />}
        />

        <div className="flex flex-col">
          <h2 className="font-display text-base font-semibold leading-6 text-ink-900">
            Setup Progress
          </h2>
          <div className="flex flex-col gap-3 p-2">
            <div className="flex items-baseline justify-between">
              <p className="font-body text-sm font-semibold uppercase tracking-[0.35px] text-ink-600">
                {completed}/{steps.length} Complete
              </p>
              {nextIncomplete?.resumeTo && (
                <Link
                  to={nextIncomplete.resumeTo}
                  className="flex items-center gap-2 font-body text-sm font-semibold uppercase tracking-[0.35px] text-sage-600 hover:underline"
                >
                  Resume
                  <ArrowRight size={11} strokeWidth={2.5} />
                </Link>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-300">
              <div
                className="h-full rounded-full bg-sage-700 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {steps.map((step) => (
            <li key={step.key}>
              <ChecklistRow label={step.label} complete={step.complete} />
            </li>
          ))}
        </ul>
      </section>
    </SignedInLayout>
  )
}

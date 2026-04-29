import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { HelpCircle } from 'lucide-react'
import { NavHeader, ProgressBar } from '@/components/ds'
import {
  SpacesExplainer,
} from '@/components/spaces/explainer'
import {
  readExplainerDismissed,
  writeExplainerDismissed,
} from '@/components/spaces/explainer-storage'
import { GuidedBranch } from '@/components/spaces/guided-branch'
import { PremisesForm } from '@/components/spaces/premises-form'
import { Tree } from '@/components/spaces/tree'
import type { SpaceNode } from '@/components/spaces/types'
import { useSupabase } from '@/lib/supabase'

type Phase = 'explainer' | 'premises' | 'guided' | 'editor'

interface MembershipRow {
  crew_id: string
  role: string
}

export default function OnboardingSpacesPage() {
  // TODO(P2.5): guided first-branch wizard (area → shelf)
  // TODO(P2.6): tree editor handoff + "I'm done" CTA → /dashboard
  // TODO(P2.7): "Use a template" entry point
  const { user } = useUser()
  const supabase = useSupabase()

  const [phase, setPhase] = useState<Phase>(() =>
    readExplainerDismissed() ? 'premises' : 'explainer',
  )
  const [crewId, setCrewId] = useState<string | null>(null)
  const [premises, setPremises] = useState<SpaceNode | null>(null)
  const [nodes, setNodes] = useState<SpaceNode[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolve the active crew from the user's most-recent active membership.
  useEffect(() => {
    let cancelled = false
    async function loadCrew() {
      const { data, error: queryError } = await supabase
        .from('crew_members')
        .select('crew_id, role')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (queryError) return
      const row = data as MembershipRow | null
      if (row?.crew_id) setCrewId(row.crew_id)
    }
    void loadCrew()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Pull existing spaces for the crew so the tree reflects reality on remount.
  useEffect(() => {
    if (!crewId) return
    let cancelled = false
    async function loadSpaces() {
      const { data, error: queryError } = await supabase
        .from('spaces')
        .select('space_id, parent_id, unit_type, name, deleted_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (queryError) return
      const rows: SpaceNode[] = Array.isArray(data) ? (data as SpaceNode[]) : []
      setNodes(rows)
      const root = rows.find((n) => n.parent_id === null)
      if (root) {
        setPremises(root)
        setPhase((p) => (p === 'premises' ? 'guided' : p))
      }
    }
    void loadSpaces()
    return () => {
      cancelled = true
    }
  }, [supabase, crewId])

  function dismissExplainer() {
    writeExplainerDismissed(true)
    setPhase('premises')
  }

  function reopenExplainer() {
    setPhase('explainer')
  }

  async function handleCreatePremises(name: string) {
    if (!user || !crewId) {
      setError('Crew context not loaded yet — try again in a moment.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const { data, error: insertError } = await supabase
        .from('spaces')
        .insert({
          crew_id: crewId,
          parent_id: null,
          unit_type: 'premises',
          name,
          created_by: user.id,
        })
        .select('space_id, parent_id, unit_type, name, deleted_at')
        .single()
      if (insertError) throw insertError
      if (!data) throw new Error('Premises insert returned no row')
      const row = data as SpaceNode
      setNodes((prev) => [...prev, row])
      setPremises(row)
      setPhase('guided')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Premises')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-paper-150">
      <NavHeader
        leading="close"
        leadingTo="/dashboard"
        title="Set up spaces"
        trailing={
          phase !== 'explainer' && (
            <button
              type="button"
              aria-label="Show the spaces explainer"
              onClick={reopenExplainer}
              className="flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
            >
              <HelpCircle size={20} strokeWidth={2.25} />
            </button>
          )
        }
      />
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-6 pt-4 pb-12">
        <ProgressBar step={3} total={5} />

        {phase === 'explainer' && (
          <SpacesExplainer onDismiss={dismissExplainer} />
        )}

        {phase === 'premises' && (
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
            <div className="flex-1">
              <PremisesForm
                onCreate={handleCreatePremises}
                submitting={submitting}
                error={error}
              />
            </div>
            <aside className="md:w-64">
              <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.55px] text-ink-300">
                Live tree
              </h2>
              <div className="mt-3 rounded-2xl bg-paper-100 p-4">
                <Tree
                  nodes={nodes}
                  emptyState="Your Premises will appear here."
                />
              </div>
            </aside>
          </div>
        )}

        {phase === 'guided' && premises && (
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
            <div className="flex-1">
              <GuidedBranch
                premises={premises}
                onCreate={async (input) => {
                  if (!user || !crewId) {
                    throw new Error('Crew context not loaded yet')
                  }
                  const { data, error: insertError } = await supabase
                    .from('spaces')
                    .insert({
                      crew_id: crewId,
                      parent_id: input.parent_id,
                      unit_type: input.unit_type,
                      name: input.name,
                      created_by: user.id,
                    })
                    .select(
                      'space_id, parent_id, unit_type, name, deleted_at',
                    )
                    .single()
                  if (insertError) throw insertError
                  if (!data) throw new Error('Insert returned no row')
                  const row = data as SpaceNode
                  setNodes((prev) => [...prev, row])
                  return row
                }}
                onComplete={() => setPhase('editor')}
              />
            </div>
            <aside className="md:w-64">
              <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.55px] text-ink-300">
                Live tree
              </h2>
              <div className="mt-3 rounded-2xl bg-paper-100 p-4">
                <Tree nodes={nodes} />
              </div>
            </aside>
          </div>
        )}

        {phase === 'editor' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-paper-100 p-4">
              <Tree nodes={nodes} />
            </div>
            <p className="font-body text-base text-ink-700">
              Coming next — full tree editor (P2.6) and template browser (P2.7).
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

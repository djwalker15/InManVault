import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'
import { NavHeader, PrimaryButton } from '@/components/ds'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import { SpacesExplainer } from '@/components/spaces/explainer'
import { TemplateBrowser } from '@/components/spaces/template-browser'
import { TreeEditor } from '@/components/spaces/tree-editor'
import type { SpaceNode, UnitType } from '@/components/spaces/types'
import { useSupabase } from '@/lib/supabase'

interface MembershipRow {
  crew_id: string
  role: string
}

export default function SpacesPage() {
  const { user } = useUser()
  const supabase = useSupabase()

  const [crewId, setCrewId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<SpaceNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showExplainer, setShowExplainer] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadCrew() {
      const { data } = await supabase
        .from('crew_members')
        .select('crew_id, role')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      const row = data as MembershipRow | null
      if (row?.crew_id) setCrewId(row.crew_id)
    }
    void loadCrew()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (!crewId) return
    let cancelled = false
    async function loadSpaces() {
      const { data } = await supabase
        .from('spaces')
        .select('space_id, parent_id, unit_type, name, deleted_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      if (cancelled) return
      setNodes(Array.isArray(data) ? (data as SpaceNode[]) : [])
      setLoading(false)
    }
    void loadSpaces()
    return () => {
      cancelled = true
    }
  }, [supabase, crewId])

  const hasPremises = useMemo(
    () => nodes.some((n) => n.parent_id === null),
    [nodes],
  )

  const hasNonPremisesSpaces = useMemo(
    () => nodes.some((n) => n.parent_id !== null && !n.deleted_at),
    [nodes],
  )

  async function refetchSpaces() {
    if (!crewId) return
    const { data } = await supabase
      .from('spaces')
      .select('space_id, parent_id, unit_type, name, deleted_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    setNodes(Array.isArray(data) ? (data as SpaceNode[]) : [])
  }

  async function insertNode(input: {
    parent_id: string
    unit_type: UnitType
    name: string
  }): Promise<SpaceNode> {
    if (!user || !crewId) throw new Error('Crew context not loaded.')
    const { data, error } = await supabase
      .from('spaces')
      .insert({
        crew_id: crewId,
        parent_id: input.parent_id,
        unit_type: input.unit_type,
        name: input.name,
        created_by: user.id,
      })
      .select('space_id, parent_id, unit_type, name, deleted_at')
      .single()
    if (error) throw error
    if (!data) throw new Error('Insert returned no row')
    const row = data as SpaceNode
    setNodes((prev) => [...prev, row])
    return row
  }

  async function rename(space_id: string, name: string): Promise<void> {
    const { error } = await supabase
      .from('spaces')
      .update({ name })
      .eq('space_id', space_id)
    if (error) throw error
    setNodes((prev) =>
      prev.map((n) => (n.space_id === space_id ? { ...n, name } : n)),
    )
  }

  async function reclassify(space_id: string, unit_type: UnitType): Promise<void> {
    const { error } = await supabase
      .from('spaces')
      .update({ unit_type })
      .eq('space_id', space_id)
    if (error) throw error
    setNodes((prev) =>
      prev.map((n) => (n.space_id === space_id ? { ...n, unit_type } : n)),
    )
  }

  async function softDelete(space_ids: string[]): Promise<void> {
    if (space_ids.length === 0) return
    const stamp = new Date().toISOString()
    const { error } = await supabase
      .from('spaces')
      .update({ deleted_at: stamp })
      .in('space_id', space_ids)
    if (error) throw error
    const idSet = new Set(space_ids)
    setNodes((prev) =>
      prev.map((n) =>
        idSet.has(n.space_id) ? { ...n, deleted_at: stamp } : n,
      ),
    )
  }

  return (
    <SignedInLayout>
      <NavHeader
        leading="menu"
        title="Spaces"
        trailing={
          <button
            type="button"
            aria-label="Show the spaces explainer"
            onClick={() => setShowExplainer(true)}
            className="flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
          >
            <HelpCircle size={20} strokeWidth={2.25} />
          </button>
        }
      />
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-6 pt-4 pb-12">
        {showExplainer ? (
          <SpacesExplainer onDismiss={() => setShowExplainer(false)} />
        ) : !hasPremises && !loading ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex justify-end">
              <TemplateBrowser
                hasExistingSpaces={hasNonPremisesSpaces}
                onApplied={refetchSpaces}
              />
            </div>
            <TreeEditor
              nodes={nodes}
              onAddChild={insertNode}
              onAddSibling={insertNode}
              onRename={rename}
              onReclassify={reclassify}
              onDelete={softDelete}
              emptyState="Loading…"
            />
          </>
        )}
      </div>
    </SignedInLayout>
  )
}

function EmptyState() {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-paper-100 p-6">
      <h2 className="font-display text-xl font-bold text-ink-900">
        No spaces yet
      </h2>
      <p className="font-body text-base leading-6 text-ink-700">
        Set up your hierarchy — name your Premises, then walk through the
        guided tour to build out the first branch.
      </p>
      <Link to="/onboarding/spaces" className="self-start">
        <PrimaryButton arrow>Set up spaces</PrimaryButton>
      </Link>
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Link, useSearchParams } from 'react-router-dom'
import { HelpCircle, LayoutGrid, List, Wrench } from 'lucide-react'
import { PrimaryButton, SecondaryButton, Toast } from '@/components/ds'
import { cn } from '@/lib/utils'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'
import { SpacesExplainer } from '@/components/spaces/explainer'
import {
  ReorganizeMode,
  type ReorganizeItem,
} from '@/components/spaces/reorganize'
import { TemplateBrowser } from '@/components/spaces/template-browser'
import { SpacesDrillDown } from '@/components/spaces/drill-down'
import { TreeEditor } from '@/components/spaces/tree-editor'
import { SPACE_COLUMNS, type SpaceNode, type UnitType } from '@/components/spaces/types'
import { useActiveCrew } from '@/lib/active-crew'
import { useRecentIds } from '@/lib/recent-ids'
import { useSupabase } from '@/lib/supabase'

type SpacesView = 'cards' | 'tree'
const VIEW_PREF_KEY = 'inman:spaces-view'

/** Remembered browser view; defaults to the scoped card drill-down. */
function readViewPreference(): SpacesView {
  try {
    return localStorage.getItem(VIEW_PREF_KEY) === 'tree' ? 'tree' : 'cards'
  } catch {
    return 'cards'
  }
}

export default function SpacesPage() {
  const { user } = useUser()
  const supabase = useSupabase()
  const { activeCrewId } = useActiveCrew(user?.id ?? null)
  const [searchParams, setSearchParams] = useSearchParams()
  const reorganize = searchParams.get('mode') === 'reorganize'

  function setMode(next: 'view' | 'reorganize') {
    const params = new URLSearchParams(searchParams)
    if (next === 'view') params.delete('mode')
    else params.set('mode', 'reorganize')
    setSearchParams(params, { replace: true })
  }

  const [nodes, setNodes] = useState<SpaceNode[]>([])
  const [items, setItems] = useState<ReorganizeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showExplainer, setShowExplainer] = useState(false)
  const [refetchTick, setRefetchTick] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<SpacesView>(readViewPreference)
  const recent = useRecentIds()

  function chooseView(next: SpacesView) {
    setView(next)
    try {
      localStorage.setItem(VIEW_PREF_KEY, next)
    } catch {
      // Private mode / storage disabled — non-fatal, the choice just won't persist.
    }
  }

  useEffect(() => {
    if (!activeCrewId) return
    let cancelled = false
    async function loadSnapshot() {
      const [{ data: spaceRows }, { data: itemRows }] = await Promise.all([
        supabase
          .from('spaces')
          .select(SPACE_COLUMNS)
          .eq('crew_id', activeCrewId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true }),
        supabase
          .from('inventory_items')
          .select(
            'inventory_item_id, name, current_space_id, home_space_id',
          )
          .eq('crew_id', activeCrewId)
          .is('deleted_at', null),
      ])
      if (cancelled) return
      setNodes(Array.isArray(spaceRows) ? (spaceRows as SpaceNode[]) : [])
      setItems(Array.isArray(itemRows) ? (itemRows as ReorganizeItem[]) : [])
      setLoading(false)
    }
    void loadSnapshot()
    return () => {
      cancelled = true
    }
  }, [supabase, activeCrewId, refetchTick])

  const hasPremises = useMemo(
    () => nodes.some((n) => n.parent_id === null),
    [nodes],
  )

  const hasNonPremisesSpaces = useMemo(
    () => nodes.some((n) => n.parent_id !== null && !n.deleted_at),
    [nodes],
  )

  function patchNodeImage(space_id: string, image_path: string | null) {
    setNodes((prev) =>
      prev.map((n) => (n.space_id === space_id ? { ...n, image_path } : n)),
    )
  }

  async function refetchSpaces() {
    if (!activeCrewId) return
    const { data } = await supabase
      .from('spaces')
      .select(SPACE_COLUMNS)
      .eq('crew_id', activeCrewId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    setNodes(Array.isArray(data) ? (data as SpaceNode[]) : [])
  }

  async function insertNode(input: {
    parent_id: string | null
    unit_type: UnitType
    name: string
  }): Promise<SpaceNode> {
    if (!user || !activeCrewId) throw new Error('Crew context not loaded.')
    const { data, error } = await supabase
      .from('spaces')
      .insert({
        crew_id: activeCrewId,
        parent_id: input.parent_id,
        unit_type: input.unit_type,
        name: input.name,
        created_by: user.id,
      })
      .select(SPACE_COLUMNS)
      .single()
    if (error) throw error
    if (!data) throw new Error('Insert returned no row')
    const row = data as SpaceNode
    setNodes((prev) => [...prev, row])
    recent.add(row.space_id)
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
    const rootName =
      nodes.find((n) => n.space_id === space_ids[0])?.name ?? 'Space'
    const cascadeCount = space_ids.length - 1
    const { error } = await supabase.rpc('cascade_soft_delete_spaces', {
      p_space_ids: space_ids,
    })
    if (error) throw error
    const stamp = new Date().toISOString()
    const idSet = new Set(space_ids)
    setNodes((prev) =>
      prev.map((n) =>
        idSet.has(n.space_id) ? { ...n, deleted_at: stamp } : n,
      ),
    )
    const suffix =
      cascadeCount > 0
        ? ` and ${cascadeCount} descendant${cascadeCount === 1 ? '' : 's'}`
        : ''
    setToast(`Deleted ${rootName}${suffix}.`)
  }

  return (
    <SignedInLayout>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 pt-4 pb-12">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.4px] text-ink-900">
            Spaces
          </h1>
          <button
            type="button"
            aria-label="Show the spaces explainer"
            onClick={() => setShowExplainer(true)}
            className="flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
          >
            <HelpCircle size={20} strokeWidth={2.25} />
          </button>
        </header>

        {showExplainer ? (
          <SpacesExplainer onDismiss={() => setShowExplainer(false)} />
        ) : !hasPremises && !loading ? (
          <EmptyState />
        ) : reorganize ? (
          activeCrewId ? (
            <ReorganizeMode
              crewId={activeCrewId}
              nodes={nodes}
              items={items}
              onExit={() => setMode('view')}
              onApplied={() => setRefetchTick((t) => t + 1)}
            />
          ) : null
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ViewToggle view={view} onChange={chooseView} />
              <div className="flex flex-wrap gap-2">
                <SecondaryButton
                  type="button"
                  onClick={() => setMode('reorganize')}
                  disabled={!hasNonPremisesSpaces}
                  className="!h-10 !w-auto px-3 !text-sm"
                >
                  <Wrench size={14} aria-hidden />
                  Reorganize
                </SecondaryButton>
                {activeCrewId && (
                  <TemplateBrowser
                    crewId={activeCrewId}
                    hasExistingSpaces={hasNonPremisesSpaces}
                    onApplied={refetchSpaces}
                  />
                )}
              </div>
            </div>
            {view === 'cards' ? (
              <SpacesDrillDown
                nodes={nodes}
                crewId={activeCrewId ?? ''}
                onAddChild={insertNode}
                onRename={rename}
                onReclassify={reclassify}
                onDelete={softDelete}
                onImageChanged={patchNodeImage}
                emptyState="Loading…"
                recentIds={recent.ids}
              />
            ) : (
              <TreeEditor
                nodes={nodes}
                crewId={activeCrewId ?? ''}
                onAddChild={insertNode}
                onAddSibling={insertNode}
                onRename={rename}
                onReclassify={reclassify}
                onDelete={softDelete}
                onImageChanged={patchNodeImage}
                emptyState="Loading…"
                recentIds={recent.ids}
              />
            )}
          </>
        )}
      </div>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </SignedInLayout>
  )
}

function ViewToggle({
  view,
  onChange,
}: {
  view: SpacesView
  onChange: (v: SpacesView) => void
}) {
  const options: { value: SpacesView; label: string; icon: typeof LayoutGrid }[] =
    [
      { value: 'cards', label: 'Cards', icon: LayoutGrid },
      { value: 'tree', label: 'Tree', icon: List },
    ]
  return (
    <div
      role="group"
      aria-label="Spaces view"
      className="flex gap-0.5 rounded-full bg-paper-200 p-0.5"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = view === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-sm font-bold transition',
              active
                ? 'bg-paper-50 text-ink-900 shadow-ambient-sm'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            <Icon size={14} aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
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

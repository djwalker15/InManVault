import { useMemo, useState } from 'react'
import { ChevronLeft, MoreHorizontal, Plus } from 'lucide-react'
import { Sheet } from '@/components/ds'
import { cn } from '@/lib/utils'
import {
  ALLOWED_CHILD_TYPES,
  descendantIds,
  reclassifySuggestions,
} from './tree-helpers'
import { Breadcrumb, ChildCard, LeafEmpty, ScopeHero } from './drill-down-cards'
import {
  ActionMenu,
  AddForm,
  DeleteConfirm,
  RenameForm,
  ReclassifyForm,
  type SheetAction,
} from './drill-down-sheets'
import type { SpaceNode, UnitType } from './types'

interface SpacesDrillDownProps {
  nodes: SpaceNode[]
  onAddChild: (input: {
    parent_id: string | null
    unit_type: UnitType
    name: string
  }) => Promise<SpaceNode>
  onRename: (space_id: string, name: string) => Promise<void>
  onReclassify: (space_id: string, unit_type: UnitType) => Promise<void>
  onDelete: (space_ids: string[]) => Promise<void>
  emptyState?: string
  /** Ids of just-created spaces — their cards flash and scroll into view. */
  recentIds?: ReadonlySet<string>
}

type SheetState = { type: 'menu' | SheetAction; targetId: string | null }

// Surface PostgrestError messages too, not just Error subclasses — supabase-js
// rejects with plain { message, … } objects that fail instanceof Error.
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return 'Failed.'
}

export function SpacesDrillDown({
  nodes,
  onAddChild,
  onRename,
  onReclassify,
  onDelete,
  emptyState,
  recentIds,
}: SpacesDrillDownProps) {
  const [focusId, setFocusId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live indexes over the non-deleted tree.
  const { childrenByParent, byId } = useMemo(() => {
    const childrenByParent = new Map<string | null, SpaceNode[]>()
    const byId = new Map<string, SpaceNode>()
    for (const n of nodes) {
      if (n.deleted_at) continue
      byId.set(n.space_id, n)
      const key = n.parent_id ?? null
      const list = childrenByParent.get(key) ?? []
      list.push(n)
      childrenByParent.set(key, list)
    }
    return { childrenByParent, byId }
  }, [nodes])

  // Derive the effective focus at render: if the focused space vanished
  // (deleted, or a crew switch swapped the tree), fall back to the root rather
  // than syncing state in an effect.
  const effectiveFocusId =
    focusId !== null && byId.has(focusId) ? focusId : null

  const scope = effectiveFocusId ? byId.get(effectiveFocusId) ?? null : null
  const children = childrenByParent.get(effectiveFocusId) ?? []
  const roots = childrenByParent.get(null) ?? []

  const path = useMemo(() => {
    const out: SpaceNode[] = []
    let cur = effectiveFocusId ? byId.get(effectiveFocusId) : undefined
    while (cur) {
      out.unshift(cur)
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return out
  }, [effectiveFocusId, byId])

  if (roots.length === 0) {
    return (
      <p className="font-body text-sm text-ink-600">
        {emptyState ?? 'No spaces yet.'}
      </p>
    )
  }

  // ── navigation ──
  function closeSheet() {
    setSheet(null)
    setError(null)
  }
  function openNode(n: SpaceNode) {
    closeSheet()
    setFocusId(n.space_id)
  }
  function jump(id: string | null) {
    closeSheet()
    setFocusId(id)
  }
  function back() {
    if (scope) setFocusId(scope.parent_id ?? null)
  }
  function openMenu(id: string) {
    setError(null)
    setSheet({ type: 'menu', targetId: id })
  }
  function openAddForScope() {
    setError(null)
    setSheet({ type: 'add', targetId: effectiveFocusId })
  }

  // ── mutations ──
  async function run(fn: () => Promise<void>, after?: () => void) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setSheet(null)
      after?.()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function handleAdd(parentId: string | null, unit_type: UnitType, name: string) {
    void run(async () => {
      await onAddChild({ parent_id: parentId, unit_type, name })
    })
  }
  function handleRename(id: string, name: string) {
    void run(() => onRename(id, name))
  }
  function handleReclassify(id: string, unit_type: UnitType) {
    void run(() => onReclassify(id, unit_type))
  }
  function handleDelete(id: string) {
    const ids = [id, ...descendantIds(nodes, id)]
    const parentOfDeleted = byId.get(id)?.parent_id ?? null
    void run(
      () => onDelete(ids),
      () => {
        // If we were viewing inside the deleted subtree, climb to its parent.
        if (effectiveFocusId && ids.includes(effectiveFocusId))
          setFocusId(parentOfDeleted)
      },
    )
  }

  const target = sheet?.targetId ? byId.get(sheet.targetId) ?? null : null

  return (
    <div className="flex flex-col">
      {/* ── header: back · breadcrumb · manage · add ── */}
      <div className="flex items-center gap-1 pb-2">
        {scope ? (
          <HeaderButton label="Go back" onClick={back}>
            <ChevronLeft size={22} />
          </HeaderButton>
        ) : (
          <span aria-hidden className="w-2" />
        )}
        <div className="min-w-0 flex-1">
          <Breadcrumb path={path} onJump={jump} />
        </div>
        {scope && (
          <HeaderButton
            label="Manage this space"
            onClick={() => openMenu(scope.space_id)}
          >
            <MoreHorizontal size={20} />
          </HeaderButton>
        )}
        <HeaderButton label="Add space" filled onClick={openAddForScope}>
          <Plus size={20} />
        </HeaderButton>
      </div>

      {/* ── scoped body (re-mounts on focus change to reset scroll + animate) ── */}
      <div
        key={effectiveFocusId ?? 'root'}
        className="animate-scope-in flex flex-col"
      >
        {scope ? (
          <ScopeHero scope={scope} kids={children} />
        ) : (
          <div className="px-1 pb-2 pt-1">
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-sage-700">
              Your spaces
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-[-0.5px] text-ink-900">
              Premises
            </h2>
            <p className="mt-1.5 font-body text-sm text-ink-600">
              Step into a home or bar to drill down. {roots.length} premises.
            </p>
          </div>
        )}

        <div className={cn(scope ? 'px-6' : 'px-1', 'pb-4 pt-1')}>
          {children.length > 0 ? (
            <div className="grid grid-cols-2 gap-3.5">
              {children.map((c) => (
                <ChildCard
                  key={c.space_id}
                  node={c}
                  kids={childrenByParent.get(c.space_id) ?? []}
                  onOpen={openNode}
                  onMenu={openMenu}
                  isNew={recentIds?.has(c.space_id) ?? false}
                />
              ))}
            </div>
          ) : (
            <LeafEmpty
              name={scope?.name ?? 'this space'}
              canAddChild={
                scope ? ALLOWED_CHILD_TYPES[scope.unit_type].length > 0 : true
              }
              onAdd={openAddForScope}
            />
          )}
        </div>
      </div>

      {/* ── sheets ── */}
      <Sheet
        open={!!sheet}
        onClose={closeSheet}
        ariaLabel={target ? `Manage ${target.name}` : 'Add a space'}
      >
        {sheet?.type === 'menu' && target && (
          <ActionMenu
            node={target}
            canAddChild={ALLOWED_CHILD_TYPES[target.unit_type].length > 0}
            canReclassify={
              reclassifySuggestions(nodes, target.space_id).suggestions.length > 0
            }
            onPick={(action: SheetAction) =>
              setSheet({ type: action, targetId: target.space_id })
            }
          />
        )}
        {sheet?.type === 'add' && (
          <AddForm
            parent={target}
            busy={busy}
            error={error}
            onSubmit={(unit_type, name) =>
              handleAdd(sheet.targetId, unit_type, name)
            }
            onCancel={closeSheet}
          />
        )}
        {sheet?.type === 'rename' && target && (
          <RenameForm
            node={target}
            busy={busy}
            error={error}
            onSubmit={(name) => handleRename(target.space_id, name)}
            onCancel={closeSheet}
          />
        )}
        {sheet?.type === 'reclassify' && target && (
          <ReclassifyForm
            node={target}
            suggestions={reclassifySuggestions(nodes, target.space_id).suggestions}
            busy={busy}
            error={error}
            onSubmit={(unit_type) => handleReclassify(target.space_id, unit_type)}
            onCancel={closeSheet}
          />
        )}
        {sheet?.type === 'delete' && target && (
          <DeleteConfirm
            node={target}
            descendantCount={descendantIds(nodes, target.space_id).length}
            busy={busy}
            error={error}
            onConfirm={() => handleDelete(target.space_id)}
            onCancel={closeSheet}
          />
        )}
      </Sheet>
    </div>
  )
}

function HeaderButton({
  label,
  filled,
  onClick,
  children,
}: {
  label: string
  filled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full transition',
        filled
          ? 'bg-gradient-to-br from-sage-700 to-sage-600 text-white shadow-cta active:scale-95 hover:brightness-105'
          : 'text-ink-900 hover:bg-paper-200',
      )}
    >
      {children}
    </button>
  )
}

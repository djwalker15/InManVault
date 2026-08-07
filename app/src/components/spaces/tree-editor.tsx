import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react'
import { PrimaryButton, SecondaryButton, TextButton } from '@/components/ds'
import {
  ALLOWED_CHILD_TYPES,
  SMART_CHILD_TYPE,
  descendantIds,
  hasChildren,
  reclassifySuggestions,
} from './tree-helpers'
import { SpacePhotoControl } from './space-photo-control'
import {
  UNIT_TYPE_GLYPH,
  UNIT_TYPE_LABEL,
  type SpaceNode,
  type UnitType,
} from './types'

interface TreeEditorProps {
  nodes: SpaceNode[]
  crewId: string
  onAddChild: (input: {
    parent_id: string
    unit_type: UnitType
    name: string
  }) => Promise<SpaceNode>
  onAddSibling: (input: {
    parent_id: string
    unit_type: UnitType
    name: string
  }) => Promise<SpaceNode>
  onRename: (space_id: string, name: string) => Promise<void>
  onDelete: (space_ids: string[]) => Promise<void>
  onReclassify: (space_id: string, unit_type: UnitType) => Promise<void>
  /** The photo control commits its own writes; hosts patch node state here. */
  onImageChanged: (space_id: string, image_path: string | null) => void
  emptyState?: string
  /** Ids of just-created spaces — their rows flash and scroll into view. */
  recentIds?: ReadonlySet<string>
}

type Action = 'add-child' | 'add-sibling' | 'rename' | 'delete' | 'reclassify'

// Surface PostgrestError messages too, not just Error subclasses — supabase-js
// rejects with plain { message, code, details, hint } objects that fail
// instanceof Error, so without this helper they get reported as "Failed."
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return 'Failed.'
}

interface ChildrenIndex {
  childrenByParent: Map<string | null, SpaceNode[]>
}

function buildIndex(nodes: SpaceNode[]): ChildrenIndex {
  const childrenByParent = new Map<string | null, SpaceNode[]>()
  for (const n of nodes) {
    if (n.deleted_at) continue
    const key = n.parent_id ?? null
    const list = childrenByParent.get(key) ?? []
    list.push(n)
    childrenByParent.set(key, list)
  }
  return { childrenByParent }
}

export function TreeEditor({
  nodes,
  crewId,
  onAddChild,
  onAddSibling,
  onRename,
  onDelete,
  onReclassify,
  onImageChanged,
  emptyState,
  recentIds,
}: TreeEditorProps) {
  const index = useMemo(() => buildIndex(nodes), [nodes])
  const roots = index.childrenByParent.get(null) ?? []

  if (roots.length === 0) {
    return (
      <p className="font-body text-sm text-ink-600">
        {emptyState ?? 'No spaces yet.'}
      </p>
    )
  }

  return (
    <ol aria-label="Editable spaces tree" className="flex flex-col gap-1.5">
      {roots.map((root) => (
        <TreeRow
          key={root.space_id}
          node={root}
          depth={0}
          index={index}
          allNodes={nodes}
          crewId={crewId}
          onAddChild={onAddChild}
          onAddSibling={onAddSibling}
          onRename={onRename}
          onDelete={onDelete}
          onReclassify={onReclassify}
          onImageChanged={onImageChanged}
          recentIds={recentIds}
        />
      ))}
    </ol>
  )
}

interface TreeRowProps {
  node: SpaceNode
  depth: number
  index: ChildrenIndex
  allNodes: SpaceNode[]
  crewId: string
  onAddChild: TreeEditorProps['onAddChild']
  onAddSibling: TreeEditorProps['onAddSibling']
  onRename: TreeEditorProps['onRename']
  onDelete: TreeEditorProps['onDelete']
  onReclassify: TreeEditorProps['onReclassify']
  onImageChanged: TreeEditorProps['onImageChanged']
  recentIds?: ReadonlySet<string>
}

function TreeRow({
  node,
  depth,
  index,
  allNodes,
  crewId,
  onAddChild,
  onAddSibling,
  onRename,
  onDelete,
  onReclassify,
  onImageChanged,
  recentIds,
}: TreeRowProps) {
  const children = index.childrenByParent.get(node.space_id) ?? []
  const [expanded, setExpanded] = useState(true)
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = recentIds?.has(node.space_id) ?? false
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Optional call: jsdom has no scrollIntoView.
    if (isNew) rowRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [isNew])

  function closeAction() {
    setAction(null)
    setError(null)
  }

  async function handleAddChild(unit_type: UnitType, name: string) {
    setBusy(true)
    setError(null)
    try {
      await onAddChild({ parent_id: node.space_id, unit_type, name })
      closeAction()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleAddSibling(unit_type: UnitType, name: string) {
    if (!node.parent_id) {
      setError('Cannot add a sibling to a Premises.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onAddSibling({ parent_id: node.parent_id, unit_type, name })
      closeAction()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRename(name: string) {
    setBusy(true)
    setError(null)
    try {
      await onRename(node.space_id, name)
      closeAction()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteConfirm() {
    setBusy(true)
    setError(null)
    try {
      const ids = [node.space_id, ...descendantIds(allNodes, node.space_id)]
      await onDelete(ids)
      closeAction()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleReclassify(unit_type: UnitType) {
    setBusy(true)
    setError(null)
    try {
      await onReclassify(node.space_id, unit_type)
      closeAction()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const reclassify = useMemo(
    () => reclassifySuggestions(allNodes, node.space_id),
    [allNodes, node.space_id],
  )
  const allowedChildTypes = ALLOWED_CHILD_TYPES[node.unit_type]
  const isPremises = node.parent_id === null
  const descendantCount = descendantIds(allNodes, node.space_id).length
  const childCount = hasChildren(allNodes, node.space_id) ? children.length : 0

  return (
    <li
      className="flex flex-col gap-1.5"
      data-unit-type={node.unit_type}
      data-depth={depth}
    >
      <div
        ref={rowRef}
        className={`flex items-center gap-2.5 rounded-md py-1${isNew ? ' animate-space-added' : ''}`}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={() => setExpanded((v) => !v)}
            className="flex size-6 items-center justify-center rounded text-ink-600 transition hover:bg-paper-200"
          >
            {expanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        ) : (
          <span aria-hidden className="size-6" />
        )}
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-paper-50 text-base"
        >
          {UNIT_TYPE_GLYPH[node.unit_type]}
        </span>
        <span className="font-body text-sm text-ink-900">
          {node.name}
          <span className="ml-2 font-body text-xs text-ink-500">
            {UNIT_TYPE_LABEL[node.unit_type]}
          </span>
        </span>
        <button
          type="button"
          aria-label={`Actions for ${node.name}`}
          onClick={() =>
            setAction((cur) => (cur === null ? 'add-child' : null))
          }
          className="ml-auto flex size-7 items-center justify-center rounded-md text-ink-600 transition hover:bg-paper-200"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {action !== null && (
        <ActionPanel
          node={node}
          crewId={crewId}
          depth={depth}
          action={action}
          allowedChildTypes={allowedChildTypes}
          allowedSiblingTypes={
            isPremises
              ? []
              : ALLOWED_CHILD_TYPES[
                  allNodes.find((n) => n.space_id === node.parent_id)
                    ?.unit_type ?? 'premises'
                ]
          }
          isPremises={isPremises}
          reclassifySuggestions={reclassify.suggestions}
          reclassifyReason={reclassify.reason}
          descendantCount={descendantCount}
          busy={busy}
          error={error}
          onAction={setAction}
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
          onRename={handleRename}
          onDelete={handleDeleteConfirm}
          onReclassify={handleReclassify}
          onImageChanged={onImageChanged}
          onCancel={closeAction}
          childCount={childCount}
        />
      )}

      {children.length > 0 && expanded && (
        <ol className="flex flex-col gap-1.5">
          {children.map((child) => (
            <TreeRow
              key={child.space_id}
              node={child}
              depth={depth + 1}
              index={index}
              allNodes={allNodes}
              crewId={crewId}
              onAddChild={onAddChild}
              onAddSibling={onAddSibling}
              onRename={onRename}
              onDelete={onDelete}
              onReclassify={onReclassify}
              onImageChanged={onImageChanged}
              recentIds={recentIds}
            />
          ))}
        </ol>
      )}
    </li>
  )
}

interface ActionPanelProps {
  node: SpaceNode
  crewId: string
  depth: number
  action: Action
  allowedChildTypes: UnitType[]
  allowedSiblingTypes: UnitType[]
  isPremises: boolean
  reclassifySuggestions: UnitType[]
  reclassifyReason?: string
  descendantCount: number
  childCount: number
  busy: boolean
  error: string | null
  onAction: (a: Action) => void
  onAddChild: (unit_type: UnitType, name: string) => Promise<void>
  onAddSibling: (unit_type: UnitType, name: string) => Promise<void>
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
  onReclassify: (unit_type: UnitType) => Promise<void>
  onImageChanged: TreeEditorProps['onImageChanged']
  onCancel: () => void
}

function ActionPanel({
  node,
  crewId,
  depth,
  action,
  allowedChildTypes,
  allowedSiblingTypes,
  isPremises,
  reclassifySuggestions,
  reclassifyReason,
  descendantCount,
  childCount,
  busy,
  error,
  onAction,
  onAddChild,
  onAddSibling,
  onRename,
  onDelete,
  onReclassify,
  onImageChanged,
  onCancel,
}: ActionPanelProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-lg bg-paper-100 p-3"
      style={{ marginLeft: `${(depth + 1) * 16 + 8}px` }}
    >
      <div className="flex flex-wrap gap-1.5">
        {allowedChildTypes.length > 0 && (
          <ActionTab
            active={action === 'add-child'}
            icon={<Plus size={14} />}
            label="Add child"
            onClick={() => onAction('add-child')}
          />
        )}
        {!isPremises && allowedSiblingTypes.length > 0 && (
          <ActionTab
            active={action === 'add-sibling'}
            icon={<Plus size={14} />}
            label="Add sibling"
            onClick={() => onAction('add-sibling')}
          />
        )}
        <ActionTab
          active={action === 'rename'}
          icon={<Pencil size={14} />}
          label="Rename"
          onClick={() => onAction('rename')}
        />
        {reclassifySuggestions.length > 0 && (
          <ActionTab
            active={action === 'reclassify'}
            icon={<Repeat size={14} />}
            label="Change type"
            onClick={() => onAction('reclassify')}
          />
        )}
        {!isPremises && (
          <ActionTab
            active={action === 'delete'}
            icon={<Trash2 size={14} />}
            label="Delete"
            danger
            onClick={() => onAction('delete')}
          />
        )}
      </div>

      {action === 'add-child' && allowedChildTypes.length > 0 && (
        <NameInputForm
          eyebrow="ADD CHILD"
          defaultUnitType={SMART_CHILD_TYPE[node.unit_type] ?? allowedChildTypes[0]}
          allowedTypes={allowedChildTypes}
          submitLabel="Add"
          busy={busy}
          error={error}
          onSubmit={(unit_type, name) => onAddChild(unit_type, name)}
          onCancel={onCancel}
        />
      )}

      {action === 'add-sibling' && (
        <NameInputForm
          eyebrow="ADD SIBLING"
          defaultUnitType={node.unit_type}
          allowedTypes={allowedSiblingTypes}
          submitLabel="Add"
          busy={busy}
          error={error}
          onSubmit={(unit_type, name) => onAddSibling(unit_type, name)}
          onCancel={onCancel}
        />
      )}

      {action === 'rename' && (
        <RenameForm
          node={node}
          crewId={crewId}
          busy={busy}
          error={error}
          onSubmit={onRename}
          onImageChanged={onImageChanged}
          onCancel={onCancel}
        />
      )}

      {action === 'reclassify' && (
        <ReclassifyForm
          current={node.unit_type}
          suggestions={reclassifySuggestions}
          reason={reclassifyReason}
          busy={busy}
          error={error}
          onSubmit={onReclassify}
          onCancel={onCancel}
        />
      )}

      {action === 'delete' && (
        <DeleteConfirm
          name={node.name}
          childCount={childCount}
          descendantCount={descendantCount}
          busy={busy}
          error={error}
          onConfirm={onDelete}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

function ActionTab({
  active,
  icon,
  label,
  danger,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs transition'
  const palette = danger
    ? active
      ? 'bg-error text-white'
      : 'bg-paper-50 text-error hover:bg-paper-200'
    : active
      ? 'bg-sage-700 text-white'
      : 'bg-paper-50 text-ink-700 hover:bg-paper-200'
  return (
    <button type="button" onClick={onClick} className={`${base} ${palette}`}>
      {icon}
      {label}
    </button>
  )
}

interface NameInputFormProps {
  eyebrow: string
  defaultUnitType: UnitType
  allowedTypes: UnitType[]
  submitLabel: string
  busy: boolean
  error: string | null
  onSubmit: (unit_type: UnitType, name: string) => Promise<void>
  onCancel: () => void
}

function NameInputForm({
  eyebrow,
  defaultUnitType,
  allowedTypes,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: NameInputFormProps) {
  const [name, setName] = useState('')
  const [unitType, setUnitType] = useState<UnitType>(defaultUnitType)
  const trimmed = name.trim()
  const valid = trimmed.length >= 1 && trimmed.length <= 64

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    await onSubmit(unitType, trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        {eyebrow}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Unit type"
          value={unitType}
          onChange={(e) => setUnitType(e.target.value as UnitType)}
          className="rounded-md bg-paper-50 px-2 py-1 font-body text-xs text-ink-700"
        >
          {allowedTypes.map((t) => (
            <option key={t} value={t}>
              {UNIT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          aria-label="Name"
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="flex-1 rounded-md bg-paper-50 px-2 py-1 font-body text-sm text-ink-900 outline-none focus:bg-paper-250"
        />
      </div>
      {error && (
        <p className="font-body text-xs text-error">{error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <PrimaryButton
          type="submit"
          height="sm"
          disabled={busy || !valid}
          className="!w-auto px-4"
        >
          {busy ? 'Saving…' : submitLabel}
        </PrimaryButton>
        <SecondaryButton
          type="button"
          onClick={onCancel}
          className="!h-12 !w-auto px-4"
        >
          Cancel
        </SecondaryButton>
      </div>
    </form>
  )
}

interface RenameFormProps {
  node: SpaceNode
  crewId: string
  busy: boolean
  error: string | null
  onSubmit: (name: string) => Promise<void>
  onImageChanged: TreeEditorProps['onImageChanged']
  onCancel: () => void
}

function RenameForm({
  node,
  crewId,
  busy,
  error,
  onSubmit,
  onImageChanged,
  onCancel,
}: RenameFormProps) {
  const [name, setName] = useState(node.name)
  const trimmed = name.trim()
  const valid = trimmed.length >= 1 && trimmed.length <= 64 && trimmed !== node.name

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    await onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        RENAME
      </span>
      <input
        aria-label="New name"
        type="text"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md bg-paper-50 px-2 py-1 font-body text-sm text-ink-900 outline-none focus:bg-paper-250"
      />
      <SpacePhotoControl
        spaceId={node.space_id}
        crewId={crewId}
        imagePath={node.image_path ?? null}
        onChange={(image_path) => onImageChanged(node.space_id, image_path)}
        disabled={busy}
      />
      {error && <p className="font-body text-xs text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PrimaryButton
          type="submit"
          height="sm"
          disabled={busy || !valid}
          className="!w-auto px-4"
        >
          {busy ? 'Saving…' : 'Save'}
        </PrimaryButton>
        <SecondaryButton
          type="button"
          onClick={onCancel}
          className="!h-12 !w-auto px-4"
        >
          Cancel
        </SecondaryButton>
      </div>
    </form>
  )
}

interface ReclassifyFormProps {
  current: UnitType
  suggestions: UnitType[]
  reason?: string
  busy: boolean
  error: string | null
  onSubmit: (unit_type: UnitType) => Promise<void>
  onCancel: () => void
}

function ReclassifyForm({
  current,
  suggestions,
  reason,
  busy,
  error,
  onSubmit,
  onCancel,
}: ReclassifyFormProps) {
  const [target, setTarget] = useState<UnitType | null>(suggestions[0] ?? null)
  const valid = target !== null && target !== current

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid || target === null) return
    await onSubmit(target)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
        CHANGE TYPE — currently {UNIT_TYPE_LABEL[current]}
      </span>
      {suggestions.length === 0 ? (
        <p className="font-body text-xs text-ink-600">
          {reason ?? 'No alternative types are valid here.'}
        </p>
      ) : (
        <select
          aria-label="New unit type"
          value={target ?? ''}
          onChange={(e) => setTarget(e.target.value as UnitType)}
          className="rounded-md bg-paper-50 px-2 py-1 font-body text-sm text-ink-700"
        >
          {suggestions.map((t) => (
            <option key={t} value={t}>
              {UNIT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      )}
      {error && <p className="font-body text-xs text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PrimaryButton
          type="submit"
          height="sm"
          disabled={busy || !valid}
          className="!w-auto px-4"
        >
          {busy ? 'Saving…' : 'Save'}
        </PrimaryButton>
        <SecondaryButton
          type="button"
          onClick={onCancel}
          className="!h-12 !w-auto px-4"
        >
          Cancel
        </SecondaryButton>
      </div>
    </form>
  )
}

interface DeleteConfirmProps {
  name: string
  childCount: number
  descendantCount: number
  busy: boolean
  error: string | null
  onConfirm: () => Promise<void>
  onCancel: () => void
}

function DeleteConfirm({
  name,
  childCount,
  descendantCount,
  busy,
  error,
  onConfirm,
  onCancel,
}: DeleteConfirmProps) {
  const cascade = descendantCount > 0
  return (
    <div className="flex flex-col gap-2">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-error">
        DELETE
      </span>
      <p className="font-body text-sm leading-5 text-ink-900">
        Delete <strong className="font-display">{name}</strong>
        {cascade ? (
          <>
            {' '}and its{' '}
            <strong className="font-display">{descendantCount}</strong>{' '}
            descendant{descendantCount === 1 ? '' : 's'}?
          </>
        ) : (
          '?'
        )}{' '}
        Items at any of these Spaces will become unsorted.
      </p>
      {childCount > 0 && (
        <p className="font-body text-xs text-ink-600">
          Direct children: {childCount}
        </p>
      )}
      {error && <p className="font-body text-xs text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <TextButton
          type="button"
          onClick={onCancel}
          className="!text-ink-700"
        >
          Cancel
        </TextButton>
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={busy}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-error px-4 font-display text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

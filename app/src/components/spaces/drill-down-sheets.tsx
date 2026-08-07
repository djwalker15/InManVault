import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { Field, PrimaryButton, SecondaryButton } from '@/components/ds'
import { cn } from '@/lib/utils'
import { ALLOWED_CHILD_TYPES, SMART_CHILD_TYPE } from './tree-helpers'
import { SpacePhotoControl } from './space-photo-control'
import {
  UNIT_TYPE_GLYPH,
  UNIT_TYPE_LABEL,
  type SpaceNode,
  type UnitType,
} from './types'

// ── Shared bits ─────────────────────────────────────────────────────────────

/** Glyph + type eyebrow + name header, reused across the sheets. */
function NodeHeader({ node, danger }: { node: SpaceNode; danger?: boolean }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className={cn(
          'flex size-[42px] items-center justify-center rounded-xl text-xl',
          danger ? 'bg-error/10 text-error' : 'bg-paper-200 text-ink-700',
        )}
      >
        {danger ? <Trash2 size={22} /> : UNIT_TYPE_GLYPH[node.unit_type]}
      </div>
      <div className="min-w-0">
        <div className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-500">
          {UNIT_TYPE_LABEL[node.unit_type]}
        </div>
        <div className="truncate font-display text-lg font-bold text-ink-900">
          {node.name}
        </div>
      </div>
    </div>
  )
}

/** Segmented chip picker — one chip per allowed type, with its glyph. */
function TypePicker({
  types,
  value,
  onChange,
}: {
  types: UnitType[]
  value: UnitType
  onChange: (t: UnitType) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {types.map((t) => {
        const active = value === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-2 font-display text-[13px] font-bold transition',
              active
                ? 'bg-sage-700 text-white'
                : 'bg-paper-150 text-ink-700 hover:bg-paper-200',
            )}
          >
            <span aria-hidden>{UNIT_TYPE_GLYPH[t]}</span>
            {UNIT_TYPE_LABEL[t]}
          </button>
        )
      })}
    </div>
  )
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null
  return <p className="mt-3 font-body text-xs text-error">{error}</p>
}

// ── Action menu (the ⋯ sheet) ───────────────────────────────────────────────

export type SheetAction = 'add' | 'rename' | 'reclassify' | 'delete'

interface ActionMenuProps {
  node: SpaceNode
  canAddChild: boolean
  canReclassify: boolean
  onPick: (action: SheetAction) => void
}

export function ActionMenu({
  node,
  canAddChild,
  canReclassify,
  onPick,
}: ActionMenuProps) {
  const isPremises = node.parent_id === null
  return (
    <div>
      <NodeHeader node={node} />
      <div className="flex flex-col gap-0.5">
        {canAddChild && (
          <MenuRow
            icon={<Plus size={20} />}
            label="Add a space inside"
            onClick={() => onPick('add')}
          />
        )}
        <MenuRow
          icon={<Pencil size={20} />}
          label="Rename"
          onClick={() => onPick('rename')}
        />
        {canReclassify && (
          <MenuRow
            icon={<Repeat size={20} />}
            label="Change type"
            onClick={() => onPick('reclassify')}
          />
        )}
        {!isPremises && (
          <MenuRow
            icon={<Trash2 size={20} />}
            label="Delete"
            danger
            onClick={() => onPick('delete')}
          />
        )}
      </div>
    </div>
  )
}

function MenuRow({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-xl px-3 py-3.5 text-left font-body text-base font-medium transition',
        danger
          ? 'text-error hover:bg-error/10'
          : 'text-ink-900 hover:bg-paper-150',
      )}
    >
      <span
        className={cn(
          'flex w-5 justify-center',
          danger ? 'text-error' : 'text-ink-600',
        )}
      >
        {icon}
      </span>
      {label}
    </button>
  )
}

// ── Add sheet ────────────────────────────────────────────────────────────────

interface AddFormProps {
  /** Parent space, or null when adding a premises at the root. */
  parent: SpaceNode | null
  busy: boolean
  error: string | null
  onSubmit: (unit_type: UnitType, name: string) => void
  onCancel: () => void
}

export function AddForm({ parent, busy, error, onSubmit, onCancel }: AddFormProps) {
  const allowed = parent ? ALLOWED_CHILD_TYPES[parent.unit_type] : []
  const [type, setType] = useState<UnitType>(
    parent ? SMART_CHILD_TYPE[parent.unit_type] ?? allowed[0] : 'premises',
  )
  const [name, setName] = useState('')
  const trimmed = name.trim()
  const valid = trimmed.length >= 1 && trimmed.length <= 64

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    onSubmit(parent ? type : 'premises', trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <div className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-sage-700">
          Add space
        </div>
        <div className="mt-1.5 font-display text-[22px] font-bold tracking-[-0.4px] text-ink-900">
          {parent ? `Add inside ${parent.name}` : 'Add a premises'}
        </div>
        <p className="mt-1.5 font-body text-sm text-ink-600">
          {parent
            ? 'Pick what kind of space this is, then name it. You can change either later.'
            : 'A premises is the top of a hierarchy — a home or a bar.'}
        </p>
      </div>

      {parent && allowed.length > 0 && (
        <div>
          <div className="mb-2.5 font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-500">
            Type
          </div>
          <TypePicker types={allowed} value={type} onChange={setType} />
        </div>
      )}

      <Field
        label="Name"
        autoFocus
        value={name}
        onValueChange={setName}
        placeholder={parent ? 'e.g. Top Shelf, Spice Rack' : 'e.g. Walker Home, Haywire Bar'}
        error={error ?? undefined}
      />

      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={busy || !valid}>
          <Plus size={18} />
          {busy ? 'Adding…' : `Add ${parent ? UNIT_TYPE_LABEL[type].toLowerCase() : 'premises'}`}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel} className="!w-auto px-5">
          Cancel
        </SecondaryButton>
      </div>
    </form>
  )
}

// ── Rename sheet ──────────────────────────────────────────────────────────────

interface RenameFormProps {
  node: SpaceNode
  crewId: string
  busy: boolean
  error: string | null
  onSubmit: (name: string) => void
  /** Fired when the space photo is set/replaced/removed (commits immediately). */
  onImageChange: (image_path: string | null) => void
  onCancel: () => void
}

export function RenameForm({
  node,
  crewId,
  busy,
  error,
  onSubmit,
  onImageChange,
  onCancel,
}: RenameFormProps) {
  const [name, setName] = useState(node.name)
  const trimmed = name.trim()
  const valid = trimmed.length >= 1 && trimmed.length <= 64 && trimmed !== node.name

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <NodeHeader node={node} />
      <Field
        label="New name"
        autoFocus
        value={name}
        onValueChange={setName}
        error={error ?? undefined}
      />
      <SpacePhotoControl
        spaceId={node.space_id}
        crewId={crewId}
        imagePath={node.image_path ?? null}
        onChange={onImageChange}
        disabled={busy}
      />
      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={busy || !valid}>
          {busy ? 'Saving…' : 'Save'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel} className="!w-auto px-5">
          Cancel
        </SecondaryButton>
      </div>
    </form>
  )
}

// ── Change-type (reclassify) sheet ────────────────────────────────────────────

interface ReclassifyFormProps {
  node: SpaceNode
  suggestions: UnitType[]
  busy: boolean
  error: string | null
  onSubmit: (unit_type: UnitType) => void
  onCancel: () => void
}

export function ReclassifyForm({
  node,
  suggestions,
  busy,
  error,
  onSubmit,
  onCancel,
}: ReclassifyFormProps) {
  const [type, setType] = useState<UnitType | null>(suggestions[0] ?? null)
  const valid = type !== null && type !== node.unit_type

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid || type === null || busy) return
    onSubmit(type)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <NodeHeader node={node} />
      <p className="font-body text-sm text-ink-600">
        Currently a {UNIT_TYPE_LABEL[node.unit_type]}. Only types that still fit
        this position — and keep its contents valid — are offered.
      </p>
      {suggestions.length > 0 && type !== null ? (
        <TypePicker types={suggestions} value={type} onChange={setType} />
      ) : (
        <p className="font-body text-sm text-ink-600">
          No alternative types are valid here.
        </p>
      )}
      <ErrorText error={error} />
      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={busy || !valid}>
          {busy ? 'Saving…' : 'Save change'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel} className="!w-auto px-5">
          Cancel
        </SecondaryButton>
      </div>
    </form>
  )
}

// ── Delete sheet ──────────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  node: SpaceNode
  descendantCount: number
  busy: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirm({
  node,
  descendantCount,
  busy,
  error,
  onConfirm,
  onCancel,
}: DeleteConfirmProps) {
  return (
    <div className="flex flex-col gap-3">
      <NodeHeader node={node} danger />
      <p className="font-body text-[15px] leading-relaxed text-ink-700">
        {descendantCount > 0 ? (
          <>
            This also removes its{' '}
            <strong className="text-ink-900">{descendantCount}</strong> nested
            space{descendantCount === 1 ? '' : 's'}.
          </>
        ) : (
          <>This space has no nested spaces.</>
        )}{' '}
        Items stored at any of these spaces will become unsorted.
      </p>
      <ErrorText error={error} />
      <div className="mt-1 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-error font-display text-base font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          <Trash2 size={18} />
          {busy ? 'Deleting…' : 'Delete space'}
        </button>
        <SecondaryButton type="button" onClick={onCancel}>
          Keep it
        </SecondaryButton>
      </div>
    </div>
  )
}

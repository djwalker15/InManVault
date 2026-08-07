import { useEffect, useRef } from 'react'
import { ChevronRight, MoreHorizontal, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSignedUrl } from '@/lib/media'
import { spacePhotoFor } from './space-photo'

/**
 * Banner background for a space: the real photo (signed URL) when
 * `image_path` is set and resolved, the deterministic warm gradient
 * otherwise (null / loading / error).
 */
function useSpaceBackground(node: SpaceNode): string {
  const photoUrl = useSignedUrl(node.image_path)
  return photoUrl
    ? `url(${photoUrl}) center / cover no-repeat`
    : spacePhotoFor(node.space_id)
}
import {
  UNIT_TYPE_GLYPH,
  UNIT_TYPE_LABEL,
  type SpaceNode,
  type UnitType,
} from './types'

/** Plural unit labels for child-count summaries ("4 zones", "1 shelf"). */
const UNIT_TYPE_PLURAL: Record<UnitType, string> = {
  premises: 'premises',
  area: 'areas',
  zone: 'zones',
  section: 'sections',
  sub_section: 'sub-sections',
  container: 'containers',
  shelf: 'shelves',
}

/** "4 zones" / "1 shelf" given a count and the children's unit_type. */
function childSummary(count: number, childType: UnitType): string {
  const label =
    count === 1 ? UNIT_TYPE_LABEL[childType].toLowerCase() : UNIT_TYPE_PLURAL[childType]
  return `${count} ${label}`
}

// ── Breadcrumb — Spaces › Premises › … › current. Tap any crumb to jump. ──
interface BreadcrumbProps {
  path: SpaceNode[]
  onJump: (id: string | null) => void
}

export function Breadcrumb({ path, onJump }: BreadcrumbProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep the deepest crumb in view as the path grows.
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth
  }, [path])

  const crumb = (label: string, id: string | null, active: boolean) => (
    <button
      key={id ?? 'root'}
      type="button"
      onClick={() => onJump(id)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'shrink-0 rounded px-1 py-0.5 font-body text-xs transition',
        active ? 'font-bold text-ink-900' : 'text-ink-600 hover:text-ink-900',
      )}
    >
      {label}
    </button>
  )

  return (
    <div
      ref={ref}
      aria-label="Breadcrumb"
      className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none]"
    >
      {crumb('Spaces', null, path.length === 0)}
      {path.map((n, i) => (
        <span key={n.space_id} className="flex shrink-0 items-center gap-0.5">
          <ChevronRight size={12} className="text-ink-400" aria-hidden />
          {crumb(n.name, n.space_id, i === path.length - 1)}
        </span>
      ))}
    </div>
  )
}

// ── A single child-space card (photo banner + name + child-count meta) ──
interface ChildCardProps {
  node: SpaceNode
  /** Direct, non-deleted children of this node. */
  kids: SpaceNode[]
  onOpen: (node: SpaceNode) => void
  onMenu: (id: string) => void
  /** Just created — flash and scroll into view. */
  isNew?: boolean
}

export function ChildCard({ node, kids, onOpen, onMenu, isNew }: ChildCardProps) {
  const meta = UNIT_TYPE_LABEL[node.unit_type]
  const glyph = UNIT_TYPE_GLYPH[node.unit_type]
  const background = useSpaceBackground(node)
  const hasKids = kids.length > 0
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Optional call: jsdom has no scrollIntoView.
    if (isNew) cardRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [isNew])

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(node)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(node)
        }
      }}
      data-unit-type={node.unit_type}
      className={cn(
        'group flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-paper-50',
        'shadow-ambient-sm transition active:scale-[0.985] hover:shadow-ambient-md',
        isNew && 'animate-space-added',
      )}
    >
      <div
        className="relative flex h-[92px] items-start justify-between p-2.5"
        style={{ background, backgroundSize: 'cover' }}
      >
        <span className="rounded-full bg-ink-900/30 px-2 py-1 font-display text-[9px] font-bold uppercase tracking-[0.6px] text-white/90 backdrop-blur-[2px]">
          {meta}
        </span>
        <span
          aria-hidden
          className="text-[17px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
        >
          {glyph}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-bold leading-snug tracking-[-0.2px] text-ink-900">
              {node.name}
            </div>
            {hasKids && (
              <div className="mt-1 flex items-center gap-1.5 font-body text-xs text-ink-600">
                <ChevronRight size={12} className="text-sage-700" aria-hidden />
                <span className="font-medium">
                  {childSummary(kids.length, kids[0].unit_type)}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={`Actions for ${node.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onMenu(node.space_id)
            }}
            className="-mr-1.5 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-600 transition hover:bg-paper-200"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Scope hero — a photo banner of the space you're currently inside ──
interface ScopeHeroProps {
  scope: SpaceNode
  kids: SpaceNode[]
}

export function ScopeHero({ scope, kids }: ScopeHeroProps) {
  const meta = UNIT_TYPE_LABEL[scope.unit_type]
  const glyph = UNIT_TYPE_GLYPH[scope.unit_type]
  const background = useSpaceBackground(scope)
  return (
    <div className="px-6 pb-3.5 pt-2">
      <div
        className="relative flex min-h-[132px] flex-col justify-end overflow-hidden rounded-[18px] p-[18px] shadow-ambient-md"
        style={{ background, backgroundSize: 'cover' }}
      >
        <div className="absolute left-[18px] top-3.5 flex items-center gap-2">
          <span
            aria-hidden
            className="text-[19px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
          >
            {glyph}
          </span>
          <span className="font-display text-[9.5px] font-bold uppercase tracking-[0.7px] text-white/95">
            {meta}
          </span>
        </div>
        <div className="font-display text-[27px] font-bold leading-[1.1] tracking-[-0.6px] text-white drop-shadow-[0_1px_12px_rgba(0,0,0,0.3)]">
          {scope.name}
        </div>
        {kids.length > 0 && (
          <div className="mt-2 font-body text-[13px] font-medium text-white/95">
            {childSummary(kids.length, kids[0].unit_type)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Empty state for a space with no children ──
interface LeafEmptyProps {
  name: string
  canAddChild: boolean
  onAdd: () => void
}

export function LeafEmpty({ name, canAddChild, onAdd }: LeafEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-paper-100 px-7 py-11 text-center">
      <div className="flex size-[52px] items-center justify-center rounded-full bg-sage-700/10 text-sage-700">
        <Package size={26} />
      </div>
      <div>
        <div className="font-display text-[17px] font-bold text-ink-900">
          Nothing here yet
        </div>
        <p className="mt-1 font-body text-[13.5px] leading-relaxed text-ink-600">
          {canAddChild ? (
            <>
              Add a space inside{' '}
              <strong className="text-ink-900">{name}</strong> to keep drilling
              down.
            </>
          ) : (
            <>
              <strong className="text-ink-900">{name}</strong> is the deepest
              level — items live here.
            </>
          )}
        </p>
      </div>
      {canAddChild && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sage-700 to-sage-600 px-5 font-display text-sm font-bold text-white shadow-cta transition active:scale-[0.98] hover:brightness-105"
        >
          Add a space inside
        </button>
      )}
    </div>
  )
}

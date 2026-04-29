import { useEffect, useMemo, useState } from 'react'
import { useSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { SpaceNode } from './types'

interface SpaceSelectProps {
  crewId: string
  /** Currently selected space_id, or '' for none. */
  value: string
  onChange: (spaceId: string) => void
  label: string
  placeholder?: string
  required?: boolean
  /** Hide a specific space and all of its descendants (used by Move). */
  excludeSubtreeOf?: string
  /** Whether an empty value is allowed (e.g. home location can be unset). */
  allowEmpty?: boolean
  className?: string
  id?: string
}

type SpaceLite = SpaceNode

/**
 * Loads the Crew's spaces tree once and renders it as a single <select>
 * with breadcrumb-formatted option labels (e.g. "Kitchen › Cabinet 1 ›
 * Shelf 1"). Used by inventory forms that need a Space picker.
 */
export function SpaceSelect({
  crewId,
  value,
  onChange,
  label,
  placeholder = 'Pick a space',
  required,
  excludeSubtreeOf,
  allowEmpty,
  className,
  id,
}: SpaceSelectProps) {
  const supabase = useSupabase()
  const [nodes, setNodes] = useState<SpaceLite[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('spaces')
        .select('space_id, parent_id, unit_type, name, deleted_at')
        .eq('crew_id', crewId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      if (cancelled) return
      setNodes(Array.isArray(data) ? (data as SpaceLite[]) : [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, crewId])

  const options = useMemo(() => buildOptions(nodes, excludeSubtreeOf), [
    nodes,
    excludeSubtreeOf,
  ])

  return (
    <label className={cn('flex flex-col gap-2', className)}>
      <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
        {label}
      </span>
      <select
        id={id}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
      >
        {(allowEmpty || !value) && (
          <option value="">{placeholder}</option>
        )}
        {options.map((o) => (
          <option key={o.space_id} value={o.space_id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

interface OptionRow {
  space_id: string
  label: string
}

function buildOptions(
  nodes: SpaceLite[],
  excludeSubtreeOf?: string,
): OptionRow[] {
  const live = nodes.filter((n) => !n.deleted_at)
  const byId = new Map(live.map((n) => [n.space_id, n]))
  const excluded = new Set<string>()
  if (excludeSubtreeOf) {
    const queue = [excludeSubtreeOf]
    while (queue.length) {
      const id = queue.shift()!
      if (excluded.has(id)) continue
      excluded.add(id)
      for (const child of live.filter((n) => n.parent_id === id)) {
        queue.push(child.space_id)
      }
    }
  }
  function path(id: string): string {
    const parts: string[] = []
    let cursor: SpaceLite | undefined = byId.get(id)
    while (cursor) {
      parts.unshift(cursor.name)
      cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined
    }
    return parts.join(' › ')
  }
  return live
    .filter((n) => !excluded.has(n.space_id))
    .map((n) => ({ space_id: n.space_id, label: path(n.space_id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

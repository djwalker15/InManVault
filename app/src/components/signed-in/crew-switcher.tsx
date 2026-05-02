import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CrewMembership } from '@/lib/active-crew'

interface CrewSwitcherProps {
  memberships: CrewMembership[]
  activeCrewId: string | null
  onSelect: (crewId: string) => void
  onNavigate: () => void
}

export function CrewSwitcher({
  memberships,
  activeCrewId,
  onSelect,
  onNavigate,
}: CrewSwitcherProps) {
  const [open, setOpen] = useState(false)
  const active = memberships.find((m) => m.crew_id === activeCrewId)

  if (memberships.length === 0) return null

  return (
    <section className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="crew-switcher-list"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md bg-paper-100 px-3 py-2 transition hover:bg-paper-200"
      >
        <span className="flex flex-1 flex-col items-start text-left">
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.55px] text-ink-300">
            {memberships.length === 1 ? 'Crew' : 'Active crew'}
          </span>
          <span className="font-body text-sm font-semibold text-ink-900">
            {active?.crew_name ?? 'Pick a crew'}
          </span>
        </span>
        {memberships.length > 1 && (
          <ChevronDown
            size={14}
            className={cn(
              'shrink-0 text-ink-600 transition',
              open && 'rotate-180',
            )}
          />
        )}
      </button>
      {open && memberships.length > 1 && (
        <ul id="crew-switcher-list" className="flex flex-col gap-1 pt-1">
          {memberships.map((m) => (
            <li key={m.crew_id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(m.crew_id)
                  setOpen(false)
                }}
                aria-current={m.crew_id === activeCrewId ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition',
                  m.crew_id === activeCrewId
                    ? 'bg-paper-200 text-sage-700'
                    : 'text-ink-700 hover:bg-paper-100',
                )}
              >
                <span className="font-body text-sm">{m.crew_name}</span>
                <span className="font-body text-xs text-ink-500">
                  {m.is_owner ? 'Owner' : capitalize(m.role)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1 flex flex-col gap-1">
        <Link
          to="/crews"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 font-body text-xs text-ink-700 hover:bg-paper-100"
        >
          Manage crews
        </Link>
        <Link
          to="/onboarding"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 font-body text-xs text-ink-700 hover:bg-paper-100"
        >
          <Plus size={12} aria-hidden />
          Create a new Crew
        </Link>
      </div>
    </section>
  )
}

function capitalize(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

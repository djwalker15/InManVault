import { useMemo, useState, type FormEvent } from 'react'
import {
  Chip,
  CtaTray,
  Field,
  PrimaryButton,
  SecondaryButton,
  TextButton,
} from '@/components/ds'
import type { SpaceNode, UnitType } from './types'

const LEVELS: UnitType[] = [
  'area',
  'zone',
  'section',
  'sub_section',
  'container',
  'shelf',
]

const SKIPPABLE: ReadonlySet<UnitType> = new Set(['container', 'shelf'])

interface LevelCopy {
  prompt: (parentName: string) => string
  tooltip: string
  examples: string[]
  placeholder: string
}

const COPY: Record<UnitType, LevelCopy> = {
  area: {
    prompt: () => "What's the first room or area you want to organize?",
    tooltip:
      'Areas are rooms or functional spaces — Kitchen, Garage, Bar, Office.',
    examples: ['Kitchen', 'Garage', 'Bar', 'Pantry Closet'],
    placeholder: 'Kitchen',
  },
  zone: {
    prompt: (parentName) =>
      `${parentName} has different regions — what do you call the first one?`,
    tooltip:
      "Zones are named regions within an area. Think 'the back wall', 'the island', 'the pantry side'.",
    examples: ['Back', 'Center', 'Side', 'Pantry', 'Fridge'],
    placeholder: 'Back',
  },
  section: {
    prompt: (parentName) =>
      `Within ${parentName}, are there positions — above the counter, below, the countertop?`,
    tooltip:
      'Sections are positional subdivisions — above, below, top, front, back. They describe where within a zone something is.',
    examples: ['Above', 'Below', 'Top', 'Front', 'Back'],
    placeholder: 'Above',
  },
  sub_section: {
    prompt: (parentName) =>
      `What fixed storage is built into ${parentName}? Cabinets, drawers, built-in shelving?`,
    tooltip:
      "Sub-sections are fixed infrastructure — bolted to the wall or built in. You can't pick these up.",
    examples: ['Cabinet 1', 'Drawer 2', 'Built-in Wine Rack'],
    placeholder: 'Cabinet 1',
  },
  container: {
    prompt: (parentName) =>
      `Inside ${parentName}, any removable organizers, bins, or racks? You can skip if not.`,
    tooltip:
      'Containers are portable — drawer organizers, spice racks, lazy susans, cambros. You can pick these up and rearrange them.',
    examples: ['Spice Rack', 'Lazy Susan', 'Drawer Organizer', 'Cambro'],
    placeholder: 'Spice Rack',
  },
  shelf: {
    prompt: () =>
      'Does this have individual shelves you want to track separately?',
    tooltip:
      'Shelves are the deepest level — individual shelf levels within a sub-section or container.',
    examples: ['Shelf 1', 'Shelf 2', 'Top Shelf', 'Bottom Shelf'],
    placeholder: 'Shelf 1',
  },
  premises: {
    prompt: () => '',
    tooltip: '',
    examples: [],
    placeholder: '',
  },
}

interface GuidedBranchProps {
  /** The Premises node — the root for the descent. */
  premises: SpaceNode
  /** Inserts a new space row and returns the new node. */
  onCreate: (input: {
    parent_id: string
    unit_type: UnitType
    name: string
  }) => Promise<SpaceNode>
  /** Called when the user finishes (either by completing shelf or skipping shelf). */
  onComplete: () => void
}

export function GuidedBranch({
  premises,
  onCreate,
  onComplete,
}: GuidedBranchProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [currentParent, setCurrentParent] = useState<SpaceNode>(premises)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unitType = LEVELS[levelIdx] ?? 'shelf'
  const copy = COPY[unitType]
  const isLastLevel = levelIdx === LEVELS.length - 1
  const canSkip = SKIPPABLE.has(unitType)

  const trimmed = name.trim()
  const validName = trimmed.length >= 1 && trimmed.length <= 64

  const headline = useMemo(
    () => copy.prompt(currentParent.name),
    [copy, currentParent.name],
  )

  function reset() {
    setName('')
    setError(null)
  }

  async function insert(): Promise<SpaceNode | null> {
    if (!validName) {
      setError('Give it a name.')
      return null
    }
    setError(null)
    setSubmitting(true)
    try {
      return await onCreate({
        parent_id: currentParent.space_id,
        unit_type: unitType,
        name: trimmed,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add.')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddAndDeeper(e: FormEvent) {
    e.preventDefault()
    const created = await insert()
    if (!created) return
    if (isLastLevel) {
      onComplete()
      return
    }
    setCurrentParent(created)
    setLevelIdx(levelIdx + 1)
    reset()
  }

  async function handleAddAnother() {
    const created = await insert()
    if (!created) return
    // Stay at the current level; parent unchanged so the next entry is a sibling.
    void created
    reset()
  }

  function handleSkip() {
    if (!canSkip) return
    if (isLastLevel) {
      onComplete()
      return
    }
    setLevelIdx(levelIdx + 1)
    reset()
  }

  return (
    <form onSubmit={handleAddAndDeeper} className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.55px] text-sage-700">
          Step {levelIdx + 1} of {LEVELS.length} · {unitType.replace('_', '-')}
        </p>
        <h1 className="font-display text-[24px] font-bold leading-[30px] tracking-[-0.4px] text-ink-900">
          {headline}
        </h1>
        <p className="font-body text-sm leading-5 text-ink-600">
          {copy.tooltip}
        </p>
      </header>

      <Field
        label={`${unitType.replace('_', '-').toUpperCase()} NAME`}
        placeholder={copy.placeholder}
        autoFocus
        value={name}
        onValueChange={setName}
        error={error ?? undefined}
        minLength={1}
        maxLength={64}
      />

      <div
        aria-label="Suggestions"
        className="flex flex-wrap gap-2"
      >
        {copy.examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setName(example)}
            className="appearance-none border-0 bg-transparent p-0"
          >
            <Chip variant="default">{example}</Chip>
          </button>
        ))}
      </div>

      <CtaTray sticky={false}>
        <PrimaryButton arrow type="submit" disabled={submitting || !validName}>
          {isLastLevel
            ? submitting
              ? 'Saving…'
              : 'Add and finish'
            : submitting
              ? 'Saving…'
              : 'Add and go deeper'}
        </PrimaryButton>
        <SecondaryButton
          type="button"
          onClick={handleAddAnother}
          disabled={submitting || !validName}
        >
          Add another at this level
        </SecondaryButton>
        {canSkip && (
          <TextButton type="button" onClick={handleSkip} disabled={submitting}>
            {isLastLevel ? "I'm done" : 'Skip this level'}
          </TextButton>
        )}
      </CtaTray>
    </form>
  )
}

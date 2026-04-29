import type { ReactNode } from 'react'
import { PrimaryButton, TipCard } from '@/components/ds'

interface LevelRow {
  glyph: string
  unitType: string
  example: string
  description: string
}

const levels: LevelRow[] = [
  {
    glyph: '🏠',
    unitType: 'Premises',
    example: 'My House',
    description: 'The whole place — your house, apartment, or business.',
  },
  {
    glyph: '🏷️',
    unitType: 'Area',
    example: 'Kitchen',
    description: 'A room or functional space inside your premises.',
  },
  {
    glyph: '📍',
    unitType: 'Zone',
    example: 'Back Wall',
    description: 'A named region within an area.',
  },
  {
    glyph: '📐',
    unitType: 'Section',
    example: 'Above',
    description: 'A positional subdivision — above, below, top, front.',
  },
  {
    glyph: '🔩',
    unitType: 'Sub-section',
    example: 'Cabinet 1',
    description: 'Fixed infrastructure — bolted to the wall, built in.',
  },
  {
    glyph: '📦',
    unitType: 'Container',
    example: 'Spice Rack',
    description: 'Portable storage — you can pick it up and move it.',
  },
  {
    glyph: '📏',
    unitType: 'Shelf',
    example: 'Shelf 1',
    description: 'A specific shelf inside a sub-section or container.',
  },
]

interface SpacesExplainerProps {
  onDismiss: () => void
  /** Wraps children below the diagram if a parent wants to inject extra content. */
  footer?: ReactNode
}

export function SpacesExplainer({ onDismiss, footer }: SpacesExplainerProps) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.4px] text-ink-900">
          How spaces work
        </h1>
        <p className="font-body text-base leading-6 text-ink-700">
          Build your hierarchy as deep as you need — not every level is required.
        </p>
      </header>

      <ol
        aria-label="The seven hierarchy levels"
        className="flex flex-col gap-2 rounded-2xl bg-paper-100 p-5"
      >
        {levels.map((level, idx) => (
          <li
            key={level.unitType}
            className="flex items-start gap-3"
            style={{ paddingLeft: `${idx * 8}px` }}
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-paper-50 text-lg"
            >
              {level.glyph}
            </span>
            <div className="flex min-w-0 flex-col">
              <p className="font-display text-sm font-bold text-ink-900">
                {level.unitType}{' '}
                <span className="font-body font-normal text-ink-600">
                  · {level.example}
                </span>
              </p>
              <p className="mt-0.5 font-body text-[13px] leading-[18px] text-ink-600">
                {level.description}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <TipCard>
        <strong className="font-display font-bold text-ink-900">
          Sub-sections are fixed; containers are portable.
        </strong>{' '}
        Cabinets and drawers are bolted in — those are sub-sections. Spice
        racks, drawer organizers, and cambros can be picked up and moved —
        those are containers.
      </TipCard>

      {footer}

      <PrimaryButton arrow onClick={onDismiss}>
        Got it, let's build
      </PrimaryButton>
    </section>
  )
}


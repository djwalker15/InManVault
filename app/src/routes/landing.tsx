import { Link, useNavigate } from 'react-router-dom'
import { Brand, PrimaryButton, SecondaryButton } from '@/components/ds'

interface FeatureCopy {
  glyph: string
  title: string
  body: string
}

const features: FeatureCopy[] = [
  {
    glyph: '🏠',
    title: 'Hierarchical spaces',
    body: 'From House to Shelf — exactly as detailed as you need.',
  },
  {
    glyph: '📋',
    title: 'Real-time across the crew',
    body: 'Everyone on the same page, in seconds.',
  },
  {
    glyph: '📷',
    title: 'Quick add by scan or search',
    body: 'Add an item in 4 seconds flat.',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-full bg-paper-150">
      <header className="flex items-center justify-between px-5 pt-4 pb-2">
        <Brand size={28} />
        <Link
          to="/sign-in"
          className="font-display text-[13px] font-bold text-ink-700 transition hover:text-sage-700"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[448px] flex-col gap-5 px-6 pb-10 pt-8">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.55px] text-sage-700">
          Inventory management
        </p>
        <h1 className="font-display text-[44px] font-bold leading-[48px] tracking-[-0.02em] text-ink-900">
          Know what's there.
          <br />
          Find it fast.
        </h1>
        <p className="font-body text-base leading-6 text-ink-700">
          InMan is shared inventory for kitchens, bars, garages, and any home
          that runs like a small operation. Built for crews of any size.
        </p>

        <div className="mt-2 flex flex-col gap-2.5">
          <PrimaryButton arrow onClick={() => navigate('/sign-up')}>
            Get started — free
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate('/invite')}>
            I have an invite link
          </SecondaryButton>
        </div>

        <ul className="mt-6 flex flex-col gap-3.5 rounded-2xl bg-paper-100 p-5">
          {features.map((feature) => (
            <li key={feature.title} className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-paper-50 text-lg"
              >
                {feature.glyph}
              </span>
              <div>
                <h3 className="font-display text-sm font-bold text-ink-900">
                  {feature.title}
                </h3>
                <p className="mt-0.5 font-body text-[13px] text-ink-600">
                  {feature.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}

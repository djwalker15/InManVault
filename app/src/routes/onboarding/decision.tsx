import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Leaf, Mail, Star } from 'lucide-react'
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout'

export default function CrewDecisionPage() {
  const navigate = useNavigate()

  return (
    <OnboardingLayout
      step={2}
      total={5}
      footer={
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="border-b border-transparent pb-[3px] font-body-alt text-sm text-ink-placeholder hover:border-ink-placeholder"
          >
            I'm just exploring — skip for now
          </button>
        </div>
      }
    >
      <div className="pb-10 pl-2">
        <h1 className="font-display text-[30px] font-bold leading-[1.3] tracking-[-0.4px] text-ink">
          Welcome.
          <br />
          Let's get you set up.
        </h1>
        <p className="mt-4 max-w-sm font-body-alt text-lg leading-[29.25px] text-ink-body">
          A Crew is a shared workspace for your inventory. Pick one.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <DecisionCard
          icon={<Leaf size={18} />}
          title="Start a new Crew"
          description="Create a fresh workspace for your home, bar, or kitchen. You'll be the Crew Admin."
          onClick={() => navigate('/onboarding/new')}
          badge={<RecommendedBadge />}
        />
        <DecisionCard
          icon={<Mail size={20} />}
          title="I have an invite"
          description="Joining a family member's pantry or a workplace? Paste your invite code."
          onClick={() => navigate('/onboarding/invite')}
        />
      </div>
    </OnboardingLayout>
  )
}

interface DecisionCardProps {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
  badge?: ReactNode
}

function DecisionCard({
  icon,
  title,
  description,
  onClick,
  badge,
}: DecisionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start rounded-xl bg-white p-6 text-left shadow-floating transition hover:-translate-y-px"
    >
      <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-surface-muted text-brand-700">
        {icon}
      </div>
      <h2 className="mb-2 font-display text-xl font-bold leading-7 text-ink">
        {title}
      </h2>
      <p className="mb-6 font-body-alt text-base leading-[26px] text-ink-body">
        {description}
      </p>
      {badge}
    </button>
  )
}

function RecommendedBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-surface-chip px-3 py-1.5 font-body-alt text-xs text-ink-chip">
      <Star size={11} className="fill-current" />
      Recommended for first-time users
    </span>
  )
}

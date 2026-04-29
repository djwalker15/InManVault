import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavHeader, ProgressBar, DecisionCard, CtaTray, PrimaryButton } from '@/components/ds'

type Selection = 'create' | 'invite'

export default function CrewDecisionPage() {
  const navigate = useNavigate()
  const [selection, setSelection] = useState<Selection>('create')

  function handleContinue() {
    if (selection === 'create') {
      navigate('/onboarding/new')
    } else {
      navigate('/invite')
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-paper-150">
      <NavHeader title="Welcome" leading="none" />
      <main className="mx-auto flex w-full max-w-[512px] flex-1 flex-col px-6 pt-4 pb-32">
        <ProgressBar step={1} total={5} className="mb-6" />
        <div className="flex flex-col gap-3">
          <DecisionCard
            glyph="🌱"
            title="Start a new Crew"
            body="Create a fresh workspace for your home, bar, or kitchen. You'll be the Crew Admin."
            selected={selection === 'create'}
            onClick={() => setSelection('create')}
          />
          <DecisionCard
            glyph="📨"
            title="I have an invite"
            body="Joining a family member's pantry or a workplace? Paste your invite code."
            selected={selection === 'invite'}
            onClick={() => setSelection('invite')}
          />
        </div>
      </main>
      <CtaTray>
        <PrimaryButton arrow onClick={handleContinue}>
          Continue
        </PrimaryButton>
      </CtaTray>
    </div>
  )
}

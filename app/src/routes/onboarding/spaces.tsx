import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { NavHeader, ProgressBar } from '@/components/ds'
import { SpacesExplainer } from '@/components/spaces/explainer'
import {
  readExplainerDismissed,
  writeExplainerDismissed,
} from '@/components/spaces/explainer-storage'

export default function OnboardingSpacesPage() {
  // TODO(P2.4): premises creation form + live tree
  // TODO(P2.5): guided first-branch wizard (area → shelf)
  // TODO(P2.6): tree editor handoff + "I'm done" CTA → /dashboard
  // TODO(P2.7): "Use a template" entry point
  const [showExplainer, setShowExplainer] = useState(
    () => !readExplainerDismissed(),
  )

  function dismissExplainer() {
    writeExplainerDismissed(true)
    setShowExplainer(false)
  }

  function reopenExplainer() {
    setShowExplainer(true)
  }

  return (
    <div className="flex min-h-full flex-col bg-paper-150">
      <NavHeader
        leading="close"
        leadingTo="/dashboard"
        title="Set up spaces"
        trailing={
          !showExplainer && (
            <button
              type="button"
              aria-label="Show the spaces explainer"
              onClick={reopenExplainer}
              className="flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
            >
              <HelpCircle size={20} strokeWidth={2.25} />
            </button>
          )
        }
      />
      <main className="mx-auto flex w-full max-w-[512px] flex-1 flex-col gap-6 px-6 pt-4 pb-12">
        <ProgressBar step={3} total={5} />
        {showExplainer ? (
          <SpacesExplainer onDismiss={dismissExplainer} />
        ) : (
          <p className="font-body text-base text-ink-700">
            Coming next — premises creation, guided branch wizard, tree editor.
          </p>
        )}
      </main>
    </div>
  )
}

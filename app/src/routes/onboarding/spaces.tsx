import { NavHeader, ProgressBar } from '@/components/ds'

export default function OnboardingSpacesPage() {
  // TODO(P2.3): explainer screen with the 7-level diagram + TipCard
  // TODO(P2.4): premises creation form + live tree
  // TODO(P2.5): guided first-branch wizard (area → shelf)
  // TODO(P2.6): tree editor handoff + "I'm done" CTA → /dashboard
  // TODO(P2.7): "Use a template" entry point
  return (
    <div className="flex min-h-full flex-col bg-paper-150">
      <NavHeader leading="close" leadingTo="/dashboard" title="Set up spaces" />
      <main className="mx-auto flex w-full max-w-[512px] flex-1 flex-col gap-6 px-6 pt-4 pb-12">
        <ProgressBar step={3} total={5} />
        <p className="font-body text-base text-ink-700">Loading…</p>
      </main>
    </div>
  )
}

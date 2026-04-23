import type { ReactNode } from 'react'
import { CloseButton, TopNav } from '@/components/top-nav'
import { ProgressBar } from './progress-bar'

interface OnboardingLayoutProps {
  step: number
  total: number
  children: ReactNode
  footer?: ReactNode
}

export function OnboardingLayout({
  step,
  total,
  children,
  footer,
}: OnboardingLayoutProps) {
  return (
    <div className="flex min-h-full flex-col bg-surface">
      <TopNav rightAction={<CloseButton to="/dashboard" />} />
      <main className="mx-auto flex w-full max-w-[512px] flex-1 flex-col px-6 pb-12 pt-4">
        <div className="p-4">
          <ProgressBar step={step} total={total} />
        </div>
        <div className="flex flex-1 flex-col">{children}</div>
        {footer && <div className="pt-12">{footer}</div>}
      </main>
    </div>
  )
}

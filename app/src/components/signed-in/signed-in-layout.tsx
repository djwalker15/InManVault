import { useState, type ReactNode } from 'react'
import { UserButton, useUser } from '@clerk/clerk-react'
import { Brand, Sidenav } from '@/components/ds'
import { TopNav } from '@/components/top-nav'
import { useActiveCrew } from '@/lib/active-crew'
import { BottomNav } from './bottom-nav'
import { CrewSwitcher } from './crew-switcher'
import { SidenavContent } from './sidenav-content'

export function SignedInLayout({ children }: { children: ReactNode }) {
  const [sidenavOpen, setSidenavOpen] = useState(false)
  const { user } = useUser()
  const { memberships, activeCrewId, setActive } = useActiveCrew(
    user?.id ?? null,
  )

  return (
    <div className="flex min-h-full flex-col bg-paper-150">
      <TopNav
        rightAction={<UserAvatarMenu />}
        onMenuClick={() => setSidenavOpen(true)}
      />
      <main className="mx-auto w-full max-w-[512px] flex-1 px-4 pb-24 pt-2">
        {children}
      </main>
      <BottomNav />
      <Sidenav
        open={sidenavOpen}
        onClose={() => setSidenavOpen(false)}
        ariaLabel="InMan navigation"
        title={<Brand size={24} />}
      >
        <CrewSwitcher
          memberships={memberships}
          activeCrewId={activeCrewId}
          onSelect={(id) => {
            setActive(id)
            setSidenavOpen(false)
          }}
          onNavigate={() => setSidenavOpen(false)}
        />
        <hr className="my-3 border-paper-300" />
        <SidenavContent onNavigate={() => setSidenavOpen(false)} />
      </Sidenav>
    </div>
  )
}

function UserAvatarMenu() {
  return (
    <UserButton
      afterSignOutUrl="/sign-in"
      appearance={{
        elements: {
          avatarBox: 'h-10 w-10 bg-sage-600',
          userButtonTrigger: 'focus:shadow-none',
        },
      }}
    />
  )
}

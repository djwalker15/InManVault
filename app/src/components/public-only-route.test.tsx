import { describe, it, expect, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { renderWithRoutes } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { PublicOnlyRoute } from './public-only-route'

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate" data-to={to} />
    ),
  }
})

function renderGuard() {
  return renderWithRoutes(
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/" element={<div>Public content</div>} />
      </Route>
    </Routes>,
  )
}

describe('PublicOnlyRoute', () => {
  it('renders Loading when Clerk is not loaded', () => {
    mockClerk({ isLoaded: false, isSignedIn: false })
    renderGuard()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('redirects to /dashboard when signed in', () => {
    mockClerk({ isLoaded: true, isSignedIn: true })
    renderGuard()
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/dashboard')
    expect(screen.queryByText('Public content')).not.toBeInTheDocument()
  })

  it('renders the Outlet when signed out', () => {
    mockClerk({ isLoaded: true, isSignedIn: false, user: null })
    renderGuard()
    expect(screen.getByText('Public content')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })
})

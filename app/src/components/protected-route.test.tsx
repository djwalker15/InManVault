import { describe, it, expect, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { renderWithRoutes } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { ProtectedRoute } from './protected-route'

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
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<div>Protected content</div>} />
      </Route>
    </Routes>,
  )
}

describe('ProtectedRoute', () => {
  it('renders Loading when Clerk is not loaded', () => {
    mockClerk({ isLoaded: false, isSignedIn: false })
    renderGuard()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })

  it('redirects to /sign-in when not signed in', () => {
    mockClerk({ isLoaded: true, isSignedIn: false, user: null })
    renderGuard()
    const navigate = screen.getByTestId('navigate')
    expect(navigate).toHaveAttribute('data-to', '/sign-in')
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders the Outlet when signed in', () => {
    mockClerk({ isLoaded: true, isSignedIn: true })
    renderGuard()
    expect(screen.getByText('Protected content')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })
})

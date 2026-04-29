import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithRouter } from '@/test/utils'
import OnboardingSpacesPage from './spaces'
import { SPACES_EXPLAINER_DISMISSED_KEY } from '@/components/spaces/explainer-storage'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('OnboardingSpacesPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    sessionStorage.removeItem(SPACES_EXPLAINER_DISMISSED_KEY)
  })

  it('renders without crashing', () => {
    renderWithRouter(<OnboardingSpacesPage />)
    expect(
      screen.getByRole('heading', { name: /set up spaces/i }),
    ).toBeInTheDocument()
  })

  it('shows ProgressBar at step 3 of 5', () => {
    renderWithRouter(<OnboardingSpacesPage />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '5')
    expect(screen.getByText('STEP 3 OF 5')).toBeInTheDocument()
  })

  it('close button routes to /dashboard', () => {
    renderWithRouter(<OnboardingSpacesPage />)
    fireEvent.click(screen.getByLabelText(/^close$/i))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('shows the explainer by default', () => {
    renderWithRouter(<OnboardingSpacesPage />)
    expect(
      screen.getByRole('heading', { name: /how spaces work/i }),
    ).toBeInTheDocument()
  })

  it('hides the explainer after dismiss and persists the flag', () => {
    renderWithRouter(<OnboardingSpacesPage />)
    fireEvent.click(
      screen.getByRole('button', { name: /got it, let's build/i }),
    )
    expect(
      screen.queryByRole('heading', { name: /how spaces work/i }),
    ).not.toBeInTheDocument()
    expect(
      sessionStorage.getItem(SPACES_EXPLAINER_DISMISSED_KEY),
    ).toBe('1')
  })

  it('respects the persisted dismiss flag on remount', () => {
    sessionStorage.setItem(SPACES_EXPLAINER_DISMISSED_KEY, '1')
    renderWithRouter(<OnboardingSpacesPage />)
    expect(
      screen.queryByRole('heading', { name: /how spaces work/i }),
    ).not.toBeInTheDocument()
  })

  it('"?" button reopens the explainer after dismiss', () => {
    renderWithRouter(<OnboardingSpacesPage />)
    fireEvent.click(
      screen.getByRole('button', { name: /got it, let's build/i }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /show the spaces explainer/i }),
    )
    expect(
      screen.getByRole('heading', { name: /how spaces work/i }),
    ).toBeInTheDocument()
  })
})

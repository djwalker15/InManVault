import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithRouter } from '@/test/utils'
import OnboardingSpacesPage from './spaces'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('OnboardingSpacesPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
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
    fireEvent.click(screen.getByLabelText(/close/i))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import CrewDecisionPage from './decision'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('CrewDecisionPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockClerk()
    makeSupabaseMock({})
  })

  it('renders both DecisionCards', () => {
    renderWithRouter(<CrewDecisionPage />)
    expect(screen.getByText('Start a new Crew')).toBeInTheDocument()
    expect(screen.getByText('I have an invite')).toBeInTheDocument()
  })

  it('first card is selected by default (aria-checked=true)', () => {
    renderWithRouter(<CrewDecisionPage />)
    const cards = screen.getAllByRole('radio')
    expect(cards[0]).toHaveAttribute('aria-checked', 'true')
    expect(cards[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('clicking the second card moves aria-checked to it', async () => {
    renderWithRouter(<CrewDecisionPage />)
    const cards = screen.getAllByRole('radio')
    await userEvent.click(cards[1])
    expect(cards[0]).toHaveAttribute('aria-checked', 'false')
    expect(cards[1]).toHaveAttribute('aria-checked', 'true')
  })

  it('Continue with default selection (create) navigates to /onboarding/new', async () => {
    renderWithRouter(<CrewDecisionPage />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding/new')
  })

  it('Continue after switching to invite navigates to /invite', async () => {
    renderWithRouter(<CrewDecisionPage />)
    const cards = screen.getAllByRole('radio')
    await userEvent.click(cards[1])
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/invite')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithRouter } from '@/test/utils'
import LandingPage from './landing'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('LandingPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('renders the InMan wordmark', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByAltText('InMan')).toBeInTheDocument()
  })

  it('renders the Sign in link routing to /sign-in', () => {
    renderWithRouter(<LandingPage />)
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/sign-in')
  })

  it('renders the eyebrow + display headline + body', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Inventory management')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /know what's there\. find it fast\./i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/shared inventory for kitchens/i),
    ).toBeInTheDocument()
  })

  it('routes Get started to /sign-up', () => {
    renderWithRouter(<LandingPage />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/sign-up')
  })

  it('routes "I have an invite link" to /invite', () => {
    renderWithRouter(<LandingPage />)
    fireEvent.click(screen.getByRole('button', { name: /i have an invite link/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/invite')
  })

  it('renders all three feature copy blocks', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Hierarchical spaces')).toBeInTheDocument()
    expect(screen.getByText('Real-time across the crew')).toBeInTheDocument()
    expect(screen.getByText('Quick add by scan or search')).toBeInTheDocument()
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import CrewsPage from './crews'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => {
  mockNavigate.mockClear()
  localStorage.clear()
})

const memberRows = [
  {
    crew_id: 'crew_a',
    role: 'admin',
    crews: { name: 'Walker Home', owner_id: 'user_1' },
  },
  {
    crew_id: 'crew_b',
    role: 'member',
    crews: { name: 'Haywire Bar', owner_id: 'user_other' },
  },
]

describe('CrewsPage', () => {
  it('renders the empty state when the user has no memberships', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      crew_members: { select: { data: [], error: null } },
    })
    renderWithRouter(<CrewsPage />)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /you're not in any crews/i }),
      ).toBeInTheDocument()
    })
  })

  it('lists each membership with the right role chip', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      crew_members: { select: { data: memberRows, error: null } },
    })
    renderWithRouter(<CrewsPage />)
    await waitFor(() => {
      expect(screen.getByText('Walker Home')).toBeInTheDocument()
    })
    expect(screen.getByText('Haywire Bar')).toBeInTheDocument()
    expect(screen.getByText(/^owner$/i)).toBeInTheDocument()
    expect(screen.getByText(/^member$/i)).toBeInTheDocument()
  })

  it('Owner row has no Leave button', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      crew_members: { select: { data: memberRows, error: null } },
    })
    renderWithRouter(<CrewsPage />)
    await waitFor(() => {
      expect(screen.getByText('Walker Home')).toBeInTheDocument()
    })
    const leaveButtons = screen.getAllByRole('button', { name: /^leave$/i })
    // Only the non-Owner ("Haywire Bar") row exposes Leave.
    expect(leaveButtons.length).toBe(1)
  })

  it('Switch to this crew updates active selection (writes localStorage)', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      crew_members: { select: { data: memberRows, error: null } },
    })
    renderWithRouter(<CrewsPage />)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /switch to this crew/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(
      screen.getByRole('button', { name: /switch to this crew/i }),
    )
    await waitFor(() => {
      expect(localStorage.getItem('inman:active-crew:user_1')).toBe('crew_b')
    })
  })

  it('Leave button calls leave_crew RPC and navigates to /dashboard', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock(
      { crew_members: { select: { data: memberRows, error: null } } },
      { leave_crew: { data: null, error: null } },
    )
    const originalConfirm = window.confirm
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(true),
    })
    renderWithRouter(<CrewsPage />)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /^leave$/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /^leave$/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('leave_crew', {
        p_crew_id: 'crew_b',
      })
    })
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      writable: true,
      value: originalConfirm,
    })
  })
})

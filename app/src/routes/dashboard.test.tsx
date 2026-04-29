import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import DashboardPage from './dashboard'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('DashboardPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('queries crew_members count with head:true and deleted_at IS NULL', async () => {
    mockClerk({ user: { id: 'user_1', firstName: 'Davontae' } })
    const sb = makeSupabaseMock({
      crew_members: { select: { count: 0, error: null } },
    })

    renderWithRouter(<DashboardPage />)

    await waitFor(() => {
      expect(sb.from).toHaveBeenCalledWith('crew_members')
    })
    expect(sb.tables.crew_members.select).toHaveBeenCalledWith(
      'crew_member_id',
      { count: 'exact', head: true },
    )
    expect(sb.tables.crew_members.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('marks "Create your Crew" complete (line-through) when count > 0', async () => {
    mockClerk({ user: { id: 'user_1', firstName: 'Davontae' } })
    makeSupabaseMock({
      crew_members: { select: { count: 1, error: null } },
    })

    renderWithRouter(<DashboardPage />)

    const label = await screen.findByText('Create your Crew')
    await waitFor(() => {
      expect(label).toHaveClass('line-through')
    })
  })

  it('does not mark crew row complete when there is no membership', async () => {
    mockClerk({ user: { id: 'user_1', firstName: 'Davontae' } })
    makeSupabaseMock({
      crew_members: { select: { count: 0, error: null } },
    })

    renderWithRouter(<DashboardPage />)
    const label = await screen.findByText('Create your Crew')
    expect(label).not.toHaveClass('line-through')
  })

  it('renders the user firstName in the welcome heading', async () => {
    mockClerk({ user: { id: 'user_1', firstName: 'Davontae' } })
    makeSupabaseMock({
      crew_members: { select: { count: 0, error: null } },
    })

    renderWithRouter(<DashboardPage />)
    expect(
      await screen.findByRole('heading', { name: /welcome, davontae/i }),
    ).toBeInTheDocument()
  })

  it('falls back to "there" when no firstName or username is set', async () => {
    mockClerk({
      user: { id: 'user_1', firstName: null, username: null },
    })
    makeSupabaseMock({
      crew_members: { select: { count: 0, error: null } },
    })

    renderWithRouter(<DashboardPage />)
    expect(
      await screen.findByRole('heading', { name: /welcome, there/i }),
    ).toBeInTheDocument()
  })

  it('Path A: renders 5-item checklist with only Sign Up + Crew complete for a fresh owner account', async () => {
    mockClerk({ user: { id: 'user_1', firstName: 'Davontae' } })
    makeSupabaseMock({
      crew_members: {
        select: { count: 1, error: null },
        maybeSingle: {
          data: { crew_id: 'crew_1', role: 'owner' },
          error: null,
        },
      },
      spaces: { select: { count: 1, error: null } },
      inventory_items: { select: { count: 0, error: null } },
      invites: { select: { count: 0, error: null } },
    })

    renderWithRouter(<DashboardPage />)

    // All 5 Path A labels are present
    expect(await screen.findByText('Sign Up')).toBeInTheDocument()
    expect(screen.getByText('Create your Crew')).toBeInTheDocument()
    expect(screen.getByText('Set up spaces')).toBeInTheDocument()
    expect(screen.getByText('Add first items')).toBeInTheDocument()
    expect(screen.getByText('Invite crew members')).toBeInTheDocument()

    // No Path B-only label
    expect(screen.queryByText(/^Joined /i)).not.toBeInTheDocument()

    // Sign Up + Create your Crew are complete (line-through)
    await waitFor(() => {
      expect(screen.getByText('Sign Up')).toHaveClass('line-through')
      expect(screen.getByText('Create your Crew')).toHaveClass('line-through')
    })

    // Remaining three are incomplete
    expect(screen.getByText('Set up spaces')).not.toHaveClass('line-through')
    expect(screen.getByText('Add first items')).not.toHaveClass('line-through')
    expect(screen.getByText('Invite crew members')).not.toHaveClass('line-through')
  })

  it('Path B: renders 4-item checklist with "Joined <crewName>" shown for an invited member', async () => {
    mockClerk({ user: { id: 'user_2', firstName: 'Alex' } })
    makeSupabaseMock({
      crew_members: {
        select: { count: 1, error: null },
        maybeSingle: {
          data: { crew_id: 'crew_1', role: 'member' },
          error: null,
        },
      },
      crews: { single: { data: { name: 'Walker Home' }, error: null } },
    })

    renderWithRouter(<DashboardPage />)

    // Path B-specific labels appear
    expect(await screen.findByText('Joined Walker Home')).toBeInTheDocument()
    expect(screen.getByText('Browse your spaces')).toBeInTheDocument()
    expect(screen.getByText('Browse inventory')).toBeInTheDocument()

    // No Path A-only labels
    await waitFor(() => {
      expect(screen.queryByText('Create your Crew')).not.toBeInTheDocument()
      expect(screen.queryByText('Set up spaces')).not.toBeInTheDocument()
    })

    // Sign Up + Joined are complete
    expect(screen.getByText('Sign Up')).toHaveClass('line-through')
    expect(screen.getByText('Joined Walker Home')).toHaveClass('line-through')
    expect(screen.getByText('Browse your spaces')).not.toHaveClass('line-through')
    expect(screen.getByText('Browse inventory')).not.toHaveClass('line-through')
  })
})

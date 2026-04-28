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
})

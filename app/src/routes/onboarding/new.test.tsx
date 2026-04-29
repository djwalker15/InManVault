import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import CrewCreationPage from './new'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

async function submit(crewName = 'Walker Home') {
  await userEvent.type(
    screen.getByPlaceholderText(/my house/i),
    crewName,
  )
  await userEvent.click(screen.getByRole('button', { name: /create crew/i }))
}

describe('CrewCreationPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('upserts users, inserts crews with .select().single(), inserts crew_members, then navigates to /onboarding/spaces', async () => {
    mockClerk({ user: { id: 'user_abc' } })
    const sb = makeSupabaseMock({
      users: { upsert: { data: null, error: null } },
      crews: { insert: { data: { crew_id: 'crew_1' }, error: null } },
      crew_members: { insert: { data: null, error: null } },
    })

    renderWithRouter(<CrewCreationPage />)
    await submit('Walker Home')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/spaces', { replace: true })
    })

    expect(sb.from).toHaveBeenCalledWith('users')
    expect(sb.tables.users.upsert).toHaveBeenCalledWith(
      { user_id: 'user_abc' },
      { onConflict: 'user_id', ignoreDuplicates: true },
    )

    expect(sb.from).toHaveBeenCalledWith('crews')
    expect(sb.tables.crews.insert).toHaveBeenCalledWith({
      name: 'Walker Home',
      owner_id: 'user_abc',
      created_by: 'user_abc',
    })
    // RLS-trap guard: .select('crew_id').single() must follow the insert
    expect(sb.tables.crews.select).toHaveBeenCalledWith('crew_id')
    expect(sb.tables.crews.single).toHaveBeenCalled()

    expect(sb.from).toHaveBeenCalledWith('crew_members')
    expect(sb.tables.crew_members.insert).toHaveBeenCalledWith({
      crew_id: 'crew_1',
      user_id: 'user_abc',
      role: 'owner',
    })
  })

  it('short-circuits when users.upsert errors — no crew insert, no navigate', async () => {
    mockClerk({ user: { id: 'user_abc' } })
    const sb = makeSupabaseMock({
      users: {
        upsert: {
          data: null,
          error: new Error('permission denied for table users'),
        },
      },
      crews: { insert: { data: { crew_id: 'crew_1' }, error: null } },
      crew_members: { insert: { data: null, error: null } },
    })

    renderWithRouter(<CrewCreationPage />)
    await submit()

    expect(
      await screen.findByText(/permission denied for table users/i),
    ).toBeInTheDocument()
    expect(sb.tables.crews.insert).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('throws "Crew insert returned no row" when RLS SELECT policy hides the inserted row', async () => {
    // The RLS-INSERT-needs-SELECT trap: insert succeeds (error: null) but the
    // SELECT policy filters out the returning row, so data is null.
    mockClerk({ user: { id: 'user_abc' } })
    const sb = makeSupabaseMock({
      users: { upsert: { data: null, error: null } },
      crews: { insert: { data: null, error: null } },
      crew_members: { insert: { data: null, error: null } },
    })

    renderWithRouter(<CrewCreationPage />)
    await submit()

    expect(
      await screen.findByText(/crew insert returned no row/i),
    ).toBeInTheDocument()
    expect(sb.tables.crew_members.insert).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('surfaces crew_members insert error and stays on page', async () => {
    mockClerk({ user: { id: 'user_abc' } })
    const sb = makeSupabaseMock({
      users: { upsert: { data: null, error: null } },
      crews: { insert: { data: { crew_id: 'crew_1' }, error: null } },
      crew_members: {
        insert: {
          data: null,
          error: new Error('crew_members RLS violation'),
        },
      },
    })

    renderWithRouter(<CrewCreationPage />)
    await submit()

    expect(
      await screen.findByText(/crew_members rls violation/i),
    ).toBeInTheDocument()
    expect(sb.tables.crew_members.insert).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('Create button is disabled until crew name has at least 2 characters', () => {
    mockClerk({ user: { id: 'user_abc' } })
    makeSupabaseMock({})

    renderWithRouter(<CrewCreationPage />)
    const btn = screen.getByRole('button', { name: /create crew/i })
    expect(btn).toBeDisabled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import InviteAcceptPage from './invite-accept'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ code: 'TEST_CODE_123' }),
  }
})

const VALID_INVITE = {
  crew_id: 'crew_abc',
  crew_name: 'Walker Home',
  status: 'pending',
  expires_at: '2099-01-01T00:00:00Z',
  invited_by: 'user_xyz',
  role: 'member',
}

describe('InviteAcceptPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockClerk({ user: { id: 'user_test' } })
  })

  it('valid code renders crew name and Accept button', async () => {
    makeSupabaseMock(
      {},
      {
        lookup_invite: { data: [VALID_INVITE], error: null },
        accept_invite: { data: 'crew_abc', error: null },
      },
    )

    renderWithRouter(<InviteAcceptPage />)

    expect(await screen.findByText(/walker home/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept invite/i })).toBeInTheDocument()
  })

  it('invalid code renders the error message', async () => {
    makeSupabaseMock(
      {},
      {
        lookup_invite: { data: [], error: null },
      },
    )

    renderWithRouter(<InviteAcceptPage />)

    expect(
      await screen.findByText(/this invite is invalid or expired/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /accept invite/i }),
    ).not.toBeInTheDocument()
  })

  it('clicking Accept calls accept_invite and navigates to /dashboard', async () => {
    const sb = makeSupabaseMock(
      {},
      {
        lookup_invite: { data: [VALID_INVITE], error: null },
        accept_invite: { data: 'crew_abc', error: null },
      },
    )

    renderWithRouter(<InviteAcceptPage />)

    await userEvent.click(await screen.findByRole('button', { name: /accept invite/i }))

    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('accept_invite', { p_code: 'TEST_CODE_123' })
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('rpc lookup error renders error message and stays on page', async () => {
    makeSupabaseMock(
      {},
      {
        lookup_invite: { data: null, error: new Error('network error') },
      },
    )

    renderWithRouter(<InviteAcceptPage />)

    expect(await screen.findByText(/network error/i)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('accept_invite rpc error renders error and stays on page', async () => {
    makeSupabaseMock(
      {},
      {
        lookup_invite: { data: [VALID_INVITE], error: null },
        accept_invite: { data: null, error: new Error('already a member') },
      },
    )

    renderWithRouter(<InviteAcceptPage />)
    await userEvent.click(await screen.findByRole('button', { name: /accept invite/i }))

    expect(await screen.findByText(/already a member/i)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

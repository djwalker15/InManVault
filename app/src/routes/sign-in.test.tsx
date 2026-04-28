import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import SignInPage from './sign-in'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('SignInPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('navigates to /dashboard after a complete sign-in attempt', async () => {
    const { signIn, setActive } = mockClerk({ isLoaded: true, isSignedIn: false })
    signIn.create.mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_abc',
    })

    renderWithRouter(<SignInPage />)
    await userEvent.type(
      screen.getByPlaceholderText('name@company.com'),
      'me@example.com',
    )
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pa55word!!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(signIn.create).toHaveBeenCalledWith({
        identifier: 'me@example.com',
        password: 'pa55word!!',
      })
    })
    expect(setActive).toHaveBeenCalledWith({ session: 'sess_abc' })
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  it('surfaces the clerkErrorMessage longMessage when signIn.create throws', async () => {
    const { signIn } = mockClerk({ isLoaded: true, isSignedIn: false })
    signIn.create.mockRejectedValue({
      errors: [{ longMessage: 'Password is incorrect.', message: 'wrong' }],
    })

    renderWithRouter(<SignInPage />)
    await userEvent.type(
      screen.getByPlaceholderText('name@company.com'),
      'me@example.com',
    )
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByText('Password is incorrect.'),
    ).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows additional-verification message when status is not complete', async () => {
    const { signIn } = mockClerk({ isLoaded: true, isSignedIn: false })
    signIn.create.mockResolvedValue({
      status: 'needs_second_factor',
      createdSessionId: null,
    })

    renderWithRouter(<SignInPage />)
    await userEvent.type(
      screen.getByPlaceholderText('name@company.com'),
      'me@example.com',
    )
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pa55word!!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByText(/additional verification step/i),
    ).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('OAuth button calls authenticateWithRedirect with the right strategy and URLs', async () => {
    const { signIn } = mockClerk({ isLoaded: true, isSignedIn: false })

    renderWithRouter(<SignInPage />)
    await userEvent.click(
      screen.getByRole('button', { name: /continue with google/i }),
    )

    expect(signIn.authenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/dashboard',
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import SignUpPage from './sign-up'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

async function fillForm(identifier: string, password: string) {
  await userEvent.type(
    screen.getByPlaceholderText('name@company.com'),
    identifier,
  )
  await userEvent.type(screen.getByPlaceholderText('••••••••'), password)
  await userEvent.click(screen.getByRole('button', { name: /create account/i }))
}

describe('SignUpPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('email path: creates signUp, prepares email verification, switches to verify stage', async () => {
    const { signUp } = mockClerk({ isLoaded: true, isSignedIn: false })
    signUp.create.mockResolvedValue({})
    signUp.prepareEmailAddressVerification.mockResolvedValue({})

    renderWithRouter(<SignUpPage />)
    await fillForm('me@example.com', 'pa55word!!')

    await waitFor(() => {
      expect(signUp.create).toHaveBeenCalledWith({
        emailAddress: 'me@example.com',
        password: 'pa55word!!',
      })
    })
    expect(signUp.prepareEmailAddressVerification).toHaveBeenCalledWith({
      strategy: 'email_code',
    })
    expect(
      await screen.findByRole('heading', { name: /^verify$/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/we sent a code to your email/i)).toBeInTheDocument()
  })

  it('phone path: identifies non-email and prepares phone verification', async () => {
    const { signUp } = mockClerk({ isLoaded: true, isSignedIn: false })
    signUp.create.mockResolvedValue({})
    signUp.preparePhoneNumberVerification.mockResolvedValue({})

    renderWithRouter(<SignUpPage />)
    await fillForm('+15551234567', 'pa55word!!')

    await waitFor(() => {
      expect(signUp.create).toHaveBeenCalledWith({
        phoneNumber: '+15551234567',
        password: 'pa55word!!',
      })
    })
    expect(signUp.preparePhoneNumberVerification).toHaveBeenCalledWith({
      strategy: 'phone_code',
    })
    expect(await screen.findByText(/we sent a code to your phone/i)).toBeInTheDocument()
  })

  it('verify stage: complete attempt → setActive → navigate /onboarding', async () => {
    const { signUp, setActive } = mockClerk({ isLoaded: true, isSignedIn: false })
    signUp.create.mockResolvedValue({})
    signUp.prepareEmailAddressVerification.mockResolvedValue({})
    signUp.attemptEmailAddressVerification.mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_xyz',
    })

    renderWithRouter(<SignUpPage />)
    await fillForm('me@example.com', 'pa55word!!')

    const codeInput = await screen.findByPlaceholderText('123456')
    await userEvent.type(codeInput, '123456')
    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }))

    await waitFor(() => {
      expect(signUp.attemptEmailAddressVerification).toHaveBeenCalledWith({
        code: '123456',
      })
    })
    expect(setActive).toHaveBeenCalledWith({ session: 'sess_xyz' })
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true })
  })

  it('"Change email or phone" returns to form stage and clears code', async () => {
    const { signUp } = mockClerk({ isLoaded: true, isSignedIn: false })
    signUp.create.mockResolvedValue({})
    signUp.prepareEmailAddressVerification.mockResolvedValue({})

    renderWithRouter(<SignUpPage />)
    await fillForm('me@example.com', 'pa55word!!')

    const codeInput = await screen.findByPlaceholderText('123456')
    await userEvent.type(codeInput, '12')
    await userEvent.click(
      screen.getByRole('button', { name: /change email or phone/i }),
    )

    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('123456')).not.toBeInTheDocument()
  })
})

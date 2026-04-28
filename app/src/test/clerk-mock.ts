import { vi } from 'vitest'
import { useAuth, useSignIn, useSignUp, useUser } from '@clerk/clerk-react'

interface UserShape {
  id?: string
  firstName?: string | null
  lastName?: string | null
  username?: string | null
}

interface MockClerkOptions {
  isLoaded?: boolean
  isSignedIn?: boolean
  user?: UserShape | null
  signIn?: Record<string, unknown>
  signUp?: Record<string, unknown>
  setActive?: ReturnType<typeof vi.fn>
}

export interface ClerkMocks {
  signIn: {
    create: ReturnType<typeof vi.fn>
    authenticateWithRedirect: ReturnType<typeof vi.fn>
  }
  signUp: {
    create: ReturnType<typeof vi.fn>
    prepareEmailAddressVerification: ReturnType<typeof vi.fn>
    preparePhoneNumberVerification: ReturnType<typeof vi.fn>
    attemptEmailAddressVerification: ReturnType<typeof vi.fn>
    attemptPhoneNumberVerification: ReturnType<typeof vi.fn>
    authenticateWithRedirect: ReturnType<typeof vi.fn>
  }
  setActive: ReturnType<typeof vi.fn>
  getToken: ReturnType<typeof vi.fn>
}

export function mockClerk(options: MockClerkOptions = {}): ClerkMocks {
  const {
    isLoaded = true,
    isSignedIn = true,
    user = { id: 'user_test', firstName: 'Test' },
    setActive = vi.fn(),
  } = options

  const signIn = {
    create: vi.fn(),
    authenticateWithRedirect: vi.fn(),
    ...(options.signIn ?? {}),
  } as ClerkMocks['signIn']

  const signUp = {
    create: vi.fn(),
    prepareEmailAddressVerification: vi.fn(),
    preparePhoneNumberVerification: vi.fn(),
    attemptEmailAddressVerification: vi.fn(),
    attemptPhoneNumberVerification: vi.fn(),
    authenticateWithRedirect: vi.fn(),
    ...(options.signUp ?? {}),
  } as ClerkMocks['signUp']

  const getToken = vi.fn().mockResolvedValue(isSignedIn ? 'token_test' : null)

  vi.mocked(useAuth).mockReturnValue({
    isLoaded,
    isSignedIn,
    userId: isSignedIn ? (user?.id ?? null) : null,
    sessionId: isSignedIn ? 'sess_test' : null,
    getToken,
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>)

  vi.mocked(useUser).mockReturnValue({
    isLoaded,
    isSignedIn,
    user: isSignedIn ? user : null,
  } as unknown as ReturnType<typeof useUser>)

  vi.mocked(useSignIn).mockReturnValue({
    isLoaded,
    signIn,
    setActive,
  } as unknown as ReturnType<typeof useSignIn>)

  vi.mocked(useSignUp).mockReturnValue({
    isLoaded,
    signUp,
    setActive,
  } as unknown as ReturnType<typeof useSignUp>)

  return { signIn, signUp, setActive, getToken }
}

import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_test')

vi.mock('@clerk/clerk-react', () => ({
  useAuth: vi.fn(),
  useUser: vi.fn(),
  useSignIn: vi.fn(),
  useSignUp: vi.fn(),
  useClerk: vi.fn(),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  ClerkLoaded: ({ children }: { children: React.ReactNode }) => children,
  ClerkLoading: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => <div data-testid="clerk-user-button" />,
  SignIn: () => <div data-testid="clerk-sign-in" />,
  SignUp: () => <div data-testid="clerk-sign-up" />,
  AuthenticateWithRedirectCallback: () => <div data-testid="clerk-redirect-callback" />,
}))

vi.mock('@/lib/supabase', () => ({
  useSupabase: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

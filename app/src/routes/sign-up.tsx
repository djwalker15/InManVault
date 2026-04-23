import { useState, type FormEvent } from 'react'
import { useSignUp } from '@clerk/clerk-react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { CloseButton, TopNav } from '@/components/top-nav'
import { AuthSeparator } from '@/components/auth/auth-separator'
import { LabeledInput } from '@/components/auth/labeled-input'
import { SocialAuthButton } from '@/components/auth/social-auth-button'
import { clerkErrorMessage } from '@/lib/clerk-error'

type Stage =
  | { kind: 'form' }
  | { kind: 'verifying'; channel: 'email' | 'phone' }

export default function SignUpPage() {
  const { signUp, setActive, isLoaded } = useSignUp()
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'form' })
  const [code, setCode] = useState('')

  async function handleSubmitForm(e: FormEvent) {
    e.preventDefault()
    if (!isLoaded || !signUp) return
    setError(null)
    setSubmitting(true)

    const isEmail = identifier.includes('@')
    try {
      if (isEmail) {
        await signUp.create({ emailAddress: identifier, password })
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        setStage({ kind: 'verifying', channel: 'email' })
      } else {
        await signUp.create({ phoneNumber: identifier, password })
        await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' })
        setStage({ kind: 'verifying', channel: 'phone' })
      }
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitCode(e: FormEvent) {
    e.preventDefault()
    if (!isLoaded || !signUp || !setActive) return
    if (stage.kind !== 'verifying') return
    setError(null)
    setSubmitting(true)
    try {
      const attempt =
        stage.channel === 'email'
          ? await signUp.attemptEmailAddressVerification({ code })
          : await signUp.attemptPhoneNumberVerification({ code })
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId })
        navigate('/onboarding', { replace: true })
      } else {
        setError('Verification did not complete. Please try again.')
      }
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOAuth(strategy: 'oauth_google' | 'oauth_facebook') {
    if (!signUp) return
    setError(null)
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard',
      })
    } catch (err) {
      setError(clerkErrorMessage(err))
    }
  }

  return (
    <div className="min-h-full bg-surface">
      <TopNav rightAction={<CloseButton />} />

      <main className="mx-auto flex w-full max-w-[448px] flex-col px-6 py-6">
        {stage.kind === 'form' ? (
          <>
            <div className="flex w-full flex-col items-center">
              <h1 className="font-display text-[36px] font-extrabold leading-[40px] text-ink">
                Join InMan
              </h1>
              <p className="mt-4 text-center text-lg leading-[29.25px] text-ink-muted">
                Professional inventory management
                <br />
                for any environment.
              </p>
            </div>

            <div className="mt-6 flex w-full flex-col gap-4">
              <SocialAuthButton
                provider="google"
                label="Signup with Google"
                onClick={() => void handleOAuth('oauth_google')}
              />
              <SocialAuthButton
                provider="facebook"
                label="Signup with Facebook"
                onClick={() => void handleOAuth('oauth_facebook')}
              />
            </div>

            <AuthSeparator>OR USE YOUR EMAIL/PHONE</AuthSeparator>

            <form
              onSubmit={handleSubmitForm}
              className="flex w-full flex-col gap-6"
            >
              <LabeledInput
                label="EMAIL OR PHONE"
                icon={<Mail size={20} />}
                type="text"
                value={identifier}
                onChange={setIdentifier}
                placeholder="name@company.com"
                autoComplete="username"
                required
              />
              <LabeledInput
                label="PASSWORD"
                icon={<Lock size={20} />}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                helperText="Must be at least 8 characters with a symbol."
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-ink-muted"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
              />

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              {/* Clerk's bot-detection captcha widget mounts here on sign-up */}
              <div id="clerk-captcha" />

              <button
                type="submit"
                disabled={submitting || !isLoaded}
                className="flex items-center justify-center rounded-lg bg-brand-500 py-5 font-display text-lg font-bold text-white shadow-[0_8px_20px_0_rgba(74,130,101,0.25)] transition hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <p className="mt-6 text-center font-display text-base font-semibold text-ink">
              Already have an account?{' '}
              <Link to="/sign-in" className="text-brand-500 hover:underline">
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="flex w-full flex-col items-center">
              <h1 className="font-display text-[36px] font-extrabold leading-[40px] text-ink">
                Verify
              </h1>
              <p className="mt-4 text-center text-lg leading-[29.25px] text-ink-muted">
                We sent a code to your{' '}
                {stage.channel === 'email' ? 'email' : 'phone'}.
                <br />
                Enter it below to finish.
              </p>
            </div>

            <form
              onSubmit={handleSubmitCode}
              className="mt-6 flex w-full flex-col gap-6"
            >
              <LabeledInput
                label="VERIFICATION CODE"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={setCode}
                placeholder="123456"
                autoComplete="one-time-code"
                required
              />

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !isLoaded || code.length < 4}
                className="flex items-center justify-center rounded-lg bg-brand-500 py-5 font-display text-lg font-bold text-white shadow-[0_8px_20px_0_rgba(74,130,101,0.25)] transition hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? 'Verifying…' : 'Verify'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStage({ kind: 'form' })
                  setCode('')
                  setError(null)
                }}
                className="text-center text-sm text-ink-muted hover:underline"
              >
                ← Change email or phone
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}

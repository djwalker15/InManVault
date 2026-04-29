import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  NavHeader,
  Field,
  PrimaryButton,
  SecondaryButton,
  CtaTray,
} from '@/components/ds'
import { useSupabase } from '@/lib/supabase'

interface InviteInfo {
  crew_id: string
  crew_name: string
  status: string
  expires_at: string
  invited_by: string
  role: string
}

export default function InviteAcceptPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const supabase = useSupabase()

  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    let cancelled = false
    async function lookup() {
      setLoading(true)
      const { data, error } = await supabase.rpc('lookup_invite', { p_code: code })
      if (cancelled) return
      if (error) {
        setLookupError(error instanceof Error ? error.message : 'Failed to load invite')
      } else if (!data || (Array.isArray(data) && data.length === 0)) {
        setLookupError('This invite is invalid or expired')
      } else {
        const row = Array.isArray(data) ? data[0] : data
        const isValid =
          row.status === 'pending' && new Date(row.expires_at) > new Date()
        if (isValid) {
          setInvite(row as InviteInfo)
        } else {
          setLookupError('This invite is invalid or expired')
        }
      }
      setLoading(false)
    }
    void lookup()
    return () => {
      cancelled = true
    }
  }, [code, supabase])

  async function handleAccept() {
    if (!code) return
    setAccepting(true)
    setAcceptError(null)
    const { error } = await supabase.rpc('accept_invite', { p_code: code })
    if (error) {
      setAcceptError(error instanceof Error ? error.message : 'Failed to accept invite')
      setAccepting(false)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-full flex-col bg-paper-150">
      <NavHeader leading="close" leadingTo="/dashboard" title="Join a crew" />
      <main className="mx-auto flex w-full max-w-[512px] flex-1 flex-col gap-6 px-6 pt-6">
        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <span className="animate-spin text-2xl">⟳</span>
          </div>
        )}

        {!loading && lookupError && (
          <div className="flex flex-col gap-4">
            <p className="font-body text-base text-ink-700">{lookupError}</p>
          </div>
        )}

        {!loading && invite && (
          <div className="flex flex-col gap-4">
            <p className="font-body text-base leading-relaxed text-ink-700">
              You&apos;ve been invited to{' '}
              <strong className="font-semibold text-ink-900">{invite.crew_name}</strong>{' '}
              by {invite.invited_by}.
            </p>
            {acceptError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {acceptError}
              </p>
            )}
          </div>
        )}
      </main>

      {!loading && lookupError && (
        <CtaTray>
          <SecondaryButton onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </SecondaryButton>
        </CtaTray>
      )}

      {!loading && invite && (
        <CtaTray>
          <PrimaryButton disabled={accepting} onClick={handleAccept}>
            {accepting ? 'Accepting…' : 'Accept invite'}
          </PrimaryButton>
        </CtaTray>
      )}
    </div>
  )
}

export function InviteEntryPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed) navigate(`/invite/${trimmed}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col bg-paper-150">
      <NavHeader leading="close" leadingTo="/dashboard" title="Join a crew" />
      <main className="mx-auto flex w-full max-w-[512px] flex-1 flex-col gap-6 px-6 pt-6">
        <Field
          label="INVITE CODE"
          placeholder="Paste your invite code"
          autoFocus
          value={code}
          onValueChange={setCode}
        />
      </main>
      <CtaTray>
        <PrimaryButton type="submit" disabled={!code.trim()} arrow>
          Continue
        </PrimaryButton>
      </CtaTray>
    </form>
  )
}

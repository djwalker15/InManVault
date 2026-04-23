import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout'
import { useSupabase } from '@/lib/supabase'

export default function CrewCreationPage() {
  const { user } = useUser()
  const supabase = useSupabase()
  const navigate = useNavigate()

  const [crewName, setCrewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSubmitting(true)
    try {
      const { error: userUpsertError } = await supabase
        .from('users')
        .upsert(
          { user_id: user.id },
          { onConflict: 'user_id', ignoreDuplicates: true },
        )
      if (userUpsertError) throw userUpsertError

      const { data: crew, error: crewError } = await supabase
        .from('crews')
        .insert({
          name: crewName.trim(),
          owner_id: user.id,
          created_by: user.id,
        })
        .select('crew_id')
        .single()
      if (crewError) throw crewError
      if (!crew) throw new Error('Crew insert returned no row')

      const { error: memberError } = await supabase.from('crew_members').insert({
        crew_id: crew.crew_id,
        user_id: user.id,
        role: 'owner',
      })
      if (memberError) throw memberError

      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create crew')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <OnboardingLayout step={2} total={5}>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <div className="pb-10 pl-2">
          <h1 className="font-display text-[30px] font-bold leading-[1.3] tracking-[-0.4px] text-ink">
            Name your Crew
          </h1>
          <p className="mt-4 max-w-sm font-body-alt text-base leading-[26px] text-ink-body">
            A Crew is a shared workspace. You'll be the Admin.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="crew-name"
            className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink"
          >
            Crew Name
          </label>
          <input
            id="crew-name"
            type="text"
            required
            minLength={2}
            maxLength={64}
            value={crewName}
            onChange={(e) => setCrewName(e.target.value)}
            placeholder="e.g. Walker Home, Haywire Bar"
            className="rounded-xl bg-surface-input px-4 py-[18px] font-body-alt text-base text-ink outline-none placeholder:text-ink-placeholder focus:ring-2 focus:ring-brand-500/40"
            autoFocus
          />
          <p className="pt-1 font-body-alt text-sm text-ink-placeholder">
            You can rename this later.
          </p>
        </div>

        {error && (
          <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-auto pb-6 pt-8">
          <button
            type="submit"
            disabled={submitting || crewName.trim().length < 2}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 font-display text-lg font-bold text-white shadow-[0_8px_16px_-4px_rgba(49,105,77,0.2)] transition hover:brightness-105 disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create Crew'}
          </button>
        </div>
      </form>
    </OnboardingLayout>
  )
}

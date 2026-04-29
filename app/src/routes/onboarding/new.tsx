import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { NavHeader, ProgressBar, Field, CtaTray, PrimaryButton } from '@/components/ds'
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

      navigate('/onboarding/spaces', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create crew')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col bg-paper-150">
      <NavHeader leading="back" title="New crew" />
      <main className="mx-auto flex w-full max-w-[512px] flex-1 flex-col gap-6 px-6 pt-4">
        <ProgressBar step={2} total={5} />
        <Field
          label="CREW NAME"
          placeholder="My House"
          hint="You can rename this later."
          autoFocus
          required
          minLength={2}
          maxLength={64}
          value={crewName}
          onValueChange={setCrewName}
        />
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </main>
      <CtaTray>
        <PrimaryButton
          arrow
          type="submit"
          disabled={submitting || crewName.trim().length < 2}
        >
          {submitting ? 'Creating…' : 'Create Crew'}
        </PrimaryButton>
      </CtaTray>
    </form>
  )
}

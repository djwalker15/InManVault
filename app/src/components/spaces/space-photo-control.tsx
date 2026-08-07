import { useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { useSupabase } from '@/lib/supabase'
import { deleteCrewImage, uploadCrewImage, useSignedUrl } from '@/lib/media'
import { spacePhotoFor } from './space-photo'

interface SpacePhotoControlProps {
  spaceId: string
  crewId: string
  imagePath: string | null
  /** Fired after a successful set/replace/remove so hosts patch their nodes. */
  onChange: (imagePath: string | null) => void
  disabled?: boolean
}

/**
 * Set / replace / remove a space photo. Shared by both space edit
 * surfaces (drill-down rename sheet + tree editor rename panel), which
 * have entirely different save plumbing — so this control owns its own
 * mutations and commits immediately on file pick, independent of the
 * host's Save button. Replace = upload new -> update row -> best-effort
 * delete of the old object (per the Media Storage lifecycle).
 */
export function SpacePhotoControl({
  spaceId,
  crewId,
  imagePath,
  onChange,
  disabled = false,
}: SpacePhotoControlProps) {
  const supabase = useSupabase()
  const photoUrl = useSignedUrl(imagePath)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function setPhoto(file: File) {
    setBusy(true)
    setError(null)
    try {
      const path = await uploadCrewImage(supabase, crewId, 'spaces', file, spaceId)
      const { error: updateError } = await supabase
        .from('spaces')
        .update({ image_path: path })
        .eq('space_id', spaceId)
      if (updateError) {
        void deleteCrewImage(supabase, path)
        throw updateError
      }
      if (imagePath) void deleteCrewImage(supabase, imagePath)
      onChange(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed.')
    } finally {
      setBusy(false)
    }
  }

  async function removePhoto() {
    if (!imagePath) return
    setBusy(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('spaces')
        .update({ image_path: null })
        .eq('space_id', spaceId)
      if (updateError) throw updateError
      void deleteCrewImage(supabase, imagePath)
      onChange(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the photo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
        Photo <span className="font-body lowercase text-ink-500">(optional)</span>
      </span>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          data-testid={`space-photo-preview-${spaceId}`}
          className="size-12 shrink-0 overflow-hidden rounded-lg"
          style={{
            background: photoUrl
              ? `url(${photoUrl}) center / cover no-repeat`
              : spacePhotoFor(spaceId),
            backgroundSize: 'cover',
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label
            className={
              disabled || busy
                ? 'flex items-center gap-2 rounded-xl bg-paper-100 px-3 py-2 font-body text-sm text-ink-400'
                : 'flex cursor-pointer items-center gap-2 rounded-xl bg-paper-100 px-3 py-2 font-body text-sm text-ink-600 transition hover:bg-paper-200'
            }
          >
            <ImagePlus size={16} aria-hidden />
            {busy ? 'Saving…' : imagePath ? 'Replace photo' : 'Add a photo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={disabled || busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void setPhoto(file)
              }}
            />
          </label>
          {imagePath && (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void removePhoto()}
              className="flex items-center gap-1 self-start font-body text-xs text-ink-500 underline disabled:text-ink-300"
            >
              <X size={12} aria-hidden />
              Remove photo
            </button>
          )}
          {error && <p className="font-body text-xs text-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import * as mediaLib from '@/lib/media'
import { SpacePhotoControl } from './space-photo-control'

vi.mock('@/lib/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/media')>()
  return {
    ...actual,
    uploadCrewImage: vi.fn(),
    deleteCrewImage: vi.fn(),
    useSignedUrl: vi.fn(() => null),
  }
})

const uploadCrewImage = vi.mocked(mediaLib.uploadCrewImage)
const deleteCrewImage = vi.mocked(mediaLib.deleteCrewImage)
const useSignedUrl = vi.mocked(mediaLib.useSignedUrl)

const photoFile = new File(['img'], 'pantry.jpg', { type: 'image/jpeg' })

describe('SpacePhotoControl', () => {
  it('uploads, updates the row, and reports the new path', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock({ spaces: { update: { data: null, error: null } } })
    uploadCrewImage.mockResolvedValue('crew_abc/spaces/s1/new.jpg')
    const onChange = vi.fn()
    render(
      <SpacePhotoControl
        spaceId="s1"
        crewId="crew_abc"
        imagePath={null}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByLabelText(/add a photo/i), {
      target: { files: [photoFile] },
    })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('crew_abc/spaces/s1/new.jpg')
    })
    expect(uploadCrewImage).toHaveBeenCalledWith(
      expect.anything(),
      'crew_abc',
      'spaces',
      photoFile,
      's1',
    )
    expect(sb.tables.spaces.update).toHaveBeenCalledWith({
      image_path: 'crew_abc/spaces/s1/new.jpg',
    })
    expect(deleteCrewImage).not.toHaveBeenCalled()
  })

  it('replace deletes the old object after the row update', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({ spaces: { update: { data: null, error: null } } })
    uploadCrewImage.mockResolvedValue('crew_abc/spaces/s1/new.jpg')
    const onChange = vi.fn()
    render(
      <SpacePhotoControl
        spaceId="s1"
        crewId="crew_abc"
        imagePath="crew_abc/spaces/s1/old.jpg"
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByLabelText(/replace photo/i), {
      target: { files: [photoFile] },
    })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('crew_abc/spaces/s1/new.jpg')
    })
    expect(deleteCrewImage).toHaveBeenCalledWith(
      expect.anything(),
      'crew_abc/spaces/s1/old.jpg',
    )
  })

  it('remove nulls the column, deletes the object, and reports null', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock({ spaces: { update: { data: null, error: null } } })
    const onChange = vi.fn()
    render(
      <SpacePhotoControl
        spaceId="s1"
        crewId="crew_abc"
        imagePath="crew_abc/spaces/s1/old.jpg"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }))
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(null)
    })
    expect(sb.tables.spaces.update).toHaveBeenCalledWith({ image_path: null })
    expect(deleteCrewImage).toHaveBeenCalledWith(
      expect.anything(),
      'crew_abc/spaces/s1/old.jpg',
    )
    expect(uploadCrewImage).not.toHaveBeenCalled()
  })

  it('surfaces upload errors without calling onChange', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    uploadCrewImage.mockRejectedValue(new Error('storage down'))
    const onChange = vi.fn()
    render(
      <SpacePhotoControl
        spaceId="s1"
        crewId="crew_abc"
        imagePath={null}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByLabelText(/add a photo/i), {
      target: { files: [photoFile] },
    })
    await waitFor(() => {
      expect(screen.getByText('storage down')).toBeInTheDocument()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the signed photo as the preview background when resolved', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    useSignedUrl.mockReturnValue('https://signed.test/crew_abc/spaces/s1/a.jpg')
    render(
      <SpacePhotoControl
        spaceId="s1"
        crewId="crew_abc"
        imagePath="crew_abc/spaces/s1/a.jpg"
        onChange={() => {}}
      />,
    )
    expect(
      screen.getByTestId('space-photo-preview-s1').getAttribute('style'),
    ).toContain('https://signed.test/crew_abc/spaces/s1/a.jpg')
  })
})

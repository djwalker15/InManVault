import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { SpaceSelect } from './space-select'

const sampleSpaces = [
  { space_id: 'p', parent_id: null, unit_type: 'premises', name: 'My House' },
  { space_id: 'a', parent_id: 'p', unit_type: 'area', name: 'Kitchen' },
  { space_id: 's', parent_id: 'a', unit_type: 'sub_section', name: 'Cabinet 1' },
]

describe('SpaceSelect', () => {
  it('renders breadcrumb-formatted options for the crew', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      spaces: { select: { data: sampleSpaces, error: null } },
    })
    render(
      <SpaceSelect
        crewId="crew_abc"
        value=""
        onChange={() => {}}
        label="Current location"
        allowEmpty
      />,
    )
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'My House › Kitchen › Cabinet 1' }),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole('option', { name: 'My House' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'My House › Kitchen' }),
    ).toBeInTheDocument()
  })

  it('fires onChange with the selected space_id', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      spaces: { select: { data: sampleSpaces, error: null } },
    })
    const onChange = vi.fn()
    render(
      <SpaceSelect
        crewId="crew_abc"
        value=""
        onChange={onChange}
        label="Pick"
        allowEmpty
      />,
    )
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'My House › Kitchen › Cabinet 1' }),
      ).toBeInTheDocument()
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's' } })
    expect(onChange).toHaveBeenCalledWith('s')
  })

  it('hides a subtree when excludeSubtreeOf is set', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      spaces: { select: { data: sampleSpaces, error: null } },
    })
    render(
      <SpaceSelect
        crewId="crew_abc"
        value=""
        onChange={() => {}}
        label="Pick"
        excludeSubtreeOf="a"
        allowEmpty
      />,
    )
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'My House' }),
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('option', { name: 'My House › Kitchen' }),
    ).toBeNull()
    expect(
      screen.queryByRole('option', { name: 'My House › Kitchen › Cabinet 1' }),
    ).toBeNull()
  })
})

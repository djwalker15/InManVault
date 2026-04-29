import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GuidedBranch } from './guided-branch'
import type { SpaceNode, UnitType } from './types'

const premises: SpaceNode = {
  space_id: 'p1',
  parent_id: null,
  unit_type: 'premises',
  name: 'My House',
}

function makeOnCreate() {
  let counter = 0
  return vi.fn(
    async (input: {
      parent_id: string
      unit_type: UnitType
      name: string
    }): Promise<SpaceNode> => ({
      space_id: `s_${++counter}`,
      parent_id: input.parent_id,
      unit_type: input.unit_type,
      name: input.name,
    }),
  )
}

describe('GuidedBranch', () => {
  it('starts at the area level with the parent name in the prompt', () => {
    render(
      <GuidedBranch
        premises={premises}
        onCreate={makeOnCreate()}
        onComplete={() => {}}
      />,
    )
    expect(screen.getByText(/step 1 of 6 · area/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /first room or area/i }),
    ).toBeInTheDocument()
  })

  it('exposes example chips that pre-fill the field', () => {
    render(
      <GuidedBranch
        premises={premises}
        onCreate={makeOnCreate()}
        onComplete={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    const input = screen.getByRole('textbox')
    expect((input as HTMLInputElement).value).toBe('Kitchen')
  })

  it('inserts the area and advances to zone (parent = the new area)', async () => {
    const onCreate = makeOnCreate()
    render(
      <GuidedBranch
        premises={premises}
        onCreate={onCreate}
        onComplete={() => {}}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Kitchen' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add and go deeper/i }))

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        parent_id: 'p1',
        unit_type: 'area',
        name: 'Kitchen',
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/step 2 of 6 · zone/i)).toBeInTheDocument()
    })
    // Headline references the parent name
    expect(
      screen.getByRole('heading', { name: /kitchen/i }),
    ).toBeInTheDocument()
  })

  it('"Add another at this level" stays on the same level and parent', async () => {
    const onCreate = makeOnCreate()
    render(
      <GuidedBranch
        premises={premises}
        onCreate={onCreate}
        onComplete={() => {}}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Kitchen' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /add another at this level/i }),
    )
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1)
    })
    // Still on the area step
    expect(screen.getByText(/step 1 of 6 · area/i)).toBeInTheDocument()
    // Field cleared
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
  })

  it('does not show Skip on area / zone / section / sub-section', () => {
    render(
      <GuidedBranch
        premises={premises}
        onCreate={makeOnCreate()}
        onComplete={() => {}}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /skip this level/i }),
    ).not.toBeInTheDocument()
  })

  it('shows Skip on container and lets the user jump to shelf', async () => {
    const onCreate = makeOnCreate()
    render(
      <GuidedBranch
        premises={premises}
        onCreate={onCreate}
        onComplete={() => {}}
      />,
    )

    // Drive through area → zone → section → sub_section
    for (const value of ['Kitchen', 'Back', 'Above', 'Cabinet 1']) {
      fireEvent.change(screen.getByRole('textbox'), { target: { value } })
      fireEvent.click(
        screen.getByRole('button', { name: /add and go deeper/i }),
      )
      await waitFor(() => {
        expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
      })
    }

    expect(screen.getByText(/step 5 of 6 · container/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /skip this level/i }))
    await waitFor(() => {
      expect(screen.getByText(/step 6 of 6 · shelf/i)).toBeInTheDocument()
    })
  })

  it('"I\'m done" on the shelf step calls onComplete without inserting', async () => {
    const onCreate = makeOnCreate()
    const onComplete = vi.fn()
    render(
      <GuidedBranch
        premises={premises}
        onCreate={onCreate}
        onComplete={onComplete}
      />,
    )

    // Drive through to shelf, skipping container.
    for (const value of ['Kitchen', 'Back', 'Above', 'Cabinet 1']) {
      fireEvent.change(screen.getByRole('textbox'), { target: { value } })
      fireEvent.click(
        screen.getByRole('button', { name: /add and go deeper/i }),
      )
      await waitFor(() => {
        expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
      })
    }
    // container → skip
    fireEvent.click(screen.getByRole('button', { name: /skip this level/i }))
    await waitFor(() => {
      expect(screen.getByText(/step 6 of 6 · shelf/i)).toBeInTheDocument()
    })

    const callsBefore = onCreate.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: /i'm done/i }))
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled()
    })
    expect(onCreate).toHaveBeenCalledTimes(callsBefore)
  })

  it('"Add and finish" on shelf inserts and then completes', async () => {
    const onCreate = makeOnCreate()
    const onComplete = vi.fn()
    render(
      <GuidedBranch
        premises={premises}
        onCreate={onCreate}
        onComplete={onComplete}
      />,
    )

    for (const value of ['Kitchen', 'Back', 'Above', 'Cabinet 1', 'Spice Rack']) {
      fireEvent.change(screen.getByRole('textbox'), { target: { value } })
      fireEvent.click(
        screen.getByRole('button', { name: /add and go deeper/i }),
      )
      await waitFor(() => {
        expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
      })
    }
    expect(screen.getByText(/step 6 of 6 · shelf/i)).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Shelf 1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add and finish/i }))
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled()
    })
    const lastCall = onCreate.mock.calls.at(-1)?.[0]
    expect(lastCall).toMatchObject({
      unit_type: 'shelf',
      name: 'Shelf 1',
    })
  })
})

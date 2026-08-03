import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SpacesDrillDown } from './drill-down'
import type { SpaceNode, UnitType } from './types'

// Two premises, so root scoping (sibling branches hidden) is observable.
//  My House ─ Kitchen ─ Back
//           └ Garage
//  Lake House ─ Boathouse
const nodes: SpaceNode[] = [
  { space_id: 'p1', parent_id: null, unit_type: 'premises', name: 'My House' },
  { space_id: 'a1', parent_id: 'p1', unit_type: 'area', name: 'Kitchen' },
  { space_id: 'z1', parent_id: 'a1', unit_type: 'zone', name: 'Back' },
  { space_id: 'a2', parent_id: 'p1', unit_type: 'area', name: 'Garage' },
  { space_id: 'p2', parent_id: null, unit_type: 'premises', name: 'Lake House' },
  { space_id: 'a3', parent_id: 'p2', unit_type: 'area', name: 'Boathouse' },
]

function makeMocks() {
  return {
    onAddChild: vi.fn(
      async (input: {
        parent_id: string | null
        unit_type: UnitType
        name: string
      }): Promise<SpaceNode> => ({
        space_id: 'new',
        parent_id: input.parent_id,
        unit_type: input.unit_type,
        name: input.name,
      }),
    ),
    onRename: vi.fn(async () => {}),
    onReclassify: vi.fn(async () => {}),
    onDelete: vi.fn(async () => {}),
  }
}

describe('SpacesDrillDown', () => {
  it('renders an empty state when there are no roots', () => {
    render(<SpacesDrillDown nodes={[]} emptyState="No spaces yet." {...makeMocks()} />)
    expect(screen.getByText('No spaces yet.')).toBeInTheDocument()
  })

  it('starts at the premises list and hides nested branches', () => {
    render(<SpacesDrillDown nodes={nodes} {...makeMocks()} />)
    expect(screen.getByText('My House')).toBeInTheDocument()
    expect(screen.getByText('Lake House')).toBeInTheDocument()
    // Nothing below the premises level is on screen yet.
    expect(screen.queryByText('Kitchen')).toBeNull()
    expect(screen.queryByText('Garage')).toBeNull()
    expect(screen.queryByText('Boathouse')).toBeNull()
  })

  it('highlights cards whose ids are in recentIds', () => {
    render(
      <SpacesDrillDown
        nodes={nodes}
        recentIds={new Set(['p1'])}
        {...makeMocks()}
      />,
    )
    const flagged = screen.getByText('My House').closest('[role="button"]')
    expect(flagged?.className).toContain('animate-space-added')
    const plain = screen.getByText('Lake House').closest('[role="button"]')
    expect(plain?.className).not.toContain('animate-space-added')
  })

  it('drilling into a premises scopes to its children and hides siblings', () => {
    render(<SpacesDrillDown nodes={nodes} {...makeMocks()} />)
    fireEvent.click(screen.getByText('My House'))

    // Direct children of My House are shown…
    expect(screen.getByText('Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Garage')).toBeInTheDocument()
    // …the sibling premises and its subtree are hidden…
    expect(screen.queryByText('Lake House')).toBeNull()
    expect(screen.queryByText('Boathouse')).toBeNull()
    // …and grandchildren stay collapsed (only immediate children render).
    expect(screen.queryByText('Back')).toBeNull()
  })

  it('breadcrumb and back climb back out of the scope', () => {
    render(<SpacesDrillDown nodes={nodes} {...makeMocks()} />)
    fireEvent.click(screen.getByText('My House'))
    fireEvent.click(screen.getByText('Kitchen'))
    // Inside Kitchen we can see the zone.
    expect(screen.getByText('Back')).toBeInTheDocument()

    // Breadcrumb jump straight to the Spaces root.
    fireEvent.click(screen.getByRole('button', { name: 'Spaces' }))
    expect(screen.getByText('Lake House')).toBeInTheDocument()
    expect(screen.queryByText('Kitchen')).toBeNull()

    // Drill back in, then use the Back button to go up one level.
    fireEvent.click(screen.getByText('My House'))
    fireEvent.click(screen.getByText('Kitchen'))
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    // (the zone) Back is gone; we're back at My House's children.
    expect(screen.getByText('Garage')).toBeInTheDocument()
  })

  it('the + at the root adds a premises (parent_id null)', async () => {
    const m = makeMocks()
    render(<SpacesDrillDown nodes={nodes} {...m} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add space' }))
    expect(screen.getByText('Add a premises')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Cabin' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add premises/i }))
    await waitFor(() => {
      expect(m.onAddChild).toHaveBeenCalledWith({
        parent_id: null,
        unit_type: 'premises',
        name: 'Cabin',
      })
    })
  })

  it("a card's ⋯ menu renames the space", async () => {
    const m = makeMocks()
    render(<SpacesDrillDown nodes={nodes} {...m} />)
    fireEvent.click(screen.getByRole('button', { name: /actions for my house/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('New name'), {
      target: { value: 'Main House' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(m.onRename).toHaveBeenCalledWith('p1', 'Main House')
    })
  })

  it('delete cascades the space and its descendants', async () => {
    const m = makeMocks()
    render(<SpacesDrillDown nodes={nodes} {...m} />)
    fireEvent.click(screen.getByText('My House'))
    fireEvent.click(screen.getByRole('button', { name: /actions for kitchen/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: /delete space/i }))
    await waitFor(() => {
      // Kitchen + its zone Back.
      expect(m.onDelete).toHaveBeenCalledWith(['a1', 'z1'])
    })
  })
})

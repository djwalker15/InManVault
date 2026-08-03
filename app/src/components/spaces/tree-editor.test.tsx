import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TreeEditor } from './tree-editor'
import type { SpaceNode, UnitType } from './types'

const baseNodes: SpaceNode[] = [
  { space_id: 'p', parent_id: null, unit_type: 'premises', name: 'My House' },
  { space_id: 'a', parent_id: 'p', unit_type: 'area', name: 'Kitchen' },
  { space_id: 'z', parent_id: 'a', unit_type: 'zone', name: 'Back' },
]

function makeMocks() {
  return {
    onAddChild: vi.fn(
      async (input: { parent_id: string; unit_type: UnitType; name: string }): Promise<SpaceNode> => ({
        space_id: 'new_child',
        parent_id: input.parent_id,
        unit_type: input.unit_type,
        name: input.name,
      }),
    ),
    onAddSibling: vi.fn(
      async (input: { parent_id: string; unit_type: UnitType; name: string }): Promise<SpaceNode> => ({
        space_id: 'new_sibling',
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

describe('TreeEditor', () => {
  it('renders an empty state when there are no roots', () => {
    const m = makeMocks()
    render(
      <TreeEditor
        nodes={[]}
        emptyState="No spaces yet."
        {...m}
      />,
    )
    expect(screen.getByText('No spaces yet.')).toBeInTheDocument()
  })

  it('renders the tree with action menus per node', () => {
    const m = makeMocks()
    render(<TreeEditor nodes={baseNodes} {...m} />)
    expect(screen.getByText('My House')).toBeInTheDocument()
    expect(screen.getByText('Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /actions for kitchen/i }),
    ).toBeInTheDocument()
  })

  it('highlights rows whose ids are in recentIds', () => {
    const m = makeMocks()
    render(
      <TreeEditor nodes={baseNodes} recentIds={new Set(['z'])} {...m} />,
    )
    const flagged = screen.getByText('Back').closest('div')
    expect(flagged?.className).toContain('animate-space-added')
    const plain = screen.getByText('Kitchen').closest('div')
    expect(plain?.className).not.toContain('animate-space-added')
  })

  it('add-child uses the smart default child type for the parent', async () => {
    const m = makeMocks()
    render(<TreeEditor nodes={baseNodes} {...m} />)
    fireEvent.click(
      screen.getByRole('button', { name: /actions for kitchen/i }),
    )
    // The default action panel surface includes the Add child tab.
    fireEvent.click(screen.getAllByRole('button', { name: /add child/i })[0])
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Pantry' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => {
      expect(m.onAddChild).toHaveBeenCalledWith({
        parent_id: 'a',
        unit_type: 'zone', // smart default for area parent
        name: 'Pantry',
      })
    })
  })

  it('add-sibling inserts under the same parent at the same type', async () => {
    const m = makeMocks()
    render(<TreeEditor nodes={baseNodes} {...m} />)
    fireEvent.click(screen.getByRole('button', { name: /actions for back/i }))
    fireEvent.click(screen.getByRole('button', { name: /add sibling/i }))
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Center' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => {
      expect(m.onAddSibling).toHaveBeenCalledWith({
        parent_id: 'a',
        unit_type: 'zone',
        name: 'Center',
      })
    })
  })

  it('rename submits the trimmed new name', async () => {
    const m = makeMocks()
    render(<TreeEditor nodes={baseNodes} {...m} />)
    fireEvent.click(
      screen.getByRole('button', { name: /actions for kitchen/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^rename$/i }))
    const input = screen.getByLabelText(/new name/i)
    fireEvent.change(input, { target: { value: '  Kitchen West  ' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(m.onRename).toHaveBeenCalledWith('a', 'Kitchen West')
    })
  })

  it('reclassify submits the picked unit_type', async () => {
    const m = makeMocks()
    // Back (zone, child of Kitchen area) is a leaf, so any of section /
    // sub_section / container / shelf is a valid reclassify target.
    render(<TreeEditor nodes={baseNodes} {...m} />)
    fireEvent.click(screen.getByRole('button', { name: /actions for back/i }))
    fireEvent.click(screen.getByRole('button', { name: /change type/i }))
    const select = screen.getByLabelText(/new unit type/i)
    fireEvent.change(select, { target: { value: 'section' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(m.onReclassify).toHaveBeenCalledWith('z', 'section')
    })
  })

  it('reclassify is hidden on the Premises root', () => {
    const m = makeMocks()
    render(<TreeEditor nodes={baseNodes} {...m} />)
    fireEvent.click(
      screen.getByRole('button', { name: /actions for my house/i }),
    )
    expect(
      screen.queryByRole('button', { name: /change type/i }),
    ).not.toBeInTheDocument()
  })

  it('Premises does not expose a delete or sibling action', () => {
    const m = makeMocks()
    render(<TreeEditor nodes={baseNodes} {...m} />)
    fireEvent.click(
      screen.getByRole('button', { name: /actions for my house/i }),
    )
    expect(
      screen.queryByRole('button', { name: /^delete$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /add sibling/i }),
    ).not.toBeInTheDocument()
  })

  it('delete cascades the descendant ids', async () => {
    const m = makeMocks()
    const wider: SpaceNode[] = [
      ...baseNodes,
      { space_id: 's', parent_id: 'z', unit_type: 'section', name: 'Above' },
      { space_id: 'sh', parent_id: 's', unit_type: 'shelf', name: 'Shelf 1' },
    ]
    render(<TreeEditor nodes={wider} {...m} />)
    fireEvent.click(
      screen.getByRole('button', { name: /actions for kitchen/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[1])
    await waitFor(() => {
      expect(m.onDelete).toHaveBeenCalled()
    })
    // Cascade: the deleted node + all live descendants.
    expect(m.onDelete).toHaveBeenCalledWith(
      expect.arrayContaining(['a', 's', 'sh', 'z']),
    )
  })
})

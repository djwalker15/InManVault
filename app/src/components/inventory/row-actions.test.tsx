import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { RowActions } from './row-actions'

/** RowActions calls useNavigate(), so it must render inside a Router. */
function renderRA(ui: React.ReactElement) {
  return render(ui, { wrapper: MemoryRouter })
}

const sampleSpaces = [
  { space_id: 's_p', parent_id: null, unit_type: 'premises', name: 'My House' },
  { space_id: 's_a', parent_id: 's_p', unit_type: 'area', name: 'Kitchen' },
  { space_id: 's_b', parent_id: 's_p', unit_type: 'area', name: 'Bar' },
]

const baseProps = {
  crewId: 'crew_abc',
  inventoryItemId: 'item_1',
  currentSpaceId: 's_a',
  homeSpaceId: null as string | null,
  unit: 'count',
  quantity: 1,
  lastUnitCost: null as number | null,
  isPackage: false,
  category_id: null as string | null,
  min_stock: null as number | null,
  expiry_date: null as string | null,
  notes: null as string | null,
  categories: [] as { category_id: string; name: string; crew_id: string | null }[],
  onChanged: () => {},
}

describe('RowActions', () => {
  it('renders all primary action buttons', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({ spaces: { select: { data: sampleSpaces, error: null } } })
    renderRA(<RowActions {...baseProps} />)
    expect(screen.getByRole('button', { name: /^move$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^remove$/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    // Set home shows when home is null (unsorted)
    expect(
      screen.getByRole('button', { name: /set home/i }),
    ).toBeInTheDocument()
    // Put back is only displaced
    expect(
      screen.queryByRole('button', { name: /put back/i }),
    ).toBeNull()
    // Log waste is live (disabled only at zero quantity)
    expect(
      screen.getByRole('button', { name: /log waste/i }),
    ).toBeEnabled()
    // Remaining stub button
    expect(
      screen.getByRole('button', { name: /add to list/i }),
    ).toBeDisabled()
  })

  it('shows Put back when displaced and hides Set home', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({ spaces: { select: { data: sampleSpaces, error: null } } })
    renderRA(<RowActions {...baseProps} homeSpaceId="s_b" currentSpaceId="s_a" />,
    )
    expect(
      screen.getByRole('button', { name: /put back/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /set home/i }),
    ).toBeNull()
  })

  it('Move opens the picker and calls record_transfer on submit', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const onChanged = vi.fn()
    const sb = makeSupabaseMock(
      { spaces: { select: { data: sampleSpaces, error: null } } },
      { record_transfer: { data: 'flow_1', error: null } },
    )
    renderRA(<RowActions {...baseProps} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: /^move$/i }))
    await waitFor(() => {
      expect(
        screen.getAllByRole('option', { name: 'My House › Bar' }).length,
      ).toBeGreaterThan(0)
    })
    fireEvent.change(screen.getByLabelText(/new current location/i), {
      target: { value: 's_b' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^confirm move$/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('record_transfer', {
        p_inventory_item_id: 'item_1',
        p_to_space_id: 's_b',
        p_notes: null,
      })
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('Put back fires record_transfer with home as the destination', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const onChanged = vi.fn()
    const sb = makeSupabaseMock(
      { spaces: { select: { data: sampleSpaces, error: null } } },
      { record_transfer: { data: 'flow_pb', error: null } },
    )
    renderRA(<RowActions
        {...baseProps}
        homeSpaceId="s_b"
        currentSpaceId="s_a"
        onChanged={onChanged}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /put back/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith(
        'record_transfer',
        expect.objectContaining({
          p_inventory_item_id: 'item_1',
          p_to_space_id: 's_b',
        }),
      )
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('Set home updates inventory_items.home_space_id', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const onChanged = vi.fn()
    const sb = makeSupabaseMock({
      spaces: { select: { data: sampleSpaces, error: null } },
      inventory_items: { update: { data: null, error: null } },
    })
    renderRA(<RowActions {...baseProps} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: /^set home$/i }))
    await waitFor(() => {
      expect(
        screen.getAllByRole('option', { name: 'My House › Kitchen' }).length,
      ).toBeGreaterThan(0)
    })
    fireEvent.change(screen.getByLabelText(/^home location$/i), {
      target: { value: 's_a' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save home$/i }))
    await waitFor(() => {
      expect(sb.tables.inventory_items.update).toHaveBeenCalledWith({
        home_space_id: 's_a',
      })
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('Edit form updates category, min_stock, expiry, and notes', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const onChanged = vi.fn()
    const sb = makeSupabaseMock({
      spaces: { select: { data: sampleSpaces, error: null } },
      inventory_items: { update: { data: null, error: null } },
    })
    renderRA(<RowActions
        {...baseProps}
        min_stock={2}
        notes="something"
        categories={[
          { category_id: 'c1', name: 'Spices', crew_id: null },
          { category_id: 'c2', name: 'Pantry', crew_id: null },
        ]}
        onChanged={onChanged}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/^category$/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/^category$/i), {
      target: { value: 'c1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(sb.tables.inventory_items.update).toHaveBeenCalledWith({
        category_id: 'c1',
        min_stock: 2,
        expiry_date: null,
        notes: 'something',
      })
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('Use opens the consume form and calls record_consumption', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const onChanged = vi.fn()
    const sb = makeSupabaseMock(
      { spaces: { select: { data: sampleSpaces, error: null } } },
      { record_consumption: { data: 'flow_use', error: null } },
    )
    renderRA(<RowActions {...baseProps} quantity={4} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: /^use$/i }))
    fireEvent.click(screen.getByRole('button', { name: /record use/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('record_consumption', {
        p_inventory_item_id: 'item_1',
        p_quantity: 1,
        p_notes: null,
      })
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('disables Use at zero quantity', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({ spaces: { select: { data: sampleSpaces, error: null } } })
    renderRA(<RowActions {...baseProps} quantity={0} />)
    expect(screen.getByRole('button', { name: /^use$/i })).toBeDisabled()
  })

  it('Log waste opens the waste form and calls record_waste', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const onChanged = vi.fn()
    const sb = makeSupabaseMock(
      { spaces: { select: { data: sampleSpaces, error: null } } },
      { record_waste: { data: 'flow_w', error: null } },
    )
    renderRA(
      <RowActions
        {...baseProps}
        quantity={3}
        expiry_date="2026-07-01"
        onChanged={onChanged}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /log waste/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /log waste — deducts 1 count/i }),
    )
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith(
        'record_waste',
        expect.objectContaining({
          p_inventory_item_id: 'item_1',
          p_quantity: 1,
          p_waste_reason: 'expired',
          p_details: { expiry_date: '2026-07-01', was_opened: false },
        }),
      )
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('Adjust opens the count form and calls record_adjustment', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const onChanged = vi.fn()
    const sb = makeSupabaseMock(
      { spaces: { select: { data: sampleSpaces, error: null } } },
      { record_adjustment: { data: 'flow_adj', error: null } },
    )
    renderRA(<RowActions {...baseProps} quantity={5} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: /^adjust$/i }))
    fireEvent.change(screen.getByLabelText(/actual count on shelf/i), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /correct count/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('record_adjustment', {
        p_inventory_item_id: 'item_1',
        p_actual_quantity: 2,
        p_reason: null,
        p_notes: null,
        p_audit_session_id: null,
      })
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('Remove requires the confirm panel and calls soft_delete_inventory_item', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const onChanged = vi.fn()
    const sb = makeSupabaseMock(
      { spaces: { select: { data: sampleSpaces, error: null } } },
      { soft_delete_inventory_item: { data: null, error: null } },
    )
    renderRA(<RowActions {...baseProps} quantity={3} onChanged={onChanged} />)
    // No RPC before the confirm step
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }))
    expect(sb.rpc).not.toHaveBeenCalled()
    expect(
      screen.getByText(/will be zeroed out with an adjustment/i),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'no longer stocking' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^remove item$/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('soft_delete_inventory_item', {
        p_inventory_item_id: 'item_1',
        p_reason: 'no longer stocking',
      })
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('Remove surfaces the RPC error for non-admins', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock(
      { spaces: { select: { data: sampleSpaces, error: null } } },
      {
        soft_delete_inventory_item: {
          data: null,
          error: new Error('Only crew admins or the owner can remove items'),
        },
      },
    )
    renderRA(<RowActions {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^remove item$/i }))
    await waitFor(() => {
      expect(
        screen.getByText('Only crew admins or the owner can remove items'),
      ).toBeInTheDocument()
    })
  })

  it('hides Open for non-package items', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({ spaces: { select: { data: sampleSpaces, error: null } } })
    renderRA(<RowActions {...baseProps} isPackage={false} quantity={3} />)
    expect(screen.queryByRole('button', { name: /^open$/i })).toBeNull()
  })

  it('shows Open for a package and disables it at zero quantity', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({ spaces: { select: { data: sampleSpaces, error: null } } })
    const { rerender } = renderRA(
      <RowActions {...baseProps} isPackage quantity={3} />,
    )
    expect(
      screen.getByRole('button', { name: /^open$/i }),
    ).toBeInTheDocument()
    rerender(<RowActions {...baseProps} isPackage quantity={0} />)
    expect(screen.getByRole('button', { name: /^open$/i })).toBeDisabled()
  })
})

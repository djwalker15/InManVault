import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { RestockForm } from './restock-form'
import type { ExistingItemRow } from './types'

const row: ExistingItemRow = {
  item: {
    inventory_item_id: 'item_1',
    crew_id: 'crew_abc',
    product_id: 'prod_1',
    current_space_id: 'space_a',
    quantity: 3,
    unit: 'count',
  },
  product: {
    product_id: 'prod_1',
    crew_id: null,
    name: 'Tomato Paste',
    brand: 'Heinz',
    barcode: null,
    image_url: null,
    size_value: 6,
    size_unit: 'oz',
    default_category_id: null,
  },
  locationPath: 'My House › Kitchen',
}

describe('RestockForm', () => {
  it('renders the existing-stock summary', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(
      <RestockForm row={row} onSaved={() => {}} onCancel={() => {}} />,
    )
    expect(
      screen.getByRole('heading', { name: /tomato paste/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/3 count/i)).toBeInTheDocument()
    expect(screen.getByText(/my house . kitchen/i)).toBeInTheDocument()
  })

  it('shows a live new-total preview as quantity changes', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(
      <RestockForm row={row} onSaved={() => {}} onCancel={() => {}} />,
    )
    fireEvent.change(screen.getByLabelText(/quantity to add/i), {
      target: { value: '5' },
    })
    expect(screen.getByText(/new total: 8 count/i)).toBeInTheDocument()
  })

  it('calls restock_inventory RPC with the additive quantity', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock(
      {},
      { restock_inventory: { data: 'flow_new', error: null } },
    )
    const onSaved = vi.fn()
    render(
      <RestockForm row={row} onSaved={onSaved} onCancel={() => {}} />,
    )
    fireEvent.change(screen.getByLabelText(/quantity to add/i), {
      target: { value: '4' },
    })
    fireEvent.change(screen.getByLabelText(/unit cost/i), {
      target: { value: '2.49' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^restock$/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('restock_inventory', {
        p_inventory_item_id: 'item_1',
        p_quantity: 4,
        p_unit_cost: 2.49,
        p_notes: null,
        p_source: null,
      })
    })
    expect(onSaved).toHaveBeenCalledWith(7)
  })

  it('surfaces an RPC error and stays on the form', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock(
      {},
      {
        restock_inventory: {
          data: null,
          error: new Error('Inventory item not found or deleted'),
        },
      },
    )
    const onSaved = vi.fn()
    render(
      <RestockForm row={row} onSaved={onSaved} onCancel={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^restock$/i }))
    await waitFor(() => {
      expect(
        screen.getByText('Inventory item not found or deleted'),
      ).toBeInTheDocument()
    })
    expect(onSaved).not.toHaveBeenCalled()
  })
})

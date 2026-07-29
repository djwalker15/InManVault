import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { ConsumeForm } from './consume-form'

const baseProps = {
  inventoryItemId: 'item_1',
  unit: 'count',
  quantity: 4,
  busy: false,
  setBusy: () => {},
  setError: () => {},
  onCancel: () => {},
  onSaved: () => {},
}

describe('ConsumeForm', () => {
  it('defaults to 1 for count units and previews the remainder', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(<ConsumeForm {...baseProps} />)
    expect(screen.getByLabelText(/quantity used/i)).toHaveValue(1)
    expect(screen.getByText(/left after: 3 count/i)).toBeInTheDocument()
  })

  it('starts empty for measured units', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(<ConsumeForm {...baseProps} unit="oz" quantity={12} />)
    expect(screen.getByLabelText(/quantity used/i)).toHaveValue(null)
    expect(
      screen.getByRole('button', { name: /record use/i }),
    ).toBeDisabled()
  })

  it('blocks using more than is on hand', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(<ConsumeForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/quantity used/i), {
      target: { value: '9' },
    })
    expect(screen.getByText(/only 4 count on hand/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /record use/i }),
    ).toBeDisabled()
  })

  it('calls record_consumption with quantity and notes', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock(
      {},
      { record_consumption: { data: 'flow_use', error: null } },
    )
    const onSaved = vi.fn()
    render(<ConsumeForm {...baseProps} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/quantity used/i), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'dinner' },
    })
    fireEvent.click(screen.getByRole('button', { name: /record use/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('record_consumption', {
        p_inventory_item_id: 'item_1',
        p_quantity: 2,
        p_notes: 'dinner',
      })
    })
    expect(onSaved).toHaveBeenCalled()
  })

  it('reports an RPC error through setError and does not save', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock(
      {},
      {
        record_consumption: {
          data: null,
          error: new Error('Cannot use more than the 4 count on hand'),
        },
      },
    )
    const onSaved = vi.fn()
    const setError = vi.fn()
    render(
      <ConsumeForm {...baseProps} onSaved={onSaved} setError={setError} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /record use/i }))
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith(
        'Cannot use more than the 4 count on hand',
      )
    })
    expect(onSaved).not.toHaveBeenCalled()
  })
})

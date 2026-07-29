import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { AdjustForm } from './adjust-form'

const baseProps = {
  inventoryItemId: 'item_1',
  unit: 'count',
  quantity: 5,
  busy: false,
  setBusy: () => {},
  setError: () => {},
  onCancel: () => {},
  onSaved: () => {},
}

describe('AdjustForm', () => {
  it('shows the tracked quantity and disables submit until a different count is entered', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(<AdjustForm {...baseProps} />)
    expect(screen.getByText(/tracked: 5 count/i)).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /correct count/i })
    expect(submit).toBeDisabled()
    // Same-as-tracked count stays disabled
    fireEvent.change(screen.getByLabelText(/actual count on shelf/i), {
      target: { value: '5' },
    })
    expect(screen.getByText(/no change/i)).toBeInTheDocument()
    expect(submit).toBeDisabled()
  })

  it('previews the signed delta as the count changes', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(<AdjustForm {...baseProps} />)
    const input = screen.getByLabelText(/actual count on shelf/i)
    fireEvent.change(input, { target: { value: '3' } })
    expect(screen.getByText(/change: −2 count/i)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '8' } })
    expect(screen.getByText(/change: \+3 count/i)).toBeInTheDocument()
  })

  it('calls record_adjustment with the actual count and reason', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock(
      {},
      { record_adjustment: { data: 'flow_adj', error: null } },
    )
    const onSaved = vi.fn()
    render(<AdjustForm {...baseProps} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/actual count on shelf/i), {
      target: { value: '3' },
    })
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'two were used untracked' },
    })
    fireEvent.click(screen.getByRole('button', { name: /correct count/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('record_adjustment', {
        p_inventory_item_id: 'item_1',
        p_actual_quantity: 3,
        p_reason: 'two were used untracked',
        p_notes: null,
        p_audit_session_id: null,
      })
    })
    expect(onSaved).toHaveBeenCalled()
  })

  it('reports an RPC error through setError and does not save', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock(
      {},
      {
        record_adjustment: {
          data: null,
          error: new Error('Only crew admins or the owner can adjust counts'),
        },
      },
    )
    const onSaved = vi.fn()
    const setError = vi.fn()
    render(<AdjustForm {...baseProps} onSaved={onSaved} setError={setError} />)
    fireEvent.change(screen.getByLabelText(/actual count on shelf/i), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: /correct count/i }))
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith(
        'Only crew admins or the owner can adjust counts',
      )
    })
    expect(onSaved).not.toHaveBeenCalled()
  })
})

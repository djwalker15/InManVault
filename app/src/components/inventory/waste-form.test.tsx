import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import * as mediaLib from '@/lib/media'
import { WasteForm } from './waste-form'

vi.mock('@/lib/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/media')>()
  return { ...actual, uploadCrewImage: vi.fn() }
})

const uploadCrewImage = vi.mocked(mediaLib.uploadCrewImage)

const baseProps = {
  crewId: 'crew_abc',
  inventoryItemId: 'item_1',
  unit: 'count',
  quantity: 6,
  lastUnitCost: 2.5 as number | null,
  expiryDate: null as string | null,
  busy: false,
  setBusy: () => {},
  setError: () => {},
  onNotice: () => {},
  onCancel: () => {},
  onSaved: () => {},
}

describe('WasteForm', () => {
  it('previews the cost from last unit cost', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(<WasteForm {...baseProps} />)
    // Default qty 1 for count units × $2.50
    expect(screen.getByText(/cost: \$2\.50/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/quantity wasted/i), {
      target: { value: '2' },
    })
    expect(screen.getByText(/cost: \$5\.00/i)).toBeInTheDocument()
  })

  it('shows "not tracked" when there is no cost data', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(<WasteForm {...baseProps} lastUnitCost={null} />)
    expect(screen.getByText(/cost: not tracked/i)).toBeInTheDocument()
  })

  it('swaps detail fields when the reason changes', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(<WasteForm {...baseProps} />)
    // Default reason: expired
    expect(screen.getByText(/expiry date/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: 'spilled' },
    })
    expect(screen.queryByText(/expiry date/i)).toBeNull()
    expect(screen.getByLabelText(/how did it spill/i)).toBeInTheDocument()
  })

  it('gates submit on the per-reason required field', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(<WasteForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: 'damaged' },
    })
    const submit = screen.getByRole('button', { name: /log waste/i })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/how was it damaged/i), {
      target: { value: 'dropped' },
    })
    expect(submit).toBeEnabled()
  })

  it('blocks wasting more than is on hand', () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock()
    render(<WasteForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/quantity wasted/i), {
      target: { value: '11' },
    })
    expect(screen.getByText(/only 6 count on hand/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log waste/i })).toBeDisabled()
  })

  it('prefills the expiry date from the item and submits the details payload', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock(
      {},
      { record_waste: { data: 'flow_w', error: null } },
    )
    const onSaved = vi.fn()
    render(
      <WasteForm {...baseProps} expiryDate="2026-07-20" onSaved={onSaved} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /log waste — deducts 1 count/i }),
    )
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('record_waste', {
        p_inventory_item_id: 'item_1',
        p_quantity: 1,
        p_waste_reason: 'expired',
        p_notes: null,
        p_photo_url: null,
        p_details: { expiry_date: '2026-07-20', was_opened: false },
      })
    })
    expect(onSaved).toHaveBeenCalled()
  })

  it('submits spilled details and reports RPC errors via setError', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock(
      {},
      {
        record_waste: {
          data: null,
          error: new Error('Cannot waste more than the 6 count on hand'),
        },
      },
    )
    const setError = vi.fn()
    const onSaved = vi.fn()
    render(
      <WasteForm {...baseProps} setError={setError} onSaved={onSaved} />,
    )
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: 'spilled' },
    })
    fireEvent.change(screen.getByLabelText(/how did it spill/i), {
      target: { value: 'knocked over' },
    })
    fireEvent.click(screen.getByRole('button', { name: /log waste/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith(
        'record_waste',
        expect.objectContaining({
          p_waste_reason: 'spilled',
          p_details: { how_spilled: 'knocked over', during_activity: null },
        }),
      )
    })
    expect(setError).toHaveBeenCalledWith(
      'Cannot waste more than the 6 count on hand',
    )
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('uploads the photo first and passes its path as p_photo_url', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock({}, { record_waste: { data: 'flow_1', error: null } })
    uploadCrewImage.mockResolvedValue('crew_abc/waste/photo.jpg')
    const onSaved = vi.fn()
    render(<WasteForm {...baseProps} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/expiry date/i), {
      target: { value: '2026-08-01' },
    })
    const photo = new File(['img'], 'moldy.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText(/add a photo/i), {
      target: { files: [photo] },
    })
    fireEvent.click(screen.getByRole('button', { name: /log waste/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith(
        'record_waste',
        expect.objectContaining({ p_photo_url: 'crew_abc/waste/photo.jpg' }),
      )
    })
    expect(uploadCrewImage).toHaveBeenCalledWith(
      expect.anything(),
      'crew_abc',
      'waste',
      photo,
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('records the waste photo-less with a notice when the upload fails', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock({}, { record_waste: { data: 'flow_1', error: null } })
    uploadCrewImage.mockRejectedValue(new Error('storage down'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onNotice = vi.fn()
    const onSaved = vi.fn()
    render(<WasteForm {...baseProps} onNotice={onNotice} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/expiry date/i), {
      target: { value: '2026-08-01' },
    })
    fireEvent.change(screen.getByLabelText(/add a photo/i), {
      target: { files: [new File(['img'], 'moldy.jpg', { type: 'image/jpeg' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /log waste/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith(
        'record_waste',
        expect.objectContaining({ p_photo_url: null }),
      )
    })
    expect(onNotice).toHaveBeenCalledWith(
      expect.stringMatching(/photo upload failed/i),
    )
    expect(onSaved).toHaveBeenCalled()
    warn.mockRestore()
  })
})

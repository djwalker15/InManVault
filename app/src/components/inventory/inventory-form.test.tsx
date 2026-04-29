import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { InventoryForm } from './inventory-form'
import type { Selection } from './types'

const product = {
  product_id: 'prod_1',
  crew_id: null,
  name: 'Tomato Paste',
  brand: 'Heinz',
  barcode: null,
  image_url: null,
  size_value: 6,
  size_unit: 'oz',
  default_category_id: null,
}

const sampleSpaces = [
  { space_id: 'p', parent_id: null, unit_type: 'premises', name: 'My House' },
  { space_id: 'a', parent_id: 'p', unit_type: 'area', name: 'Kitchen' },
]

const sampleUnits = [
  { unit: 'count', unit_category: 'count' },
  { unit: 'oz', unit_category: 'weight' },
]

describe('InventoryForm', () => {
  it('renders the selected product header + form fields', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      categories: { select: { data: [], error: null } },
      unit_definitions: { select: { data: sampleUnits, error: null } },
      spaces: { select: { data: sampleSpaces, error: null } },
    })
    const selection: Selection = { kind: 'product', product }
    render(
      <InventoryForm
        crewId="crew_abc"
        selection={selection}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByText('Tomato Paste')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByLabelText(/^quantity$/i)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/^unit$/i)).toBeInTheDocument()
  })

  it('disables the submit button until quantity + unit + current space are valid', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      categories: { select: { data: [], error: null } },
      unit_definitions: { select: { data: sampleUnits, error: null } },
      spaces: { select: { data: sampleSpaces, error: null } },
    })
    const selection: Selection = { kind: 'product', product }
    render(
      <InventoryForm
        crewId="crew_abc"
        selection={selection}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    )
    await waitFor(() => {
      expect(screen.getByLabelText('Current location')).toBeInTheDocument()
    })
    const submit = screen.getByRole('button', { name: /add to inventory/i })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Current location'), {
      target: { value: 'a' },
    })
    expect(submit).toBeEnabled()
  })

  it('calls record_purchase RPC with the form values atomically', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const sb = makeSupabaseMock(
      {
        categories: { select: { data: [], error: null } },
        unit_definitions: { select: { data: sampleUnits, error: null } },
        spaces: { select: { data: sampleSpaces, error: null } },
      },
      { record_purchase: { data: 'item_new', error: null } },
    )
    const onSaved = vi.fn()
    const selection: Selection = { kind: 'product', product }
    render(
      <InventoryForm
        crewId="crew_abc"
        selection={selection}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    )
    // Wait for the SpaceSelect options to populate. There are two selects
    // (current + home location); checking that at least one option exists
    // is enough — both selects share the same option list.
    await waitFor(() => {
      expect(
        screen.getAllByRole('option', { name: 'My House › Kitchen' }).length,
      ).toBeGreaterThan(0)
    })

    fireEvent.change(screen.getByLabelText('Current location'), {
      target: { value: 'a' },
    })
    fireEvent.change(screen.getByLabelText(/^quantity$/i), {
      target: { value: '2' },
    })

    const submit = screen.getByRole('button', { name: /add to inventory/i })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)

    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith(
        'record_purchase',
        expect.objectContaining({
          p_product_id: 'prod_1',
          p_quantity: 2,
          p_unit: 'oz',
          p_current_space_id: 'a',
        }),
      )
    })
    expect(onSaved).toHaveBeenCalledWith('item_new')
  })

  it('surfaces an RPC error and stays on the form', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock(
      {
        categories: { select: { data: [], error: null } },
        unit_definitions: { select: { data: sampleUnits, error: null } },
        spaces: { select: { data: sampleSpaces, error: null } },
      },
      { record_purchase: { data: null, error: new Error('Product not accessible') } },
    )
    const onSaved = vi.fn()
    const selection: Selection = { kind: 'product', product }
    render(
      <InventoryForm
        crewId="crew_abc"
        selection={selection}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    )
    await waitFor(() => {
      expect(
        screen.getAllByRole('option', { name: 'My House › Kitchen' }).length,
      ).toBeGreaterThan(0)
    })
    fireEvent.change(screen.getByLabelText('Current location'), {
      target: { value: 'a' },
    })
    const submit = screen.getByRole('button', { name: /add to inventory/i })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)
    await waitFor(() => {
      expect(screen.getByText('Product not accessible')).toBeInTheDocument()
    })
    expect(onSaved).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import QuickAddPage from './quick'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const crewMembers = {
  crew_members: {
    select: {
      data: [
        {
          crew_id: 'crew_abc',
          role: 'admin',
          crews: { name: 'Test', owner_id: 'user_1' },
        },
      ],
      error: null,
    },
  },
}

const spaces = {
  spaces: {
    select: {
      data: [
        { space_id: 'p', parent_id: null, unit_type: 'premises', name: 'My House', deleted_at: null },
        { space_id: 'a', parent_id: 'p', unit_type: 'area', name: 'Kitchen', deleted_at: null },
      ],
      error: null,
    },
  },
}

const units = {
  unit_definitions: {
    select: {
      data: [
        { unit: 'count', unit_category: 'count' },
        { unit: 'oz', unit_category: 'weight' },
      ],
      error: null,
    },
  },
}

const masterProduct = {
  product_id: 'prod_master_1',
  crew_id: null,
  name: 'Tomato Paste',
  brand: 'Heinz',
  barcode: null,
  image_url: null,
  size_value: 6,
  size_unit: 'oz',
  default_category_id: null,
}

describe('QuickAddPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockClerk({ user: { id: 'user_1' } })
  })

  it('defaults quantity to 1, unit to count, and location to the Premises', async () => {
    makeSupabaseMock({ ...crewMembers, ...spaces, ...units })
    renderWithRouter(<QuickAddPage />)

    expect((await screen.findByLabelText('Quantity')) as HTMLInputElement).toHaveValue(1)
    expect(screen.getByLabelText('Unit')).toHaveValue('count')
    await waitFor(() => {
      expect(screen.getByLabelText('Location')).toHaveValue('p')
    })
  })

  it('creates a name-only custom product when no catalog match is chosen', async () => {
    const newProduct = { ...masterProduct, product_id: 'prod_custom_1', crew_id: 'crew_abc', name: 'Homemade syrup' }
    const sb = makeSupabaseMock(
      {
        ...crewMembers,
        ...spaces,
        ...units,
        products: {
          select: { data: [], error: null },
          single: { data: newProduct, error: null },
        },
      },
      { record_purchase: { data: 'item_new', error: null } },
    )
    renderWithRouter(<QuickAddPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Location')).toHaveValue('p')
    })
    fireEvent.change(screen.getByLabelText(/what did you get/i), {
      target: { value: 'Homemade syrup' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add to inventory/i }))

    await waitFor(() => {
      expect(sb.tables.products.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          crew_id: 'crew_abc',
          name: 'Homemade syrup',
          source: 'crew_created',
          created_by: 'user_1',
        }),
      )
    })
    expect(sb.rpc).toHaveBeenCalledWith(
      'record_purchase',
      expect.objectContaining({
        p_crew_id: 'crew_abc',
        p_product_id: 'prod_custom_1',
        p_quantity: 1,
        p_unit: 'count',
        p_current_space_id: 'p',
      }),
    )
    await waitFor(() => {
      expect(screen.getByText(/added homemade syrup/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/1 item added this session/i)).toBeInTheDocument()
  })

  it('explains what is missing on submit instead of silently disabling', async () => {
    const sb = makeSupabaseMock({ ...crewMembers, ...spaces, ...units })
    renderWithRouter(<QuickAddPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Location')).toHaveValue('p')
    })
    // No product typed or picked yet — the CTA stays tappable and explains.
    const submit = screen.getByRole('button', { name: /add to inventory/i })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    await waitFor(() => {
      expect(
        screen.getByText('Type or pick a product first.'),
      ).toBeInTheDocument()
    })
    expect(sb.rpc).not.toHaveBeenCalled()
  })

  it('uses a chosen catalog product without creating a new one', async () => {
    const sb = makeSupabaseMock(
      {
        ...crewMembers,
        ...spaces,
        ...units,
        products: { select: { data: [masterProduct], error: null } },
      },
      { record_purchase: { data: 'item_new', error: null } },
    )
    renderWithRouter(<QuickAddPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Location')).toHaveValue('p')
    })
    fireEvent.change(screen.getByLabelText(/what did you get/i), {
      target: { value: 'tom' },
    })
    const match = await screen.findByRole('button', { name: /tomato paste/i }, { timeout: 2000 })
    fireEvent.click(match)
    fireEvent.click(screen.getByRole('button', { name: /add to inventory/i }))

    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith(
        'record_purchase',
        expect.objectContaining({
          p_crew_id: 'crew_abc',
          p_product_id: 'prod_master_1',
        }),
      )
    })
    expect(sb.tables.products.insert).not.toHaveBeenCalled()
  })
})

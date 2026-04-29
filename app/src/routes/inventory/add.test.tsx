import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import AddInventoryPage from './add'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

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

const existingItem = {
  inventory_item_id: 'item_1',
  crew_id: 'crew_abc',
  product_id: 'prod_master_1',
  current_space_id: 'space_a',
  quantity: 3,
  unit: 'count',
}

const sampleSpaces = [
  { space_id: 'space_a', name: 'Cabinet 1', parent_id: 'space_p' },
  { space_id: 'space_p', name: 'Kitchen', parent_id: null },
]

describe('AddInventoryPage — Step 1 product resolution', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockClerk({ user: { id: 'user_1' } })
  })

  it('renders the search field and the create-custom CTA', async () => {
    makeSupabaseMock({
      crew_members: {
        maybeSingle: { data: { crew_id: 'crew_abc' }, error: null },
      },
    })
    renderWithRouter(<AddInventoryPage />)
    await waitFor(() => {
      expect(screen.getByText(/search for a product/i)).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: /create a custom product/i }),
    ).toBeInTheDocument()
  })

  it('searches as the user types and groups catalog vs existing inventory', async () => {
    makeSupabaseMock({
      crew_members: {
        maybeSingle: { data: { crew_id: 'crew_abc' }, error: null },
      },
      products: { select: { data: [masterProduct], error: null } },
      inventory_items: { select: { data: [existingItem], error: null } },
      spaces: { select: { data: sampleSpaces, error: null } },
    })
    renderWithRouter(<AddInventoryPage />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/tomato paste/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByPlaceholderText(/tomato paste/i), {
      target: { value: 'tom' },
    })
    await waitFor(
      () => {
        expect(screen.getByText(/in your inventory/i)).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
    expect(screen.getByText(/catalog matches/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /restock this/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /add another/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Kitchen › Cabinet 1/)).toBeInTheDocument()
  })

  it('selects a catalog product and routes to the inventory form (P3.4)', async () => {
    makeSupabaseMock({
      crew_members: {
        maybeSingle: { data: { crew_id: 'crew_abc' }, error: null },
      },
      products: { select: { data: [masterProduct], error: null } },
      inventory_items: { select: { data: [], error: null } },
      categories: { select: { data: [], error: null } },
      unit_definitions: { select: { data: [], error: null } },
      spaces: { select: { data: [], error: null } },
    })
    renderWithRouter(<AddInventoryPage />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/tomato paste/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByPlaceholderText(/tomato paste/i), {
      target: { value: 'tom' },
    })
    await waitFor(
      () => {
        expect(screen.getByText(/catalog matches/i)).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
    fireEvent.click(screen.getByRole('button', { name: /tomato paste/i }))
    expect(
      screen.getByRole('button', { name: /add to inventory/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Current location')).toBeInTheDocument()
  })

  it('Restock on existing item routes to the RestockForm', async () => {
    makeSupabaseMock({
      crew_members: {
        maybeSingle: { data: { crew_id: 'crew_abc' }, error: null },
      },
      products: { select: { data: [masterProduct], error: null } },
      inventory_items: { select: { data: [existingItem], error: null } },
      spaces: { select: { data: sampleSpaces, error: null } },
    })
    renderWithRouter(<AddInventoryPage />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/tomato paste/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByPlaceholderText(/tomato paste/i), {
      target: { value: 'tom' },
    })
    await waitFor(
      () => {
        expect(
          screen.getByRole('button', { name: /restock this/i }),
        ).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
    fireEvent.click(screen.getByRole('button', { name: /restock this/i }))
    // Now on the restock form — quantity-to-add field, scoped Restock CTA.
    expect(screen.getByLabelText(/quantity to add/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^restock$/i })).toBeInTheDocument()
    expect(screen.getByText(/3 count/i)).toBeInTheDocument()
  })

  it('opens the custom-product form and creates a crew-private product', async () => {
    const newProduct = {
      product_id: 'prod_custom_1',
      crew_id: 'crew_abc',
      name: 'Homemade syrup',
      brand: null,
      barcode: null,
      image_url: null,
      size_value: null,
      size_unit: null,
      default_category_id: null,
    }
    const sb = makeSupabaseMock({
      crew_members: {
        maybeSingle: { data: { crew_id: 'crew_abc' }, error: null },
      },
      categories: { select: { data: [], error: null } },
      unit_definitions: { select: { data: [], error: null } },
      spaces: { select: { data: [], error: null } },
      products: { single: { data: newProduct, error: null } },
    })
    renderWithRouter(<AddInventoryPage />)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create a custom product/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(
      screen.getByRole('button', { name: /create a custom product/i }),
    )
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /create a custom product/i }),
      ).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: 'Homemade syrup' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create product/i }))
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
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /add to inventory/i }),
      ).toBeInTheDocument()
    })
  })

  it('after a successful save, returns to search with a session counter', async () => {
    makeSupabaseMock(
      {
        crew_members: {
          maybeSingle: { data: { crew_id: 'crew_abc' }, error: null },
        },
        products: { select: { data: [masterProduct], error: null } },
        inventory_items: { select: { data: [], error: null } },
        categories: { select: { data: [], error: null } },
        unit_definitions: {
          select: { data: [{ unit: 'oz', unit_category: 'weight' }], error: null },
        },
        spaces: {
          select: {
            data: [
              { space_id: 'p', parent_id: null, unit_type: 'premises', name: 'My House' },
              { space_id: 'a', parent_id: 'p', unit_type: 'area', name: 'Kitchen' },
            ],
            error: null,
          },
        },
      },
      { record_purchase: { data: 'item_new', error: null } },
    )
    renderWithRouter(<AddInventoryPage />)
    fireEvent.change(
      await screen.findByPlaceholderText(/tomato paste/i),
      { target: { value: 'tom' } },
    )
    await waitFor(
      () => {
        expect(screen.getByText(/catalog matches/i)).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
    fireEvent.click(screen.getByRole('button', { name: /tomato paste/i }))
    fireEvent.change(await screen.findByLabelText('Current location'), {
      target: { value: 'a' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add to inventory/i }))
    await waitFor(() => {
      expect(screen.getByText(/added tomato paste/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/1 item added this session/i)).toBeInTheDocument()
    expect(screen.getByText(/search for a product/i)).toBeInTheDocument()
  })

  it('back-arrow routes to /inventory', async () => {
    makeSupabaseMock({
      crew_members: {
        maybeSingle: { data: { crew_id: 'crew_abc' }, error: null },
      },
    })
    renderWithRouter(<AddInventoryPage />)
    await waitFor(() => {
      expect(screen.getByLabelText(/back to inventory/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByLabelText(/back to inventory/i))
    expect(mockNavigate).toHaveBeenCalledWith('/inventory')
  })
})

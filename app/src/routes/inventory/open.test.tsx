import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithRoutes } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import OpenPackagePage from './open'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const packageItem = {
  inventory_item_id: 'item_pkg',
  product_id: 'prod_pkg',
  quantity: 3,
  unit: 'pkg',
  current_space_id: 'space_a',
  last_unit_cost: 12,
}

const componentRows = [
  { component_product_id: 'c_coke', quantity: 4, unit: 'count', sort_order: 0 },
  { component_product_id: 'c_sprite', quantity: 4, unit: 'count', sort_order: 1 },
  { component_product_id: 'c_fanta', quantity: 4, unit: 'count', sort_order: 2 },
]

const componentNames = [
  { product_id: 'c_coke', name: 'Coke 12oz can' },
  { product_id: 'c_sprite', name: 'Sprite 12oz can' },
  { product_id: 'c_fanta', name: 'Fanta 12oz can' },
]

const unitDefs = [
  { unit: 'count', unit_category: 'count', to_base_factor: 1 },
  { unit: 'pkg', unit_category: 'count', to_base_factor: 1 },
]

const sampleSpaces = [
  { space_id: 'space_a', name: 'Pantry', parent_id: 'space_p' },
  { space_id: 'space_p', name: 'Demo Kitchen', parent_id: null },
]

function mockForOpen(
  rpcResult: { data: unknown; error: Error | null } = {
    data: 'evt_1',
    error: null,
  },
) {
  return makeSupabaseMock(
    {
      crew_members: {
        select: {
          data: [
            {
              crew_id: 'crew_abc',
              role: 'admin',
              crews: { name: 'Demo', owner_id: 'user_1' },
            },
          ],
          error: null,
        },
      },
      // maybeSingle = the package item; select = existing items for preview.
      inventory_items: {
        maybeSingle: { data: packageItem, error: null },
        select: { data: [], error: null },
      },
      // maybeSingle = the package product; select = component name lookup.
      products: {
        maybeSingle: { data: { name: 'Soda Variety 12-pack', is_package: true }, error: null },
        select: { data: componentNames, error: null },
      },
      product_components: { select: { data: componentRows, error: null } },
      unit_definitions: { select: { data: unitDefs, error: null } },
      spaces: { select: { data: sampleSpaces, error: null } },
    },
    { open_package: rpcResult },
  )
}

function renderPage() {
  return renderWithRoutes(
    <Routes>
      <Route path="/inventory/open/:itemId" element={<OpenPackagePage />} />
    </Routes>,
    '/inventory/open/item_pkg',
  )
}

describe('OpenPackagePage — break wizard', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockClerk({ user: { id: 'user_1' } })
  })

  it('walks count → preview → cost → confirm and calls open_package', async () => {
    const sb = mockForOpen()
    renderPage()

    // Step 1: count
    await waitFor(() => {
      expect(screen.getByText(/how many to open\?/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /^preview$/i }))

    // Step 2: preview — children resolve to new items (no existing stock)
    await waitFor(() => {
      expect(screen.getByText(/store contents in/i)).toBeInTheDocument()
    })
    expect(screen.getAllByText(/\+ new item/i).length).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: /review cost/i }))

    // Step 3: cost — default split reconciles ($12 across 12 cans), Continue enabled
    await waitFor(() => {
      expect(screen.getByText(/\$12\.00 of \$12\.00 allocated/i)).toBeInTheDocument()
    })
    const continueBtn = screen.getByRole('button', { name: /continue/i })
    expect(continueBtn).toBeEnabled()
    fireEvent.click(continueBtn)

    // Step 4: confirm → open
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /open package/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /open package/i }))

    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith(
        'open_package',
        expect.objectContaining({
          p_package_item_id: 'item_pkg',
          p_quantity_opened: 1,
          p_target_space_id: 'space_a',
          p_cost_overrides: null,
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText(/package opened/i)).toBeInTheDocument()
    })
  })

  it('surfaces a friendly error when the RPC fails and commits nothing', async () => {
    mockForOpen({ data: null, error: new Error('Only 1 sealed pack(s) available') })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/how many to open\?/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /^preview$/i }))
    await waitFor(() =>
      expect(screen.getByText(/store contents in/i)).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: /review cost/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /open package/i })).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: /open package/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/only 1 sealed pack/i)
    })
    // Stays on the confirm step — no success screen.
    expect(screen.queryByText(/package opened/i)).toBeNull()
  })

  it('blocks opening when the item is not a package', async () => {
    makeSupabaseMock({
      crew_members: {
        select: {
          data: [
            { crew_id: 'crew_abc', role: 'admin', crews: { name: 'Demo', owner_id: 'user_1' } },
          ],
          error: null,
        },
      },
      inventory_items: {
        maybeSingle: { data: packageItem, error: null },
        select: { data: [], error: null },
      },
      products: {
        maybeSingle: { data: { name: 'Plain Item', is_package: false }, error: null },
        select: { data: [], error: null },
      },
      product_components: { select: { data: [], error: null } },
      unit_definitions: { select: { data: unitDefs, error: null } },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/isn.t a package/i)
    })
  })
})

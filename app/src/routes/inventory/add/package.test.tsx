import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import CreatePackagePage from './package'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const units = [
  { unit: 'count', unit_category: 'count' },
  { unit: 'g', unit_category: 'weight' },
]

const spaces = [
  { space_id: 'space_a', name: 'Pantry', parent_id: 'space_p' },
  { space_id: 'space_p', name: 'Demo Kitchen', parent_id: null },
]

const candidates = [
  { product_id: 'c_coke', name: 'Coke 12oz can', brand: 'Coca-Cola' },
]

function mockForCreate() {
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
      unit_definitions: { select: { data: units, error: null } },
      spaces: { select: { data: spaces, error: null } },
      // select = picker candidates; single = the inserted package product row.
      products: {
        select: { data: candidates, error: null },
        single: { data: { product_id: 'pkg_new' }, error: null },
      },
      product_components: { insert: { data: null, error: null } },
    },
    { record_purchase: { data: 'item_new', error: null } },
  )
}

describe('CreatePackagePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockClerk({ user: { id: 'user_1' } })
  })

  it('creates a package + components + sealed stock, then routes to the open wizard', async () => {
    const sb = mockForCreate()
    renderWithRouter(<CreatePackagePage />)

    await waitFor(() => {
      expect(screen.getByLabelText(/package name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/package name/i), {
      target: { value: 'Soda Variety 8-pack' },
    })

    // Pick a component product via the inline picker.
    fireEvent.change(screen.getByLabelText(/search products/i), {
      target: { value: 'coke' },
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /coke 12oz can/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /coke 12oz can/i }))

    // Component qty defaults to 1; bump it to 4.
    fireEvent.change(screen.getByLabelText(/quantity per package/i), {
      target: { value: '4' },
    })

    // Pick a storage space once its options have loaded (sealed packs default to 1).
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: /demo kitchen › pantry/i }),
      ).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/stored in/i), {
      target: { value: 'space_a' },
    })

    expect(screen.getByLabelText(/stored in/i)).toHaveValue('space_a')
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create & open/i }),
      ).toBeEnabled()
    })
    fireEvent.click(screen.getByRole('button', { name: /create & open/i }))

    await waitFor(() => {
      expect(sb.tables.products.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          crew_id: 'crew_abc',
          name: 'Soda Variety 8-pack',
          is_package: true,
        }),
      )
    })
    expect(sb.tables.product_components.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        package_product_id: 'pkg_new',
        component_product_id: 'c_coke',
        quantity: 4,
        unit: 'count',
        sort_order: 0,
      }),
    ])
    expect(sb.rpc).toHaveBeenCalledWith(
      'record_purchase',
      expect.objectContaining({
        p_product_id: 'pkg_new',
        p_quantity: 1,
        p_unit: 'pkg',
        p_current_space_id: 'space_a',
      }),
    )
    expect(mockNavigate).toHaveBeenCalledWith('/inventory/open/item_new')
  })

  it('keeps the submit disabled until name, a component, and a space are set', async () => {
    mockForCreate()
    renderWithRouter(<CreatePackagePage />)
    await waitFor(() => {
      expect(screen.getByLabelText(/package name/i)).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: /create & open/i }),
    ).toBeDisabled()
  })
})

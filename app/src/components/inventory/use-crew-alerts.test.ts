import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { useCrewAlerts } from './use-crew-alerts'

const items = [
  {
    inventory_item_id: 'i_low',
    product_id: 'p1',
    current_space_id: 's_a',
    home_space_id: 's_a',
    quantity: 1,
    unit: 'count',
    category_id: null,
    min_stock: 3,
    expiry_date: null,
  },
]

const products = [
  {
    product_id: 'p1',
    name: 'Cinnamon',
    brand: 'Spice Co',
    image_url: 'crew_abc/products/p1/img.jpg',
  },
]

const spaces = [{ space_id: 's_a', parent_id: null, name: 'Pantry' }]

describe('useCrewAlerts', () => {
  it('carries the product image_url through to alert rows', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      inventory_items: { select: { data: items, error: null } },
      products: { select: { data: products, error: null } },
      spaces: { select: { data: spaces, error: null } },
    })
    const { result } = renderHook(() => useCrewAlerts('crew_abc'))
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.rows).toHaveLength(1)
    expect(result.current.rows[0]).toMatchObject({
      productName: 'Cinnamon',
      productBrand: 'Spice Co',
      productImageUrl: 'crew_abc/products/p1/img.jpg',
    })
  })
})

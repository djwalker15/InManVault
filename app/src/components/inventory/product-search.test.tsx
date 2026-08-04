import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { ProductSearch } from './product-search'
import type { ProductRow } from './types'

const lime: ProductRow = {
  product_id: 'prod_lime',
  crew_id: null,
  name: 'Sparkling water',
  brand: 'LaCroix',
  variant: 'Lime',
  barcode: null,
  image_url: null,
  size_value: 12,
  size_unit: 'fl_oz',
  default_category_id: null,
}

const itemRow = {
  inventory_item_id: 'item_1',
  crew_id: 'crew_abc',
  product_id: 'prod_lime',
  current_space_id: 'space_pantry',
  quantity: 4,
  unit: 'count',
}

const spaceRow = {
  space_id: 'space_pantry',
  name: 'Pantry',
  parent_id: null,
}

function mockSearch({ withItem = false } = {}) {
  mockClerk({ user: { id: 'user_1' } })
  return makeSupabaseMock({
    products: { select: { data: [lime], error: null } },
    inventory_items: {
      select: { data: withItem ? [itemRow] : [], error: null },
    },
    spaces: { select: { data: [spaceRow], error: null } },
  })
}

function renderSearch() {
  return render(
    <ProductSearch
      crewId="crew_abc"
      onSelect={() => {}}
      onCreateCustom={() => {}}
    />,
  )
}

async function search(term: string) {
  fireEvent.change(screen.getByLabelText(/search for a product/i), {
    target: { value: term },
  })
  // Outlast the 250 ms debounce before the query fires.
  await screen.findByText('Catalog matches', undefined, { timeout: 2000 })
}

describe('ProductSearch — variant', () => {
  it('searches variant alongside name, brand, and barcode', async () => {
    const sb = mockSearch()
    renderSearch()
    await search('lime')

    await waitFor(() => {
      expect(sb.tables.products.or).toHaveBeenCalledWith(
        expect.stringContaining('variant.ilike.%lime%'),
      )
    })
  })

  it('shows the variant as its own facet in catalog result rows', async () => {
    mockSearch()
    renderSearch()
    await search('lime')

    expect(
      screen.getByText('LaCroix · Lime · 12 fl_oz · Catalog'),
    ).toBeInTheDocument()
  })

  it('shows the variant and size in existing-inventory rows', async () => {
    mockSearch({ withItem: true })
    renderSearch()
    await search('lime')

    expect(
      screen.getByText('Lime · 12 fl_oz · 4 count · Pantry'),
    ).toBeInTheDocument()
  })
})

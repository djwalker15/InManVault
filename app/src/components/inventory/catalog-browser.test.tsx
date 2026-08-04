import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { CatalogBrowser } from './catalog-browser'
import {
  INITIAL_BROWSE_FILTERS,
  type CatalogBrowserFilters,
  type ProductRow,
} from './types'

const products: ProductRow[] = [
  {
    product_id: 'prod_1',
    crew_id: null,
    name: 'Sparkling water',
    brand: 'LaCroix',
    variant: 'Lime',
    barcode: null,
    image_url: null,
    size_value: 12,
    size_unit: 'fl_oz',
    default_category_id: 'cat_bev',
  },
  {
    product_id: 'prod_2',
    crew_id: 'crew_abc',
    name: 'Homemade syrup',
    brand: null,
    variant: null,
    barcode: null,
    image_url: null,
    size_value: null,
    size_unit: null,
    default_category_id: null,
  },
]

const categories = [
  { category_id: 'cat_bev', name: 'Beverages', crew_id: null },
  { category_id: 'cat_bak', name: 'Baking', crew_id: null },
]

function mockBrowse({ count = products.length } = {}) {
  mockClerk({ user: { id: 'user_1' } })
  return makeSupabaseMock({
    products: { select: { data: products, error: null, count } },
    categories: { select: { data: categories, error: null } },
  })
}

function renderBrowser(
  props: {
    onSelect?: (s: unknown) => void
    filters?: CatalogBrowserFilters
    onFiltersChange?: (f: CatalogBrowserFilters) => void
  } = {},
) {
  return render(
    <CatalogBrowser
      crewId="crew_abc"
      onSelect={props.onSelect ?? (() => {})}
      onBack={() => {}}
      filters={props.filters ?? INITIAL_BROWSE_FILTERS}
      onFiltersChange={props.onFiltersChange ?? (() => {})}
    />,
  )
}

describe('CatalogBrowser', () => {
  it('lists products alphabetically with their facets', async () => {
    const sb = mockBrowse()
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('Sparkling water')).toBeInTheDocument()
    })
    expect(screen.getByText('LaCroix · Lime · 12 fl_oz · Catalog')).toBeInTheDocument()
    expect(screen.getByText('Homemade syrup')).toBeInTheDocument()
    expect(sb.tables.products.order).toHaveBeenCalledWith('name', {
      ascending: true,
    })
    expect(sb.tables.products.range).toHaveBeenCalledWith(0, 24)
  })

  it('selecting a row emits the same selection shape as search', async () => {
    mockBrowse()
    const onSelect = vi.fn()
    renderBrowser({ onSelect })

    await waitFor(() => {
      expect(screen.getByText('Sparkling water')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /sparkling water/i }))
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'product',
      product: expect.objectContaining({ product_id: 'prod_1' }),
    })
  })

  it('category and source chips update the lifted filter state', async () => {
    mockBrowse()
    const onFiltersChange = vi.fn()
    renderBrowser({ onFiltersChange })

    await waitFor(() => {
      expect(screen.getByText('Beverages')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Beverages' }))
    expect(onFiltersChange).toHaveBeenCalledWith({
      source: 'all',
      categoryId: 'cat_bev',
      pages: 1,
    })

    fireEvent.click(screen.getByRole('button', { name: "My crew's" }))
    expect(onFiltersChange).toHaveBeenCalledWith({
      source: 'mine',
      categoryId: null,
      pages: 1,
    })
  })

  it('applies the filters to the products query', async () => {
    const sb = mockBrowse()
    renderBrowser({
      filters: { source: 'mine', categoryId: 'cat_bev', pages: 1 },
    })

    await waitFor(() => {
      expect(sb.tables.products.eq).toHaveBeenCalledWith('crew_id', 'crew_abc')
    })
    expect(sb.tables.products.eq).toHaveBeenCalledWith(
      'default_category_id',
      'cat_bev',
    )
  })

  it('Catalog source filters to crew_id null', async () => {
    const sb = mockBrowse()
    renderBrowser({ filters: { source: 'catalog', categoryId: null, pages: 1 } })

    await waitFor(() => {
      expect(sb.tables.products.is).toHaveBeenCalledWith('crew_id', null)
    })
  })

  it('Load more grows the visible range', async () => {
    const sb = mockBrowse({ count: 60 })
    const onFiltersChange = vi.fn()
    renderBrowser({ onFiltersChange })

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /load more/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    expect(onFiltersChange).toHaveBeenCalledWith({
      source: 'all',
      categoryId: null,
      pages: 2,
    })

    // The caller feeds the new state back in; page 2 = rows 0-49.
    renderBrowser({
      filters: { source: 'all', categoryId: null, pages: 2 },
    })
    await waitFor(() => {
      expect(sb.tables.products.range).toHaveBeenCalledWith(0, 49)
    })
  })
})

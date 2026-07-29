import { describe, expect, it } from 'vitest'
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { InventoryList } from './inventory-list'

// Expanding a row renders RowActions, which calls useNavigate(), so every
// render needs a Router in the tree.
function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: MemoryRouter })
}

const items = [
  {
    inventory_item_id: 'i_low',
    product_id: 'p1',
    current_space_id: 's_a',
    home_space_id: null,
    quantity: 1,
    unit: 'count',
    category_id: 'c1',
    min_stock: 3,
    expiry_date: null,
  },
  {
    inventory_item_id: 'i_out',
    product_id: 'p2',
    current_space_id: 's_a',
    home_space_id: null,
    quantity: 0,
    unit: 'count',
    category_id: null,
    min_stock: null,
    expiry_date: null,
  },
  {
    inventory_item_id: 'i_ok',
    product_id: 'p3',
    current_space_id: 's_a',
    home_space_id: 's_a',
    quantity: 8,
    unit: 'oz',
    category_id: null,
    min_stock: 2,
    expiry_date: null,
  },
  {
    inventory_item_id: 'i_displaced',
    product_id: 'p4',
    current_space_id: 's_a',
    home_space_id: 's_b',
    quantity: 4,
    unit: 'count',
    category_id: null,
    min_stock: null,
    expiry_date: null,
  },
]

const products = [
  { product_id: 'p1', name: 'Cinnamon', brand: null, default_category_id: null },
  { product_id: 'p2', name: 'Tomato Paste', brand: 'Heinz', default_category_id: null },
  { product_id: 'p3', name: 'Olive Oil', brand: null, default_category_id: null },
  { product_id: 'p4', name: 'Salt', brand: null, default_category_id: null },
]

const categories = [{ category_id: 'c1', name: 'Spices' }]

const spaces = [
  { space_id: 's_p', parent_id: null, name: 'My House' },
  { space_id: 's_a', parent_id: 's_p', name: 'Cabinet 1' },
  { space_id: 's_b', parent_id: 's_p', name: 'Cabinet 2' },
]

describe('InventoryList', () => {
  it('renders rows in alerts-first order: out → low → displaced → none', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      inventory_items: { select: { data: items, error: null } },
      products: { select: { data: products, error: null } },
      categories: { select: { data: categories, error: null } },
      spaces: { select: { data: spaces, error: null } },
    })
    render(<InventoryList crewId="crew_abc" />)
    await waitFor(() => {
      expect(
        screen.getByRole('list', { name: /inventory items/i }),
      ).toBeInTheDocument()
    })
    const headings = screen.getAllByRole('heading', { level: 3 })
    const names = headings.map((h) => h.textContent?.split('·')[0].trim())
    expect(names[0]).toBe('Tomato Paste') // out_of_stock = 100
    expect(names[1]).toBe('Cinnamon')     // low_stock = 50
    expect(names[2]).toBe('Salt')         // displaced = 20
    expect(names[3]).toBe('Olive Oil')    // no alerts = 0
  })

  it('renders status badges per row', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      inventory_items: { select: { data: items, error: null } },
      products: { select: { data: products, error: null } },
      categories: { select: { data: categories, error: null } },
      spaces: { select: { data: spaces, error: null } },
    })
    render(<InventoryList crewId="crew_abc" />)
    // Filter chips and row badges share the alert label, so multiple
    // matches are expected; assert at least one of each.
    await waitFor(() => {
      expect(screen.getAllByText(/out of stock/i).length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText(/low stock/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^displaced$/i).length).toBeGreaterThan(0)
  })

  it('renders the crew location breadcrumb in each row', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      inventory_items: { select: { data: items, error: null } },
      products: { select: { data: products, error: null } },
      categories: { select: { data: categories, error: null } },
      spaces: { select: { data: spaces, error: null } },
    })
    render(<InventoryList crewId="crew_abc" />)
    await waitFor(() => {
      expect(
        screen.getAllByText(/my house . cabinet 1/i).length,
      ).toBeGreaterThan(0)
    })
  })

  it('renders the category override (Spices) for the category-tagged row', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      inventory_items: { select: { data: items, error: null } },
      products: { select: { data: products, error: null } },
      categories: { select: { data: categories, error: null } },
      spaces: { select: { data: spaces, error: null } },
    })
    render(<InventoryList crewId="crew_abc" />)
    // Spices appears as both a filter chip AND a row badge.
    await waitFor(() => {
      expect(screen.getAllByText('Spices').length).toBeGreaterThan(0)
    })
  })

  it('row click toggles the inline detail panel and lazy-loads recent flows', async () => {
    mockClerk({ user: { id: 'user_1' } })
    const itemsForExpand = [items[2]] // the in_place "Olive Oil" row
    makeSupabaseMock({
      inventory_items: { select: { data: itemsForExpand, error: null } },
      products: { select: { data: products, error: null } },
      categories: { select: { data: [], error: null } },
      spaces: { select: { data: spaces, error: null } },
      flows: {
        select: {
          data: [
            {
              flow_id: 'f1',
              flow_type: 'purchase',
              quantity: 8,
              unit: 'oz',
              performed_at: new Date(Date.now() - 120_000).toISOString(),
              performed_by: 'user_1',
              notes: null,
            },
          ],
          error: null,
        },
      },
    })
    const { getByRole, getByTestId, queryByTestId } = render(
      <InventoryList crewId="crew_abc" />,
    )
    await waitFor(() => {
      expect(getByRole('button', { name: /olive oil/i })).toBeInTheDocument()
    })
    const rowBtn = getByRole('button', { name: /olive oil/i })
    expect(rowBtn).toHaveAttribute('aria-expanded', 'false')
    expect(queryByTestId('row-details-i_ok')).toBeNull()
    fireEvent.click(rowBtn)
    // After click: aria-expanded flips first.
    await waitFor(() => {
      expect(rowBtn).toHaveAttribute('aria-expanded', 'true')
    })
    expect(getByTestId('row-details-i_ok')).toBeInTheDocument()
    // Recent flows arrive after a second async tick (the row-details
    // useEffect kicks off the flows fetch on mount).
    await waitFor(() => {
      expect(
        within(getByTestId('row-details-i_ok')).getByText(
          /purchased 8 oz/i,
        ),
      ).toBeInTheDocument()
    })
  })

  it('renders an error message when the query fails', async () => {
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      inventory_items: {
        select: { data: null, error: new Error('RLS blocked') },
      },
    })
    render(<InventoryList crewId="crew_abc" />)
    await waitFor(() => {
      expect(screen.getByText('RLS blocked')).toBeInTheDocument()
    })
  })
})

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { CustomProductForm } from './custom-product-form'

/**
 * Brands as the crew sees them: master-catalog rows, the crew's own rows, a
 * duplicate that differs only in case, and a product with no brand at all.
 * The mock keys responses by table, so this one `products.select` answers the
 * brand fetch.
 */
const brandRows = [
  { brand: 'Kraft' },
  { brand: 'Heinz' },
  { brand: 'kraft' },
  { brand: null },
  { brand: 'Domino' },
  { brand: '  Heinz  ' },
]

function mockBrands(rows: { brand: string | null }[] = brandRows) {
  mockClerk({ user: { id: 'user_1' } })
  return makeSupabaseMock({
    products: { select: { data: rows, error: null } },
  })
}

function renderForm() {
  return render(
    <CustomProductForm
      crewId="crew_abc"
      userId="user_1"
      onCreated={() => {}}
      onCancel={() => {}}
    />,
  )
}

function brandOptions(container: HTMLElement): string[] {
  const list = screen
    .getByLabelText(/brand/i)
    .getAttribute('list')
  const datalist = container.querySelector(`datalist#${CSS.escape(list ?? '')}`)
  return Array.from(datalist?.querySelectorAll('option') ?? []).map(
    (o) => o.value,
  )
}

describe('CustomProductForm — brand autocomplete', () => {
  it('suggests brands from every product the crew can see, deduped and sorted', async () => {
    mockBrands()
    const { container } = renderForm()

    await waitFor(() => {
      expect(brandOptions(container).length).toBeGreaterThan(0)
    })
    // 'kraft' collapses into 'Kraft' (first spelling wins), the padded
    // '  Heinz  ' collapses into 'Heinz', and the null brand contributes
    // nothing at all.
    expect(brandOptions(container)).toEqual(['Domino', 'Heinz', 'Kraft'])
  })

  it('does not scope the brand query to the crew, so the master catalog survives', async () => {
    const sb = mockBrands()
    renderForm()

    await waitFor(() => {
      expect(sb.tables.products.select).toHaveBeenCalledWith('brand')
    })
    // A .eq('crew_id', …) here would throw away every catalog row, since the
    // catalog is exactly the rows with crew_id null.
    expect(sb.tables.products.eq).not.toHaveBeenCalled()
    expect(sb.tables.products.not).toHaveBeenCalledWith('brand', 'is', null)
    expect(sb.tables.products.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('snaps a case-insensitive match to the spelling already in the catalog', async () => {
    mockBrands()
    const { container } = renderForm()
    await waitFor(() => {
      expect(brandOptions(container).length).toBeGreaterThan(0)
    })

    const input = screen.getByLabelText(/brand/i)
    fireEvent.change(input, { target: { value: 'kraft' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(input).toHaveValue('Kraft')
    })
  })

  it('leaves a brand new brand alone, trimmed but otherwise untouched', async () => {
    mockBrands()
    const { container } = renderForm()
    await waitFor(() => {
      expect(brandOptions(container).length).toBeGreaterThan(0)
    })

    const input = screen.getByLabelText(/brand/i)
    fireEvent.change(input, { target: { value: '  Tenacious Foods  ' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(input).toHaveValue('Tenacious Foods')
    })
  })

  it('submits the canonical brand', async () => {
    const sb = mockBrands()
    // The insert lands on the same table mock; point it at a created row.
    sb.tables.products.single.mockImplementation(() => ({
      then: (
        onFulfilled: (v: { data: unknown; error: null }) => unknown,
      ) =>
        Promise.resolve({
          data: {
            product_id: 'prod_new',
            crew_id: 'crew_abc',
            name: 'Mac and cheese',
            brand: 'Kraft',
            barcode: null,
            image_url: null,
            size_value: null,
            size_unit: null,
            default_category_id: null,
          },
          error: null,
        }).then(onFulfilled),
    }))

    const { container } = renderForm()
    await waitFor(() => {
      expect(brandOptions(container).length).toBeGreaterThan(0)
    })

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: 'Mac and cheese' },
    })
    const brandInput = screen.getByLabelText(/brand/i)
    fireEvent.change(brandInput, { target: { value: 'KRAFT' } })
    fireEvent.blur(brandInput)
    fireEvent.click(screen.getByRole('button', { name: /create product/i }))

    await waitFor(() => {
      expect(sb.tables.products.insert).toHaveBeenCalledWith(
        expect.objectContaining({ brand: 'Kraft' }),
      )
    })
  })

  it('still allows an empty brand — the field stays optional', async () => {
    mockBrands()
    const { container } = renderForm()
    await waitFor(() => {
      expect(brandOptions(container).length).toBeGreaterThan(0)
    })

    const input = screen.getByLabelText(/brand/i)
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(input).toHaveValue('')
  })
})

describe('CustomProductForm — Field focus styling', () => {
  it('keeps the sage focus bar working on a field that also passes onBlur', async () => {
    mockBrands()
    const { container } = renderForm()
    await waitFor(() => {
      expect(brandOptions(container).length).toBeGreaterThan(0)
    })

    const input = screen.getByLabelText(/brand/i)
    const shell = input.parentElement as HTMLElement

    expect(shell.className).toContain('border-transparent')
    fireEvent.focus(input)
    expect(shell.className).toContain('border-sage-700')
    fireEvent.blur(input)
    expect(shell.className).toContain('border-transparent')
  })
})

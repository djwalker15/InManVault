import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import * as mediaLib from '@/lib/media'
import { CustomProductForm } from './custom-product-form'

vi.mock('@/lib/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/media')>()
  return { ...actual, uploadCrewImage: vi.fn(), deleteCrewImage: vi.fn() }
})

const uploadCrewImage = vi.mocked(mediaLib.uploadCrewImage)

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

/**
 * The mock serves one canned response per table, so the brand fetch and the
 * variant fetch both read these rows; each hook plucks its own column.
 */
const variantRows = [
  { brand: 'LaCroix', variant: 'Lime' },
  { brand: 'LaCroix', variant: 'lime' },
  { brand: 'LaCroix', variant: 'Pamplemousse' },
  { brand: 'Heinz', variant: null },
]

function variantOptions(container: HTMLElement): string[] {
  const list = screen
    .getByLabelText(/variant/i)
    .getAttribute('list')
  const datalist = container.querySelector(`datalist#${CSS.escape(list ?? '')}`)
  return Array.from(datalist?.querySelectorAll('option') ?? []).map(
    (o) => o.value,
  )
}

describe('CustomProductForm — variant field', () => {
  it('suggests previously used variants, deduped and sorted', async () => {
    mockBrands(variantRows)
    const { container } = renderForm()

    await waitFor(() => {
      expect(variantOptions(container).length).toBeGreaterThan(0)
    })
    // 'lime' collapses into 'Lime' (first spelling wins) and the null
    // variant contributes nothing.
    expect(variantOptions(container)).toEqual(['Lime', 'Pamplemousse'])
  })

  it('snaps a typed variant onto the existing spelling on blur', async () => {
    mockBrands(variantRows)
    const { container } = renderForm()
    await waitFor(() => {
      expect(variantOptions(container).length).toBeGreaterThan(0)
    })

    const input = screen.getByLabelText(/variant/i)
    fireEvent.change(input, { target: { value: 'LIME' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(input).toHaveValue('Lime')
    })
  })

  it('submits the variant, and null when the field is left blank', async () => {
    const sb = mockBrands(variantRows)
    sb.tables.products.single.mockImplementation(() => ({
      then: (
        onFulfilled: (v: { data: unknown; error: null }) => unknown,
      ) =>
        Promise.resolve({
          data: {
            product_id: 'prod_new',
            crew_id: 'crew_abc',
            name: 'Sparkling water',
            brand: 'LaCroix',
            variant: 'Lime',
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
      expect(variantOptions(container).length).toBeGreaterThan(0)
    })

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: 'Sparkling water' },
    })
    fireEvent.change(screen.getByLabelText(/variant/i), {
      target: { value: 'Lime' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create product/i }))

    await waitFor(() => {
      expect(sb.tables.products.insert).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'Lime' }),
      )
    })

    // A blank field must reach the database as null, not ''.
    sb.tables.products.insert.mockClear()
    fireEvent.change(screen.getByLabelText(/variant/i), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create product/i }))
    await waitFor(() => {
      expect(sb.tables.products.insert).toHaveBeenCalledWith(
        expect.objectContaining({ variant: null }),
      )
    })
  })
})

describe('CustomProductForm — create similar (initialProduct)', () => {
  const source = {
    name: 'Sparkling water',
    brand: 'LaCroix',
    variant: 'Lime',
    size_value: 12,
    size_unit: 'fl_oz',
    default_category_id: 'cat_bev',
  }

  function renderPrefilled() {
    return render(
      <CustomProductForm
        crewId="crew_abc"
        userId="user_1"
        initialProduct={source}
        autoFocusVariant
        onCreated={() => {}}
        onCancel={() => {}}
      />,
    )
  }

  it('prefills everything except barcode', () => {
    mockBrands(variantRows)
    renderPrefilled()

    expect(screen.getByLabelText(/product name/i)).toHaveValue('Sparkling water')
    expect(screen.getByLabelText(/brand/i)).toHaveValue('LaCroix')
    expect(screen.getByLabelText(/variant/i)).toHaveValue('Lime')
    expect(screen.getByLabelText(/size value/i)).toHaveValue(12)
    expect(screen.getByLabelText(/size unit/i)).toHaveValue('')
    // Copying a UPC would create false barcode-scan hits on the clone.
    expect(screen.getByLabelText(/barcode/i)).toHaveValue('')
  })

  it('focuses the variant field — the one that usually differs', () => {
    mockBrands(variantRows)
    renderPrefilled()

    expect(screen.getByLabelText(/variant/i)).toHaveFocus()
  })

  it('creates a new crew-private product on save', async () => {
    const sb = mockBrands(variantRows)
    sb.tables.products.single.mockImplementation(() => ({
      then: (
        onFulfilled: (v: { data: unknown; error: null }) => unknown,
      ) =>
        Promise.resolve({
          data: {
            product_id: 'prod_new',
            crew_id: 'crew_abc',
            name: 'Sparkling water',
            brand: 'LaCroix',
            variant: 'Pamplemousse',
            barcode: null,
            image_url: null,
            size_value: 12,
            size_unit: null,
            default_category_id: null,
          },
          error: null,
        }).then(onFulfilled),
    }))
    renderPrefilled()

    fireEvent.change(screen.getByLabelText(/variant/i), {
      target: { value: 'Pamplemousse' },
    })
    // jsdom mis-flags the prefilled number input (step=0.01, value 12) as a
    // step mismatch and swallows the implicit submission, so submit the form
    // directly. Browsers accept the value.
    fireEvent.submit(
      screen.getByRole('button', { name: /create product/i }).closest('form')!,
    )

    await waitFor(() => {
      expect(sb.tables.products.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          crew_id: 'crew_abc',
          source: 'crew_created',
          name: 'Sparkling water',
          variant: 'Pamplemousse',
          barcode: null,
        }),
      )
    })
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

describe('CustomProductForm — photo upload', () => {
  const createdRow = {
    product_id: 'prod_9',
    crew_id: 'crew_abc',
    name: 'Ghost Pepper Jam',
    brand: null,
    variant: null,
    barcode: null,
    image_url: null,
    size_value: null,
    size_unit: null,
    default_category_id: null,
  }
  const photoFile = new File(['img'], 'jam.jpg', { type: 'image/jpeg' })

  function mockCreate() {
    mockClerk({ user: { id: 'user_1' } })
    return makeSupabaseMock({
      products: {
        select: { data: [], error: null },
        single: { data: createdRow, error: null },
        update: { data: null, error: null },
      },
    })
  }

  async function fillAndSubmit() {
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: 'Ghost Pepper Jam' },
    })
    fireEvent.change(screen.getByLabelText(/add a photo/i), {
      target: { files: [photoFile] },
    })
    fireEvent.click(screen.getByRole('button', { name: /create product/i }))
  }

  it('uploads the photo after insert and reports the path on the created row', async () => {
    const sb = mockCreate()
    uploadCrewImage.mockResolvedValue('crew_abc/products/prod_9/img.jpg')
    const onCreated = vi.fn()
    render(
      <CustomProductForm
        crewId="crew_abc"
        userId="user_1"
        onCreated={onCreated}
        onCancel={() => {}}
      />,
    )
    await fillAndSubmit()
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith({
        ...createdRow,
        image_url: 'crew_abc/products/prod_9/img.jpg',
      })
    })
    expect(uploadCrewImage).toHaveBeenCalledWith(
      expect.anything(),
      'crew_abc',
      'products',
      photoFile,
      'prod_9',
    )
    expect(sb.tables.products.update).toHaveBeenCalledWith({
      image_url: 'crew_abc/products/prod_9/img.jpg',
    })
  })

  it('still creates the product when the upload fails', async () => {
    mockCreate()
    uploadCrewImage.mockRejectedValue(new Error('storage down'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onCreated = vi.fn()
    render(
      <CustomProductForm
        crewId="crew_abc"
        userId="user_1"
        onCreated={onCreated}
        onCancel={() => {}}
      />,
    )
    await fillAndSubmit()
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(createdRow)
    })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('lets the user clear a chosen photo before submitting', async () => {
    mockCreate()
    render(
      <CustomProductForm
        crewId="crew_abc"
        userId="user_1"
        onCreated={() => {}}
        onCancel={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText(/add a photo/i), {
      target: { files: [photoFile] },
    })
    expect(screen.getByText('jam.jpg')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }))
    expect(screen.queryByText('jam.jpg')).toBeNull()
    expect(screen.getByText(/add a photo/i)).toBeInTheDocument()
  })
})

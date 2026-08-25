import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithRouter } from '@/test/utils'
import { makeSupabaseMock } from '@/test/supabase-mock'
import * as mediaLib from '@/lib/media'
import { ReceiptPreviewStep } from './preview-step'
import type { RowState } from './types'

vi.mock('@/lib/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/media')>()
  return { ...actual, useSignedUrl: vi.fn() }
})
const useSignedUrl = vi.mocked(mediaLib.useSignedUrl)

const unresolvedRow: RowState = {
  id: 1,
  rawText: 'LACROIX LIME 12PK',
  canonicalName: 'LaCroix Lime',
  brand: null,
  quantity: 1,
  unit: 'count',
  unitPrice: 5.99,
  choice: { kind: 'unresolved' },
  included: true,
  candidates: [
    {
      product_id: 'p_lime',
      name: 'LaCroix',
      brand: 'LaCroix',
      variant: 'Lime',
      size_value: 12,
      size_unit: 'fl_oz',
      image_url: 'crew_1/products/p_lime/a.jpg',
    },
    // Legacy-shaped candidate: no variant/size/image fields at all.
    { product_id: 'p_spindrift', name: 'Spindrift', brand: null },
  ],
}

function renderStep(onChange = vi.fn()) {
  makeSupabaseMock({ spaces: { select: { data: [], error: null } } })
  renderWithRouter(
    <ReceiptPreviewStep
      crewId="crew_1"
      rows={[unresolvedRow]}
      onChange={onChange}
      spaceId=""
      onSpaceChange={() => {}}
      validUnits={['count']}
      importing={false}
      onBack={() => {}}
      onImport={() => {}}
    />,
  )
  return onChange
}

describe('ReceiptPreviewStep — candidate chips', () => {
  it('renders a thumbnail plus brand · variant · size for each candidate', () => {
    useSignedUrl.mockImplementation((v) =>
      v ? `https://signed.test/${v}` : null,
    )
    renderStep()

    const lime = screen.getByRole('button', {
      name: /^LaCroix · LaCroix · Lime · 12 fl_oz$/,
    })
    expect(lime.querySelector('img')).toHaveAttribute(
      'src',
      'https://signed.test/crew_1/products/p_lime/a.jpg',
    )

    // No image → letter fallback, no meta line for a bare candidate.
    const spindrift = screen.getByRole('button', { name: /^Spindrift$/ })
    expect(spindrift.querySelector('img')).toBeNull()
    expect(spindrift).toHaveTextContent(/^S\s*Spindrift$/)
  })

  it('tapping a chip resolves the row to that product', () => {
    useSignedUrl.mockReturnValue(null)
    const onChange = renderStep()
    fireEvent.click(screen.getByRole('button', { name: /^Spindrift$/ }))
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 1,
        choice: { kind: 'product', productId: 'p_spindrift', productName: 'Spindrift' },
      }),
    ])
  })
})

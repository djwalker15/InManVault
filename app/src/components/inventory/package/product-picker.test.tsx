import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import * as mediaLib from '@/lib/media'
import { ProductPicker } from './product-picker'

vi.mock('@/lib/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/media')>()
  return { ...actual, useSignedUrl: vi.fn(() => null) }
})

const useSignedUrl = vi.mocked(mediaLib.useSignedUrl)

const results = [
  {
    product_id: 'p1',
    name: 'Seltzer 12-pack',
    brand: 'Bubbly',
    image_url: 'crew_abc/products/p1/img.jpg',
  },
]

describe('ProductPicker', () => {
  it('fetches image_url with results and hands it to onChange', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockClerk({ user: { id: 'user_1' } })
    makeSupabaseMock({
      products: { select: { data: results, error: null } },
    })
    const onChange = vi.fn()
    render(<ProductPicker value={null} onChange={onChange} excludeIds={[]} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'seltzer' },
    })
    await vi.advanceTimersByTimeAsync(300)
    await waitFor(() => {
      expect(screen.getByText('Seltzer 12-pack')).toBeInTheDocument()
    })
    // The thumbnail resolves the row's dual-mode image_url.
    expect(useSignedUrl).toHaveBeenCalledWith('crew_abc/products/p1/img.jpg')

    fireEvent.click(screen.getByText('Seltzer 12-pack'))
    expect(onChange).toHaveBeenCalledWith(results[0])
    vi.useRealTimers()
  })
})

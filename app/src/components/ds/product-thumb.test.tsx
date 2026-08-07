import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProductThumb } from '@/components/ds/product-thumb'
import * as mediaLib from '@/lib/media'

vi.mock('@/lib/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/media')>()
  return { ...actual, useSignedUrl: vi.fn() }
})

const useSignedUrl = vi.mocked(mediaLib.useSignedUrl)

describe('ProductThumb', () => {
  it('renders the resolved image', () => {
    useSignedUrl.mockReturnValue('https://signed.test/crew1/products/p1/x.jpg')
    const { container } = render(
      <ProductThumb imageUrl="crew1/products/p1/x.jpg" name="Olive Oil" />,
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute(
      'src',
      'https://signed.test/crew1/products/p1/x.jpg',
    )
    expect(useSignedUrl).toHaveBeenCalledWith('crew1/products/p1/x.jpg')
  })

  it('falls back to the first letter when there is no image', () => {
    useSignedUrl.mockReturnValue(null)
    render(<ProductThumb imageUrl={null} name="olive oil" />)
    expect(screen.getByText('O')).toBeInTheDocument()
  })

  it('falls back to the letter while a signed URL is loading', () => {
    useSignedUrl.mockReturnValue(null)
    const { container } = render(
      <ProductThumb imageUrl="crew1/products/p1/x.jpg" name="Butter" />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('falls back to the letter when the image fails to load', () => {
    useSignedUrl.mockReturnValue('https://signed.test/broken.jpg')
    const { container } = render(
      <ProductThumb imageUrl="crew1/products/p1/x.jpg" name="Flour" />,
    )
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('supports the detail size variant', () => {
    useSignedUrl.mockReturnValue(null)
    const { container } = render(
      <ProductThumb imageUrl={null} name="Salt" size="detail" />,
    )
    expect(container.firstElementChild).toHaveClass('size-16')
  })
})

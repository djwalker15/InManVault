import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as mediaLib from '@/lib/media'
import { ChildCard, ScopeHero } from './drill-down-cards'
import type { SpaceNode } from './types'

vi.mock('@/lib/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/media')>()
  return { ...actual, useSignedUrl: vi.fn(() => null) }
})

const useSignedUrl = vi.mocked(mediaLib.useSignedUrl)

const node: SpaceNode = {
  space_id: 's1',
  parent_id: null,
  unit_type: 'premises',
  name: 'My House',
  image_path: null,
}

function cardBackground(container: HTMLElement): string {
  const banner = container.querySelector('[style*="background"]')
  return banner?.getAttribute('style') ?? ''
}

describe('drill-down cards — space photo backgrounds', () => {
  it('keeps the gradient when there is no photo', () => {
    useSignedUrl.mockReturnValue(null)
    const { container } = render(
      <ChildCard node={node} kids={[]} onOpen={() => {}} onMenu={() => {}} />,
    )
    expect(cardBackground(container)).toContain('linear-gradient')
  })

  it('renders the signed photo when image_path resolves', () => {
    useSignedUrl.mockReturnValue('https://signed.test/crew/spaces/s1/a.jpg')
    const withPhoto = { ...node, image_path: 'crew/spaces/s1/a.jpg' }
    const { container } = render(
      <ChildCard node={withPhoto} kids={[]} onOpen={() => {}} onMenu={() => {}} />,
    )
    expect(cardBackground(container)).toContain(
      'https://signed.test/crew/spaces/s1/a.jpg',
    )
    expect(useSignedUrl).toHaveBeenCalledWith('crew/spaces/s1/a.jpg')
  })

  it('ScopeHero falls back to the gradient while the signed URL loads', () => {
    useSignedUrl.mockReturnValue(null)
    const withPhoto = { ...node, image_path: 'crew/spaces/s1/a.jpg' }
    const { container } = render(<ScopeHero scope={withPhoto} kids={[]} />)
    expect(cardBackground(container)).toContain('linear-gradient')
  })
})

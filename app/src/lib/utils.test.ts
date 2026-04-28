import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges duplicate tailwind classes, last one wins', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('passes through conditionals and falsy values', () => {
    const isActive = true
    const isHidden = false
    expect(cn('base', isActive && 'active', isHidden && 'hidden', null, undefined)).toBe(
      'base active',
    )
  })

  it('handles arrays and objects per clsx semantics', () => {
    expect(cn(['a', { b: true, c: false }, 'd'])).toBe('a b d')
  })
})

import { describe, it, expect } from 'vitest'
import { clerkErrorMessage } from './clerk-error'

describe('clerkErrorMessage', () => {
  it('prefers longMessage from the first Clerk error', () => {
    const err = {
      errors: [
        { message: 'short', longMessage: 'long detailed reason' },
        { message: 'second', longMessage: 'second long' },
      ],
    }
    expect(clerkErrorMessage(err)).toBe('long detailed reason')
  })

  it('falls back to message when longMessage is missing', () => {
    expect(clerkErrorMessage({ errors: [{ message: 'just message' }] })).toBe(
      'just message',
    )
  })

  it('falls back to default string when errors array is empty', () => {
    expect(clerkErrorMessage({ errors: [] })).toBe('Something went wrong.')
  })

  it('falls back to default string when error entry has no message fields', () => {
    expect(clerkErrorMessage({ errors: [{}] })).toBe('Something went wrong.')
  })

  it('uses Error.message for plain Error instances', () => {
    expect(clerkErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns default string for unknown shapes', () => {
    expect(clerkErrorMessage('a string')).toBe('Something went wrong.')
    expect(clerkErrorMessage(null)).toBe('Something went wrong.')
    expect(clerkErrorMessage(undefined)).toBe('Something went wrong.')
    expect(clerkErrorMessage(42)).toBe('Something went wrong.')
  })
})

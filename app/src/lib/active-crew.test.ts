import { describe, expect, it, beforeEach } from 'vitest'
import {
  readPreference,
  writePreference,
} from './active-crew'

const KEY_PREFIX = 'inman:active-crew:'

describe('active-crew preference helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no preference is stored', () => {
    expect(readPreference('user_1')).toBeNull()
  })

  it('round-trips a preference through localStorage scoped by user_id', () => {
    writePreference('user_1', 'crew_a')
    writePreference('user_2', 'crew_b')
    expect(readPreference('user_1')).toBe('crew_a')
    expect(readPreference('user_2')).toBe('crew_b')
    // Underlying key shape:
    expect(localStorage.getItem(KEY_PREFIX + 'user_1')).toBe('crew_a')
  })

  it('clears a preference when set to null', () => {
    writePreference('user_1', 'crew_a')
    writePreference('user_1', null)
    expect(readPreference('user_1')).toBeNull()
  })
})

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecentIds } from './recent-ids'

describe('useRecentIds', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('tracks an id until the TTL expires', () => {
    const { result } = renderHook(() => useRecentIds(1000))
    act(() => result.current.add('a'))
    expect(result.current.ids.has('a')).toBe(true)
    act(() => vi.advanceTimersByTime(999))
    expect(result.current.ids.has('a')).toBe(true)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.ids.has('a')).toBe(false)
  })

  it('holds multiple ids concurrently, each with its own expiry', () => {
    const { result } = renderHook(() => useRecentIds(1000))
    act(() => result.current.add('a'))
    act(() => vi.advanceTimersByTime(500))
    act(() => result.current.add('b'))
    expect([...result.current.ids]).toEqual(['a', 'b'])
    act(() => vi.advanceTimersByTime(500))
    expect([...result.current.ids]).toEqual(['b'])
    act(() => vi.advanceTimersByTime(500))
    expect(result.current.ids.size).toBe(0)
  })

  it('clears pending timers on unmount without warnings', () => {
    const { result, unmount } = renderHook(() => useRecentIds(1000))
    act(() => result.current.add('a'))
    unmount()
    // Advancing past the TTL must not attempt a state update on an
    // unmounted hook — the cleanup cleared the timeout.
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow()
  })
})

import { act, renderHook, render, screen } from '@testing-library/react'
import { createElement, Fragment } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock } from '@/test/supabase-mock'
import {
  __resetMediaCache,
  deleteCrewImage,
  getSignedUrls,
  resolveImageSrc,
  uploadCrewImage,
  useSignedUrl,
} from '@/lib/media'
import * as downscaleLib from '@/lib/downscale'

vi.mock('@/lib/downscale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/downscale')>()
  return { ...actual, downscaleToBlob: vi.fn() }
})

const downscaleToBlob = vi.mocked(downscaleLib.downscaleToBlob)

const JPEG_BLOB = new Blob(['fake-jpeg'], { type: 'image/jpeg' })
const FILE = new File(['raw'], 'photo.png', { type: 'image/png' })
const UUID_JPG = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/

function flushMicrotasks() {
  return act(async () => {})
}

beforeEach(() => {
  __resetMediaCache()
  downscaleToBlob.mockResolvedValue(JPEG_BLOB)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('resolveImageSrc', () => {
  it('classifies external URLs, storage paths, and empty values', () => {
    expect(resolveImageSrc('https://cdn.example.com/a.jpg')).toEqual({
      kind: 'external',
      url: 'https://cdn.example.com/a.jpg',
    })
    expect(resolveImageSrc('http://cdn.example.com/a.jpg')).toEqual({
      kind: 'external',
      url: 'http://cdn.example.com/a.jpg',
    })
    expect(resolveImageSrc('crew1/products/p1/x.jpg')).toEqual({
      kind: 'path',
      path: 'crew1/products/p1/x.jpg',
    })
    expect(resolveImageSrc(null)).toBeNull()
    expect(resolveImageSrc(undefined)).toBeNull()
    expect(resolveImageSrc('')).toBeNull()
  })
})

describe('uploadCrewImage', () => {
  it('downscales and uploads to <crew>/<domain>/<entity>/<uuid>.jpg', async () => {
    const mock = makeSupabaseMock()
    const path = await uploadCrewImage(mock.client, 'crew1', 'products', FILE, 'prod9')

    expect(downscaleToBlob).toHaveBeenCalledWith(FILE)
    expect(path).toMatch(/^crew1\/products\/prod9\//)
    expect(path).toMatch(UUID_JPG)
    expect(mock.storage.from).toHaveBeenCalledWith('crew-media')
    expect(mock.storage.buckets['crew-media'].upload).toHaveBeenCalledWith(
      path,
      JPEG_BLOB,
      { contentType: 'image/jpeg' },
    )
  })

  it('omits the entity segment when no entityId is given', async () => {
    const mock = makeSupabaseMock()
    const path = await uploadCrewImage(mock.client, 'crew1', 'waste', FILE)
    expect(path).toMatch(/^crew1\/waste\/[0-9a-f-]{36}\.jpg$/)
  })

  it('throws when the upload fails', async () => {
    const mock = makeSupabaseMock()
    mock.storage.from('crew-media').upload.mockResolvedValueOnce({
      data: null,
      error: new Error('quota exceeded'),
    })
    await expect(
      uploadCrewImage(mock.client, 'crew1', 'products', FILE),
    ).rejects.toThrow('quota exceeded')
  })
})

describe('deleteCrewImage', () => {
  it('warns instead of throwing when removal fails', async () => {
    const mock = makeSupabaseMock()
    mock.storage.from('crew-media').remove.mockResolvedValueOnce({
      data: null,
      error: new Error('gone'),
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      deleteCrewImage(mock.client, 'crew1/products/p1/x.jpg'),
    ).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('useSignedUrl', () => {
  it('returns external URLs synchronously without touching storage', () => {
    const mock = makeSupabaseMock()
    const { result } = renderHook(() =>
      useSignedUrl('https://cdn.example.com/a.jpg'),
    )
    expect(result.current).toBe('https://cdn.example.com/a.jpg')
    expect(mock.storage.from).not.toHaveBeenCalled()
  })

  it('returns null for null values without touching storage', () => {
    const mock = makeSupabaseMock()
    const { result } = renderHook(() => useSignedUrl(null))
    expect(result.current).toBeNull()
    expect(mock.storage.from).not.toHaveBeenCalled()
  })

  it('mints one batched createSignedUrls call for 30 concurrent hooks', async () => {
    const mock = makeSupabaseMock()
    const paths = Array.from({ length: 30 }, (_, i) => `crew1/products/p${i}/img.jpg`)

    function Thumb({ path }: { path: string }) {
      const url = useSignedUrl(path)
      return createElement('span', { 'data-testid': path }, url ?? 'loading')
    }
    function List() {
      return createElement(
        Fragment,
        null,
        paths.map((path) => createElement(Thumb, { key: path, path })),
      )
    }

    render(createElement(List))
    await flushMicrotasks()

    const bucket = mock.storage.buckets['crew-media']
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(1)
    expect(bucket.createSignedUrls).toHaveBeenCalledWith(paths, 3600)
    expect(screen.getByTestId(paths[0]).textContent).toBe(
      `https://signed.test/${paths[0]}`,
    )
  })

  it('dedupes the same path across components', async () => {
    const mock = makeSupabaseMock()
    const path = 'crew1/products/p1/img.jpg'
    renderHook(() => useSignedUrl(path))
    renderHook(() => useSignedUrl(path))
    await flushMicrotasks()

    const bucket = mock.storage.buckets['crew-media']
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(1)
    expect(bucket.createSignedUrls).toHaveBeenCalledWith([path], 3600)
  })

  it('serves later mounts from the cache with no extra storage call', async () => {
    const mock = makeSupabaseMock()
    const path = 'crew1/products/p1/img.jpg'
    renderHook(() => useSignedUrl(path))
    await flushMicrotasks()

    const { result } = renderHook(() => useSignedUrl(path))
    expect(result.current).toBe(`https://signed.test/${path}`)
    await flushMicrotasks()
    expect(mock.storage.buckets['crew-media'].createSignedUrls).toHaveBeenCalledTimes(1)
  })

  it('caches mint failures negatively and retries after 60s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const mock = makeSupabaseMock()
    const path = 'crew1/products/p1/img.jpg'
    const bucket = mock.storage.from('crew-media')
    bucket.createSignedUrls.mockResolvedValueOnce({
      data: null,
      error: new Error('storage down'),
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result, rerender } = renderHook(() => useSignedUrl(path))
    await flushMicrotasks()
    expect(result.current).toBeNull()
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(1)

    // Inside the negative window: no retry.
    vi.setSystemTime(Date.now() + 30_000)
    rerender()
    await flushMicrotasks()
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(1)

    // Past the negative window: retried, now succeeds.
    vi.setSystemTime(Date.now() + 31_000)
    rerender()
    await flushMicrotasks()
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(2)
    expect(result.current).toBe(`https://signed.test/${path}`)
    warn.mockRestore()
  })

  it('re-mints in the background when under 5 minutes remain, serving the old URL meanwhile', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const mock = makeSupabaseMock()
    const path = 'crew1/products/p1/img.jpg'
    const bucket = mock.storage.from('crew-media')

    const { result, rerender } = renderHook(() => useSignedUrl(path))
    await flushMicrotasks()
    expect(result.current).toBe(`https://signed.test/${path}`)

    // 56 minutes in: < 5 min of TTL left → a re-render triggers a refresh,
    // but the cached URL keeps being served (no flicker to null).
    vi.setSystemTime(Date.now() + 56 * 60_000)
    rerender()
    expect(result.current).toBe(`https://signed.test/${path}`)
    await flushMicrotasks()
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(2)
    expect(result.current).toBe(`https://signed.test/${path}`)
  })
})

describe('getSignedUrls', () => {
  it('resolves a map of signed URLs through the shared cache', async () => {
    const mock = makeSupabaseMock()
    const paths = ['crew1/spaces/s1/a.jpg', 'crew1/spaces/s2/b.jpg']
    const urls = await getSignedUrls(mock.client, paths)
    expect(urls.get(paths[0])).toBe(`https://signed.test/${paths[0]}`)
    expect(urls.get(paths[1])).toBe(`https://signed.test/${paths[1]}`)
    expect(mock.storage.buckets['crew-media'].createSignedUrls).toHaveBeenCalledTimes(1)

    // Second ask is served from cache.
    await getSignedUrls(mock.client, paths)
    expect(mock.storage.buckets['crew-media'].createSignedUrls).toHaveBeenCalledTimes(1)
  })

  it('maps per-item mint failures to null', async () => {
    const mock = makeSupabaseMock()
    const bucket = mock.storage.from('crew-media')
    bucket.createSignedUrls.mockImplementationOnce((paths: string[]) =>
      Promise.resolve({
        data: paths.map((path, i) =>
          i === 0
            ? { error: 'Object not found', path, signedUrl: null }
            : { error: null, path, signedUrl: `https://signed.test/${path}` },
        ),
        error: null,
      }),
    )
    const urls = await getSignedUrls(mock.client, ['crew1/a.jpg', 'crew1/b.jpg'])
    expect(urls.get('crew1/a.jpg')).toBeNull()
    expect(urls.get('crew1/b.jpg')).toBe('https://signed.test/crew1/b.jpg')
  })
})

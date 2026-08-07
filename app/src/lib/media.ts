// Crew-scoped media: upload lifecycle + signed-URL resolution for the
// private `crew-media` bucket. Design: docs/cross-cutting/Media Storage.md.
//
// Image columns are dual-mode: a full external http(s) URL (master
// catalog, server-written) renders directly; anything else is a
// `crew-media` storage path that needs a short-lived signed URL. The
// signed-URL layer below batches every path requested in one render pass
// into a single `createSignedUrls` call via a module-level cache, so
// list surfaces need no wiring beyond rendering a thumb component.

import { useEffect, useSyncExternalStore } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useSupabase } from '@/lib/supabase'
import { downscaleToBlob } from '@/lib/downscale'

export const CREW_MEDIA_BUCKET = 'crew-media'

export type MediaDomain = 'products' | 'waste' | 'spaces'

export type ImageSrc =
  | { kind: 'external'; url: string }
  | { kind: 'path'; path: string }

/** Dual-mode resolver for image columns (`products.image_url` etc.). */
export function resolveImageSrc(
  value: string | null | undefined,
): ImageSrc | null {
  if (!value) return null
  if (/^https?:\/\//.test(value)) return { kind: 'external', url: value }
  return { kind: 'path', path: value }
}

/**
 * Downscale (1500 px longest edge, JPEG q0.8) and upload a crew image.
 * Returns the storage path `<crewId>/<domain>/[<entityId>/]<uuid>.jpg`.
 */
export async function uploadCrewImage(
  supabase: SupabaseClient,
  crewId: string,
  domain: MediaDomain,
  file: File,
  entityId?: string,
): Promise<string> {
  const blob = await downscaleToBlob(file)
  const segments = [crewId, domain, entityId, `${crypto.randomUUID()}.jpg`]
  const path = segments.filter(Boolean).join('/')
  const { error } = await supabase.storage
    .from(CREW_MEDIA_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

/**
 * Best-effort delete for the replace/remove flows. A failure leaves an
 * orphaned object (accepted in v1) — warn, never throw.
 */
export async function deleteCrewImage(
  supabase: SupabaseClient,
  path: string,
): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(CREW_MEDIA_BUCKET)
      .remove([path])
    if (error) throw error
  } catch (err) {
    console.warn(`crew-media: could not delete ${path} (orphan kept)`, err)
  }
}

// ------------------------------------------------------------------
// Signed-URL cache. Module-level so every consumer shares one map and
// one in-flight batch. `url: null` entries are negative (mint failed);
// they suppress retries for NEGATIVE_TTL_MS.
// ------------------------------------------------------------------

const TTL_SECONDS = 3600
const REFRESH_MARGIN_MS = 5 * 60_000
const NEGATIVE_TTL_MS = 60_000

interface CacheEntry {
  url: string | null
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const listeners = new Set<() => void>()
let pending = new Set<string>()
let inFlight = new Map<string, Promise<void>>()
let flushScheduled = false
let flushClient: SupabaseClient | null = null
let batchDeferred: { promise: Promise<void>; resolve: () => void } | null = null

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Serve from cache while the entry is alive, even during a re-mint. */
function readCache(path: string): string | null {
  const entry = cache.get(path)
  if (!entry || entry.expiresAt <= Date.now()) return null
  return entry.url
}

function needsMint(path: string): boolean {
  if (inFlight.has(path)) return false
  const entry = cache.get(path)
  if (!entry) return true
  if (entry.url === null) return entry.expiresAt <= Date.now()
  return entry.expiresAt - Date.now() < REFRESH_MARGIN_MS
}

/** Queue a path for the next microtask flush (one storage call per pass). */
function ensureSigned(supabase: SupabaseClient, path: string): Promise<void> {
  const existing = inFlight.get(path)
  if (existing) return existing
  if (!needsMint(path)) return Promise.resolve()

  if (!batchDeferred) {
    let resolve!: () => void
    const promise = new Promise<void>((r) => {
      resolve = r
    })
    batchDeferred = { promise, resolve }
  }
  pending.add(path)
  inFlight.set(path, batchDeferred.promise)
  flushClient = supabase
  if (!flushScheduled) {
    flushScheduled = true
    queueMicrotask(flush)
  }
  return batchDeferred.promise
}

async function flush(): Promise<void> {
  const paths = [...pending]
  const supabase = flushClient
  const deferred = batchDeferred
  pending = new Set()
  flushScheduled = false
  flushClient = null
  batchDeferred = null
  if (!paths.length || !supabase) {
    deferred?.resolve()
    return
  }

  try {
    const { data, error } = await supabase.storage
      .from(CREW_MEDIA_BUCKET)
      .createSignedUrls(paths, TTL_SECONDS)
    if (error) throw error
    const byPath = new Map(data?.map((item) => [item.path, item]) ?? [])
    const now = Date.now()
    for (const path of paths) {
      const item = byPath.get(path)
      if (item?.signedUrl && !item.error) {
        cache.set(path, { url: item.signedUrl, expiresAt: now + TTL_SECONDS * 1000 })
      } else {
        cache.set(path, { url: null, expiresAt: now + NEGATIVE_TTL_MS })
      }
    }
  } catch (err) {
    console.warn('crew-media: signed-url mint failed', err)
    const expiresAt = Date.now() + NEGATIVE_TTL_MS
    for (const path of paths) {
      cache.set(path, { url: null, expiresAt })
    }
  } finally {
    for (const path of paths) inFlight.delete(path)
    deferred?.resolve()
    notify()
  }
}

/**
 * Resolve a dual-mode image value to something an `<img src>` can use.
 * External URLs resolve synchronously; storage paths go through the
 * batched signed-URL cache (null while loading or on error — callers
 * show their fallback). Expired-but-unrendered URLs are refreshed
 * opportunistically on the next render; a component left mounted and
 * untouched past the TTL keeps its stale URL (accepted in v1).
 */
export function useSignedUrl(value: string | null | undefined): string | null {
  const supabase = useSupabase()
  const resolved = resolveImageSrc(value)
  const path = resolved?.kind === 'path' ? resolved.path : null
  const url = useSyncExternalStore(subscribe, () =>
    path ? readCache(path) : null,
  )
  // Deliberately no dependency array: the refresh-margin check must
  // re-run on every render (a time-based condition no dep can capture).
  // ensureSigned is a couple of Map lookups when the entry is fresh.
  useEffect(() => {
    if (path) void ensureSigned(supabase, path)
  })
  return resolved?.kind === 'external' ? resolved.url : url
}

/**
 * Non-hook batch accessor sharing the same cache and dedupe. Values are
 * signed URLs, or null where minting failed.
 */
export async function getSignedUrls(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Map<string, string | null>> {
  await Promise.all(paths.map((path) => ensureSigned(supabase, path)))
  return new Map(paths.map((path) => [path, readCache(path)]))
}

/** Test-only: wipe the module-level cache and any queued work. */
export function __resetMediaCache(): void {
  cache.clear()
  listeners.clear()
  pending = new Set()
  inFlight = new Map()
  flushScheduled = false
  flushClient = null
  batchDeferred = null
}
